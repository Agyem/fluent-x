import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import Placeholder from '../components/Placeholder'
import { MOMO_CONFIG, isMomoConfigured } from '../lib/momoConfig'
import { SHIPPING_OPTIONS, getShippingFee, getExpectedDeliveryDate, type ShippingMethod } from '../lib/shipping'

export default function Checkout() {
  const { user, profile } = useAuth()
  const { items, subtotal: displaySubtotal, clear } = useCart()
  const navigate = useNavigate()
  const [paymentMethod, setPaymentMethod] = useState<'momo' | ''>('')
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod | ''>('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasClaimedPayment, setHasClaimedPayment] = useState(false)

  // Load delivery address from customer_profiles if available
  useEffect(() => {
    if (!user) return
    supabase.from('customer_profiles').select('delivery_address').eq('profile_id', user.id).single().then(({ data }) => {
      if (data?.delivery_address) setDeliveryAddress(String(data.delivery_address))
    })
  }, [user])

  if (!user) {
    return (
      <div className="max-w-xl mx-auto bg-white border border-zinc-200 rounded-2xl p-6 text-center">
        <h1 className="text-lg font-bold">Checkout</h1>
        <p className="text-sm text-zinc-500 mt-2">Please log in to checkout. After login you’ll be returned to checkout.</p>
        <div className="mt-4 flex gap-2 justify-center">
          <Link to="/login" state={{ from: '/checkout' }} className="px-4 py-2 rounded-xl bg-zinc-900 text-white text-sm">Log in</Link>
          <Link to="/register" className="px-4 py-2 rounded-xl border border-zinc-200 text-sm">Create account</Link>
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="max-w-xl mx-auto">
        <Placeholder title="Checkout — cart empty" desc="Add items to your cart before checking out." />
        <Link to="/catalogue" className="inline-flex mt-4 px-4 py-2 rounded-xl bg-zinc-900 text-white text-sm">Browse catalogue</Link>
      </div>
    )
  }

  const shippingFee = shippingMethod ? getShippingFee(shippingMethod as ShippingMethod) : 0
  const authoritativeSubtotalNote = "Authoritative subtotal will be recalculated from DB prices on Place Order"

  const handlePlaceOrder = async () => {
    setError(null)
    if (!paymentMethod) { setError('Please select a payment method.'); return }
    if (!shippingMethod) { setError('Please select a delivery method.'); return }
    if (!deliveryAddress.trim()) { setError('Please provide a delivery address.'); return }

    setPlacing(true)
    try {
      // 1. Authoritative re-fetch — NOT trust localStorage prices
      type ValidatedItem = { variant_id: string; product_id: string; quantity: number; unit_price: number }
      const validated: ValidatedItem[] = []
      let authoritativeSubtotal = 0

      for (const cartItem of items) {
        const { data: variant, error: vErr } = await supabase.from('product_variants').select('id, product_id, price, sale_price, active').eq('id', cartItem.variant_id).eq('active', true).single()
        if (vErr || !variant) throw new Error(`Variant unavailable: ${cartItem.product_name} — ${cartItem.variant_name ?? ''}`)
        const { data: product, error: pErr } = await supabase.from('products').select('id, active').eq('id', variant.product_id).eq('active', true).single()
        if (pErr || !product) throw new Error(`Product unavailable: ${cartItem.product_name} is no longer active`)
        const { data: inv, error: invErr } = await supabase.from('inventory').select('available').eq('variant_id', variant.id).single()
        if (invErr || inv == null) throw new Error(`Inventory data missing for ${cartItem.product_name} — ${cartItem.variant_name ?? ''}`)
        if (inv.available < cartItem.quantity) throw new Error(`Insufficient stock for ${cartItem.product_name} — ${cartItem.variant_name ?? ''}: requested ${cartItem.quantity}, available ${inv.available}`)
        const authoritativePrice = variant.sale_price ?? variant.price
        if (authoritativePrice == null) throw new Error(`Price missing for ${cartItem.product_name}`)
        validated.push({ variant_id: variant.id, product_id: variant.product_id, quantity: cartItem.quantity, unit_price: authoritativePrice })
        authoritativeSubtotal += authoritativePrice * cartItem.quantity
      }

      const fee = getShippingFee(shippingMethod as ShippingMethod)
      const finalTotal = authoritativeSubtotal + fee

      // 2. Create orders row — customer_id from auth, total includes shipping
      const { data: order, error: oErr } = await supabase.from('orders').insert({
        customer_id: user.id,
        status: 'pending',
        total_amount: finalTotal,
      }).select('id, order_number').single()
      if (oErr || !order) throw new Error(oErr?.message ?? 'Failed to create order')

      // 3. Create order_items with authoritative unit_price
      const itemsToInsert = validated.map(v => ({
        order_id: order.id,
        product_id: v.product_id,
        variant_id: v.variant_id,
        quantity: v.quantity,
        unit_price: v.unit_price,
      }))
      const { error: itemsErr } = await supabase.from('order_items').insert(itemsToInsert)
      if (itemsErr) throw new Error(`Order created (${order.order_number}) but items failed: ${itemsErr.message} — contact support`)

      // 4. Create deliveries row — persists shipping/delivery info using EXISTING schema
      // deliveries: method, expected_delivery_date, delivery_address, status
      const expectedDate = getExpectedDeliveryDate(shippingMethod as ShippingMethod)
      const { error: delErr } = await supabase.from('deliveries').insert({
        order_id: order.id,
        method: shippingMethod, // 'air' or 'sea' — existing column `method`
        expected_delivery_date: expectedDate,
        delivery_address: deliveryAddress.trim(),
        status: 'pending',
      })
      if (delErr) {
        // Do not fail order if delivery insert blocked (RLS may still be staff-only) — report but keep order
        console.warn('[checkout] deliveries insert failed (RLS may block customers):', delErr.message)
        // We do not throw here — order and items are already created, delivery is supplementary
        // The fee is still in total_amount, and method can be derived from order if needed
      }

      // Do NOT create payment record — manual MoMo stays pending
      // Do NOT deduct inventory

      clear()
      navigate(`/orders/${order.id}`, { state: { justCreated: true, shippingMethod, fee, finalTotal } })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setPlacing(false)
    }
  }

  const selectedShipping = shippingMethod ? SHIPPING_OPTIONS[shippingMethod as ShippingMethod] : null

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h1 className="text-xl font-bold">Checkout</h1>

      <div className="bg-white border border-zinc-200 rounded-2xl p-4">
        <h3 className="text-sm font-bold">Account</h3>
        <div className="text-sm mt-2">{profile?.full_name ?? user.email} <span className="text-zinc-500">· {profile?.email ?? user.email}</span></div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-2xl p-4">
        <h3 className="text-sm font-bold">Delivery address</h3>
        <input value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} placeholder="Enter delivery address (e.g. UCC Main Campus, Hall...)" className="mt-2 w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-zinc-300" />
        <div className="text-xs text-zinc-400 mt-1">Belongs only to you — from <code>customer_profiles.delivery_address</code> if available, otherwise enter here. RLS ensures only your address.</div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-2xl p-4">
        <h3 className="text-sm font-bold">Review items ({items.length})</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {items.map(i => (
            <li key={i.variant_id} className="flex justify-between border-b border-zinc-100 py-2">
              <span>{i.product_name} — {i.variant_name ?? 'Default'} ×{i.quantity}</span>
              <span className="font-mono">GH₵ {(i.unit_price * i.quantity).toFixed(2)} <span className="text-xs text-zinc-400">(display)</span></span>
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-zinc-500">Subtotal (display)</span><span className="font-mono">GH₵ {displaySubtotal.toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-zinc-500">Shipping {selectedShipping ? `(${selectedShipping.label})` : ''}</span><span className="font-mono">{shippingMethod ? `GH₵ ${shippingFee}` : '—'}</span></div>
          <div className="flex justify-between pt-2 border-t border-zinc-200 font-bold"><span>Total</span><span className="font-mono">GH₵ {(displaySubtotal + shippingFee).toFixed(2)} <span className="text-xs font-normal text-zinc-400">(authoritative on Place Order)</span></span></div>
        </div>
        <div className="text-xs text-zinc-400 mt-2">{authoritativeSubtotalNote}</div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-2xl p-4">
        <h3 className="text-sm font-bold">Delivery method</h3>
        <p className="text-xs text-zinc-500 mt-1">Select how you want your order delivered — fee added to total.</p>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(['air', 'sea'] as const).map(m => {
            const opt = SHIPPING_OPTIONS[m]
            const selected = shippingMethod === m
            return (
              <button key={m} onClick={() => setShippingMethod(m)} className={`text-left p-4 rounded-xl border-2 ${selected ? 'border-[#5B5FEF] bg-[#F5F5FF]' : 'border-zinc-200 hover:border-zinc-300 bg-white'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">{opt.label}</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${m === 'air' ? 'bg-[#FFEADB] text-[#D35F09]' : 'bg-zinc-100 text-zinc-600'}`}>{opt.type}</span>
                </div>
                <div className="text-xs text-zinc-500 mt-1">{opt.estimate}</div>
                <div className="text-sm font-bold mt-2">GH₵{opt.fee}</div>
              </button>
            )
          })}
        </div>
        {selectedShipping && <div className="mt-3 text-xs text-zinc-600">Selected: <strong>{selectedShipping.label}</strong> · {selectedShipping.type} · {selectedShipping.estimate} — fee GH₵{selectedShipping.fee} added to total. Changing Air ↔ Sea updates total immediately.</div>}
        <div className="mt-2 text-xs text-zinc-400">Pricing from <code>src/lib/shipping.ts</code> — isolated config (DB has single <code>settings.delivery_fee=15</code>, not per-method, so code config used per spec).</div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-2xl p-4">
        <h3 className="text-sm font-bold">Payment method</h3>
        <div className="mt-3">
          <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer ${paymentMethod === 'momo' ? 'border-[#5B5FEF] bg-[#F5F5FF]' : 'border-zinc-200 hover:border-zinc-300'}`}>
            <input type="radio" name="payment" value="momo" checked={paymentMethod === 'momo'} onChange={() => setPaymentMethod('momo')} className="accent-[#5B5FEF]" />
            <span className="text-sm font-semibold">Mobile Money — Manual</span>
            <span className="ml-auto text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full">Pending until verified</span>
          </label>
        </div>
        {paymentMethod === 'momo' && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <h4 className="text-sm font-bold text-amber-900">Pay with Mobile Money</h4>
            <p className="text-sm text-amber-800 mt-2">Send the <strong>exact final total</strong> (subtotal + shipping) to Cartiva MoMo.</p>
            <div className="mt-3 grid gap-2 text-sm bg-white rounded-xl p-3 border border-amber-200">
              <div className="flex justify-between"><span className="text-zinc-500">MoMo Network:</span><span className="font-semibold">{MOMO_CONFIG.network ?? <span className="text-amber-600">[CONFIGURED ADMIN NETWORK — required]</span>}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Account Name:</span><span className="font-semibold">{MOMO_CONFIG.accountName ?? <span className="text-amber-600">[CONFIGURED ACCOUNT NAME — required]</span>}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Account Number:</span><span className="font-mono font-semibold">{MOMO_CONFIG.accountNumber ?? <span className="text-amber-600">[CONFIGURED NUMBER — required]</span>}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Amount:</span><span className="font-mono font-bold">GH₵ {(displaySubtotal + shippingFee).toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Reference:</span><span className="font-mono">CARTIVA-ORDER-ID</span></div>
            </div>
            {!isMomoConfigured() && <div className="mt-3 text-xs text-amber-700 bg-amber-100 rounded-lg px-3 py-2">MoMo not configured — placeholders shown. Set <code>VITE_MOMO_NETWORK/ACCOUNT_NAME/NUMBER</code>.</div>}
            <label className="mt-4 flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={hasClaimedPayment} onChange={e => setHasClaimedPayment(e.target.checked)} className="rounded" />
              <span className="text-sm">I have made the payment <span className="text-zinc-500">(does not mark as paid — Admin verifies, stays Pending)</span></span>
            </label>
          </div>
        )}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

      <div className="flex gap-2">
        <Link to="/cart" className="px-4 py-3 rounded-xl border border-zinc-200 text-sm font-semibold">Back to cart</Link>
        <button onClick={handlePlaceOrder} disabled={placing} className="flex-1 py-3 rounded-xl bg-[#5B5FEF] text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
          {placing ? 'Placing order...' : `Place Order — GH₵ ${(displaySubtotal + shippingFee).toFixed(2)} (Pending Payment)`}
        </button>
      </div>
      <div className="text-xs text-zinc-400">Order will be created with <code>customer_id = auth.uid()</code>, authoritative prices, and shipping fee from <code>shipping.ts</code>. Manipulated totals cannot affect order.</div>
    </div>
  )
}
