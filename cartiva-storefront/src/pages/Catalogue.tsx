import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getActiveCategories, getActiveProducts, getProductImages, getPublicImageUrl, getProductVariants } from '../lib/catalogue'
import type { Category, Product } from '../lib/catalogue'
import { SkeletonCard } from '../components/Loading'
import ErrorState from '../components/ErrorState'
import Placeholder from '../components/Placeholder'
import { displayCategoryName } from '../lib/categoryDisplay'

export default function Catalogue() {
  const [params, setParams] = useSearchParams()
  const search = (params.get('search') ?? '').toLowerCase()
  const categoryFilter = params.get('category') ?? ''

  const [cats, setCats] = useState<Category[] | null>(null)
  const [products, setProducts] = useState<Product[] | null>(null)
  const [variantPrices, setVariantPrices] = useState<Record<string, number | null>>({})
  const [err, setErr] = useState<string | null>(null)

  // Simple image map: productId -> hasImage (0 rows currently, but ready)
  const [imageMap, setImageMap] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [c, p] = await Promise.all([getActiveCategories(), getActiveProducts()])
        if (cancelled) return
        setCats(c)
        setProducts(p)
        // Pre-check images and authoritative variant prices (to avoid GH₵0 for variable products)
        const entries: Record<string, boolean> = {}
        const priceMap: Record<string, number | null> = {}
        await Promise.all(p.map(async prod => {
          try {
            const imgs = await getProductImages(prod.id)
            if (imgs.length > 0 && imgs[0].storage_path) {
              const url = getPublicImageUrl(imgs[0].storage_path)
              entries[prod.id] = !!url
            } else entries[prod.id] = false
          } catch { entries[prod.id] = false }
          // Authoritative price from variants for variable products
          if (prod.product_type === 'variable') {
            try {
              const vars = await getProductVariants(prod.id)
              const priced = vars.filter(v => (v.sale_price ?? v.price) > 0)
              if (priced.length > 0) {
                const best = priced.reduce((min, v) => ((v.sale_price ?? v.price) < (min.sale_price ?? min.price) ? v : min))
                priceMap[prod.id] = best.sale_price ?? best.price
              } else priceMap[prod.id] = null
            } catch { priceMap[prod.id] = null }
          } else {
            priceMap[prod.id] = prod.sale_price ?? prod.base_price ?? null
          }
        }))
        if (!cancelled) { setImageMap(entries); setVariantPrices(priceMap) }
      } catch (e) {
        if (!cancelled) setErr((e as Error).message)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    if (!products) return null
    let list = products
    if (categoryFilter) list = list.filter(p => p.category_id === categoryFilter)
    if (search) {
      list = list.filter(p =>
        p.name.toLowerCase().includes(search) ||
        (p.sku ?? '').toLowerCase().includes(search) ||
        (p.description ?? '').toLowerCase().includes(search)
      )
    }
    return list
  }, [products, categoryFilter, search])

  if (err) return <ErrorState message={err} onRetry={() => location.reload()} />
  if (cats === null || products === null || filtered === null) {
    return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between">
        <h1 className="text-xl font-bold">Catalogue</h1>
        <div className="flex gap-2">
          <select value={categoryFilter} onChange={e => { const v = e.target.value; const next = new URLSearchParams(params); if (v) next.set('category', v); else next.delete('category'); setParams(next) }} className="border border-zinc-200 rounded-xl px-3 py-2 text-sm bg-white">
            <option value="">All categories</option>
            {cats.map(c => <option key={c.id} value={c.id}>{displayCategoryName(c.name)}</option>)}
          </select>
          <input value={params.get('search') ?? ''} onChange={e => { const v = e.target.value; const next = new URLSearchParams(params); if (v) next.set('search', v); else next.delete('search'); setParams(next) }} placeholder="Search..." className="border border-zinc-200 rounded-xl px-3 py-2 text-sm w-40" />
        </div>
      </div>

      {filtered.length === 0 ? (
        search || categoryFilter
          ? <Placeholder title="No results" desc={`No products match ${search ? `search "${search}"` : ''} ${categoryFilter ? 'in this category' : ''}.`} />
          : <Placeholder title="No products" desc="No active products in database." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => {
            const hasImage = imageMap[p.id]
            const displayPrice = variantPrices[p.id] ?? (p.sale_price ?? p.base_price)
            const hasPrice = displayPrice != null && displayPrice !== 0
            const catName = displayCategoryName(cats.find(c => c.id === p.category_id)?.name ?? 'Uncategorized')
            return (
              <Link key={p.id} to={`/product/${p.id}`} className="bg-white border border-zinc-200 rounded-2xl p-4 hover:border-zinc-300 flex flex-col gap-2">
                <div className="text-xs text-zinc-500 uppercase tracking-wide">{catName} · {p.product_type === 'variable' ? 'Variable' : 'Simple'}</div>
                <div className="font-semibold line-clamp-2">{p.name}</div>
                <div className="text-sm font-bold">
                  {hasPrice ? `GH₵ ${displayPrice}` : <span className="text-zinc-400 font-normal text-xs">Price not set</span>}
                </div>
                {p.sku ? <div className="text-xs text-zinc-400">SKU {p.sku}</div> : null}
                {hasImage ? (
                  <div className="mt-2 text-xs bg-green-50 border border-green-200 rounded-xl p-3 text-green-700">Image available</div>
                ) : (
                  <div className="mt-2 text-xs bg-zinc-50 border border-dashed border-zinc-200 rounded-xl p-3 text-zinc-500 text-center">No image available</div>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
