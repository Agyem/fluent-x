import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Loading } from '../components/Loading'
import ErrorState from '../components/ErrorState'

export default function Account() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null)
  const [customer, setCustomer] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function load() {
      try {
        const { data: p, error: pe } = await supabase.from('profiles').select('id, full_name, email, role').eq('id', user!.id).single()
        if (pe && (pe as { code?: string }).code !== 'PGRST116') throw pe
        const { data: cp, error: ce } = await supabase.from('customer_profiles').select('profile_id, school, delivery_address').eq('profile_id', user!.id).single()
        if (ce && (ce as { code?: string }).code !== 'PGRST116') throw ce
        if (!cancelled) { setProfile(p as Record<string, unknown>); setCustomer(cp as Record<string, unknown>); }
      } catch (e) { if (!cancelled) setErr((e as Error).message) }
      finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [user])

  if (loading) return <Loading label="Loading account..." />
  if (err) return <ErrorState message={err} />
  if (!profile) return <ErrorState message="Profile not found — if you just registered, please confirm your email and log in again. (Trigger may not have created profile yet)" />

  return (
    <div className="max-w-2xl mx-auto bg-white border border-zinc-200 rounded-2xl p-6 space-y-4">
      <h1 className="text-xl font-bold">My account</h1>
      <div className="grid gap-3 text-sm">
        <div className="flex justify-between border-b border-zinc-100 py-2"><span className="text-zinc-500">Full name</span><span className="font-semibold">{String(profile.full_name ?? '—')}</span></div>
        <div className="flex justify-between border-b border-zinc-100 py-2"><span className="text-zinc-500">Email</span><span className="font-semibold">{String(profile.email ?? user?.email ?? '—')}</span></div>
        <div className="flex justify-between border-b border-zinc-100 py-2"><span className="text-zinc-500">Role</span><span className="font-mono text-xs bg-zinc-100 px-2 py-1 rounded-full">{String(profile.role ?? '—')}</span></div>
        <div className="flex justify-between border-b border-zinc-100 py-2"><span className="text-zinc-500">User ID</span><span className="font-mono text-xs">{String(profile.id).slice(0, 8)}…</span></div>
        {customer && <div className="flex justify-between py-2"><span className="text-zinc-500">School</span><span className="font-semibold">{String(customer.school ?? '—')}</span></div>}
      </div>
      <div className="text-xs text-zinc-400">Read-only display from <code>profiles</code> + <code>customer_profiles</code> via RLS (own row only). No editing in this stage.</div>
    </div>
  )
}
