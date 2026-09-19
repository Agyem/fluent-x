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
    <div className="page">
      <section className="section"><div className="container" style={{ maxWidth: 460 }}>
        <div className="eyebrow">Welcome back</div>
        <h1 className="section-title" style={{ marginBottom: 8 }}>Log in.</h1>
        <p className="section-description" style={{ marginBottom: 24 }}>Access your Cartiva orders and wishlist.</p>
        <form onSubmit={submit} style={{ display: 'grid', gap: 10 }}>
          <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" />
          <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" />
          {err && <div style={{ padding: '12px 14px', borderRadius: 12, background: '#fee2e2', border: '1px solid var(--red)', color: 'var(--red)', fontSize: 13 }}>{err}</div>}
          <button disabled={loading} className="primary-btn full-btn" style={{ opacity: loading ? 0.6 : 1 }}>{loading ? 'Signing in...' : 'Log in →'}</button>
          <div style={{ fontSize: 13, textAlign: 'center', color: 'var(--muted)' }}>No account? <Link to="/register" style={{ color: 'var(--orange)', fontWeight: 700 }}>Create account</Link></div>
        </form>
      </div></section>
    </div>
  )
}
