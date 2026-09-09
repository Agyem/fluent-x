import { Link } from 'react-router-dom'
import { useCart } from '../context/CartContext'

export default function FloatingCart({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { items, subtotal, removeItem, increase, decrease } = useCart()
  if (!open) return null
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 360, height: '100%', background: 'var(--surface)', boxShadow: 'var(--shadow-pop)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 14, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
            Cart ({items.reduce((s, i) => s + i.quantity, 0)})
          </h3>
          <button onClick={onClose} className="icon-btn" style={{ width: 30, height: 30 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--surface-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', color: 'var(--text-muted)' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 12 }}>Your cart is empty</p>
              <Link to="/catalogue" onClick={onClose} className="btn primary" style={{ marginTop: 14, display: 'inline-flex' }}>Browse products</Link>
            </div>
          ) : items.map(item => (
            <div key={item.variant_id} className="card" style={{ padding: 12, display: 'flex', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.product_name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{item.variant_name || 'Default'}{item.sku ? ` · ${item.sku}` : ''}</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }} className="mono">GH₵ {item.unit_price} <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>× {item.quantity}</span></div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button onClick={() => decrease(item.variant_id)} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border-strong)', background: 'none', cursor: 'pointer', fontSize: 14 }}>−</button>
                  <span style={{ width: 24, textAlign: 'center', fontSize: 13, fontWeight: 600 }}>{item.quantity}</span>
                  <button onClick={() => increase(item.variant_id)} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border-strong)', background: 'none', cursor: 'pointer', fontSize: 14 }}>+</button>
                </div>
                <button onClick={() => removeItem(item.variant_id)} style={{ fontSize: 11, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
              </div>
            </div>
          ))}
        </div>
        {items.length > 0 && (
          <div style={{ padding: 14, borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 12 }}>
              <span style={{ color: 'var(--text-muted)' }}>Subtotal</span>
              <span style={{ fontWeight: 700 }} className="mono">GH₵ {subtotal.toFixed(2)}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Link to="/cart" onClick={onClose} className="btn" style={{ justifyContent: 'center', padding: '10px 0' }}>View cart</Link>
              <Link to="/checkout" onClick={onClose} className="btn primary" style={{ justifyContent: 'center', padding: '10px 0' }}>Checkout</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
