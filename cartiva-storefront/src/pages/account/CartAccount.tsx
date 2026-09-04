import { useNavigate } from 'react-router-dom'
import { useCart } from '../../context/CartContext'

export default function AccountCart() {
  const navigate = useNavigate()
  const { items, increase, decrease, removeItem, subtotal } = useCart()

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>My cart</h2>
      {items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg></div>
          <h3>Your cart is empty</h3>
          <p>Add some products to get started.</p>
          <button className="btn primary" onClick={() => navigate('/catalogue')}>Browse products</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, alignItems: 'start' }}>
          <div className="card" style={{ padding: 4 }}>
            {items.map(item => (
              <div key={item.product_id} className="product-row" style={{ padding: '14px 14px' }}>
                <div className="product-thumb">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="product-name">{item.product_name}</div>
                  {item.variant_name && <div className="product-var">{item.variant_name}</div>}
                </div>
                <div className="qty-stepper">
                  <button onClick={() => decrease(item.variant_id)}>-</button>
                  <span className="mono" style={{ fontWeight: 600, minWidth: 20, textAlign: 'center' }}>{item.quantity}</span>
                  <button onClick={() => increase(item.variant_id)}>+</button>
                </div>
                <div className="product-price">GH₵ {(item.unit_price * item.quantity).toFixed(2)}</div>
                <button className="btn sm ghost" style={{ color: 'var(--danger)' }} onClick={() => removeItem(item.variant_id)}>✕</button>
              </div>
            ))}
          </div>
          <div className="card" style={{ padding: 18, position: 'sticky', top: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Order summary</h3>
            <div className="co-summary-row"><span>Subtotal</span><span className="mono">GH₵ {subtotal.toFixed(2)}</span></div>
            <div className="co-summary-row"><span>Shipping</span><span className="mono" style={{ color: 'var(--text-muted)' }}>Calculated at checkout</span></div>
            <div className="co-summary-row" style={{ fontWeight: 700, color: 'var(--text)', borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 8 }}><span>Total</span><span className="mono">GH₵ {subtotal.toFixed(2)}</span></div>
            <button className="btn primary block" style={{ marginTop: 14 }} onClick={() => navigate('/checkout')}>Proceed to checkout</button>
          </div>
        </div>
      )}
    </div>
  )
}
