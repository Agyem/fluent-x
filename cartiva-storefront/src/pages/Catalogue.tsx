import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getActiveCategories, getActiveProducts, getProductImages, getPublicImageUrl, getProductVariants } from '../lib/catalogue'
import type { Category, Product } from '../lib/catalogue'
import { SkeletonCard } from '../components/Loading'
import ErrorState from '../components/ErrorState'
import Placeholder from '../components/Placeholder'
import { displayCategoryName } from '../lib/categoryDisplay'
import { Package } from 'lucide-react'

const CEDI = (n: number) => 'GH₵ ' + n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function Catalogue() {
  const [params, setParams] = useSearchParams()
  const search = (params.get('search') ?? '').toLowerCase()
  const categoryFilter = params.get('category') ?? ''
  const sortBy = params.get('sort') ?? 'popular'

  const [cats, setCats] = useState<Category[] | null>(null)
  const [products, setProducts] = useState<Product[] | null>(null)
  const [variantPrices, setVariantPrices] = useState<Record<string, number | null>>({})
  const [imageMap, setImageMap] = useState<Record<string, boolean>>({})
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [c, p] = await Promise.all([getActiveCategories(), getActiveProducts()])
        if (cancelled) return
        setCats(c)
        setProducts(p)
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
    if (sortBy === 'price-asc') list = [...list].sort((a, b) => (variantPrices[a.id] ?? a.sale_price ?? a.base_price ?? 0) - (variantPrices[b.id] ?? b.sale_price ?? b.base_price ?? 0))
    else if (sortBy === 'price-desc') list = [...list].sort((a, b) => (variantPrices[b.id] ?? b.sale_price ?? b.base_price ?? 0) - (variantPrices[a.id] ?? a.sale_price ?? a.base_price ?? 0))
    return list
  }, [products, categoryFilter, search, sortBy, variantPrices])

  const setSort = (v: string) => {
    const next = new URLSearchParams(params)
    if (v) next.set('sort', v); else next.delete('sort')
    setParams(next)
  }

  if (err) return <ErrorState message={err} onRetry={() => location.reload()} />
  if (cats === null || products === null || filtered === null) {
    return <div className="product-grid"><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
  }

  const activeCat = categoryFilter ? cats.find(c => c.id === categoryFilter) : null

  return (
    <>
      <div className="breadcrumb">
        <span style={{ cursor: 'pointer' }} onClick={() => window.location.href = '/'}>Home</span> / <b>{activeCat ? displayCategoryName(activeCat.name) : 'All products'}</b>
      </div>
      <div className="cat-layout">
        <div>
          <div className="filter-block">
            <h4>Category</h4>
            <div className="filter-row" onClick={() => { const next = new URLSearchParams(params); next.delete('category'); setParams(next) }}>
              <input type="radio" checked={!categoryFilter} readOnly /> All products
            </div>
            {cats.map(c => (
              <div key={c.id} className="filter-row" onClick={() => { const next = new URLSearchParams(params); next.set('category', c.id); setParams(next) }}>
                <input type="radio" checked={categoryFilter === c.id} readOnly /> {displayCategoryName(c.name)}
              </div>
            ))}
          </div>
          <div className="filter-block">
            <h4>Availability</h4>
            <div className="filter-row"><input type="checkbox" defaultChecked /> In stock only</div>
          </div>
        </div>

        <div>
          <div className="toolbar">
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{filtered.length} product{filtered.length !== 1 ? 's' : ''}</div>
            <select className="sort-select" value={sortBy} onChange={e => setSort(e.target.value)}>
              <option value="popular">Most popular</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
            </select>
          </div>

          {filtered.length === 0 ? (
            search || categoryFilter
              ? <Placeholder title="No results" desc={`No products match ${search ? `search "${search}"` : ''} ${categoryFilter ? 'in this category' : ''}.`} />
              : <Placeholder title="No products" desc="No active products in database." />
          ) : (
            <div className="product-grid">
              {filtered.map(p => {
                const displayPrice = variantPrices[p.id] ?? (p.sale_price ?? p.base_price)
                const hasPrice = displayPrice != null && displayPrice !== 0
                const catName = displayCategoryName(cats.find(c => c.id === p.category_id)?.name ?? 'Uncategorized')
                const hasImage = imageMap[p.id]
                return (
                  <Link key={p.id} to={`/product/${p.id}`} className="card product-card">
                    <div className="pc-image">
                      {hasImage ? (
                        <img src={getPublicImageUrl(p.id) ?? undefined} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <Package />
                      )}
                    </div>
                    <div className="pc-body">
                      <div className="pc-cat">{catName}</div>
                      <div className="pc-name">{p.name}</div>
                      <div className="pc-price-row">
                        <span className="pc-price">{hasPrice ? CEDI(displayPrice!) : 'Price not set'}</span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
