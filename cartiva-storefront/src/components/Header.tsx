import { useNavigate, useLocation } from 'react-router-dom'
import { Search, ShoppingCart, Home, ShoppingBag, Heart, Bell, Settings, LogOut } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import FloatingCart from './FloatingCart'

export default function Header() {
  const [cartOpen, setCartOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [q, setQ] = useState('')
  const navigate = useNavigate()
  const location = useLocation()
  const { user, signOut } = useAuth()
  const { count } = useCart()
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (q.trim()) navigate(`/catalogue?search=${encodeURIComponent(q.trim())}`)
  }

  const handleLogout = async () => { setDropdownOpen(false); await signOut(); navigate('/') }

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'
  const userInitials = userName.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <div className="brand" style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
          <img src="/new_logo-removebg-preview%20(1).png" alt="Cartiva" style={{ height: 36, width: 'auto' }} />
          <span className="brand-name">Cartiva</span>
        </div>

        <nav className="site-nav">
          <button className={isActive('/') ? 'active' : ''} onClick={() => navigate('/')}>Home</button>
          <button className={isActive('/catalogue') ? 'active' : ''} onClick={() => navigate('/catalogue')}>Categories</button>
          <button className={isActive('/account/orders') ? 'active' : ''} onClick={() => navigate('/account/orders')}>Orders</button>
          <button className={isActive('/account/support') ? 'active' : ''} onClick={() => navigate('/account/support')}>Support</button>
        </nav>

        <div className="site-search">
          <Search />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(e) }}
            placeholder="Search products..."
          />
        </div>

        <div className="site-right">
          <button className="icon-btn cart-btn" onClick={() => setCartOpen(true)} aria-label="Cart">
            <ShoppingCart />
            {count > 0 && <span className="count">{count}</span>}
          </button>

          <div style={{ position: 'relative' }} ref={dropdownRef}>
            <div className="avatar" onClick={() => setDropdownOpen(!dropdownOpen)}>
              {userInitials}
            </div>
            {dropdownOpen && (
              <div className="account-dropdown" onClick={e => e.stopPropagation()}>
                <div className="dd-head">
                  <div className="dd-name">{userName}</div>
                  <div className="dd-email">{user?.email ?? ''}</div>
                </div>
                <button className="dd-item" onClick={() => { setDropdownOpen(false); navigate('/account') }}>
                  <Home />My Cartiva
                </button>
                <button className="dd-item" onClick={() => { setDropdownOpen(false); navigate('/account/orders') }}>
                  <ShoppingBag />Orders
                </button>
                <button className="dd-item" onClick={() => { setDropdownOpen(false); navigate('/account/wishlist') }}>
                  <Heart />Wishlist
                </button>
                <button className="dd-item" onClick={() => { setDropdownOpen(false); navigate('/account/notifications') }}>
                  <Bell />Notifications
                </button>
                <hr />
                <button className="dd-item" onClick={() => { setDropdownOpen(false); navigate('/account/settings') }}>
                  <Settings />Settings
                </button>
                <button className="dd-item" onClick={handleLogout}>
                  <LogOut />Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <FloatingCart open={cartOpen} onClose={() => setCartOpen(false)} />

      <div className="mobile-bottomnav">
        <button className={isActive('/') ? 'active' : ''} onClick={() => navigate('/')}>
          <Home /><span>Home</span>
        </button>
        <button className={isActive('/catalogue') ? 'active' : ''} onClick={() => navigate('/catalogue')}>
          <ShoppingBag /><span>Shop</span>
        </button>
        <button className={isActive('/cart') ? 'active' : ''} onClick={() => navigate('/cart')}>
          <ShoppingCart />{count > 0 && <span className="mb-badge" />}<span>Cart</span>
        </button>
        <button className={isActive('/account') ? 'active' : ''} onClick={() => navigate('/account')}>
          <Settings /><span>Account</span>
        </button>
      </div>
    </header>
  )
}
