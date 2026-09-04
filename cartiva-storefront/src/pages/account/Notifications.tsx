import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Loading } from '../../components/Loading'
import ErrorState from '../../components/ErrorState'

interface Notification { id: string; title: string; message: string; read: boolean; created_at: string }

export default function AccountNotifications() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function load() {
      try {
        const { data, error } = await supabase.from('notifications').select('*').eq('customer_id', user!.id).order('created_at', { ascending: false }).limit(50)
        if (error) {
          if ((error as { code?: string }).code === '42P01') { if (!cancelled) setNotifications([]); return }
          throw error
        }
        if (!cancelled) setNotifications((data || []) as Notification[])
      } catch (e) { if (!cancelled) setErr((e as Error).message) }
      finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [user])

  async function markRead(id: string) {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  async function markAllRead() {
    if (!user) return
    await supabase.from('notifications').update({ read: true }).eq('customer_id', user!.id).eq('read', false)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  if (loading) return <Loading label="Loading notifications..." />
  if (err) return <ErrorState message={err} />

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Notifications {unreadCount > 0 && <span className="mono" style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 400 }}>({unreadCount} unread)</span>}</h2>
        {unreadCount > 0 && <button className="btn sm ghost" onClick={markAllRead}>Mark all read</button>}
      </div>
      {notifications.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg></div>
          <h3>No notifications</h3>
          <p>You're all caught up!</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 4 }}>
          {notifications.map(n => (
            <div key={n.id} className={`notif-row${!n.read ? ' unread' : ''}`} style={{ padding: !n.read ? '13px 12px' : '13px 14px', cursor: 'pointer' }} onClick={() => markRead(n.id)}>
              <div className="notif-icon" style={{ background: n.read ? 'var(--surface-muted)' : 'var(--primary-light)', color: n.read ? 'var(--text-muted)' : 'var(--primary)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: n.read ? 500 : 700, fontSize: 13 }}>{n.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{n.message}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{new Date(n.created_at).toLocaleDateString()}</div>
              </div>
              {!n.read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0 }} />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
