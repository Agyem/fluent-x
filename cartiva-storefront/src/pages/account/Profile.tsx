import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Loading } from '../../components/Loading'
import ErrorState from '../../components/ErrorState'

export default function AccountProfile() {
  const { user } = useAuth()
  const [form, setForm] = useState({ full_name: '', email: '', phone: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function load() {
      try {
        const { data } = await supabase.from('profiles').select('full_name, email, phone').eq('id', user!.id).single()
        if (data && !cancelled) setForm({ full_name: (data as Record<string, unknown>).full_name as string || '', email: (data as Record<string, unknown>).email as string || user!.email || '', phone: (data as Record<string, unknown>).phone as string || '' })
      } catch (e) { if (!cancelled) setErr((e as Error).message) }
      finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [user])

  async function handleSave() {
    if (!user) return
    setSaving(true); setMsg(null); setErr(null)
    try {
      const { error } = await supabase.from('profiles').update({ full_name: form.full_name, phone: form.phone }).eq('id', user.id)
      if (error) throw error
      setMsg('Profile updated successfully.')
    } catch (e) { setErr((e as Error).message) }
    finally { setSaving(false) }
  }

  if (loading) return <Loading label="Loading profile..." />
  if (err && !form.full_name) return <ErrorState message={err} />

  const initials = form.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U'

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Profile</h2>
      <div className="card" style={{ padding: 24, maxWidth: 520 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <div className="avatar lg">{initials}</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{form.full_name || 'User'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{form.email}</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Full name</label>
            <input className="field" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', fontSize: 13 }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Email</label>
            <input className="field" value={form.email} disabled style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', fontSize: 13, background: 'var(--surface-muted)', color: 'var(--text-muted)' }} />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Email cannot be changed here.</div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Phone</label>
            <input className="field" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', fontSize: 13 }} />
          </div>
          {msg && <div style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>{msg}</div>}
          {err && <div style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 600 }}>{err}</div>}
          <button className="btn primary" style={{ width: 'fit-content' }} onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button>
        </div>
      </div>
    </div>
  )
}
