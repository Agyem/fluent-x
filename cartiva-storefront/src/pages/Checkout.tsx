import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import Placeholder from '../components/Placeholder'
import { getExpectedDeliveryDate } from '../lib/shipping'

const CEDI = (n: number) => 'GH₵ ' + n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const MOMO_NUMBER = import.meta.env.VITE_MTN_MOMO_NUMBER as string | undefined ?? '059 000 0000'
const MOMO_NAME = import.meta.env.VITE_MTN_MOMO_NAME as string | undefined ?? 'CARTIVA'

export default function Checkout() {
  const { user, profile } = useAuth()
  const { items, subtotal: displaySubtotal, clear } = useCart()
  const navigate = useNavigate()
  const [paymentMethod, setPaymentMethod] = useState<'seevplus' | 'manual_momo' | ''>('seevplus')
  const [momoTxId, setMomoTxId] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [deliveryNote, setDeliveryNote] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    supabase.from('customer_profiles').select('delivery_address').eq('profile_id', user.id).single().then(({ data }) => {
      if (data?.delivery_address) setDeliveryAddress(String(data.delivery_address))
    })
    if (profile?.full_name) setCustomerName(String(profile.full_name))
  }, [user, profile])

  if (!user) {
    return (
      <div className="page">
        <section className="section"><div className="container"><div className="empty-state">
          <div className="empty-icon">🔒</div>
          <h2>Please log in to checkout.</h2>
          <p>Your cart is saved — log in to continue.</p>
          <Link to="/login" state={{ from: '/checkout' }} className="primary-btn">Log in</Link>
        </div></div></section>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="page">
        <section className="section"><div className="container">
          <Placeholder title="Cart empty" desc="Add items to your cart before checking out." />
          <Link to="/catalogue" className="primary-btn" style={{ marginTop: 16 }}>Browse catalogue</Link>
        </div></section>
      </div>
    )
  }

  const handlePlaceOrder = async () => {
    setError(null)
    if (!paymentMethod) { setError('Please select a payment method.'); return }
    if (paymentMethod === 'manual_momo' && !momoTxId.trim()) { setError('Please enter your MoMo transaction ID.'); return }
    if (!deliveryAddress.trim()) { setError('Please provide a delivery address.'); return }
    if (!customerName.trim() || !customerPhone.trim()) { setError('Please enter your name and phone number.'); return }

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

      const finalTotal = authoritativeSubtotal

      const { error: custErr } = await supabase.from('customers').upsert(
        { id: user.id, email: user.email ?? '' },
        { onConflict: 'id', ignoreDuplicates: true }
      )
      if (custErr) console.warn('[checkout] customers upsert:', custErr.message)

      // Manual MoMo orders are visible immediately as 'pending' for verification; Seev orders stay hidden as 'pending_payment'
      const orderStatus = paymentMethod === 'manual_momo' ? 'pending' : 'pending_payment'
      const deliveryStatus = paymentMethod === 'manual_momo' ? 'pending' : 'pending_payment'

      const { data: order, error: oErr } = await supabase.from('orders').insert({
        customer_id: user.id,
        status: orderStatus,
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

      const expectedDate = getExpectedDeliveryDate('free')
      const note = deliveryNote.trim() ? ` — Note: ${deliveryNote.trim()}` : ''
      const fullAddress = `${deliveryAddress.trim()} (${customerName.trim()}, ${customerPhone.trim()})${note}`
      const { error: delErr } = await supabase.from('deliveries').insert({
        order_id: order.id,
        method: 'free',
        expected_delivery_date: expectedDate,
        delivery_address: fullAddress,
        status: deliveryStatus,
      })
      if (delErr) console.warn('[checkout] deliveries insert failed:', delErr.message)

      if (paymentMethod === 'manual_momo') {
        const { error: payErr } = await supabase.from('payments').insert({
          order_id: order.id,
          amount: finalTotal,
          method: 'mtn_momo',
          reference: momoTxId.trim(),
          notes: `Manual MoMo — awaiting verification. Customer phone: ${customerPhone.trim()}`,
          recorded_by: user.id,
        })
        if (payErr) console.warn('[checkout] manual payment insert failed:', payErr.message)
        await supabase.from('order_updates').insert({
          order_id: order.id,
          title: 'Awaiting MoMo verification',
          message: `Manual MTN MoMo payment submitted — TxID: ${momoTxId.trim()} — GH₵${finalTotal}. Admin will verify shortly.`,
          customer_visible: true,
        })
        clear()
        navigate(`/account/orders/${order.id}`, { state: { justCreated: true, manualMomo: true, fee: 0, finalTotal } })
        return
      }

      if (paymentMethod === 'seevplus') {
        const { data: session, error: sessErr } = await supabase.functions.invoke('seevplus-init', {
          body: {
            order_id: order.id,
            redirect_url: `${window.location.origin}/payment/callback?order_id=${order.id}`,
          },
        })
        if (sessErr || !session?.checkout_url) {
          throw new Error(session?.error ?? sessErr?.message ?? 'Could not start Seev Plus payment. Your order is saved — please retry from your orders page or contact support.')
        }
        clear()
        window.location.href = session.checkout_url
        return
      }

      clear()
      navigate(`/account/orders/${order.id}`, { state: { justCreated: true, fee: 0, finalTotal } })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setPlacing(false)
    }
  }

  return (
    <div className="page">
      <section className="page-header">
        <div className="container">
          <div className="eyebrow">Final step</div>
          <h1>Checkout.</h1>
          <p>Tell us where you&apos;d like your order delivered.</p>
        </div>
      </section>

      <section className="section">
        <div className="container checkout-grid">
          <div>
            <div className="checkout-section">
              <h3>1. Delivery information</h3>
              <div className="input-grid">
                <input className="input" placeholder="Full name" value={customerName} onChange={e => setCustomerName(e.target.value)} />
                <input className="input" placeholder="Phone number" type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
              </div>
              <input className="input" placeholder="Delivery address — e.g. Hall, room, street, city" style={{ marginTop: 10 }} value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} />
              <textarea className="input" placeholder="Additional delivery note (optional)" style={{ marginTop: 10 }} value={deliveryNote} onChange={e => setDeliveryNote(e.target.value)} />
            </div>

            <div className="checkout-section">
              <h3>2. Payment</h3>
              <button className={`location-option${paymentMethod === 'seevplus' ? ' active' : ''}`} style={{ width: '100%', marginBottom: 10 }} onClick={() => setPaymentMethod('seevplus')}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 13 }}>Seev Plus — Mobile Money</div>
                  <div style={{ fontSize: 11, marginTop: 2, opacity: .75 }}>MTN MoMo, Telecel Cash, AT Money — pay on a secure hosted page</div>
                </div>
              </button>
              <button className={`location-option${paymentMethod === 'manual_momo' ? ' active' : ''}`} style={{ width: '100%' }} onClick={() => setPaymentMethod('manual_momo')}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 13 }}>MTN MoMo — Manual</div>
                  <div style={{ fontSize: 11, marginTop: 2, opacity: .75 }}>Send to merchant number, enter transaction ID — we verify manually</div>
                </div>
              </button>

              {paymentMethod === 'manual_momo' && (
                <div style={{ marginTop: 14, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, padding: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Send payment to:</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--orange)', letterSpacing: 0.5 }}>{MOMO_NUMBER}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Name: {MOMO_NAME} — Amount: {CEDI(displaySubtotal)} — use your name as reference</div>
                  <div style={{ fontSize: 11, color: '#92400e', background: '#fef3c7', borderRadius: 8, padding: '8px 10px', marginTop: 10 }}>After sending, paste the transaction ID below. Your order will appear as &quot;Pending verification&quot; until we confirm.</div>
                  <input className="input" placeholder="MoMo transaction ID (e.g. 1234567890)" value={momoTxId} onChange={e => setMomoTxId(e.target.value)} style={{ marginTop: 12 }} />
                </div>
              )}

              {error && <div style={{ background: '#fee2e2', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: 12, padding: '10px 16px', fontSize: 13, marginTop: 14 }}>{error}</div>}
            </div>
          </div>

          <aside className="cart-summary">
            <div className="summary-title">Your order</div>
            {items.map(i => (
              <div key={i.variant_id} className="summary-line">
                <span>{i.product_name} × {i.quantity}</span>
                <span>{CEDI(i.unit_price * i.quantity)}</span>
              </div>
            ))}
            <div className="summary-line"><span>Shipping</span><span style={{ color: 'var(--green)' }}>Free</span></div>
            <div className="summary-total"><span>Total</span><span>{CEDI(displaySubtotal)}</span></div>
            {paymentMethod === 'manual_momo' && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10, textAlign: 'center' }}>You will pay {CEDI(displaySubtotal)} to {MOMO_NUMBER}</div>}
            <button className="primary-btn full-btn" style={{ marginTop: 20 }} disabled={placing} onClick={handlePlaceOrder}>
              {placing ? 'Placing order...' : paymentMethod === 'manual_momo' ? 'Submit MoMo payment →' : 'Place order →'}
            </button>
          </aside>
        </div>
      </section>
    </div>
  )
}
