import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function validateEmail(v: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) }

export default function Register() {
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null); setInfo(null)
    if (!fullName.trim() || !email.trim() || !password) { setErr('Please fill in all required fields.'); return }
    if (!validateEmail(email)) { setErr('Please enter a valid email address.'); return }
    if (password.length < 6) { setErr('Password must be at least 6 characters.'); return }
    if (password !== confirm) { setErr('Passwords do not match.'); return }

    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName.trim(), phone: phone.trim() || undefined } }
      })
      if (error) { setErr(error.message); return }

      if (!data.session && data.user) {
        setInfo('Account created! Please check your email to confirm your address before logging in.')
        return
      }

      if (data.session && data.user) {
        const { data: existing } = await supabase.from('profiles').select('id, role').eq('id', data.user.id).single()
        if (!existing) {
          const { error: insertErr } = await supabase.from('profiles').insert({
            id: data.user.id, full_name: fullName.trim(), email: email.trim(), role: 'customer',
          })
          if (insertErr) {
            setInfo('Account created, but profile setup needs admin trigger. Please contact support if login fails.')
            return
          }
          try {
            const { data: cp } = await supabase.from('customer_profiles').select('profile_id').eq('profile_id', data.user.id).single()
            if (!cp) await supabase.from('customer_profiles').insert({ profile_id: data.user.id })
          } catch { /* ignore */ }
        }
        navigate('/account')
      }
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '0 auto' }}>
      <div className="card" style={{ padding: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Create account</h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>Customers only. Role is always <span style={{ fontWeight: 600 }}>customer</span> — enforced by database.</p>
        <form onSubmit={submit} style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Full name *</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Ama Mensah" style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', fontSize: 13, outline: 'none' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Email *</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ama@example.com" style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', fontSize: 13, outline: 'none' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Phone (optional)</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+233..." style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', fontSize: 13, outline: 'none' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Password *</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', fontSize: 13, outline: 'none' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Confirm password *</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', fontSize: 13, outline: 'none' }} />
          </div>
          {err && <div style={{ padding: '8px 12px', borderRadius: 9, background: 'var(--danger-light)', border: '1px solid var(--danger)', color: 'var(--danger)', fontSize: 13 }}>{err}</div>}
          {info && <div style={{ padding: '8px 12px', borderRadius: 9, background: 'var(--warning-light)', border: '1px solid var(--warning)', color: '#92600A', fontSize: 13 }}>{info}</div>}
          <button disabled={loading} className="btn primary block" style={{ opacity: loading ? 0.5 : 1 }}>{loading ? 'Creating...' : 'Create account'}</button>
          <div style={{ fontSize: 13, textAlign: 'center', color: 'var(--text-muted)' }}>Already have an account? <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>Log in</Link></div>
        </form>
      </div>
    </div>
  )
}
