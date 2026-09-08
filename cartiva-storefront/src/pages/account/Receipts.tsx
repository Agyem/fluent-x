import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Loading } from '../../components/Loading'
import ErrorState from '../../components/ErrorState'

const CEDI_FULL = (n: number) => 'GH₵' + Number(n).toLocaleString('en-GH', { maximumFractionDigits: 0 })

interface Receipt {
  id: string; amount: number; method: string; reference: string; created_at: string;
  order_id: string; order_number?: string | null; order_date?: string | null;
}

export default function AccountReceipts() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function load() {
      try {
        const { data: orders, error: oErr } = await supabase.from('orders').select('id, order_number, created_at').eq('customer_id', user!.id)
        if (oErr) throw oErr
        const list = (orders ?? []) as { id: string; order_number: string | null; created_at: string }[]
        if (list.length === 0) { if (!cancelled) setReceipts([]); return }
        const meta = new Map(list.map(o => [o.id, o]))
        const { data: pays, error: pErr } = await supabase.from('payments')
          .select('id, amount, method, reference, created_at, order_id')
          .in('order_id', list.map(o => o.id))
          .order('created_at', { ascending: false })
        if (pErr) {
          const code = (pErr as { code?: string }).code
          if (code === '42P01' || code === '42703') { if (!cancelled) setReceipts([]); return }
          throw pErr
        }
        if (!cancelled) {
          setReceipts(((pays ?? []) as Receipt[]).map(p => ({
            ...p,
            order_number: meta.get(p.order_id)?.order_number ?? null,
            order_date: meta.get(p.order_id)?.created_at ?? null,
          })))
        }
      } catch (e) { if (!cancelled) setErr((e as Error).message) }
      finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [user])

  if (loading) return <Loading label="Loading receipts..." />
  if (err) return <ErrorState message={err} />

  return (
    <div id="receipts" className="section">
      <div className="section-head">
        <small>TRANSACTION HISTORY</small>
        <h2>Receipts</h2>
        <p>Your official Cartiva transaction records.</p>
      </div>

      {receipts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🧾</div>
          <h3>No receipts yet</h3>
          <p>Receipts appear here after a verified payment.</p>
          <button className="orange-btn" onClick={() => navigate('/account/orders')}>View orders</button>
        </div>
      ) : (
        <div className="receipt-list">
          {receipts.map((r, i) => (
            <div key={r.id} className="receipt">
              <div className="receipt-icon">▤</div>
              <div className="receipt-info">
                <strong>Receipt #RCT-{(r.order_number || r.order_id).slice(0, 6).toUpperCase()}</strong>
                <span>Order #{r.order_number || r.order_id.slice(0, 8)} · {r.order_date ? new Date(r.order_date).toLocaleDateString() : ''} · {r.method}{i === 0 ? '' : ''}</span>
                <span style={{ fontFamily: 'monospace' }}>{r.reference}</span>
              </div>
              <div className="receipt-amount">{CEDI_FULL(r.amount)}</div>
              <button className="small-btn primary" onClick={() => navigate(`/account/orders/${r.order_id}`)}>View Receipt</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
