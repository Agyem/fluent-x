import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import Placeholder from '../components/Placeholder'
import { MOMO_CONFIG } from '../lib/momoConfig'
import { SHIPPING_OPTIONS, getShippingFee, getExpectedDeliveryDate, type ShippingMethod } from '../lib/shipping'
import { Package, Truck, CreditCard } from 'lucide-react'

export default function Checkout() {
  const { user, profile } = useAuth()
  const { items, subtotal: displaySubtotal, clear } = useCart()
  const navigate = useNavigate()
  const [step, _setStep] = useState(1)
  const [paymentMethod, setPaymentMethod] = useState<'momo' | ''>('')
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod | ''>('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasClaimedPayment, setHasClaimedPayment] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase.from('customer_profiles').select('delivery_address').eq('profile_id', user.id).single().then(({ data }) => {
      if (data?.delivery_address) setDeliveryAddress(String(data.delivery_address))
    })
  }, [user])

  if (!user) {
    return (
      <div style={{ maxWidth: 440, margin: '0 auto', textAlign: 'center', padding: '50px 20px' }}>
        <div className="confirm-icon"><Package /></div>
        <h1 style={{ fontSize: 18, fontWeight: 700 }}>Checkout</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 8 }}>Please log in to checkout.</p>
        <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'center' }}>
          <Link to="/login" state={{ from: '/checkout' }} className="btn primary">Log in</Link>
          <Link to="/register" className="btn">Create account</Link>
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div style={{ maxWidth: 440, margin: '0 auto' }}>
        <Placeholder title="Cart empty" desc="Add items to your cart before checking out." />
        <Link to="/catalogue" className="btn primary" style={{ marginTop: 16 }}>Browse catalogue</Link>
      </div>
    )
  }

  const shippingFee = shippingMethod ? getShippingFee(shippingMethod as ShippingMethod) : 0

  const handlePlaceOrder = async () => {
    setError(null)
    if (!paymentMethod) { setError('Please select a payment method.'); return }
    if (!shippingMethod) { setError('Please select a delivery method.'); return }
    if (!deliveryAddress.trim()) { setError('Please provide a delivery address.'); return }

    setPlacing(true)
    try {
      type ValidatedItem = { variant_id: string; product_id: string; quantity: number; unit_price: number }
      const validated: ValidatedItem[] = []
      let authoritativeSubtotal = 0

      for (const cartItem of items) {
        const { data: variant, error: vErr } = await supabase.from('product_variants').select('id, product_id, price, sale_price, active').eq('id', cartItem.variant_id).eq('active', true).single()
        if (vErr || !variant) throw new Error(`Variant unavailable: ${cartItem.product_name} — ${cartItem.variant_name ?? ''}`)
        const { data: product, error: pErr } = await supabase.from('products').select('id, active').eq('id', variant.product_id).eq('active', true).single()
        if (pErr || !product) throw new Error(`Product unavailable: ${cartItem.product_name} is no longer active`)
        const { data: inv, error: invErr } = await supabase.from('inventory').select('available').eq('variant_id', variant.id).single()
        if (invErr || inv == null) throw new Error(`Inventory data missing for ${cartItem.product_name}`)
        if (inv.available < cartItem.quantity) throw new Error(`Insufficient stock for ${cartItem.product_name}: requested ${cartItem.quantity}, available ${inv.available}`)
        const authoritativePrice = variant.sale_price ?? variant.price
        if (authoritativePrice == null) throw new Error(`Price missing for ${cartItem.product_name}`)
        validated.push({ variant_id: variant.id, product_id: variant.product_id, quantity: cartItem.quantity, unit_price: authoritativePrice })
        authoritativeSubtotal += authoritativePrice * cartItem.quantity
      }

      const fee = getShippingFee(shippingMethod as ShippingMethod)
      const finalTotal = authoritativeSubtotal + fee

      const { data: order, error: oErr } = await supabase.from('orders').insert({
        customer_id: user.id,
        status: 'pending',
        total_amount: finalTotal,
      }).select('id, order_number').single()
      if (oErr || !order) throw new Error(oErr?.message ?? 'Failed to create order')

      const itemsToInsert = validated.map(v => ({
        order_id: order.id,
        product_id: v.product_id,
        variant_id: v.variant_id,
        quantity: v.quantity,
        unit_price: v.unit_price,
      }))
      const { error: itemsErr } = await supabase.from('order_items').insert(itemsToInsert)
      if (itemsErr) throw new Error(`Order created (${order.order_number}) but items failed: ${itemsErr.message}`)

      const expectedDate = getExpectedDeliveryDate(shippingMethod as ShippingMethod)
      const { error: delErr } = await supabase.from('deliveries').insert({
        order_id: order.id,
        method: shippingMethod,
        expected_delivery_date: expectedDate,
        delivery_address: deliveryAddress.trim(),
        status: 'pending',
      })
      if (delErr) console.warn('[checkout] deliveries insert failed:', delErr.message)

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
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 23, fontWeight: 700, marginBottom: 20 }}>Checkout</h1>

      <div className="checkout-steps">
        <div className={`co-step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'done' : ''}`}>
          <div className="co-num">{step > 1 ? '✓' : '1'}</div>
          <span className="co-label">Address</span>
        </div>
        <div className="co-connector" />
        <div className={`co-step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'done' : ''}`}>
          <div className="co-num">{step > 2 ? '✓' : '2'}</div>
          <span className="co-label">Shipping</span>
        </div>
        <div className="co-connector" />
        <div className={`co-step ${step >= 3 ? 'active' : ''} ${step > 3 ? 'done' : ''}`}>
          <div className="co-num">3</div>
          <span className="co-label">Payment</span>
        </div>
      </div>

      <div className="card" style={{ padding: 18, marginBottom: 14 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Account</h3>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{profile?.full_name ?? user.email} · {profile?.email ?? user.email}</div>
      </div>

      <div className="card" style={{ padding: 18, marginBottom: 14 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Delivery address</h3>
        <input
          value={deliveryAddress}
          onChange={e => setDeliveryAddress(e.target.value)}
          placeholder="Enter delivery address (e.g. UCC Main Campus, Hall...)"
          style={{ width: '100%', border: '1px solid var(--border-strong)', borderRadius: 9, padding: '9px 12px', fontSize: 13, outline: 'none', background: 'var(--surface)', color: 'var(--text)' }}
        />
      </div>

      <div className="card" style={{ padding: 18, marginBottom: 14 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Review items ({items.length})</h3>
        {items.map(i => (
          <div key={i.variant_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
            <span>{i.product_name} — {i.variant_name ?? 'Default'} ×{i.quantity}</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>GH₵ {(i.unit_price * i.quantity).toFixed(2)}</span>
          </div>
        ))}
        <div style={{ marginTop: 12 }}>
          <div className="co-summary-row"><span>Subtotal</span><span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>GH₵ {displaySubtotal.toFixed(2)}</span></div>
          <div className="co-summary-row"><span>Shipping {selectedShipping ? `(${selectedShipping.label})` : ''}</span><span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{shippingMethod ? `GH₵ ${shippingFee}` : '—'}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>
            <span>Total</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>GH₵ {(displaySubtotal + shippingFee).toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 18, marginBottom: 14 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Delivery method</h3>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Select how you want your order delivered.</p>
        {(['air', 'sea'] as const).map(m => {
          const opt = SHIPPING_OPTIONS[m]
          const selected = shippingMethod === m
          return (
            <div key={m} className={`pay-option ${selected ? 'selected' : ''}`} onClick={() => setShippingMethod(m)}>
              <div className="pay-icon"><Truck style={{ width: 18, height: 18, color: 'var(--primary)' }} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{opt.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{opt.estimate}</div>
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 13 }}>GH₵ {opt.fee}</div>
            </div>
          )
        })}
      </div>

      <div className="card" style={{ padding: 18, marginBottom: 14 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Payment method</h3>
        <div className={`pay-option ${paymentMethod === 'momo' ? 'selected' : ''}`} onClick={() => setPaymentMethod('momo')}>
          <div className="pay-icon"><CreditCard style={{ width: 18, height: 18, color: 'var(--primary)' }} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>Mobile Money — Manual</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Pending admin verification</div>
          </div>
        </div>
        {paymentMethod === 'momo' && (
          <div style={{ marginTop: 12, background: 'var(--warning-light)', borderRadius: 12, padding: 16, border: '1px solid var(--warning)' }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Pay with Mobile Money</h4>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>Send the <strong>exact final total</strong> to Cartiva MoMo.</p>
            <div style={{ marginTop: 10, background: 'var(--surface)', borderRadius: 10, padding: 12, border: '1px solid var(--border)', fontSize: 13 }}>
              <div className="co-summary-row"><span>Network:</span><span style={{ fontWeight: 600 }}>{MOMO_CONFIG.network ?? '[Not configured]'}</span></div>
              <div className="co-summary-row"><span>Account Name:</span><span style={{ fontWeight: 600 }}>{MOMO_CONFIG.accountName ?? '[Not configured]'}</span></div>
              <div className="co-summary-row"><span>Number:</span><span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>{MOMO_CONFIG.accountNumber ?? '[Not configured]'}</span></div>
              <div className="co-summary-row"><span>Amount:</span><span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700 }}>GH₵ {(displaySubtotal + shippingFee).toFixed(2)}</span></div>
              <div className="co-summary-row"><span>Reference:</span><span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>CARTIVA-ORDER-ID</span></div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, cursor: 'pointer', fontSize: 13 }}>
              <input type="checkbox" checked={hasClaimedPayment} onChange={e => setHasClaimedPayment(e.target.checked)} />
              <span>I have made the payment</span>
            </label>
          </div>
        )}
      </div>

      {error && <div style={{ background: 'var(--danger-light)', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: 12, padding: '10px 16px', fontSize: 13, marginBottom: 14 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <Link to="/cart" className="btn">Back to cart</Link>
        <button onClick={handlePlaceOrder} disabled={placing} className="btn primary block" style={{ flex: 1 }}>
          {placing ? 'Placing order...' : `Place Order — GH₵ ${(displaySubtotal + shippingFee).toFixed(2)}`}
        </button>
      </div>
    </div>
  )
}
