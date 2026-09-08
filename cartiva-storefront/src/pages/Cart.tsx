import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { getPublicImageUrl } from '../lib/catalogue'

const CEDI = (n: number) => 'GH₵ ' + n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function Cart() {
  const { items, removeItem, increase, decrease, clear, subtotal } = useCart()
  const navigate = useNavigate()

  if (items.length === 0) {
    return (
      <div className="page">
        <section className="page-header">
          <div className="container">
            <div className="eyebrow">Your selection</div>
            <h1>Your cart.</h1>
            <p>Products you&apos;re ready to take with you.</p>
          </div>
        </section>
        <section className="section">
          <div className="container">
            <div className="empty-state">
              <div className="empty-icon">🛒</div>
              <h2>Your cart is empty.</h2>
              <p>Looks like you haven&apos;t added anything yet.</p>
              <button className="primary-btn" onClick={() => navigate('/catalogue')}>Start shopping</button>
            </div>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="page">
      <section className="page-header">
        <div className="container">
          <div className="eyebrow">Ready when you are</div>
          <h1>Your cart.</h1>
          <p>Review your products before checkout.</p>
        </div>
      </section>
      <section className="section">
        <div className="container cart-layout">
          <div className="cart-list">
            {items.map(item => {
              const img = item.image_path ? getPublicImageUrl(item.image_path) : null
              return (
                <div key={item.variant_id} className="cart-item">
                  <div className="cart-item-image">{img ? <img src={img} alt={item.product_name} /> : <span style={{ fontSize: 28 }}>📦</span>}</div>
                  <div>
                    <h3>{item.product_name}</h3>
                    <p>{item.variant_name ?? 'Default'}{item.sku ? ` · ${item.sku}` : ''}</p>
                    <div className="quantity-row" style={{ margin: '9px 0 0' }}>
                      <div className="quantity-box">
                        <button onClick={() => decrease(item.variant_id)}>−</button>
                        <span>{item.quantity}</span>
                        <button onClick={() => increase(item.variant_id)}>+</button>
                      </div>
                    </div>
                    <button className="remove-btn" onClick={() => removeItem(item.variant_id)}>Remove from cart</button>
                  </div>
                  <div className="cart-item-price">{CEDI(item.unit_price * item.quantity)}</div>
                </div>
              )
            })}
          </div>
          <aside className="cart-summary">
            <div className="summary-title">Order summary</div>
            <div className="summary-line"><span>Subtotal</span><span>{CEDI(subtotal)}</span></div>
            <div className="summary-line"><span>Delivery</span><span>Calculated at checkout</span></div>
            <div className="summary-total"><span>Total</span><span>{CEDI(subtotal)}</span></div>
            <button className="primary-btn full-btn" style={{ marginTop: 20 }} onClick={() => navigate('/checkout')}>Proceed to checkout →</button>
            <Link to="/catalogue" className="secondary-btn full-btn" style={{ marginTop: 8 }}>Continue shopping</Link>
            <button className="remove-btn" style={{ marginTop: 12 }} onClick={clear}>Clear cart</button>
          </aside>
        </div>
      </section>
    </div>
  )
}
