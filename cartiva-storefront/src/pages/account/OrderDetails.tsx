import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Loading } from '../../components/Loading'
import ErrorState from '../../components/ErrorState'

interface OrderDetail {
  id: string; status: string; total_amount: number; created_at: string;
  deliveries?: { method: string; status: string; tracking_number?: string; expected_delivery_date?: string }[];
  order_items?: { quantity: number; unit_price: number; products?: { name: string }[] }[];
}

const STATUS_MAP: Record<string, number> = {
  pending: 0, placed: 0,
  confirmed: 1,
  processing: 2,
  shipped: 3,
  'out for delivery': 4,
  delivered: 5,
  cancelled: -1,
}

export default function AccountOrderDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data, error } = await supabase.from('orders')
          .select('id, status, total_amount, created_at, deliveries(method, status, tracking_number, expected_delivery_date), order_items(quantity, unit_price, products(name))')
          .eq('id', id!).single()
        if (error) throw error
        if (!cancelled) setOrder(data as OrderDetail)
      } catch (e) { if (!cancelled) setErr((e as Error).message) }
      finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [id])

  if (loading) return <Loading label="Loading order..." />
  if (err) return <ErrorState message={err} />
  if (!order) return <ErrorState message="Order not found" />

  const statusIdx = STATUS_MAP[order.status] ?? 0

  return (
    <div>
      <button className="back-link" onClick={() => navigate('/account/orders')}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        Back to orders
      </button>

      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>Order #{order.id.slice(0, 8)}...</h2>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Placed {new Date(order.created_at).toLocaleDateString()}</div>
          </div>
          <span className="pill" style={{
            background: order.status === 'delivered' ? 'var(--success-light)' : order.status === 'cancelled' ? 'var(--danger-light)' : 'var(--primary-light)',
            color: order.status === 'delivered' ? 'var(--success)' : order.status === 'cancelled' ? 'var(--danger)' : 'var(--primary-dark)',
          }}>{order.status}</span>
        </div>

        <div className="rail">
          {['Placed', 'Confirmed', 'Processing', 'Shipped', 'Out for delivery', 'Delivered'].map((step, i) => (
            <div key={step} className={`rail-step${i <= statusIdx ? ' done' : ''}${i === statusIdx ? ' current' : ''}`}>
              <div className="rail-dot" />
              {i < 5 && <div className="rail-line" />}
              <div className="rail-label">{step}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <div className="card" style={{ padding: 18 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Items</h3>
          {order.order_items?.map((item, i) => (
            <div key={i} className="product-row">
              <div className="product-thumb">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
              </div>
              <div style={{ flex: 1 }}>
                <div className="product-name">{item.products?.[0]?.name || 'Product'}</div>
                <div className="product-var">Qty: {item.quantity}</div>
              </div>
              <div className="product-price">GH₵ {(Number(item.unit_price) * item.quantity).toFixed(2)}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: 18 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Summary</h3>
            <div className="co-summary-row"><span>Total</span><span className="mono">GH₵ {Number(order.total_amount).toFixed(2)}</span></div>
          </div>

          {order.deliveries?.[0] && (
            <div className="card" style={{ padding: 18 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Delivery</h3>
              <div style={{ fontSize: 13 }}><span style={{ color: 'var(--text-muted)' }}>Method:</span> {order.deliveries[0].method === 'air' ? 'Air Freight' : 'Sea Freight'}</div>
              {order.deliveries[0].tracking_number && <div style={{ fontSize: 13, marginTop: 4 }}><span style={{ color: 'var(--text-muted)' }}>Tracking:</span> {order.deliveries[0].tracking_number}</div>}
              {order.deliveries[0].expected_delivery_date && <div style={{ fontSize: 13, marginTop: 4 }}><span style={{ color: 'var(--text-muted)' }}>Est. delivery:</span> {new Date(order.deliveries[0].expected_delivery_date).toLocaleDateString()}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
