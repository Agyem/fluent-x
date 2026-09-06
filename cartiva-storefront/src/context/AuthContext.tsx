import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

type Profile = { id: string; role: string; full_name: string; email: string } | null

type AuthState = {
  user: User | null
  session: Session | null
  profile: Profile
  loading: boolean
  isCustomer: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  isCustomer: false,
  signOut: async () => {},
})

export const useAuth = () => useContext(AuthContext)

async function fetchProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').select('id, role, full_name, email').eq('id', userId).single()
  if (error) {
    // PGRST116 = 0 rows (profile not yet created by trigger)
    if ((error as { code?: string }).code === 'PGRST116') return null
    console.warn('[auth] fetchProfile error', error.message)
    return null
  }
  return data as Profile
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    // Initial session
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      const sess = data.session
      setSession(sess)
      setUser(sess?.user ?? null)
      if (sess?.user) {
        const p = await fetchProfile(sess.user.id)
        if (mounted) setProfile(p)
        supabase.from('customers').upsert(
          { id: sess.user.id, email: sess.user.email ?? '' },
          { onConflict: 'id', ignoreDuplicates: true }
        ).then(({ error }) => { if (error) console.warn('[auth] customers sync:', error.message) })
      }
      setLoading(false)
    })

    // Subscribe to changes
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, sess) => {
      setSession(sess)
      setUser(sess?.user ?? null)
      if (sess?.user) {
        const p = await fetchProfile(sess.user.id)
        setProfile(p)
        supabase.from('customers').upsert(
          { id: sess.user.id, email: sess.user.email ?? '' },
          { onConflict: 'id', ignoreDuplicates: true }
        ).then(({ error }) => { if (error) console.warn('[auth] customers sync:', error.message) })
      } else {
        setProfile(null)
      }
      setLoading(false)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const isCustomer = profile?.role === 'customer' || (!profile && !!user) // optimistic if profile not yet loaded but docs say all storefront users are customer

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, isCustomer, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
