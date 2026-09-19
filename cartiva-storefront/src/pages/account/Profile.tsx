import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Loading } from '../../components/Loading'
import ErrorState from '../../components/ErrorState'

export default function AccountProfile() {
  const { user } = useAuth()
  const [form, setForm] = useState({ first: '', last: '', email: '', phone: '' })
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
        if (data && !cancelled) {
          const full = String((data as Record<string, unknown>).full_name || '')
          const parts = full.split(' ')
          setForm({
            first: parts[0] || '',
            last: parts.slice(1).join(' ') || '',
            email: String((data as Record<string, unknown>).email || user!.email || ''),
            phone: String((data as Record<string, unknown>).phone || ''),
          })
        }
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
      const full_name = `${form.first} ${form.last}`.trim()
      const { error } = await supabase.from('profiles').update({ full_name, phone: form.phone }).eq('id', user.id)
      if (error) throw error
      setMsg('Profile updated successfully.')
    } catch (e) { setErr((e as Error).message) }
    finally { setSaving(false) }
  }

  if (loading) return <Loading label="Loading profile..." />
  if (err && !form.first) return <ErrorState message={err} />

  return (
    <div id="profile" className="section">
      <div className="section-head">
        <small>PERSONAL INFORMATION</small>
        <h2>My Profile</h2>
        <p>Keep your Cartiva account information up to date.</p>
      </div>

      <div className="form-panel">
        <div className="form-grid">
          <div className="field">
            <label>FIRST NAME</label>
            <input value={form.first} onChange={e => setForm(f => ({ ...f, first: e.target.value }))} />
          </div>
          <div className="field">
            <label>LAST NAME</label>
            <input value={form.last} onChange={e => setForm(f => ({ ...f, last: e.target.value }))} />
          </div>
          <div className="field">
            <label>EMAIL ADDRESS</label>
            <input value={form.email} disabled style={{ background: '#f7f7f7', color: '#999' }} />
          </div>
          <div className="field">
            <label>PHONE NUMBER</label>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+233 XX XXX XXXX" />
          </div>
        </div>
        {msg && <div style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600, marginTop: 14 }}>{msg}</div>}
        {err && <div style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 600, marginTop: 14 }}>{err}</div>}
        <div className="save-row">
          <button className="orange-btn" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : msg ? 'Saved ✓' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  )
}
