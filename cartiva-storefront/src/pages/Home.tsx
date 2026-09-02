import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getActiveCategories, getActiveProducts } from '../lib/catalogue'
import type { Category, Product } from '../lib/catalogue'
import { SkeletonCard } from '../components/Loading'
import ErrorState from '../components/ErrorState'
import Placeholder from '../components/Placeholder'

export default function Home() {
  const [cats, setCats] = useState<Category[] | null>(null)
  const [products, setProducts] = useState<Product[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [c, p] = await Promise.all([getActiveCategories(), getActiveProducts()])
        if (!cancelled) { setCats(c); setProducts(p) }
      } catch (e) {
        if (!cancelled) setErr((e as Error).message)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (err) return <ErrorState message={err} onRetry={() => location.reload()} />
  const loading = cats === null || products === null

  return (
    <div className="space-y-6">
      <div className="bg-[#14152B] text-white rounded-[20px] p-8 md:p-10">
        <h1 className="text-2xl md:text-3xl font-bold max-w-[520px]">Modern tech, delivered to your hall.</h1>
        <p className="text-sm text-white/70 mt-2 max-w-[460px]">Cartiva 2.0 storefront — same Supabase as the Management System. Clean, fast, mobile-first.</p>
        <Link to="/catalogue" className="inline-flex mt-5 px-5 py-2.5 rounded-xl bg-[#F2720E] text-white text-sm font-semibold">Shop catalogue</Link>
      </div>

      <section>
        <h2 className="text-sm font-bold tracking-wide uppercase text-zinc-500 mb-3">Categories</h2>
        {loading ? <div className="grid grid-cols-2 md:grid-cols-4 gap-3"><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
        : cats!.length === 0 ? <Placeholder title="No categories" desc="No active categories in database." />
        : <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {cats!.map(c => (
              <Link key={c.id} to={`/catalogue?category=${c.id}`} className="bg-white border border-zinc-200 rounded-2xl p-4 hover:border-zinc-300">
                <div className="text-sm font-semibold">{c.name}</div>
                <div className="text-xs text-zinc-500 mt-1">{c.icon ?? '—'}</div>
              </Link>
            ))}
          </div>}
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold tracking-wide uppercase text-zinc-500">Featured products</h2>
          <Link to="/catalogue" className="text-sm font-semibold text-[#5B5FEF] hover:underline">View all</Link>
        </div>
        {loading ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
        : products!.length === 0 ? <Placeholder title="No products" desc="No active products in database." />
        : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {products!.slice(0, 8).map(p => (
              <Link key={p.id} to={`/product/${p.id}`} className="bg-white border border-zinc-200 rounded-2xl p-4 hover:border-zinc-300 flex flex-col gap-2">
                <div className="text-xs text-zinc-500 uppercase tracking-wide">{p.product_type}</div>
                <div className="font-semibold line-clamp-2">{p.name}</div>
                <div className="text-sm font-bold">{p.sale_price != null ? `GH₵ ${p.sale_price}` : p.base_price != null ? `GH₵ ${p.base_price}` : '—'} {p.sale_price != null && p.base_price != null && p.sale_price < p.base_price && <span className="ml-2 text-xs font-normal line-through text-zinc-400">GH₵ {p.base_price}</span>}</div>
                <div className="text-xs text-zinc-400">SKU {p.sku ?? '—'}</div>
                <div className="mt-2 text-xs bg-zinc-50 border border-dashed border-zinc-200 rounded-xl p-3 text-zinc-500">Image placeholder — bucket missing (Stage 2A)</div>
              </Link>
            ))}
          </div>}
      </section>
    </div>
  )
}
