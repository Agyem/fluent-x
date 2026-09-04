import { useEffect, useMemo, useState, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getActiveCategories, getActiveProducts, getProductImages, getPublicImageUrl, getProductVariants } from '../lib/catalogue'
import type { Category, Product, ProductVariant } from '../lib/catalogue'
import { SkeletonCard } from '../components/Loading'
import ErrorState from '../components/ErrorState'
import Placeholder from '../components/Placeholder'
import { displayCategoryName } from '../lib/categoryDisplay'
import { Package } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'

const CEDI = (n: number) => 'GH₵ ' + n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function Catalogue() {
  const { user } = useAuth()
  const { addItem } = useCart()
  const [params, setParams] = useSearchParams()
  const search = (params.get('search') ?? '').toLowerCase()
  const categoryFilter = params.get('category') ?? ''
  const sortBy = params.get('sort') ?? 'popular'

  const [cats, setCats] = useState<Category[] | null>(null)
  const [products, setProducts] = useState<Product[] | null>(null)
  const [variantPrices, setVariantPrices] = useState<Record<string, number | null>>({})
  const [firstVariants, setFirstVariants] = useState<Record<string, ProductVariant>>({})
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [wishlist, setWishlist] = useState<Set<string>>(new Set())
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [c, p] = await Promise.all([getActiveCategories(), getActiveProducts()])
        if (cancelled) return
        setCats(c)
        setProducts(p)
        const urlMap: Record<string, string> = {}
        const priceMap: Record<string, number | null> = {}
        const varMap: Record<string, ProductVariant> = {}
        await Promise.all(p.map(async prod => {
          try {
            const imgs = await getProductImages(prod.id)
            if (imgs.length > 0 && imgs[0].storage_path) {
              const url = getPublicImageUrl(imgs[0].storage_path)
              if (url) urlMap[prod.id] = url
            }
          } catch { /* no image */ }
          if (prod.product_type === 'variable') {
            try {
              const vars = await getProductVariants(prod.id)
              if (vars.length > 0) varMap[prod.id] = vars[0]
              const priced = vars.filter(v => (v.sale_price ?? v.price) > 0)
              if (priced.length > 0) {
                const best = priced.reduce((min, v) => ((v.sale_price ?? v.price) < (min.sale_price ?? min.price) ? v : min))
                priceMap[prod.id] = best.sale_price ?? best.price
                if (!varMap[prod.id]) varMap[prod.id] = best
              } else priceMap[prod.id] = null
            } catch { priceMap[prod.id] = null }
          } else {
            priceMap[prod.id] = prod.sale_price ?? prod.base_price ?? null
          }
        }))
        if (!cancelled) { setImageUrls(urlMap); setVariantPrices(priceMap); setFirstVariants(varMap) }

        if (user) {
          const { data: wl } = await supabase.from('wishlist_items').select('product_id').eq('customer_id', user.id)
          if (!cancelled && wl) setWishlist(new Set(wl.map((w: { product_id: string }) => w.product_id)))
        }
      } catch (e) {
        if (!cancelled) setErr((e as Error).message)
      }
    }
    load()
    return () => { cancelled = true }
  }, [user])

  const toggleWishlist = useCallback(async (productId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!user) { window.location.href = '/login'; return }
    if (wishlist.has(productId)) {
      const { error } = await supabase.from('wishlist_items').delete().eq('customer_id', user.id).eq('product_id', productId)
      if (!error) setWishlist(prev => { const next = new Set(prev); next.delete(productId); return next })
    } else {
      const { error } = await supabase.from('wishlist_items').insert({ customer_id: user.id, product_id: productId })
      if (error) { console.error('[wishlist]', error.message); alert('Wishlist is not available yet — run the SQL migration first.'); return }
      setWishlist(prev => new Set(prev).add(productId))
    }
  }, [user, wishlist])

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
                const imgUrl = imageUrls[p.id]
                return (
                  <Link key={p.id} to={`/product/${p.id}`} className="card product-card">
                    <div className="pc-image">
                      {imgUrl ? (
                        <img src={imgUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <Package />
                      )}
                      <div className={`pc-wish${wishlist.has(p.id) ? ' active' : ''}`} onClick={e => toggleWishlist(p.id, e)}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill={wishlist.has(p.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                      </div>
                    </div>
                    <div className="pc-body">
                      <div className="pc-cat">{catName}</div>
                      <div className="pc-name">{p.name}</div>
                      <div className="pc-price-row">
                        <span className="pc-price">{hasPrice ? CEDI(displayPrice!) : 'Price not set'}</span>
                        {firstVariants[p.id] && (
                          <button className="pc-add" onClick={e => {
                            e.preventDefault(); e.stopPropagation()
                            const v = firstVariants[p.id]
                            addItem({
                              product_id: p.id, variant_id: v.id,
                              product_name: p.name, variant_name: v.name,
                              sku: v.sku ?? p.sku ?? null,
                              unit_price: v.sale_price ?? v.price,
                              image_path: null,
                            })
                          }}>Add</button>
                        )}
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
