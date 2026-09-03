import { Link } from 'react-router-dom'
import { useCart } from '../context/CartContext'

export default function Cart() {
  const { items, removeItem, increase, decrease, clear, subtotal } = useCart()

  if (items.length === 0) {
    return (
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <div className="empty-state">
          <div className="empty-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg></div>
          <h3>Your cart is empty</h3>
          <p>Add some products to get started.</p>
          <Link to="/catalogue" className="btn primary">Continue shopping</Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Cart</h1>
        <button className="btn sm ghost" onClick={clear} style={{ color: 'var(--text-muted)' }}>Clear cart</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map(item => (
          <div key={item.variant_id} className="card" style={{ padding: 16, display: 'flex', gap: 14 }}>
            <div className="product-thumb">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div className="product-name">{item.product_name}</div>
              {item.variant_name && <div className="product-var">{item.variant_name}{item.sku ? ` · SKU ${item.sku}` : ''}</div>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                <div className="qty-stepper">
                  <button onClick={() => decrease(item.variant_id)}>-</button>
                  <span className="mono" style={{ fontWeight: 600, minWidth: 20, textAlign: 'center' }}>{item.quantity}</span>
                  <button onClick={() => increase(item.variant_id)}>+</button>
                </div>
                <button className="btn sm ghost" style={{ color: 'var(--danger)', fontSize: 12 }} onClick={() => removeItem(item.variant_id)}>Remove</button>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="product-price">GH₵ {(item.unit_price * item.quantity).toFixed(2)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>GH₵ {item.unit_price} × {item.quantity}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 18, marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Subtotal</div>
          <div style={{ fontSize: 20, fontWeight: 700 }} className="mono">GH₵ {subtotal.toFixed(2)}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/catalogue" className="btn">Continue shopping</Link>
          <Link to="/checkout" className="btn primary">Checkout</Link>
        </div>
      </div>
    </div>
  )
}
