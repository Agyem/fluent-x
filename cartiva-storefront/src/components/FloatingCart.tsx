import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { getPublicImageUrl } from '../lib/catalogue'

const CEDI = (n: number) => 'GH₵ ' + Number(n).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Rendered in a body portal: the site header uses backdrop-filter, which
// creates a containing block that breaks `position: fixed` for descendants.
// Portaling keeps the drawer anchored to the viewport with correct z-index.
export default function FloatingCart({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { items, subtotal, removeItem, increase, decrease } = useCart()
  const count = items.reduce((s, i) => s + i.quantity, 0)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  return createPortal(
    <>
      <div className={`cart-drawer-overlay${open ? ' is-active' : ''}`} onClick={onClose} aria-hidden={!open} />
      <aside className={`cart-drawer${open ? ' is-open' : ''}`} role="dialog" aria-label="Shopping cart" aria-hidden={!open}>
        <div className="cart-drawer-header">
          <h3 className="cart-drawer-title">Cart ({count})</h3>
          <button onClick={onClose} className="cart-drawer-close" aria-label="Close cart">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div className="cart-drawer-body">
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <p style={{ fontSize: 13, color: '#6b7280' }}>Your cart is empty</p>
              <Link to="/catalogue" onClick={onClose} className="cart-checkout-btn" style={{ marginTop: 14 }}>Browse products</Link>
            </div>
          ) : items.map(item => {
            const img = item.image_path ? getPublicImageUrl(item.image_path) : null
            return (
              <div key={item.variant_id} className="cart-drawer-item">
                <div className="cart-drawer-item-image">{img ? <img src={img} alt={item.product_name} /> : <span style={{ fontSize: 26 }}>📦</span>}</div>
                <div className="cart-drawer-item-details">
                  <p className="cart-drawer-item-title">{item.product_name}</p>
                  <span className="cart-drawer-item-sub">{item.variant_name || 'Default'}{item.sku ? ` · ${item.sku}` : ''}</span>
                  <span className="cart-drawer-item-price">{CEDI(item.unit_price)} <span style={{ fontSize: 11, fontWeight: 400, color: '#6b7280' }}>× {item.quantity}</span></span>
                  <div className="cart-drawer-qty">
                    <button onClick={() => decrease(item.variant_id)} aria-label="Decrease">−</button>
                    <span style={{ width: 24, textAlign: 'center', fontSize: 13, fontWeight: 600 }}>{item.quantity}</span>
                    <button onClick={() => increase(item.variant_id)} aria-label="Increase">+</button>
                  </div>
                  <button className="cart-drawer-remove" onClick={() => removeItem(item.variant_id)}>Remove</button>
                </div>
                <div className="cart-drawer-item-price">{CEDI(item.unit_price * item.quantity)}</div>
              </div>
            )
          })}
        </div>

        {items.length > 0 && (
          <div className="cart-drawer-footer">
            <div className="cart-summary-row"><span>Subtotal</span><span>{CEDI(subtotal)}</span></div>
            <Link to="/checkout" onClick={onClose} className="cart-checkout-btn">Checkout</Link>
            <Link to="/cart" onClick={onClose} className="cart-drawer-view-btn">View cart</Link>
          </div>
        )}
      </aside>
    </>,
    document.body
  )
}
