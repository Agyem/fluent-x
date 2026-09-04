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
        if (error) {
          if ((error as { code?: string }).code === '42P01' || (error as { code?: string }).code === '42703') { if (!cancelled) setPayments([]); return }
          throw error
        }
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

      <div className="card" style={{ padding: 20, marginTop: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Payment Help</h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>CARTIVA aims to make your shopping experience simple and secure.</p>

        <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Payment Methods</h4>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>We accept the payment methods displayed on our website at checkout. Available payment options may vary depending on your location.</p>

        <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Payment Confirmation</h4>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>Your order will be processed once payment has been successfully confirmed. Please keep your payment confirmation or transaction details until your order has been received.</p>

        <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Failed or Pending Payments</h4>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>If your payment fails or remains pending, please avoid making multiple payments for the same order. Contact us with your order details so we can assist you.</p>

        <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Payment Issues</h4>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>If you have been charged but your order has not been confirmed, please contact CARTIVA customer support and provide your payment or transaction reference where available.</p>

        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>For assistance with payment, please contact our support team.</p>
      </div>
    </div>
  )
}
