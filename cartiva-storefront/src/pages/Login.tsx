import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation() as { state?: { from?: string } }
  const from = location.state?.from ?? '/account'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    if (!email.trim() || !password) { setErr('Please fill in all fields.'); return }
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) {
        if (error.message.toLowerCase().includes('email not confirmed')) {
          setErr('Please confirm your email first — check your inbox for the confirmation link.')
        } else if (error.message.toLowerCase().includes('invalid')) {
          setErr('Invalid email or password.')
        } else {
          setErr(error.message)
        }
        return
      }
      if (data.user) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single()
        if (profile && profile.role !== 'customer') {
          await supabase.auth.signOut()
          setErr('This storefront is for customers only. Admin/staff must use the Management System.')
          return
        }
      }
      navigate(from, { replace: true })
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '0 auto' }}>
      <div className="card" style={{ padding: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Log in</h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>Welcome back — customers only.</p>
        <form onSubmit={submit} style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ama@example.com" style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', fontSize: 13, outline: 'none' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', fontSize: 13, outline: 'none' }} />
          </div>
          {err && <div style={{ padding: '8px 12px', borderRadius: 9, background: 'var(--danger-light)', border: '1px solid var(--danger)', color: 'var(--danger)', fontSize: 13 }}>{err}</div>}
          <button disabled={loading} className="btn primary block" style={{ opacity: loading ? 0.5 : 1 }}>{loading ? 'Signing in...' : 'Log in'}</button>
          <div style={{ fontSize: 13, textAlign: 'center', color: 'var(--text-muted)' }}>No account? <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 600 }}>Create account</Link></div>
        </form>
      </div>
    </div>
  )
}
