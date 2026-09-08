import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Seev Plus webhook handler.
// - Verifies HMAC signature against the RAW body before parsing.
// - 401 on bad signature with zero side effects.
// - Deduplicates on data.transaction.reference (event IDs change on replay).
// - Webhook amounts are MAJOR units — converted to pesewas before comparing.
// - 404/unknown mappings are acknowledged (2xx) without side effects;
//   verify-on-callback remains the fallback fulfilment path.
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

  const secret = Deno.env.get('SEEVPLUS_WEBHOOK_SECRET')
  if (!secret) {
    return new Response(JSON.stringify({ error: 'webhook not configured' }), { status: 500, headers: JSON_HEADERS })
  }

  // Raw body FIRST — re-serializing breaks the digest.
  const rawBody = await req.text()
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

  let event: { id?: string; event?: string; env?: string; data?: { transaction?: {
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

  // Optional environment enforcement (set SEEVPLUS_WEBHOOK_ENV to sandbox/production).
  const expectedEnv = Deno.env.get('SEEVPLUS_WEBHOOK_ENV')
  if (expectedEnv && event.env && event.env !== expectedEnv) {
    return new Response('Wrong environment', { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const isSuccess = event.event === 'payment.succeeded' || tx.status === 'completed'
  if (!isSuccess) {
    // payment.failed / cancelled / anything else: keep the order unpaid,
    // acknowledge so the delivery is recorded as delivered.
    return new Response(JSON.stringify({ received: true }), { headers: JSON_HEADERS })
  }

  // Resolve our order via the meta we sent at session creation.
  const orderId = tx.metadata?.developer?.orderId ?? tx.metadata?.orderId ?? tx.meta?.orderId ?? null
  if (!orderId) {
    console.warn('[seevplus-webhook] succeeded event with no orderId in meta', tx.reference)
    return new Response(JSON.stringify({ received: true, unmapped: true }), { headers: JSON_HEADERS })
  }

  const { data: order } = await supabase.from('orders').select('id, total_amount, customer_id').eq('id', orderId).single()
  if (!order) {
    console.warn('[seevplus-webhook] order not found', orderId)
    return new Response(JSON.stringify({ received: true, unmapped: true }), { headers: JSON_HEADERS })
  }

  // Webhook amount is MAJOR units — convert to pesewas before comparing.
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

  await supabase.from('order_updates').insert({
    order_id: orderId,
    title: 'Payment verified',
    message: `Seev Plus payment verified: ${tx.reference} for GH₵${order.total_amount}`,
    customer_visible: true,
  })

  return new Response(JSON.stringify({ received: true }), { headers: JSON_HEADERS })
})
