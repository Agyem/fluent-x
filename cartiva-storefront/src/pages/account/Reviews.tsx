import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Loading } from '../../components/Loading'
import ErrorState from '../../components/ErrorState'

interface Review { id: string; rating: number; comment: string; status: string; created_at: string; product_id?: string }

export default function AccountReviews() {
  const { user } = useAuth()
  const [reviews, setReviews] = useState<Review[]>([])
  const [tab, setTab] = useState<'pending' | 'published'>('pending')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function load() {
      try {
        const { data, error } = await supabase.from('reviews').select('id, rating, comment, status, created_at, product_id').eq('customer_id', user!.id).order('created_at', { ascending: false })
        if (error) {
          if (!cancelled) setReviews([])
          return
        }
        if (!cancelled) setReviews((data || []) as Review[])
      } catch (e) { if (!cancelled) setErr((e as Error).message) }
      finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [user])

  if (loading) return <Loading label="Loading reviews..." />
  if (err) return <ErrorState message={err} />

  const filtered = reviews.filter(r => tab === 'pending' ? r.status === 'pending' : r.status === 'published')

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Reviews</h2>
      <div className="tabbar">
        <button className={tab === 'pending' ? 'active' : ''} onClick={() => setTab('pending')}>Pending</button>
        <button className={tab === 'published' ? 'active' : ''} onClick={() => setTab('published')}>Published</button>
      </div>
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg></div>
          <h3>No {tab} reviews</h3>
          <p>{tab === 'pending' ? 'All caught up! No pending reviews.' : 'Your published reviews will appear here.'}</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 4 }}>
          {filtered.map(r => (
            <div key={r.id} className="product-row" style={{ padding: '14px 14px', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="product-name">Product</div>
                  <div className="star-row readonly" style={{ marginTop: 4 }}>
                    {[1, 2, 3, 4, 5].map(s => (
                      <svg key={s} className={s <= r.rating ? 'on' : ''} width="14" height="14" viewBox="0 0 24 24" fill={s <= r.rating ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>
                    ))}
                  </div>
                </div>
                <span className="pill" style={{ background: r.status === 'published' ? 'var(--success-light)' : 'var(--warning-light)', color: r.status === 'published' ? 'var(--success)' : 'var(--warning)', fontSize: 11 }}>{r.status}</span>
              </div>
              {r.comment && <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{r.comment}</div>}
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(r.created_at).toLocaleDateString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
