import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Loading } from '../components/Loading'
import ErrorState from '../components/ErrorState'
import Placeholder from '../components/Placeholder'

import { SHIPPING_OPTIONS } from '../lib/shipping'

type OrderRow = { id: string; order_number: string; status: string; total_amount: number; shipping_fee: number | null; created_at: string; customer_id: string }
type DeliveryRow = { order_id: string; method: string | null; expected_delivery_date: string | null; delivery_address: string | null; status: string | null }
type PaymentRow = { order_id: string; payment_status: string; total_paid: number; balance: number }

export default function Orders() {
  const { user } = useAuth()
  const [orders, setOrders] = useState<OrderRow[] | null>(null)
  const [deliveries, setDeliveries] = useState<Record<string, DeliveryRow>>({})
  const [payments, setPayments] = useState<Record<string, PaymentRow>>({})
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function load() {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('id, order_number, status, total_amount, shipping_fee, created_at, customer_id')
          .eq('customer_id', user!.id)
          .order('created_at', { ascending: false })
        if (error) throw error
        if (cancelled) return
        setOrders((data ?? []) as OrderRow[])
        if (data && data.length > 0) {
          const ids = data.map(o => o.id)
          const [delsRes, payRes] = await Promise.all([
            supabase.from('deliveries').select('order_id, method, expected_delivery_date, delivery_address, status').in('order_id', ids),
            supabase.from('order_payment_summary').select('order_id, payment_status, total_paid, balance').in('order_id', ids),
          ])
          if (!cancelled && delsRes.data) {
            const map: Record<string, DeliveryRow> = {}
            delsRes.data.forEach(d => { map[d.order_id] = d as DeliveryRow })
            setDeliveries(map)
          }
          if (!cancelled && payRes.data) {
            const map: Record<string, PaymentRow> = {}
            payRes.data.forEach(p => { map[p.order_id] = p as PaymentRow })
            setPayments(map)
          }
        }
      } catch (e) { if (!cancelled) setErr((e as Error).message) }
    }
    load()
    return () => { cancelled = true }
  }, [user])

  if (err) return <ErrorState message={err} onRetry={() => location.reload()} />
  if (orders === null) return <Loading label="Loading orders..." />
  if (orders.length === 0) return <Placeholder title="No orders yet" desc="You have no orders — they will appear here after checkout." />

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">My orders</h1>
      <p className="text-sm text-zinc-500">Newest first — only your orders (RLS: <code>customer_id = auth.uid()</code>).</p>
      <div className="grid gap-3">
        {orders.map(o => {
          const del = deliveries[o.id]
          const pay = payments[o.id]
          const method = del?.method as keyof typeof SHIPPING_OPTIONS | undefined
          const opt = method ? SHIPPING_OPTIONS[method] : null
          const paymentStatus = pay?.payment_status ?? 'unpaid'
          const paymentBadge = paymentStatus === 'paid' ? 'Paid' : paymentStatus === 'partially_paid' ? 'Partially paid' : 'Pending Payment'
          const statusColor = o.status === 'completed' ? 'bg-green-50 text-green-700' : o.status === 'pending' ? 'bg-zinc-100 text-zinc-600' : 'bg-blue-50 text-blue-700'
          return (
            <Link key={o.id} to={`/orders/${o.id}`} className="bg-white border border-zinc-200 rounded-2xl p-4 hover:border-zinc-300">
              <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-sm font-bold truncate">#{o.order_number}</div>
                  <div className="text-xs text-zinc-500 mt-1 flex flex-wrap gap-1.5 items-center">
                    <span>{new Date(o.created_at).toLocaleDateString()}</span>
                    <span>·</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor}`}>{o.status}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${paymentStatus === 'paid' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>{paymentBadge}</span>
                  </div>
                  {del ? (
                    <div className="text-xs text-zinc-500 mt-1">
                      {opt ? `${opt.label} · ${opt.type} · ${opt.estimate} · GH₵${opt.fee}` : `Delivery: ${del.method ?? '—'}${del.status ? ` · ${del.status}` : ''}`}
                      {del.expected_delivery_date ? ` · ETA ${new Date(del.expected_delivery_date).toLocaleDateString()}` : ''}
                    </div>
                  ) : (
                    <div className="text-xs text-zinc-400 mt-1">Delivery: — (no delivery record yet)</div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold">GH₵ {o.total_amount}</div>
                  {o.shipping_fee != null && o.shipping_fee > 0 && <div className="text-xs text-zinc-500">incl. GH₵{o.shipping_fee} shipping</div>}
                </div>
              </div>
            </Link>
          )
        })}
      </div>
      {orders.length === 0 ? null : <div className="text-xs text-zinc-400 text-center">Tap an order to view details, items, and tracking.</div>}
    </div>
  )
}
