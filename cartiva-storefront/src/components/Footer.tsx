import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="bg-[#2B2D2F] text-zinc-300 mt-12">
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-7 py-10 grid grid-cols-2 md:grid-cols-5 gap-8">
        <div className="col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-[#F2720E] grid place-items-center text-white font-bold text-sm">C</div>
            <span className="font-bold text-white">Cartiva 2.0</span>
            <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full">Storefront</span>
          </div>
          <p className="text-sm text-zinc-400 max-w-[280px] leading-relaxed">Modern tech e-commerce — same Supabase as the Management System. Management → Supabase ← Storefront. No direct .exe connection.</p>
        </div>
        <div>
          <h4 className="text-xs font-bold tracking-widest text-zinc-500 uppercase mb-3">Shop</h4>
          <ul className="space-y-2 text-sm">
            <li><Link to="/catalogue" className="hover:text-white">Catalogue</Link></li>
            <li><Link to="/catalogue" className="hover:text-white">New arrivals</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-bold tracking-widest text-zinc-500 uppercase mb-3">Account</h4>
          <ul className="space-y-2 text-sm">
            <li><Link to="/account" className="hover:text-white">My account</Link></li>
            <li><Link to="/orders" className="hover:text-white">Orders</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-bold tracking-widest text-zinc-500 uppercase mb-3">Help</h4>
          <ul className="space-y-2 text-sm">
            <li><span className="text-zinc-500">Support — coming soon</span></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-7 py-4 flex flex-col sm:flex-row gap-2 justify-between text-xs text-zinc-500">
          <span>© 2026 Cartiva 2.0 — Storefront foundation</span>
          <span>VITE_SUPABASE_URL connected · anon key only</span>
        </div>
      </div>
    </footer>
  )
}
