import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'

const CEDI = (n: number) => '₵' + Number(n).toLocaleString('en-GH', { maximumFractionDigits: 0 })

const MENU: { group: string; items: { path: string; label: string; icon: string; end?: boolean }[] }[] = [
  { group: 'ACCOUNT', items: [
    { path: '/account', label: 'Overview', icon: '⌂', end: true },
    { path: '/account/orders', label: 'My Orders', icon: '▣' },
    { path: '/account/wishlist', label: 'Wishlist', icon: '♡' },
    { path: '/account/receipts', label: 'Receipts', icon: '▤' },
  ]},
  { group: 'PERSONAL', items: [
    { path: '/account/profile', label: 'Profile', icon: '◎' },
    { path: '/account/addresses', label: 'Delivery', icon: '⌖' },
    { path: '/account/settings', label: 'Settings', icon: '⚙' },
  ]},
  { group: 'MORE', items: [
    { path: '/account/cart', label: 'Cart', icon: '🛒' },
    { path: '/account/reviews', label: 'Reviews', icon: '★' },
    { path: '/account/notifications', label: 'Notifications', icon: '🔔' },
    { path: '/account/offers', label: 'Offers', icon: '🎟' },
    { path: '/account/support', label: 'Help Center', icon: '?' },
    { path: '/account/security', label: 'Security', icon: '🛡' },
  ]},
]

export default function AccountLayout() {
  const { user, profile, signOut } = useAuth()
  const { count } = useCart()
  const navigate = useNavigate()
  const location = useLocation()

  const [orderCount, setOrderCount] = useState(0)
  const [wishlistCount, setWishlistCount] = useState(0)
  const [totalSpent, setTotalSpent] = useState(0)
  const [receiptCount, setReceiptCount] = useState(0)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function load() {
      try {
        const { data: orders } = await supabase.from('orders').select('id, total_amount').eq('customer_id', user!.id)
        const list = (orders ?? []) as { id: string; total_amount: number }[]
        let receipts = 0
        if (list.length > 0) {
          const { count: rc } = await supabase.from('payments').select('id', { count: 'exact', head: true }).in('order_id', list.map(o => o.id))
          receipts = rc || 0
        }
        const { count: wc } = await supabase.from('wishlist_items').select('id', { count: 'exact', head: true }).eq('customer_id', user!.id)
        if (!cancelled) {
          setOrderCount(list.length)
          setTotalSpent(list.reduce((s, o) => s + Number(o.total_amount || 0), 0))
          setReceiptCount(receipts)
          setWishlistCount(wc || 0)
        }
      } catch { /* metrics stay zeroed */ }
    }
    load()
    return () => { cancelled = true }
  }, [user, location.pathname])

  const fullName = String(profile?.full_name || user?.user_metadata?.full_name || 'Cartiva shopper')
  const email = String(profile?.email || user?.email || '')
  const initials = fullName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U'

  const isActive = (path: string, end?: boolean) =>
    end ? location.pathname === '/account' : (location.pathname === path || location.pathname.startsWith(path + '/'))

  const handleSignOut = async () => { await signOut(); navigate('/') }

  return (
    <div className="acct">
      <header className="acct-topbar">
        <button className="logo" onClick={() => navigate('/')}>CARTIVA<span>.</span></button>
        <div className="acct-top-actions">
          <button className="nav-icon" onClick={() => navigate('/search')} aria-label="Search">⌕</button>
          <button className="nav-icon" onClick={() => navigate('/account/wishlist')} aria-label="Wishlist">♡</button>
          <button className="nav-icon" onClick={() => navigate('/account/cart')} aria-label="Cart">🛒{count > 0 && <span className="cart-count">{count}</span>}</button>
          <button className="acct-signout-btn" onClick={handleSignOut}>Sign out</button>
        </div>
      </header>

      <main className="acct-page">
        <section className="profile-hero">
          <div className="profile-main">
            <div className="identity">
              <div className="avatar">{initials}</div>
              <div>
                <div className="welcome">Welcome back 👋</div>
                <h1>{fullName}</h1>
                <p>{email}</p>
              </div>
            </div>
            <div className="profile-actions">
              <button className="light-btn" onClick={() => navigate('/account/profile')}>Edit Profile</button>
              <button className="orange-btn" onClick={() => navigate('/account/orders')}>View Orders</button>
            </div>
          </div>
        </section>

        <section className="metrics">
          <div className="metric" onClick={() => navigate('/account/orders')}>
            <div className="metric-icon">📦</div>
            <div><small>ORDERS</small><strong>{orderCount}</strong></div>
          </div>
          <div className="metric" onClick={() => navigate('/account/wishlist')}>
            <div className="metric-icon">♡</div>
            <div><small>WISHLIST</small><strong>{wishlistCount}</strong></div>
          </div>
          <div className="metric" onClick={() => navigate('/account/receipts')}>
            <div className="metric-icon">₵</div>
            <div><small>TOTAL SPENT</small><strong>{CEDI(totalSpent)}</strong></div>
          </div>
          <div className="metric" onClick={() => navigate('/account/receipts')}>
            <div className="metric-icon">🧾</div>
            <div><small>RECEIPTS</small><strong>{receiptCount}</strong></div>
          </div>
        </section>

        <div className="content-layout">
          <aside className="acct-sidebar">
            <button className="side-link" onClick={() => navigate('/')} style={{ color: 'var(--orange)', fontWeight: 800 }}>
              <span className="side-icon">←</span>Back to shop
            </button>
            {MENU.map(g => (
              <div key={g.group}>
                <div className="nav-label">{g.group}</div>
                {g.items.map(item => (
                  <button
                    key={item.path}
                    className={`side-link${isActive(item.path, item.end) ? ' active' : ''}`}
                    onClick={() => navigate(item.path)}
                  >
                    <span className="side-icon">{item.icon}</span>{item.label}
                  </button>
                ))}
              </div>
            ))}
            <div className="side-divider" />
            <button className="side-link" onClick={handleSignOut}><span className="side-icon">↪</span>Sign Out</button>
          </aside>

          <section className="main-content">
            <Outlet />
          </section>
        </div>
      </main>

      <nav className="mobile-nav">
        <button className={location.pathname === '/' ? 'active' : ''} onClick={() => navigate('/')}><span>⌂</span>Home</button>
        <button className={location.pathname.startsWith('/account/orders') ? 'active' : ''} onClick={() => navigate('/account/orders')}><span>▣</span>Orders</button>
        <button className={location.pathname.startsWith('/account/wishlist') ? 'active' : ''} onClick={() => navigate('/account/wishlist')}><span>♡</span>Wishlist</button>
        <button className={location.pathname.startsWith('/account/receipts') ? 'active' : ''} onClick={() => navigate('/account/receipts')}><span>▤</span>Receipts</button>
        <button className={location.pathname.startsWith('/account/profile') ? 'active' : ''} onClick={() => navigate('/account/profile')}><span>◎</span>Profile</button>
      </nav>
    </div>
  )
}
