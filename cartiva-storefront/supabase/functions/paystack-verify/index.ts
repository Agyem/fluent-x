import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

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
    const paystackSecret = Deno.env.get('PAYSTACK_SECRET_KEY')!

    if (!paystackSecret) throw new Error('PAYSTACK_SECRET_KEY not configured')

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { reference, order_id } = await req.json()
    
    if (!reference || !order_id) throw new Error('Missing reference or order_id')

    // Verify with Paystack
    const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { 'Authorization': `Bearer ${paystackSecret}` },
    })

    const paystackData = await paystackRes.json()

    if (!paystackData.status || paystackData.data.status !== 'success') {
      throw new Error('Payment not successful: ' + (paystackData.data?.gateway_response || 'verification failed'))
    }

    // Verify amount and order
    const { data: order } = await supabase.from('orders').select('id, total_amount').eq('id', order_id).single()
    if (!order) throw new Error('Order not found')

    const expectedAmount = Math.round(Number(order.total_amount) * 100)
    const paidAmount = paystackData.data.amount

    if (paidAmount !== expectedAmount) {
      throw new Error(`Amount mismatch: expected ${expectedAmount}, got ${paidAmount}`)
    }

    // Prevent duplicate processing - check if already paid
    const { data: existing } = await supabase.from('payments').select('id').eq('order_id', order_id).eq('reference', reference).single()
    if (existing) {
      return new Response(JSON.stringify({ status: 'already_verified', order_id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Create payment record (service role bypasses RLS)
    const { error: paymentError } = await supabase.from('payments').insert({
      order_id,
      amount: order.total_amount,
      method: 'paystack',
      reference,
      recorded_by: order.customer_id, // or system
    })

    if (paymentError) throw new Error('Failed to create payment: ' + paymentError.message)

    // Update order status to paid (if column exists, otherwise via order_updates)
    // For now, we don't auto-update status - admin verifies, but we can log
    await supabase.from('order_updates').insert({
      order_id,
      title: 'Payment verified',
      message: `Paystack payment verified: ${reference} for GH₵${order.total_amount}`,
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
