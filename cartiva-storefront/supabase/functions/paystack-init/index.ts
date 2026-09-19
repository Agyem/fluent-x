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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const paystackSecret = Deno.env.get('PAYSTACK_SECRET_KEY')
    
    if (!paystackSecret) {
      throw new Error('PAYSTACK_SECRET_KEY not configured')
    }

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing authorization')
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error('Unauthorized')

    const { amount, order_id, email } = await req.json()
    
    if (!amount || !order_id || !email) {
      throw new Error('Missing required fields: amount, order_id, email')
    }

    // Verify order belongs to user and get authoritative amount
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, total_amount, customer_id')
      .eq('id', order_id)
      .eq('customer_id', user.id)
      .single()
    
    if (orderError || !order) throw new Error('Order not found or not owned by user')
    
    // Verify amount matches authoritative total (prevent manipulation)
    if (Number(order.total_amount) !== Number(amount)) {
      throw new Error(`Amount mismatch: expected ${order.total_amount}, got ${amount}`)
    }

    // Initialize Paystack transaction
    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paystackSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: Math.round(amount * 100), // Paystack expects kobo
        reference: `CARTIVA-${order_id}-${Date.now()}`,
        metadata: {
          order_id,
          customer_id: user.id,
        },
      }),
    })

    const paystackData = await paystackRes.json()
    
    if (!paystackData.status) {
      throw new Error(paystackData.message || 'Paystack initialization failed')
    }

    return new Response(
      JSON.stringify({
        authorization_url: paystackData.data.authorization_url,
        access_code: paystackData.data.access_code,
        reference: paystackData.data.reference,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
