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
        // Handle unconfirmed email, invalid credentials, etc.
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
        // Verify profile is customer (storefront must not allow admin/staff)
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
    <div className="max-w-md mx-auto bg-white border border-zinc-200 rounded-2xl p-6">
      <h1 className="text-xl font-bold">Log in</h1>
      <p className="text-sm text-zinc-500 mt-1">Welcome back — customers only.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label className="text-xs font-semibold text-zinc-600">Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-zinc-300" placeholder="ama@example.com" />
        </div>
        <div>
          <label className="text-xs font-semibold text-zinc-600">Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-zinc-300" placeholder="••••••••" />
        </div>
        {err && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-3 py-2">{err}</div>}
        <button disabled={loading} className="w-full py-3 rounded-xl bg-zinc-900 text-white text-sm font-semibold disabled:opacity-50">{loading ? 'Signing in...' : 'Log in'}</button>
        <div className="text-sm text-center text-zinc-500">No account? <Link to="/register" className="text-[#5B5FEF] font-semibold">Create account</Link></div>
      </form>
      <div className="mt-4 text-xs text-zinc-400">Uses <code>supabase.auth.signInWithPassword()</code> — no admin APIs.</div>
    </div>
  )
}
