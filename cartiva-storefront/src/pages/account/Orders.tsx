import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Loading } from '../../components/Loading'
import ErrorState from '../../components/ErrorState'

interface Order {
  id: string; status: string; total: number; created_at: string;
  deliveries?: { method: string; status: string }[];
  order_items?: { quantity: number; products?: { name: string }[] }[];
}

const TABS = ['All', 'Active', 'Delivered', 'Cancelled']

export default function AccountOrders() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [orders, setOrders] = useState<Order[]>([])
  const [tab, setTab] = useState('All')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function load() {
      try {
        const { data, error } = await supabase.from('orders')
          .select('id, status, total, created_at, deliveries(method, status), order_items(quantity, products(name))')
          .eq('customer_id', user!.id)
          .order('created_at', { ascending: false })
        if (error) throw error
        if (!cancelled) setOrders((data || []) as Order[])
      } catch (e) { if (!cancelled) setErr((e as Error).message) }
      finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [user])

  if (loading) return <Loading label="Loading orders..." />
  if (err) return <ErrorState message={err} />

  const filtered = orders.filter(o => {
    if (tab === 'All') return true
    if (tab === 'Active') return !['delivered', 'cancelled'].includes(o.status)
    if (tab === 'Delivered') return o.status === 'delivered'
    if (tab === 'Cancelled') return o.status === 'cancelled'
    return true
  })

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>My orders</h2>
      <div className="tabbar">
        {TABS.map(t => <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>)}
      </div>
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
          </div>
          <h3>No {tab.toLowerCase()} orders</h3>
          <p>{tab === 'All' ? "You haven't placed any orders yet." : `No orders with status "${tab.toLowerCase()}".`}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(o => (
            <div key={o.id} className="card order-card" style={{ cursor: 'pointer' }} onClick={() => navigate(`/account/orders/${o.id}`)}>
              <div className="order-top">
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Order #{o.id.slice(0, 8)}...</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{new Date(o.created_at).toLocaleDateString()}</div>
                </div>
                <span className={`pill ${o.status === 'delivered' ? '' : o.status === 'cancelled' ? 'danger' : ''}`}
                  style={{
                    background: o.status === 'delivered' ? 'var(--success-light)' : o.status === 'cancelled' ? 'var(--danger-light)' : 'var(--primary-light)',
                    color: o.status === 'delivered' ? 'var(--success)' : o.status === 'cancelled' ? 'var(--danger)' : 'var(--primary-dark)',
                  }}>
                  {o.status}
                </span>
              </div>
              <div className="order-meta">
                <div><span>Items</span>{o.order_items?.length || 0}</div>
                <div><span>Total</span><span className="mono" style={{ fontWeight: 600 }}>GH₵ {Number(o.total).toFixed(2)}</span></div>
                {o.deliveries?.[0] && <div><span>Delivery</span>{o.deliveries[0].method === 'air' ? 'Air' : 'Sea'}</div>}
              </div>
              <div className="mini-rail">
                <span className={o.status !== 'pending' ? 'done' : ''} />
                <span className={['confirmed', 'processing', 'shipped', 'delivered'].includes(o.status) ? 'done' : ''} />
                <span className={['shipped', 'delivered'].includes(o.status) ? 'done' : ''} />
                <span className={o.status === 'delivered' ? 'done' : ''} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
