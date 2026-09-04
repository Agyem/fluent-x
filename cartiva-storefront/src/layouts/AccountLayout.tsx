import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useEffect, useRef, useState, type ReactElement } from 'react'

const NAV = [
  { group: 'General', items: [
    { path: '/account', label: 'Overview', icon: 'home' },
    { path: '/account/orders', label: 'Orders', icon: 'bag' },
    { path: '/account/addresses', label: 'Addresses', icon: 'map' },
    { path: '/account/wishlist', label: 'Wishlist', icon: 'heart' },
    { path: '/account/cart', label: 'Cart', icon: 'cart' },
  ]},
  { group: 'Activity', items: [
    { path: '/account/reviews', label: 'Reviews', icon: 'star' },
    { path: '/account/notifications', label: 'Notifications', icon: 'bell' },
    { path: '/account/payments', label: 'Payments', icon: 'card' },
    { path: '/account/offers', label: 'Offers', icon: 'tag' },
  ]},
  { group: 'Support', items: [
    { path: '/account/support', label: 'Help Center', icon: 'help' },
  ]},
  { group: 'Account', items: [
    { path: '/account/profile', label: 'Profile', icon: 'user' },
    { path: '/account/security', label: 'Security', icon: 'shield' },
    { path: '/account/settings', label: 'Settings', icon: 'gear' },
  ]},
]

function NavIcon({ name }: { name: string }) {
  const s = { width: 18, height: 18, viewBox: '0 0 24 24' as const, fill: 'none' as const, stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const icons: Record<string, ReactElement> = {
    home: <svg {...s}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>,
    bag: <svg {...s}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
    map: <svg {...s}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>,
    heart: <svg {...s}><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>,
    cart: <svg {...s}><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>,
    star: <svg {...s}><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>,
    bell: <svg {...s}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>,
    card: <svg {...s}><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,
    tag: <svg {...s}><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><path d="M7 7h.01"/></svg>,
    help: <svg {...s}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>,
    user: <svg {...s}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    shield: <svg {...s}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    gear: <svg {...s}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  }
  return icons[name] || <svg {...s}><circle cx="12" cy="12" r="10"/></svg>
}

export default function AccountLayout() {
  const { user, profile, signOut } = useAuth()
  const { count } = useCart()
  const navigate = useNavigate()
  const location = useLocation()
  const [ddOpen, setDdOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const ddRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ddRef.current && !ddRef.current.contains(e.target as Node)) setDdOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const initials = (profile?.full_name as string || 'U').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div id="app-shell">
      <aside className="sidebar">
        <div className="brand" style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
          <img src="/cartiva-logo.svg" alt="Cartiva" style={{ height: 36, width: 'auto' }} />
        </div>

        {NAV.map(g => (
          <div key={g.group}>
            <div className="nav-group-label">{g.group}</div>
            {g.items.map(item => {
              const active = item.path === '/account'
                ? location.pathname === '/account'
                : location.pathname.startsWith(item.path)
              return (
                <button
                  key={item.path}
                  className={`nav-item${active ? ' active' : ''}`}
                  onClick={() => { navigate(item.path); setMobileOpen(false) }}
                >
                  <NavIcon name={item.icon} />
                  {item.label}
                  {item.label === 'Cart' && count > 0 && <span className="nav-badge">{count}</span>}
                </button>
              )
            })}
          </div>
        ))}

        <div style={{ flex: 1 }} />
        <button className="nav-item" onClick={() => navigate('/')} style={{ color: 'var(--text-muted)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Back to shop
        </button>
      </aside>

      <div className="main">
        <div className="topbar">
          <div className="topbar-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input type="text" placeholder="Search orders, products..." />
          </div>
          <div className="topbar-right" ref={ddRef}>
            <button className="icon-btn" onClick={() => navigate('/account/notifications')}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
              <span className="dot" />
            </button>
            <div className="avatar sm" onClick={() => setDdOpen(!ddOpen)}>{initials}</div>
            {ddOpen && (
              <div className="account-dropdown">
                <div className="dd-head">
                  <div className="dd-name">{String(profile?.full_name || 'User')}</div>
                  <div className="dd-email">{String(profile?.email || user?.email || '')}</div>
                </div>
                <button className="dd-item" onClick={() => { navigate('/account/profile'); setDdOpen(false) }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  Profile
                </button>
                <button className="dd-item" onClick={() => { navigate('/account/orders'); setDdOpen(false) }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                  Orders
                </button>
                <button className="dd-item" onClick={() => { navigate('/account/settings'); setDdOpen(false) }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  Settings
                </button>
                <hr />
                <button className="dd-item" onClick={() => { signOut(); navigate('/'); setDdOpen(false) }} style={{ color: 'var(--danger)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
        <Outlet />
      </div>

      <div className={`mobile-topbar${mobileOpen ? ' open' : ''}`}>
        <div className="mobile-topbar-bar">
          <button className="icon-btn" onClick={() => setMobileOpen(!mobileOpen)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
          </button>
          <span className="brand-name" style={{ fontSize: 15 }}>Cartiva</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="icon-btn" onClick={() => navigate('/account/notifications')}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
            </button>
            <div className="avatar sm" onClick={() => navigate('/account/profile')}>{initials}</div>
          </div>
        </div>
      </div>

      {mobileOpen && <div className="mobile-sheet" onClick={() => setMobileOpen(false)} />}
      {mobileOpen && (
        <div className="mobile-sheet-inner">
          <div className="brand" style={{ padding: '4px 0 16px' }}>
            <img src="/cartiva-logo.svg" alt="Cartiva" style={{ height: 36, width: 'auto' }} />
          </div>
          {NAV.map(g => (
            <div key={g.group}>
              <div className="nav-group-label">{g.group}</div>
              {g.items.map(item => {
                const active = item.path === '/account'
                  ? location.pathname === '/account'
                  : location.pathname.startsWith(item.path)
                return (
                  <button
                    key={item.path}
                    className={`nav-item${active ? ' active' : ''}`}
                    onClick={() => { navigate(item.path); setMobileOpen(false) }}
                  >
                    <NavIcon name={item.icon} />
                    {item.label}
                  </button>
                )
              })}
            </div>
          ))}
          <button className="nav-item" onClick={() => { navigate('/'); setMobileOpen(false) }} style={{ color: 'var(--text-muted)', marginTop: 12 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Back to shop
          </button>
        </div>
      )}

      <div className="mobile-bottomnav">
        <button className={location.pathname === '/account' ? 'active' : ''} onClick={() => navigate('/account')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>
          Overview
        </button>
        <button className={location.pathname.startsWith('/account/orders') ? 'active' : ''} onClick={() => navigate('/account/orders')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
          Orders
        </button>
        <button className={location.pathname.startsWith('/account/wishlist') ? 'active' : ''} onClick={() => navigate('/account/wishlist')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
          Wishlist
        </button>
        <button className={location.pathname.startsWith('/account/cart') ? 'active' : ''} onClick={() => navigate('/account/cart')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
          Cart
          {count > 0 && <span className="mb-badge" />}
        </button>
      </div>
    </div>
  )
}
