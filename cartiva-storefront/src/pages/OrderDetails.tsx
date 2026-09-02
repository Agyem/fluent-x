import { useEffect, useState } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Loading } from '../components/Loading'
import ErrorState from '../components/ErrorState'
import { SHIPPING_OPTIONS } from '../lib/shipping'
import { MOMO_CONFIG } from '../lib/momoConfig'

export default function OrderDetails() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const location = useLocation() as { state?: { justCreated?: boolean } }
  const justCreated = location.state?.justCreated
  const [order, setOrder] = useState<Record<string, unknown> | null>(null)
  const [items, setItems] = useState<Record<string, unknown>[] | null>(null)
  const [delivery, setDelivery] = useState<Record<string, unknown> | null>(null)
  const [payment, setPayment] = useState<Record<string, unknown> | null>(null)
  const [updates, setUpdates] = useState<Record<string, unknown>[] | null>(null)
  const [productMap, setProductMap] = useState<Record<string, string>>({})
  const [err, setErr] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!id || !user) return
    let cancelled = false
    async function load() {
      try {
        const { data: ord, error: oerr } = await supabase.from('orders').select('id, order_number, status, total_amount, shipping_fee, created_at, customer_id').eq('id', id!).eq('customer_id', user!.id).single()
        if (oerr) {
          if ((oerr as { code?: string }).code === 'PGRST116') { if (!cancelled) setNotFound(true); return }
          throw oerr
        }
        if (!cancelled) setOrder(ord as Record<string, unknown>)
        const [itsRes, delRes, payRes, updRes] = await Promise.all([
          supabase.from('order_items').select('id, quantity, unit_price, line_subtotal, product_id, variant_id').eq('order_id', id!),
          supabase.from('deliveries').select('method, expected_delivery_date, delivery_address, status, carrier, tracking_number').eq('order_id', id!).single(),
          supabase.from('order_payment_summary').select('payment_status, total_paid, balance').eq('order_id', id!).single(),
          supabase.from('order_updates').select('id, title, message, customer_visible, created_at').eq('order_id', id!).eq('customer_visible', true).order('created_at', { ascending: true }),
        ])
        if (itsRes.error) throw itsRes.error
        if (!cancelled) {
          setItems((itsRes.data ?? []) as Record<string, unknown>[])
          // Fetch product names for items
          if (itsRes.data && itsRes.data.length > 0) {
            const pIds = [...new Set(itsRes.data.map((it: { product_id: string }) => it.product_id))]
            const { data: prods } = await supabase.from('products').select('id, name').in('id', pIds)
            if (prods && !cancelled) {
              const map: Record<string, string> = {}
              prods.forEach((p: { id: string; name: string }) => { map[p.id] = p.name })
              setProductMap(map)
            }
          }
        }
        if (!cancelled && !delRes.error) setDelivery(delRes.data as Record<string, unknown>)
        else if (delRes.error && (delRes.error as { code?: string }).code !== 'PGRST116') throw delRes.error
        if (!cancelled && !payRes.error) setPayment(payRes.data as Record<string, unknown>)
        if (!cancelled && !updRes.error) setUpdates((updRes.data ?? []) as Record<string, unknown>[])
      } catch (e) { if (!cancelled) setErr((e as Error).message) }
    }
    load()
    return () => { cancelled = true }
  }, [id, user])

  if (err) return <ErrorState message={err} />
  if (notFound) return <div className="space-y-4"><ErrorState message="Order not found or you do not have access (RLS enforced)." /><Link to="/orders" className="inline-flex px-4 py-2 rounded-xl bg-zinc-900 text-white text-sm">Back to orders</Link></div>
  if (!order) return <Loading label="Loading order..." />

  const method = delivery?.method as keyof typeof SHIPPING_OPTIONS | undefined
  const shipOpt = method ? SHIPPING_OPTIONS[method] : null
  const subtotal = items ? items.reduce((sum, it) => sum + Number(it.line_subtotal ?? (Number(it.unit_price) * Number(it.quantity))), 0) : 0
  const shippingFee = order.shipping_fee != null ? Number(order.shipping_fee) : shipOpt ? shipOpt.fee : 0
  const paymentStatus = (payment?.payment_status as string) ?? 'unpaid'
  const statusColor = order.status === 'completed' ? 'bg-green-50 text-green-700 border-green-200' : order.status === 'pending' ? 'bg-zinc-100 text-zinc-600 border-zinc-200' : order.status === 'confirmed' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-zinc-50 text-zinc-600 border-zinc-200'

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Link to="/orders" className="text-sm text-zinc-500 hover:text-zinc-900">← Back to orders</Link>
      {justCreated && <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-sm text-green-800">Order placed successfully! <span className="font-mono font-bold">#{String(order.order_number)}</span> — Payment is <strong>Pending Payment</strong> until Admin verifies your Manual MoMo transfer.</div>}

      <div className="bg-white border border-zinc-200 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold font-mono">#{String(order.order_number)}</h1>
            <div className="text-xs text-zinc-500 mt-1">{new Date(String(order.created_at)).toLocaleString()}</div>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-1.5">
            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusColor}`}>{String(order.status)}</span>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${paymentStatus === 'paid' ? 'bg-green-50 text-green-700 border border-green-200' : paymentStatus === 'partially_paid' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>Payment: {paymentStatus === 'paid' ? 'Paid' : paymentStatus === 'partially_paid' ? 'Partially paid' : 'Pending Payment'}</span>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-bold">Items</h3>
          {items === null ? <Loading label="Loading items..." /> : items.length === 0 ? <div className="text-sm text-zinc-500 mt-2">No items (order may be empty or RLS blocks order_items)</div>
          : <div className="mt-3 space-y-3">
              {items.map(it => (
                <div key={String(it.id)} className="flex gap-3 p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                  <div className="w-12 h-12 rounded-lg bg-white border border-zinc-200 grid place-items-center shrink-0 text-zinc-400 text-xs">IMG</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{productMap[String(it.product_id)] ?? `Product ${String(it.product_id).slice(0,8)}…`}</div>
                    <div className="text-xs text-zinc-500 mt-1">Variant {String(it.variant_id).slice(0,8)}… · Qty {String(it.quantity)} · Unit GH₵ {String(it.unit_price)}</div>
                  </div>
                  <div className="text-sm font-bold font-mono shrink-0">GH₵ {String(it.line_subtotal ?? (Number(it.unit_price) * Number(it.quantity)).toFixed(2))}</div>
                </div>
              ))}
            </div>}
        </div>

        <div className="mt-6 grid gap-2 text-sm bg-zinc-50 rounded-xl p-4 border border-zinc-200">
          <div className="flex justify-between"><span className="text-zinc-500">Subtotal</span><span className="font-mono">GH₵ {subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-zinc-500">Shipping {shipOpt ? `(${shipOpt.label} · ${shipOpt.estimate})` : delivery?.method ? `(${String(delivery.method)})` : ''}</span><span className="font-mono">{shippingFee ? `GH₵${shippingFee}` : '—'}</span></div>
          <div className="flex justify-between font-bold pt-2 border-t border-zinc-200"><span>Total</span><span className="font-mono">GH₵ {String(order.total_amount)}</span></div>
          <div className="text-xs text-zinc-400">Subtotal + shipping = total — authoritative DB values, not client. Payment via <code>order_payment_summary</code> ({paymentStatus}).</div>
        </div>

        {delivery ? (
          <div className="mt-6 bg-white border border-zinc-200 rounded-xl p-4">
            <h4 className="text-sm font-bold">Delivery</h4>
            <div className="text-sm mt-3 space-y-2">
              <div className="flex justify-between"><span className="text-zinc-500">Method</span><span className="font-semibold">{shipOpt ? `${shipOpt.label} · ${shipOpt.type}` : String(delivery.method)}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Type</span><span>{shipOpt?.type ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Estimate</span><span>{shipOpt?.estimate ?? (delivery['expected_delivery_date'] ? new Date(String(delivery['expected_delivery_date'])).toLocaleDateString() : '—')}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Status</span><span className="font-semibold">{String(delivery.status ?? 'pending')}</span></div>
              {delivery['delivery_address'] ? <div><span className="text-zinc-500">Address:</span> <span className="ml-2">{String(delivery['delivery_address'])}</span></div> : null}
              {delivery['carrier'] ? <div><span className="text-zinc-500">Carrier:</span> {String(delivery.carrier)}</div> : null}
              {delivery['tracking_number'] ? <div><span className="text-zinc-500">Tracking:</span> <span className="font-mono">{String(delivery.tracking_number)}</span></div> : null}
            </div>
          </div>
        ) : (
          <div className="mt-6 bg-zinc-50 border border-dashed border-zinc-200 rounded-xl p-4 text-sm text-zinc-500">No delivery record yet — will appear after Admin processes shipping.</div>
        )}

        {updates && updates.length > 0 ? (
          <div className="mt-6">
            <h4 className="text-sm font-bold">Order timeline</h4>
            <div className="mt-3 space-y-3">
              {updates.map(u => (
                <div key={String(u.id)} className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-[#5B5FEF] mt-1.5 shrink-0" />
                  <div>
                    <div className="text-sm font-semibold">{String(u.title)}</div>
                    <div className="text-xs text-zinc-500">{String(u.message)}</div>
                    <div className="text-xs text-zinc-400">{new Date(String(u.created_at)).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-6 text-xs text-zinc-400">No customer-visible updates yet — timeline will show when Management System adds <code>order_updates</code> with <code>customer_visible:true</code>.</div>
        )}

        {justCreated && (
          <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <h4 className="text-sm font-bold text-amber-900">Manual MoMo — Pending Payment</h4>
            <div className="text-sm mt-2 grid gap-1 bg-white rounded-xl p-3 border border-amber-200">
              <div className="flex justify-between"><span className="text-zinc-500">Network:</span><span className="font-semibold">{MOMO_CONFIG.network ?? '[CONFIGURED NETWORK]'}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Account:</span><span className="font-semibold">{MOMO_CONFIG.accountName ?? '[ACCOUNT NAME]'}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Number:</span><span className="font-mono">{MOMO_CONFIG.accountNumber ?? '[NUMBER]'}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Amount:</span><span className="font-mono font-bold">GH₵ {String(order.total_amount)}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Ref:</span><span className="font-mono">CARTIVA-{String(order.order_number)}</span></div>
            </div>
            <div className="text-xs text-amber-700 mt-2">Payment stays <strong>Pending Payment</strong> until Admin verifies. Do not share PIN/OTP. You can track status here after refresh.</div>
          </div>
        )}
        <div className="mt-4 text-xs text-zinc-400 text-center">Order refreshes from Supabase — RLS ensures only your data. Payment via <code>order_payment_summary</code>, not client.</div>
      </div>
    </div>
  )
}
