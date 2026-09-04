import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Loading } from '../../components/Loading'
import ErrorState from '../../components/ErrorState'

interface Payment { id: string; amount: number; method: string; status: string; created_at: string; orders?: { id: string }[] }

export default function AccountPayments() {
  const { user } = useAuth()
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function load() {
      try {
        const { data, error } = await supabase.from('order_payment_summary').select('id, amount, method, status, created_at, orders(id)').eq('customer_id', user!.id).order('created_at', { ascending: false })
        if (error) throw error
        if (!cancelled) setPayments((data || []) as Payment[])
      } catch (e) { if (!cancelled) setErr((e as Error).message) }
      finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [user])

  if (loading) return <Loading label="Loading payments..." />
  if (err) return <ErrorState message={err} />

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Payment history</h2>
      {payments.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg></div>
          <h3>No payments yet</h3>
          <p>Your payment history will appear here after your first order.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 4, overflowX: 'auto' }}>
          <table className="table-simple">
            <thead><tr><th>Date</th><th>Order</th><th>Method</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id}>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="mono" style={{ fontSize: 12 }}>#{p.orders?.[0]?.id?.slice(0, 8) || '—'}</td>
                  <td style={{ textTransform: 'capitalize' }}>{p.method}</td>
                  <td className="mono" style={{ fontWeight: 600 }}>GH₵ {Number(p.amount).toFixed(2)}</td>
                  <td><span className="pill" style={{ background: p.status === 'verified' ? 'var(--success-light)' : 'var(--warning-light)', color: p.status === 'verified' ? 'var(--success)' : 'var(--warning)', fontSize: 11 }}>{p.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
