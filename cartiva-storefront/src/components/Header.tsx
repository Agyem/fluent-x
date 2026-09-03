import { Link, useNavigate } from 'react-router-dom'
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
  const handleLogout = async () => { await signOut(); navigate('/') }
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <div class="brand" style="cursor:pointer;" onClick={() => navigate('/')}>
          <div class="w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold bg-[#F2720E] text-white">C</div>
          <span className="font-bold text-[17px] tracking-tight hidden sm:inline">Cartiva</span>
        </div>

        <nav className="site-nav">
          {nav.map(n => (
            <button key={n.to} className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${navigate().route === n.to ? 'bg-[#FDF2E9] text-[#D35F09]' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'}`} onClick={() => navigate(n.to)}>
              {n.label}
            </button>
          ))}
        </nav>

        <div class="site-search">
          <Search className="w-4 h-4 text-zinc-400 shrink-0" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search products..." className="bg-transparent outline-none text-sm w-full placeholder:text-zinc-400" />
        </div>

        <div class="site-right">
          <button onClick={() => setCartOpen(true)} className="relative icon-btn">
            <ShoppingCart className="w-4 h-4" />
            {count > 0 && <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 grid place-items-center rounded-full bg-[#F2720E] text-white text-[10px] font-bold]">{count}</span>}
          </button>
          {user ? (
            <>
              <div class="avatar" onClick={() => navigate('/account')}>{user.email?.[0]?.toUpperCase() ?? 'U'}</div>
            </>
          ) : (
            <>
              <button className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 text-sm font-semibold hover:bg-zinc-50">Login</button>
              <button className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F2720E] text-white text-sm font-semibold">Create Account</button>
            </>
          )}
          <button className="md:hidden w-9 h-9 grid place-items-center rounded-xl border border-zinc-200" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <FloatingCart open={cartOpen} onClose={() => setCartOpen(false)} />
    </header>
  )
}