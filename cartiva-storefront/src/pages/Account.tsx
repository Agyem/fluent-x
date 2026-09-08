import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { Loading } from '../components/Loading'
import ErrorState from '../components/ErrorState'

export default function Account() {
  const { user, profile } = useAuth()
  const { count: cartCount } = useCart()
  const navigate = useNavigate()
  const [orderCount, setOrderCount] = useState(0)
  const [wishlistCount, setWishlistCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function load() {
      try {
        const [ordersRes, wlRes] = await Promise.all([
          supabase.from('orders').select('id', { count: 'exact', head: true }).eq('customer_id', user!.id),
          supabase.from('wishlist_items').select('id', { count: 'exact', head: true }).eq('customer_id', user!.id),
        ])
        if (ordersRes.error) throw ordersRes.error
        if (!cancelled) {
          setOrderCount(ordersRes.count || 0)
          setWishlistCount(wlRes.count || 0)
        }
      } catch (e) { if (!cancelled) setErr((e as Error).message) }
      finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [user])

  if (loading) return <Loading label="Loading overview..." />
  if (err) return <ErrorState message={err} />

  const name = (profile?.full_name as string) || user?.email?.split('@')[0] || 'Cartiva shopper'

  return (
    <div>
      <div className="eyebrow">Welcome back</div>
      <h2>Hello, {name}.</h2>
      <p>This account area is ready to connect to your authentication system and Supabase user profile.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginTop: 30 }}>
        <div style={{ background: '#f7f7f5', padding: 20, borderRadius: 15, cursor: 'pointer' }} onClick={() => navigate('/account/orders')}>
          <div style={{ fontSize: 10, color: '#888' }}>ORDERS</div>
          <strong style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 25 }}>{orderCount}</strong>
        </div>
        <div style={{ background: '#f7f7f5', padding: 20, borderRadius: 15, cursor: 'pointer' }} onClick={() => navigate('/account/wishlist')}>
          <div style={{ fontSize: 10, color: '#888' }}>WISHLIST</div>
          <strong style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 25 }}>{wishlistCount}</strong>
        </div>
        <div style={{ background: '#f7f7f5', padding: 20, borderRadius: 15, cursor: 'pointer' }} onClick={() => navigate('/account/cart')}>
          <div style={{ fontSize: 10, color: '#888' }}>CART ITEMS</div>
          <strong style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 25 }}>{cartCount}</strong>
        </div>
      </div>
    </div>
  )
}
