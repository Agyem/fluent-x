import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Verifies a Seev Plus checkout session server-side.
// Per Seev docs the verify route takes no API key, and a 404/502 is
// NEVER mapped onto a failure — those come back as `unknown` so the
// caller retries instead of marking the order failed.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { reference, order_id } = await req.json()

    if (!reference || !order_id) throw new Error('Missing reference or order_id')

    const verifyRes = await fetch(
      `https://api.seevplus.com/api/v1/developer/payments/${encodeURIComponent(reference)}`
    )
    const payload = await verifyRes.json()

    if (!verifyRes.ok) {
      // 404 (unknown session) and 502 (upstream silent) say nothing about
      // whether the customer was charged — report unknown, never failed.
      return new Response(
        JSON.stringify({ status: 'unknown', order_id, detail: payload.error ?? payload.message ?? 'verification unavailable' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const sessionStatus: string = payload.data?.status ?? 'unknown'

    if (sessionStatus !== 'completed' && sessionStatus !== 'success') {
      // pending / failed / cancelled — report as-is so the UI shows the
      // correct state instead of guessing.
      return new Response(
        JSON.stringify({ status: sessionStatus, order_id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Paid — reconcile against our own order before fulfilment.
    const { data: order } = await supabase.from('orders').select('id, total_amount, customer_id').eq('id', order_id).single()
    if (!order) throw new Error('Order not found')

    const expectedAmount = Math.round(Number(order.total_amount) * 100)
    const paidAmount = payload.data?.amount

    if (paidAmount != null && paidAmount !== expectedAmount) {
      throw new Error(`Amount mismatch: expected ${expectedAmount}, got ${paidAmount}`)
    }

    // Deduplicate on the payment reference (event IDs change on replay).
    const { data: existing } = await supabase.from('payments').select('id').eq('order_id', order_id).eq('reference', reference).single()
    if (existing) {
      return new Response(JSON.stringify({ status: 'already_verified', order_id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Create payment record (service role bypasses RLS)
    const { error: paymentError } = await supabase.from('payments').insert({
      order_id,
      amount: order.total_amount,
      method: 'seevplus',
      reference,
      recorded_by: order.customer_id,
    })

    if (paymentError) throw new Error('Failed to create payment: ' + paymentError.message)

    // Mark order as paid so it appears in the customer's order list
    await supabase.from('orders').update({ status: 'paid' }).eq('id', order_id)

    // Update delivery status
    await supabase.from('deliveries').update({ status: 'processing' }).eq('order_id', order_id)

    await supabase.from('order_updates').insert({
      order_id,
      title: 'Payment verified',
      message: `Seev Plus payment verified: ${reference} for GH₵${order.total_amount}`,
      customer_visible: true,
    })

    return new Response(
      JSON.stringify({ status: 'verified', order_id, amount: order.total_amount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
