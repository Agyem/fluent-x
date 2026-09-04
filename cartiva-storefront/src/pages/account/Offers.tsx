import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Loading } from '../../components/Loading'
import ErrorState from '../../components/ErrorState'

interface Coupon { id: string; code: string; description?: string; discount_percent: number; valid_until: string; used: boolean }

export default function AccountOffers() {
  const { user } = useAuth()
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function load() {
      try {
        const { data, error } = await supabase.from('coupons').select('id, code, discount_percent, valid_until, used').eq('customer_id', user!.id).order('valid_until', { ascending: false })
        if (error) {
          const code = (error as { code?: string }).code
          if (code === '42P01' || code === '42703') { if (!cancelled) setCoupons([]); return }
          throw error
        }
        if (!cancelled) setCoupons((data || []) as Coupon[])
      } catch (e) { if (!cancelled) setErr((e as Error).message) }
      finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [user])

  function copyCode(code: string) {
    navigator.clipboard.writeText(code)
    setCopied(code)
    setTimeout(() => setCopied(null), 2000)
  }

  if (loading) return <Loading label="Loading offers..." />
  if (err) return <ErrorState message={err} />

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Offers & coupons</h2>
      {coupons.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><path d="M7 7h.01"/></svg></div>
          <h3>No offers yet</h3>
          <p>Check back later for exclusive deals and discounts.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {coupons.map(c => (
            <div key={c.id} className={`card coupon-card${c.used ? ' used' : ''}`} style={{ opacity: c.used ? 0.5 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--primary)' }}>{c.discount_percent}% OFF</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{c.description || 'Discount on your next order'}</div>
                </div>
                {c.used && <span className="pill" style={{ background: 'var(--surface-muted)', color: 'var(--text-muted)', fontSize: 10 }}>Used</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="coupon-code">{c.code}</span>
                {!c.used && (
                  <button className="btn sm ghost" onClick={() => copyCode(c.code)}>
                    {copied === c.code ? 'Copied!' : 'Copy'}
                  </button>
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>Valid until {new Date(c.valid_until).toLocaleDateString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
