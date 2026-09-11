import { useNavigate, useLocation } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { supabase } from '../lib/supabase'
import FloatingCart from './FloatingCart'

export default function Header() {
  const [cartOpen, setCartOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [wishlistCount, setWishlistCount] = useState(0)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, signOut } = useAuth()
  const { count, lastAdded } = useCart()
  const dropdownRef = useRef<HTMLDivElement>(null)
  const firstRender = useRef(true)

  // Pop the cart drawer open whenever an item is added anywhere.
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    if (lastAdded > 0) setCartOpen(true)
  }, [lastAdded])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (!user) { setWishlistCount(0); return }
    let cancelled = false
    supabase.from('wishlist_items').select('id', { count: 'exact', head: true }).eq('customer_id', user.id).then(({ count: c }) => {
      if (!cancelled) setWishlistCount(c || 0)
    })
    return () => { cancelled = true }
  }, [user, location.pathname])

  const handleLogout = async () => { setDropdownOpen(false); await signOut(); navigate('/') }

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  const userName = (user?.user_metadata?.full_name as string) || user?.email?.split('@')[0] || 'User'
  const userInitials = userName.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()

  const goSearch = () => navigate('/search')
  const goCategories = () => {
    if (location.pathname === '/') {
      document.getElementById('categoriesSection')?.scrollIntoView({ behavior: 'smooth' })
    } else {
      navigate('/catalogue')
    }
  }

  return (
    <header className="site-header">
      <div className="container header-inner">
        <button className="logo" onClick={() => navigate('/')}>
          CARTIVA<span>.</span>
        </button>

        <nav className="desktop-nav">
          <button data-nav="home" className={isActive('/') && location.pathname === '/' ? 'active' : ''} onClick={() => navigate('/')}>Home</button>
          <button data-nav="shop" className={location.pathname.startsWith('/catalogue') ? 'active' : ''} onClick={() => navigate('/catalogue')}>Shop</button>
          <button onClick={goCategories}>Categories</button>
          <button data-nav="search" className={location.pathname.startsWith('/search') ? 'active' : ''} onClick={goSearch}>Search</button>
        </nav>

        <div className="header-actions">
          <button className="icon-btn" onClick={goSearch} aria-label="Search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
          </button>

          <button className="icon-btn" id="headerWishlistButton" onClick={() => navigate(user ? '/account/wishlist' : '/login')} aria-label="Wishlist">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.8 8.6c0 5.2-8.8 10.1-8.8 10.1S3.2 13.8 3.2 8.6A4.6 4.6 0 0 1 12 6.2a4.6 4.6 0 0 1 8.8 2.4Z" /></svg>
            <span className={`wishlist-badge${wishlistCount > 0 ? '' : ' hidden'}`} id="wishlistBadge">{wishlistCount}</span>
          </button>

          <button className="icon-btn" id="headerCartButton" onClick={() => setCartOpen(true)} aria-label="Cart">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 1.9-1.4L21 8H6" /><circle cx="9" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></svg>
            <span className={`cart-badge${count > 0 ? '' : ' empty'}`} id="cartBadge">{count}</span>
          </button>

          <div style={{ position: 'relative' }} ref={dropdownRef}>
            {user ? (
              <button className="icon-btn" onClick={() => setDropdownOpen(!dropdownOpen)} aria-label="Account">
                <span style={{ fontSize: 12, fontWeight: 800 }}>{userInitials}</span>
              </button>
            ) : (
              <button className="icon-btn" onClick={() => navigate('/login')} aria-label="Account">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.8-3.8 3.2-5.7 7-5.7s6.2 1.9 7 5.7" /></svg>
              </button>
            )}
            {dropdownOpen && user && (
              <div className="account-dropdown" onClick={e => e.stopPropagation()}>
                <div className="dd-head">
                  <div className="dd-name">{userName}</div>
                  <div className="dd-email">{user?.email ?? ''}</div>
                </div>
                <button className="dd-item" onClick={() => { setDropdownOpen(false); navigate('/account') }}>My Cartiva</button>
                <button className="dd-item" onClick={() => { setDropdownOpen(false); navigate('/account/orders') }}>Orders</button>
                <button className="dd-item" onClick={() => { setDropdownOpen(false); navigate('/account/wishlist') }}>Wishlist</button>
                <button className="dd-item" onClick={() => { setDropdownOpen(false); navigate('/account/notifications') }}>Notifications</button>
                <hr />
                <button className="dd-item" onClick={() => { setDropdownOpen(false); navigate('/account/settings') }}>Settings</button>
                <button className="dd-item" onClick={handleLogout}>Sign out</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <FloatingCart open={cartOpen} onClose={() => setCartOpen(false)} onOpen={() => setCartOpen(true)} />

      <nav className="mobile-bottom-nav">
        <button className={`mobile-nav-item${location.pathname === '/' ? ' active' : ''}`} data-mobile-nav="home" onClick={() => navigate('/')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m4 10 8-6 8 6v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" /></svg>
          Home
        </button>
        <button className={`mobile-nav-item${location.pathname.startsWith('/catalogue') ? ' active' : ''}`} data-mobile-nav="shop" onClick={() => navigate('/catalogue')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 7h14l-1 13H6L5 7Z" /><path d="M9 7a3 3 0 0 1 6 0" /></svg>
          Shop
        </button>
        <button className={`mobile-nav-item${location.pathname.startsWith('/search') ? ' active' : ''}`} data-mobile-nav="search" onClick={() => navigate('/search')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
          Search
        </button>
        <button className={`mobile-nav-item${location.pathname.startsWith('/account/wishlist') ? ' active' : ''}`} data-mobile-nav="wishlist" onClick={() => navigate(user ? '/account/wishlist' : '/login')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.8 8.6c0 5.2-8.8 10.1-8.8 10.1S3.2 13.8 3.2 8.6A4.6 4.6 0 0 1 12 6.2a4.6 4.6 0 0 1 8.8 2.4Z" /></svg>
          Wishlist
        </button>
        <button className={`mobile-nav-item${location.pathname.startsWith('/account') ? ' active' : ''}`} data-mobile-nav="account" onClick={() => navigate(user ? '/account' : '/login')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.8-3.8 3.2-5.7 7-5.7s6.2 1.9 7 5.7" /></svg>
          Account
        </button>
      </nav>
    </header>
  )
}
