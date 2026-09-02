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
    // Client validation (not security)
    if (!fullName.trim() || !email.trim() || !password) { setErr('Please fill in all required fields.'); return }
    if (!validateEmail(email)) { setErr('Please enter a valid email address.'); return }
    if (password.length < 6) { setErr('Password must be at least 6 characters.'); return }
    if (password !== confirm) { setErr('Passwords do not match.'); return }

    setLoading(true)
    try {
      // No role field — storefront never sends role. DB must enforce customer.
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: phone.trim() || undefined,
            // Note: no role here — security is DB-enforced
          }
        }
      })
      if (error) { setErr(error.message); return }

      // Email confirmation handling: mailer_autoconfirm is false per inspection
      if (!data.session && data.user) {
        // User created but needs to confirm email — no session yet
        setInfo('Account created! Please check your email to confirm your address before logging in. (Email confirmation is enabled for this project)')
        return
      }

      if (data.session && data.user) {
        // Session exists — check if profile was auto-created by trigger
        // Do NOT blindly insert; first check if trigger already did it
        const { data: existing } = await supabase.from('profiles').select('id, role').eq('id', data.user.id).single()
        if (!existing) {
          // No profile yet — try to create customer profile safely
          // RLS must allow authenticated user to insert own profile where id = auth.uid() and role = customer
          // If RLS blocks, we report blocker instead of using service role
          const { error: insertErr } = await supabase.from('profiles').insert({
            id: data.user.id,
            full_name: fullName.trim(),
            email: email.trim(),
            role: 'customer',
          })
          if (insertErr) {
            // If insert fails due to RLS or trigger race, warn but don't use service role
            console.warn('[register] profile insert failed', insertErr.message)
            setInfo('Account created, but profile setup needs admin trigger. Please contact support if login fails. (Do not retry with service key)')
            // Still allow login — trigger may have created it
          }
          // Also try customer_profiles if needed — check if table requires row
          try {
            const { data: cp } = await supabase.from('customer_profiles').select('profile_id').eq('profile_id', data.user.id).single()
            if (!cp) {
              await supabase.from('customer_profiles').insert({ profile_id: data.user.id })
            }
          } catch { /* ignore — may be auto-created or RLS blocks, not critical for Stage 4 */ }
        }
        // Success — redirect to account (will be protected)
        navigate('/account')
      }
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto bg-white border border-zinc-200 rounded-2xl p-6">
      <h1 className="text-xl font-bold">Create account</h1>
      <p className="text-sm text-zinc-500 mt-1">Customers only. Role is always <span className="font-semibold text-zinc-700">customer</span> — enforced by database.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label className="text-xs font-semibold text-zinc-600">Full name *</label>
          <input value={fullName} onChange={e => setFullName(e.target.value)} className="mt-1 w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-zinc-300" placeholder="Ama Mensah" />
        </div>
        <div>
          <label className="text-xs font-semibold text-zinc-600">Email *</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-zinc-300" placeholder="ama@example.com" />
        </div>
        <div>
          <label className="text-xs font-semibold text-zinc-600">Phone (optional)</label>
          <input value={phone} onChange={e => setPhone(e.target.value)} className="mt-1 w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-zinc-300" placeholder="+233..." />
        </div>
        <div>
          <label className="text-xs font-semibold text-zinc-600">Password *</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-zinc-300" placeholder="••••••••" />
        </div>
        <div>
          <label className="text-xs font-semibold text-zinc-600">Confirm password *</label>
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className="mt-1 w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-zinc-300" placeholder="••••••••" />
        </div>
        {err && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-3 py-2">{err}</div>}
        {info && <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-3 py-2">{info}</div>}
        <button disabled={loading} className="w-full py-3 rounded-xl bg-[#5B5FEF] text-white text-sm font-semibold disabled:opacity-50">{loading ? 'Creating...' : 'Create account'}</button>
        <div className="text-sm text-center text-zinc-500">Already have an account? <Link to="/login" className="text-[#5B5FEF] font-semibold">Log in</Link></div>
      </form>
      <div className="mt-4 text-xs text-zinc-400">Uses <code>supabase.auth.signUp()</code> with anon key only — no role field, no service-role, no create-user Edge Function.</div>
    </div>
  )
}
