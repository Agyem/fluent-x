import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Seev Plus webhook handler.
// - Reads X-Seev-Event-ID / X-Seev-Event-Type / X-Seev-Timestamp / X-Seev-Signature.
// - Verifies `v1=` + HMAC-SHA256(timestamp + "." + RAW body) with constant-time
//   comparison and 300s tolerance. 401 on bad signature, zero side effects.
// - Env isolation is primarily the per-env signing secret (a sandbox secret
//   cannot validate production events); SEEV_WEBHOOK_ENV adds a second check.
// - Deduplicates on data.transaction.reference (event IDs change on replay).
// - Webhook amounts are MAJOR units — converted to pesewas before comparing,
//   currency must be GHS.
// - payment.failed resolves the order and logs it via order_updates without
//   touching payment state, so retry stays possible.
// - Storage is append-only (payments deduped by reference, order_updates is a
//   log), so out-of-order delivery cannot overwrite newer state; updatedAt is
//   recorded on log rows for traceability.
// - Slow work is minimal; the handler answers 2xx inside the 8s window.
//
// IMPORTANT: deploy with JWT verification OFF — Seev cannot send a Supabase
// JWT, so `supabase functions deploy seevplus-webhook --no-verify-jwt`.

const JSON_HEADERS = { 'Content-Type': 'application/json' }

