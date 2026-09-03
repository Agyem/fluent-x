import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getActiveCategories, getActiveProducts, getProductVariants } from '../lib/catalogue'
import type { Category, Product } from '../lib/catalogue'
import { SkeletonCard } from '../components/Loading'
import ErrorState from '../components/ErrorState'
import Placeholder from '../components/Placeholder'
import { displayCategoryName } from '../lib/categoryDisplay'

export default function Home() {
  const [cats, setCats] = useState<Category[] | null>(null)
  const [products, setProducts] = useState<Product[] | null>(null)
  const [variantPrices, setVariantPrices] = useState<Record<string, number | null>>({})
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [c, p] = await Promise.all([getActiveCategories(), getActiveProducts()])
        if (cancelled) return
        setCats(c); setProducts(p)
        // For variable products, fetch authoritative variant price to avoid GH₵0
        const priceMap: Record<string, number | null> = {}
        await Promise.all(p.map(async prod => {
          if (prod.product_type === 'variable') {
            try {
              const vars = await getProductVariants(prod.id)
              const priced = vars.filter(v => v.price > 0 || (v.sale_price ?? 0) > 0)
              if (priced.length > 0) {
                const best = priced.reduce((min, v) => {
                  const pv = v.sale_price ?? v.price
                  const mv = min.sale_price ?? min.price
                  return pv < mv ? v : min
                })
                priceMap[prod.id] = best.sale_price ?? best.price
              } else priceMap[prod.id] = null
            } catch { priceMap[prod.id] = null }
          } else {
            priceMap[prod.id] = prod.sale_price ?? prod.base_price ?? null
          }
        }))
        if (!cancelled) setVariantPrices(priceMap)
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
      <div className="bg-gradient-to-br from-[#14152B] via-[#1e1f3a] to-[#2a2d5a] text-white rounded-[20px] p-8 md:p-10 relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-[#F2720E]/20 rounded-full blur-2xl" />
        <div className="absolute -left-6 -bottom-6 w-32 h-32 bg-[#5B5FEF]/15 rounded-full blur-xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur px-3 py-1 rounded-full text-xs font-semibold tracking-wide">✦ New arrivals • Free delivery over GH₵500</div>
          <h1 className="text-2xl md:text-4xl font-bold max-w-[560px] mt-3 leading-tight">Smartphones, Laptops & Home Tech — <span className="text-[#F2B705]">delivered fast</span> across Ghana.</h1>
          <p className="text-sm text-white/70 mt-3 max-w-[520px]">Shop authentic smartphones, laptops, audio & wearables, accessories and home appliances. Secure checkout, 3–7 day Air or 14–30 day Sea delivery.</p>
          <div className="flex gap-3 mt-6">
            <Link to="/catalogue" className="inline-flex px-6 py-3 rounded-xl bg-[#F2720E] text-white text-sm font-bold hover:bg-[#E05A00] transition">Shop now</Link>
            <Link to="/catalogue" className="inline-flex px-6 py-3 rounded-xl bg-white/10 backdrop-blur text-white text-sm font-semibold hover:bg-white/20 transition">View catalogue</Link>
          </div>
        </div>
      </div>

      <section>
        <h2 className="text-sm font-bold tracking-wide uppercase text-zinc-500 mb-3">Shop by category</h2>
        {loading ? <div className="grid grid-cols-2 md:grid-cols-5 gap-3"><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
        : cats!.length === 0 ? <Placeholder title="No categories" desc="No active categories in database." />
        : <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {cats!.map(c => (
              <Link key={c.id} to={`/catalogue?category=${c.id}`} className="bg-white border border-zinc-200 rounded-2xl p-4 hover:border-zinc-300 text-center">
                <div className="text-sm font-semibold">{displayCategoryName(c.name)}</div>
                <div className="text-xs text-zinc-500 mt-1 capitalize">{c.name.toLowerCase()}</div>
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
            {products!.slice(0, 8).map(p => {
              const displayPrice = variantPrices[p.id] ?? (p.sale_price ?? p.base_price)
              const hasPrice = displayPrice != null && displayPrice !== 0
              return (
                <Link key={p.id} to={`/product/${p.id}`} className="bg-white border border-zinc-200 rounded-2xl p-4 hover:border-zinc-300 flex flex-col gap-2">
                  <div className="text-xs text-zinc-500 uppercase tracking-wide">{p.product_type === 'variable' ? 'Variable' : 'Simple'}</div>
                  <div className="font-semibold line-clamp-2">{p.name}</div>
                  <div className="text-sm font-bold">
                    {hasPrice ? `GH₵ ${displayPrice}` : <span className="text-zinc-400 font-normal text-xs">Price not set</span>}
                  </div>
                  {p.sku && <div className="text-xs text-zinc-400">SKU {p.sku}</div>}
                  <div className="mt-2 text-xs bg-zinc-50 border border-dashed border-zinc-200 rounded-xl p-3 text-zinc-500 text-center">No image available</div>
                </Link>
              )
            })}
          </div>}
      </section>
    </div>
  )
}
