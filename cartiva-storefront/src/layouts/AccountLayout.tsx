import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'

const MENU = [
  { path: '/account', label: 'Overview', end: true },
  { path: '/account/orders', label: 'Orders' },
  { path: '/account/addresses', label: 'Addresses' },
  { path: '/account/wishlist', label: 'Wishlist' },
  { path: '/account/cart', label: 'Cart' },
  { path: '/account/reviews', label: 'Reviews' },
  { path: '/account/notifications', label: 'Notifications' },
  { path: '/account/offers', label: 'Offers' },
  { path: '/account/support', label: 'Help Center' },
  { path: '/account/profile', label: 'Profile' },
  { path: '/account/security', label: 'Security' },
  { path: '/account/settings', label: 'Settings' },
]

export default function AccountLayout() {
  const { signOut } = useAuth()
  const { count } = useCart()
  const navigate = useNavigate()
  const location = useLocation()

  const handleSignOut = async () => { await signOut(); navigate('/') }

  return (
    <div className="page">
      <section className="page-header">
        <div className="container">
          <div className="eyebrow">Your Cartiva</div>
          <h1>Your account.</h1>
          <p>Manage your orders, saved products and shopping activity.</p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 40 }}>
        <div className="container account-grid">
          <aside className="account-menu">
            {MENU.map(m => {
              const active = m.end ? location.pathname === '/account' : location.pathname.startsWith(m.path)
              return (
                <button key={m.path} className={active ? 'active' : ''} onClick={() => navigate(m.path)}>
                  {m.label}
                  {m.label === 'Cart' && count > 0 ? ` (${count})` : ''}
                </button>
              )
            })}
            <button onClick={() => navigate('/')}>← Back to shop</button>
            <button onClick={handleSignOut} style={{ color: 'var(--red)' }}>Sign out</button>
          </aside>

          <div className="account-panel">
            <Outlet />
          </div>
        </div>
      </section>
    </div>
  )
}