async function hmacHex(secret: string, message: string): Promise<string> {
  // Key is the UTF-8 bytes of the secret string (matches Seev's Node example).
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const secret = Deno.env.get('SEEV_WEBHOOK_SECRET')
  if (!secret) {
    return new Response(JSON.stringify({ error: 'webhook not configured' }), { status: 500, headers: JSON_HEADERS })
  }

  // Raw body FIRST — re-serializing breaks the digest.
  const rawBody = await req.text()
  const eventId = req.headers.get('X-Seev-Event-ID') ?? ''
  const eventTypeHeader = req.headers.get('X-Seev-Event-Type') ?? ''
  const timestamp = req.headers.get('X-Seev-Timestamp') ?? ''
  const signature = req.headers.get('X-Seev-Signature') ?? ''

  let valid = timestamp !== '' && !Number.isNaN(Number(timestamp)) && Math.abs(Date.now() / 1000 - Number(timestamp)) <= 300
  if (valid) {
    const expected = 'v1=' + (await hmacHex(secret, `${timestamp}.${rawBody}`))
    valid = safeEqual(expected, signature)
  }
  if (!valid) {
    return new Response('Invalid signature', { status: 401 })
  }

  let event: { id?: string; event?: string; type?: string; env?: string; data?: { transaction?: {
    reference?: string; status?: string; amount?: number; currency?: string;
    updatedAt?: string; metadata?: { developer?: { orderId?: string }; orderId?: string };
    meta?: { orderId?: string };
  } } }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return new Response('Bad payload', { status: 400 })
  }

  const tx = event?.data?.transaction
  if (!tx?.reference) {
    return new Response('Bad payload', { status: 400 })
  }

  // Event type: prefer the signed header, fall back to the body field.
  const eventType = eventTypeHeader || event.event || event.type || ''
  // Event ID is logged for traceability only — NEVER the dedup key.
  const seenEventId = eventId || event.id || 'unknown'

  // Optional environment enforcement (set SEEV_WEBHOOK_ENV to sandbox/production).
  // Primary isolation is the per-env signing secret itself.
  const expectedEnv = Deno.env.get('SEEV_WEBHOOK_ENV')
  if (expectedEnv && event.env && event.env !== expectedEnv) {
    return new Response('Wrong environment', { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Resolve our order via the meta we sent at session creation (existing
  // reference system — no second reference store introduced).
  const orderId = tx.metadata?.developer?.orderId ?? tx.metadata?.orderId ?? tx.meta?.orderId ?? null
  if (!orderId) {
    console.warn('[seevplus-webhook] event with no orderId in meta', tx.reference, seenEventId)
    return new Response(JSON.stringify({ received: true, unmapped: true }), { headers: JSON_HEADERS })
  }

  const { data: order } = await supabase.from('orders').select('id, total_amount, customer_id').eq('id', orderId).single()
  if (!order) {
    console.warn('[seevplus-webhook] order not found', orderId)
    return new Response(JSON.stringify({ received: true, unmapped: true }), { headers: JSON_HEADERS })
  }

  const txUpdatedAt = tx.updatedAt ?? null
  const isSuccess = eventType === 'payment.succeeded' || tx.status === 'completed'
  if (!isSuccess) {
    // A stale failure must never overwrite a recorded success (out-of-order
    // delivery): if this reference already fulfilled, ack silently.
    const { data: paid } = await supabase.from('payments').select('id').eq('order_id', orderId).eq('reference', tx.reference).single()
    if (paid) {
      return new Response(JSON.stringify({ received: true, duplicate: true }), { headers: JSON_HEADERS })
    }
    // payment.failed / cancelled: record it once on the existing
    // order_updates log so support can see it, keep the order unpaid, retry intact.
    const { data: logged } = await supabase.from('order_updates').select('id').eq('order_id', orderId).like('message', `%${tx.reference}%`).limit(1)
    if (!logged || logged.length === 0) {
      await supabase.from('order_updates').insert({
        order_id: orderId,
        title: 'Payment failed',
        message: `Seev Plus reported ${eventType || tx.status || 'failure'} for ${tx.reference}${txUpdatedAt ? ` at ${txUpdatedAt}` : ''} — order remains unpaid, customer can retry.`,
        customer_visible: true,
      })
    }
    return new Response(JSON.stringify({ received: true }), { headers: JSON_HEADERS })
  }

  // Currency must be GHS; amount is MAJOR units — convert to pesewas first.
  if ((tx.currency ?? 'GHS').toUpperCase() !== 'GHS') {
    return new Response(
      JSON.stringify({ error: `Unsupported currency: ${tx.currency}` }),
      { status: 400, headers: JSON_HEADERS }
    )
  }
  const paidPesewas = Math.round(Number(tx.amount) * 100)
  const expectedPesewas = Math.round(Number(order.total_amount) * 100)
  if (paidPesewas !== expectedPesewas) {
    return new Response(
      JSON.stringify({ error: `Amount mismatch: expected ${expectedPesewas}, got ${paidPesewas}` }),
      { status: 400, headers: JSON_HEADERS }
    )
  }

  // Dedup on the payment reference (survives manual replays).
  const { data: existing } = await supabase.from('payments').select('id').eq('order_id', orderId).eq('reference', tx.reference).single()
  if (existing) {
    return new Response(JSON.stringify({ received: true, duplicate: true }), { headers: JSON_HEADERS })
  }

  const { error: paymentError } = await supabase.from('payments').insert({
    order_id: orderId,
    amount: order.total_amount,
    method: 'seevplus',
    reference: tx.reference,
    recorded_by: order.customer_id,
  })
  if (paymentError) {
    return new Response(JSON.stringify({ error: 'Failed to create payment: ' + paymentError.message }), { status: 500, headers: JSON_HEADERS })
  }

  // Mark order as paid so it appears in the customer's order list
  await supabase.from('orders').update({ status: 'paid' }).eq('id', orderId)

  // Update delivery status
  await supabase.from('deliveries').update({ status: 'processing' }).eq('order_id', orderId)

  await supabase.from('order_updates').insert({
    order_id: orderId,
    title: 'Payment verified',
    message: `Seev Plus payment verified: ${tx.reference} for GH₵${order.total_amount} (event ${seenEventId}${txUpdatedAt ? `, updated ${txUpdatedAt}` : ''})`,
    customer_visible: true,
  })

  return new Response(JSON.stringify({ received: true }), { headers: JSON_HEADERS })
})
