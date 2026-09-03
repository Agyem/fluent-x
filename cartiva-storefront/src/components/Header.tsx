import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Search, ShoppingCart, Menu, X, LogOut } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import FloatingCart from './FloatingCart'

const nav = [
  { to: '/', label: 'Home' },
  { to: '/catalogue', label: 'Catalogue' },
  { to: '/orders', label: 'Orders' },
]

export default function Header() {
  const [open, setOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [q, setQ] = useState('')
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { count } = useCart()
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (q.trim()) navigate(`/catalogue?search=${encodeURIComponent(q.trim())}`)
  }
  const handleLogout = async () => { await signOut(); navigate('/'); }
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-zinc-200">
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-7 flex items-center gap-4 h-[60px]">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-[#F2720E] grid place-items-center text-white font-bold text-sm">C</div>
          <span className="font-bold text-[17px] tracking-tight hidden sm:inline">Cartiva</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 ml-2">
          {nav.map(n => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => `px-3 py-1.5 rounded-lg text-sm font-semibold ${isActive ? 'bg-[#FDF2E9] text-[#D35F09]' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'}`}>
              {n.label}
            </NavLink>
          ))}
        </nav>

        <form onSubmit={submit} className="flex-1 max-w-[420px] hidden sm:flex items-center gap-2 bg-zinc-100 rounded-xl px-3 py-2 ml-auto">
          <Search className="w-4 h-4 text-zinc-400 shrink-0" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search products..." className="bg-transparent outline-none text-sm w-full placeholder:text-zinc-400" />
        </form>

        <div className="flex items-center gap-2 ml-auto sm:ml-0">
          <button onClick={() => setCartOpen(true)} className="relative w-9 h-9 grid place-items-center rounded-xl border border-zinc-200 hover:bg-zinc-50">
            <ShoppingCart className="w-4 h-4" />
            {count > 0 && <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-[#5B5FEF] text-white text-[11px] font-bold">{count}</span>}
          </button>
          {user ? (
            <>
              <Link to="/account" className="w-9 h-9 grid place-items-center rounded-full bg-[#F2720E] text-white font-bold text-sm" title="Account">{user.email?.[0]?.toUpperCase() ?? 'U'}</Link>
              <button onClick={handleLogout} className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 text-sm font-semibold hover:bg-zinc-50"><LogOut className="w-4 h-4" />Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" className="hidden md:inline-flex px-3 py-1.5 rounded-xl border border-zinc-200 text-sm font-semibold">Login</Link>
              <Link to="/register" className="hidden md:inline-flex px-3 py-1.5 rounded-xl bg-[#F2720E] text-white text-sm font-semibold">Create Account</Link>
            </>
          )}
          <button className="md:hidden w-9 h-9 grid place-items-center rounded-xl border border-zinc-200" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-zinc-200 bg-white px-4 py-3 space-y-2">
          <form onSubmit={submit} className="flex items-center gap-2 bg-zinc-100 rounded-xl px-3 py-2">
            <Search className="w-4 h-4 text-zinc-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search..." className="bg-transparent outline-none text-sm w-full" />
          </form>
          {nav.map(n => <NavLink key={n.to} to={n.to} onClick={() => setOpen(false)} className="block px-3 py-2 rounded-lg text-sm font-medium hover:bg-zinc-100">{n.label}</NavLink>)}
          <div className="flex gap-2 pt-2 border-t border-zinc-100">
            {user ? (
              <>
                <Link to="/account" onClick={() => setOpen(false)} className="flex-1 text-center py-2 rounded-xl border border-zinc-200 text-sm font-semibold">Account</Link>
                <Link to="/orders" onClick={() => setOpen(false)} className="flex-1 text-center py-2 rounded-xl border border-zinc-200 text-sm font-semibold">Orders</Link>
                <button onClick={() => { setOpen(false); handleLogout() }} className="flex-1 text-center py-2 rounded-xl bg-zinc-900 text-white text-sm font-semibold">Logout</button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setOpen(false)} className="flex-1 text-center py-2 rounded-xl border border-zinc-200 text-sm font-semibold">Login</Link>
                <Link to="/register" onClick={() => setOpen(false)} className="flex-1 text-center py-2 rounded-xl bg-[#F2720E] text-white text-sm font-semibold">Create Account</Link>
              </>
            )}
          </div>
        </div>
      )}
      <FloatingCart open={cartOpen} onClose={() => setCartOpen(false)} />
    </header>
  )
}
