import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Creates a Seev Plus Checkout API session server-side.
// The secret key NEVER leaves the server (Deno.env SEEVPLUS_SECRET_KEY).
// Amounts are integers in pesewas (GHS smallest unit).

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
    const seevSecret = Deno.env.get('SEEVPLUS_SECRET_KEY')

    if (!seevSecret) {
      throw new Error('SEEVPLUS_SECRET_KEY not configured')
    }

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing authorization')

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error('Unauthorized')

    const { order_id, redirect_url } = await req.json()

    if (!order_id || !redirect_url) {
      throw new Error('Missing required fields: order_id, redirect_url')
    }

    // Verify order belongs to user and get authoritative total (prevent manipulation)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, total_amount, customer_id')
      .eq('id', order_id)
      .eq('customer_id', user.id)
      .single()

    if (orderError || !order) throw new Error('Order not found or not owned by user')

    // Line items for the Seev session (per-unit prices in pesewas)
    const { data: items } = await supabase
      .from('order_items')
      .select('quantity, unit_price, products(name)')
      .eq('order_id', order_id)

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single()

    const totalPesewas = Math.round(Number(order.total_amount) * 100)

    const seevItems = (items ?? []).map((it: { quantity: number; unit_price: number; products?: { name: string }[] }) => ({
      name: it.products?.[0]?.name ?? 'Cartiva item',
      quantity: it.quantity,
      price: Math.round(Number(it.unit_price) * 100),
    }))

    const res = await fetch('https://api.seevplus.com/api/v1/developer/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${seevSecret}`,
        'Idempotency-Key': `cartiva-${order_id}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'checkout',
        recipient: {
          name: profile?.full_name ?? user.email ?? 'Cartiva customer',
          email: profile?.email ?? user.email ?? '',
        },
        ...(seevItems.length > 0 ? { items: seevItems } : { amount: totalPesewas }),
        currency: 'GHS',
        channels: ['mobile_money'],
        redirect_url,
        meta: { orderId: order_id },
      }),
    })

    const payload = await res.json()

    if (res.status !== 201) {
      throw new Error(payload.error ?? payload.message ?? 'Seev Plus session creation failed')
    }

    return new Response(
      JSON.stringify({
        checkout_url: payload.data.checkout_url,
        reference: payload.data.reference,
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
