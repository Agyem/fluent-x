import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function validateEmail(v: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) }

export default function Register() {
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
        setInfo('Account created successfully! You can now log in.')
        return
      }

      if (data.session && data.user) {
        const { data: existing } = await supabase.from('profiles').select('id, role').eq('id', data.user.id).single()
        if (!existing) {
          await supabase.from('profiles').insert({
            id: data.user.id, full_name: fullName.trim(), email: email.trim(), role: 'customer',
          })
          try {
            const { data: cp } = await supabase.from('customer_profiles').select('profile_id').eq('profile_id', data.user.id).single()
            if (!cp) await supabase.from('customer_profiles').insert({ profile_id: data.user.id })
          } catch { /* ignore */ }
        }
        setInfo('Account created successfully! You can now log in.')
      }
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <section className="section"><div className="container" style={{ maxWidth: 460 }}>
        {info ? (
          <div style={{ textAlign: 'center' }}>
            <div className="success-circle">✓</div>
            <h1 className="order-number">Account created!</h1>
            <p style={{ color: '#737373', fontSize: 13, marginBottom: 20 }}>Your account has been created successfully. You can now log in to start shopping.</p>
            <Link to="/login" className="primary-btn full-btn">Log in</Link>
          </div>
        ) : (
          <>
            <div className="eyebrow">Join Cartiva</div>
            <h1 className="section-title" style={{ marginBottom: 8 }}>Create account.</h1>
            <p className="section-description" style={{ marginBottom: 24 }}>Start shopping with CARTIVA in minutes.</p>
            <form onSubmit={submit} style={{ display: 'grid', gap: 10 }}>
              <input className="input" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Full name *" />
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address *" />
              <input className="input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone (optional)" />
              <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password *" />
              <input className="input" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Confirm password *" />
              {err && <div style={{ padding: '12px 14px', borderRadius: 12, background: '#fee2e2', border: '1px solid var(--red)', color: 'var(--red)', fontSize: 13 }}>{err}</div>}
              <button disabled={loading} className="primary-btn full-btn" style={{ opacity: loading ? 0.6 : 1 }}>{loading ? 'Creating...' : 'Create account →'}</button>
              <div style={{ fontSize: 13, textAlign: 'center', color: 'var(--muted)' }}>Already have an account? <Link to="/login" style={{ color: 'var(--orange)', fontWeight: 700 }}>Log in</Link></div>
            </form>
          </>
        )}
      </div></section>
    </div>
  )
}
