import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Loading } from '../components/Loading'
import ErrorState from '../components/ErrorState'

interface Order {
  id: string; status: string; total: number; created_at: string;
  order_items?: { product_id: string; quantity: number; products?: { name: string; thumbnail_path?: string }[] }[];
}

export default function Account() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [orders, setOrders] = useState<Order[]>([])
  const [orderCount, setOrderCount] = useState(0)
  const [addressCount, setAddressCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function load() {
      try {
        const [ordersRes, addrRes] = await Promise.all([
          supabase.from('orders').select('id, status, total, created_at, order_items(product_id, quantity, products(name, thumbnail_path))').eq('customer_id', user!.id).order('created_at', { ascending: false }).limit(5),
          supabase.from('customer_addresses').select('id', { count: 'exact', head: true }).eq('customer_id', user!.id),
        ])
        if (ordersRes.error) throw ordersRes.error
        if (!cancelled) {
          setOrders((ordersRes.data || []) as Order[])
          setOrderCount((ordersRes.data || []).length)
          setAddressCount(addrRes.count || 0)
        }
      } catch (e) { if (!cancelled) setErr((e as Error).message) }
      finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [user])

  if (loading) return <Loading label="Loading overview..." />
  if (err) return <ErrorState message={err} />

  const name = (profile?.full_name as string || 'there').split(' ')[0]
  const stats = [
    { label: 'Total orders', value: orderCount, icon: 'bag', color: 'var(--primary-light)', iconColor: 'var(--primary-dark)', path: '/account/orders' },
    { label: 'Addresses', value: addressCount, icon: 'map', color: 'var(--success-light)', iconColor: 'var(--success)', path: '/account/addresses' },
    { label: 'Wishlist items', value: 0, icon: 'heart', color: 'var(--danger-light)', iconColor: 'var(--danger)', path: '/account/wishlist' },
    { label: 'Reviews', value: 0, icon: 'star', color: 'var(--warning-light)', iconColor: 'var(--warning)', path: '/account/reviews' },
  ]

  return (
    <div>
      <div className="welcome-banner">
        <h2>Welcome back, {name}!</h2>
        <p>Manage your orders, addresses, and account settings from here.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 22 }}>
        {stats.map(s => (
          <div key={s.label} className="card qa-card" onClick={() => navigate(s.path)}>
            <div className="qa-icon" style={{ background: s.color, color: s.iconColor }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {s.icon === 'bag' && <><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></>}
                {s.icon === 'map' && <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></>}
                {s.icon === 'heart' && <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>}
                {s.icon === 'star' && <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>}
              </svg>
            </div>
            <div className="qa-num">{s.value}</div>
            <div className="qa-label">{s.label}</div>
          </div>
        ))}
      </div>

      {orders.length > 0 && (
        <div className="card" style={{ padding: 18 }}>
          <div className="section-head" style={{ marginBottom: 14 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>Recent orders</h3>
            <button className="btn sm ghost" onClick={() => navigate('/account/orders')}>View all</button>
          </div>
          {orders.map(o => (
            <div key={o.id} className="product-row" style={{ cursor: 'pointer' }} onClick={() => navigate(`/account/orders/${o.id}`)}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Order #{o.id.slice(0, 8)}...</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {o.order_items?.length || 0} items · {new Date(o.created_at).toLocaleDateString()}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="product-price">GH₵ {Number(o.total).toFixed(2)}</div>
                <div style={{ fontSize: 11, color: o.status === 'delivered' ? 'var(--success)' : o.status === 'cancelled' ? 'var(--danger)' : 'var(--text-muted)', fontWeight: 600, textTransform: 'capitalize', marginTop: 2 }}>{o.status}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {orders.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
          </div>
          <h3>No orders yet</h3>
          <p>Start shopping to see your orders here.</p>
          <button className="btn primary" onClick={() => navigate('/catalogue')}>Browse products</button>
        </div>
      )}
    </div>
  )
}
