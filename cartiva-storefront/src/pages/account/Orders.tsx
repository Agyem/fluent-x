import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Loading } from '../../components/Loading'
import ErrorState from '../../components/ErrorState'
import { getPublicImageUrl } from '../../lib/catalogue'

const CEDI_FULL = (n: number) => 'GH₵' + Number(n).toLocaleString('en-GH', { maximumFractionDigits: 0 })

interface Order {
  id: string; order_number?: string | null; status: string; total_amount: number; created_at: string;
  deliveries?: { method: string; status: string; delivery_address?: string | null }[];
  order_items?: { quantity: number; product_id: string; products?: { name: string }[] }[];
}

export default function AccountOrders() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [orders, setOrders] = useState<Order[]>([])
  const [imgMap, setImgMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function load() {
      try {
        const { data, error } = await supabase.from('orders')
          .select('id, order_number, status, total_amount, created_at, deliveries(method, status, delivery_address), order_items(quantity, product_id, products(name))')
          .eq('customer_id', user!.id)
          .order('created_at', { ascending: false })
        if (error) throw error
        const list = (data || []) as Order[]
        if (!cancelled) setOrders(list)
        const pids = [...new Set(list.flatMap(o => (o.order_items ?? []).map(i => i.product_id)).filter(Boolean))]
        if (pids.length > 0 && !cancelled) {
          const { data: imgs } = await supabase.from('product_images').select('product_id, storage_path').in('product_id', pids).order('is_primary', { ascending: false })
          const map: Record<string, string> = {}
          for (const im of (imgs ?? []) as { product_id: string; storage_path: string }[]) {
            if (!map[im.product_id]) {
              const url = getPublicImageUrl(im.storage_path)
              if (url) map[im.product_id] = url
            }
          }
          if (!cancelled) setImgMap(map)
        }
      } catch (e) { if (!cancelled) setErr((e as Error).message) }
      finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [user])

  if (loading) return <Loading label="Loading orders..." />
  if (err) return <ErrorState message={err} />

  return (
    <div id="orders" className="section">
      <div className="section-head">
        <small>PURCHASE HISTORY</small>
        <h2>My Orders</h2>
        <p>Track your purchases and access their receipts.</p>
      </div>

      {orders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <h3>No orders yet</h3>
          <p>Your completed Cartiva orders will appear here.</p>
          <button className="orange-btn" onClick={() => navigate('/catalogue')}>Start shopping</button>
        </div>
      ) : (
        <div className="order-list">
          {orders.map(o => {
            const first = o.order_items?.[0]
            const itemCount = o.order_items?.reduce((s, i) => s + i.quantity, 0) || 0
            const addr = o.deliveries?.[0]?.delivery_address?.split('(')[0].trim()
            return (
              <div key={o.id} className="order-card">
                <div className="order-card-header">
                  <div>
                    <strong>#{o.order_number || o.id.slice(0, 8)}</strong>
                    <small>{new Date(o.created_at).toLocaleDateString()} · {itemCount} item(s)</small>
                  </div>
                  <span className={`status ${o.status === 'delivered' ? 'delivered' : 'processing'}`}>{o.status}</span>
                </div>
                <div className="order-card-body">
                  <div className="product-img">
                    {first && imgMap[first.product_id] ? <img src={imgMap[first.product_id]} alt="" /> : <span style={{ fontSize: 26 }}>📦</span>}
                  </div>
                  <div className="product-info">
                    <strong>{first?.products?.[0]?.name || `${itemCount} item(s)`}</strong>
                    {first && <span>Qty {first.quantity}</span>}
                  </div>
                  <div className="price">{CEDI_FULL(o.total_amount)}</div>
                </div>
                <div className="order-card-footer">
                  <span>{o.status === 'delivered' ? 'Delivered' : 'Delivery'}{addr ? `: ${addr}` : ''}</span>
                  <div className="buttons">
                    <button className="small-btn" onClick={() => navigate('/account/receipts')}>View Receipt</button>
                    <button className="small-btn primary" onClick={() => navigate(`/account/orders/${o.id}`)}>Track Order</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
