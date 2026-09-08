import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { Loading } from '../components/Loading'
import ErrorState from '../components/ErrorState'
import { getPublicImageUrl } from '../lib/catalogue'

const CEDI_FULL = (n: number) => 'GH₵' + Number(n).toLocaleString('en-GH', { maximumFractionDigits: 0 })

interface OrderRow {
  id: string; order_number?: string | null; status: string; total_amount: number; created_at: string;
  order_items?: { quantity: number; unit_price: number; product_id: string; products?: { name: string }[] }[];
  deliveries?: { delivery_address?: string | null }[];
}

const STEPS = ['Placed', 'Confirmed', 'Processing', 'Ready', 'Delivered']
const STATUS_IDX: Record<string, number> = {
  pending: 0, placed: 0, confirmed: 1, processing: 2, shipped: 3, ready: 3,
  'out for delivery': 3, delivered: 4, cancelled: -1,
}

export default function Account() {
  const { user } = useAuth()
  const { count: cartCount } = useCart()
  const navigate = useNavigate()
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [wishlistCount, setWishlistCount] = useState(0)
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function load() {
      try {
        const { data: ordersData, error } = await supabase.from('orders')
          .select('id, order_number, status, total_amount, created_at, order_items(quantity, unit_price, product_id, products(name)), deliveries(delivery_address)')
          .eq('customer_id', user!.id).order('created_at', { ascending: false }).limit(5)
        if (error) throw error
        const list = (ordersData || []) as OrderRow[]
        if (!cancelled) setOrders(list)
        const { count: wc } = await supabase.from('wishlist_items').select('id', { count: 'exact', head: true }).eq('customer_id', user!.id)
        if (!cancelled) setWishlistCount(wc || 0)
        const firstPid = list[0]?.order_items?.[0]?.product_id
        if (firstPid && !cancelled) {
          const { data: imgs } = await supabase.from('product_images').select('storage_path').eq('product_id', firstPid).order('is_primary', { ascending: false }).limit(1)
          const path = (imgs?.[0] as { storage_path?: string } | undefined)?.storage_path
          if (path && !cancelled) setImgUrl(getPublicImageUrl(path))
        }
      } catch (e) { if (!cancelled) setErr((e as Error).message) }
      finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [user])

  if (loading) return <Loading label="Loading overview..." />
  if (err) return <ErrorState message={err} />

  const latest = orders[0]
  const totalSpent = orders.reduce((s, o) => s + Number(o.total_amount || 0), 0)
  const statusIdx = latest ? (STATUS_IDX[latest.status] ?? 0) : 0
  const firstItem = latest?.order_items?.[0]
  const deliveryAddr = latest?.deliveries?.[0]?.delivery_address?.split('(')[0].trim() || '—'

  return (
    <div id="overview" className="section">
      <div className="section-head">
        <small>ACCOUNT OVERVIEW</small>
        <h2>Your Cartiva</h2>
        <p>Everything about your shopping experience, in one place.</p>
      </div>

      <div className="overview-grid">
        <div className="panel">
          <div className="panel-title">
            <h3>Current Order</h3>
            <button onClick={() => navigate('/account/orders')}>View all</button>
          </div>
          {latest ? (
            <>
              <div className="order-top">
                <div className="order-number">Order <strong>#{latest.order_number || latest.id.slice(0, 8)}</strong></div>
                <span className={`status ${latest.status === 'delivered' ? 'delivered' : 'processing'}`}>{latest.status}</span>
              </div>
              <div className="product-preview">
                <div className="product-img">{imgUrl ? <img src={imgUrl} alt="" /> : <span style={{ fontSize: 28 }}>📦</span>}</div>
                <div className="product-info">
                  <strong>{firstItem?.products?.[0]?.name || 'Order items'}</strong>
                  <span>{latest.order_items?.length || 0} item(s){firstItem ? ` · Qty ${firstItem.quantity}` : ''}</span>
                </div>
                <div className="price">{CEDI_FULL(latest.total_amount)}</div>
              </div>
              <div className="progress">
                {STEPS.map((s, i) => (
                  <div key={s} className={`progress-item${i < statusIdx ? ' done' : ''}${i === statusIdx ? ' current' : ''}`}>
                    <div className="progress-dot">{i < statusIdx ? '✓' : i + 1}</div>
                    <p>{s}</p>
                  </div>
                ))}
              </div>
              <div className="delivery-mini">
                <div><span>DELIVERING TO</span><strong>{deliveryAddr}</strong></div>
                <button className="small-btn primary" onClick={() => navigate(`/account/orders/${latest.id}`)}>Track</button>
              </div>
            </>
          ) : (
            <p style={{ color: '#858585', fontSize: 13 }}>No orders yet — your latest order will appear here.</p>
          )}
        </div>

        <div className="panel">
          <div className="panel-title"><h3>Your Shopping</h3></div>
          <small style={{ color: '#999', fontSize: 10 }}>TOTAL SPENT ON CARTIVA</small>
          <div className="spend-number">{CEDI_FULL(totalSpent)}</div>
          <p className="spend-description">Across {orders.length} recent order(s).</p>
          <div className="spend-bar"><span /></div>
          <div className="spend-goal"><span>Shopping activity</span><span>{Math.min(100, orders.length * 12)}%</span></div>
          {orders[0] && (
            <div style={{ marginTop: 25, paddingTop: 17, borderTop: '1px solid #eee' }}>
              <small style={{ color: '#999', fontSize: 10 }}>LAST ORDER</small>
              <strong style={{ display: 'block', marginTop: 4, fontSize: 13 }}>{new Date(orders[0].created_at).toLocaleDateString()}</strong>
            </div>
          )}
        </div>
      </div>

      <div className="quick-section">
        <div className="panel-title"><h3>Quick Access</h3></div>
        <div className="quick-grid">
          <button className="quick" onClick={() => navigate('/account/orders')}>
            <span className="quick-icon">▣</span><strong>Track Orders</strong><span>See where your order is</span><b className="quick-arrow">→</b>
          </button>
          <button className="quick" onClick={() => navigate('/account/wishlist')}>
            <span className="quick-icon">♡</span><strong>Wishlist</strong><span>{wishlistCount} product(s) saved</span><b className="quick-arrow">→</b>
          </button>
          <button className="quick" onClick={() => navigate('/account/receipts')}>
            <span className="quick-icon">▤</span><strong>Receipts</strong><span>View transaction records</span><b className="quick-arrow">→</b>
          </button>
          <button className="quick" onClick={() => navigate('/account/cart')}>
            <span className="quick-icon">🛒</span><strong>Cart</strong><span>{cartCount} item(s) waiting</span><b className="quick-arrow">→</b>
          </button>
        </div>
      </div>

      {orders.length > 0 && (
        <div style={{ marginTop: 25 }}>
          <div className="panel-title">
            <h3>Recent Orders</h3>
            <button onClick={() => navigate('/account/orders')}>See all orders →</button>
          </div>
          <div className="order-list">
            {orders.slice(0, 2).map(o => (
              <div key={o.id} className="order-card">
                <div className="order-card-header">
                  <div><strong>#{o.order_number || o.id.slice(0, 8)}</strong><small>{new Date(o.created_at).toLocaleDateString()}</small></div>
                  <span className={`status ${o.status === 'delivered' ? 'delivered' : 'processing'}`}>{o.status}</span>
                </div>
                <div className="order-card-footer">
                  <span>{o.order_items?.reduce((s, i) => s + i.quantity, 0) || 0} item(s) · {CEDI_FULL(o.total_amount)}</span>
                  <div className="buttons">
                    <button className="small-btn" onClick={() => navigate('/account/receipts')}>Receipt</button>
                    <button className="small-btn primary" onClick={() => navigate(`/account/orders/${o.id}`)}>Track</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
