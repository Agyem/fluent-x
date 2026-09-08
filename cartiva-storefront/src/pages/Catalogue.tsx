import { useEffect, useMemo, useState, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getActiveCategories, getActiveProducts, getProductImages, getPublicImageUrl, getProductVariants } from '../lib/catalogue'
import type { Category, Product, ProductVariant } from '../lib/catalogue'
import { SkeletonCard } from '../components/Loading'
import ErrorState from '../components/ErrorState'
import Placeholder from '../components/Placeholder'
import { displayCategoryName } from '../lib/categoryDisplay'
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
        setCats(c); setProducts(p)
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
          // Fetch variants for ALL products — simple products carry a hidden "Default" variant.
          try {
            const vars = await getProductVariants(prod.id)
            if (vars.length > 0) varMap[prod.id] = vars[0]
            const priced = vars.filter(v => (v.sale_price ?? v.price) > 0)
            if (priced.length > 0) {
              const best = priced.reduce((min, v) => ((v.sale_price ?? v.price) < (min.sale_price ?? min.price) ? v : min))
              priceMap[prod.id] = best.sale_price ?? best.price
              if (!varMap[prod.id]) varMap[prod.id] = best
            } else priceMap[prod.id] = prod.sale_price ?? prod.base_price ?? null
          } catch { priceMap[prod.id] = prod.sale_price ?? prod.base_price ?? null }
        }))
        if (!cancelled) { setImageUrls(urlMap); setVariantPrices(priceMap); setFirstVariants(varMap) }
        if (user) {
          const { data: wl } = await supabase.from('wishlist_items').select('product_id').eq('customer_id', user.id)
          if (!cancelled && wl) setWishlist(new Set(wl.map((w: { product_id: string }) => w.product_id)))
        }
      } catch (e) { if (!cancelled) setErr((e as Error).message) }
    }
    load()
    return () => { cancelled = true }
  }, [user])

  const toggleWishlist = useCallback(async (productId: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (!user) { window.location.href = '/login'; return }
    if (wishlist.has(productId)) {
      const { error } = await supabase.from('wishlist_items').delete().eq('customer_id', user.id).eq('product_id', productId)
      if (!error) setWishlist(prev => { const next = new Set(prev); next.delete(productId); return next })
    } else {
      const { error } = await supabase.from('wishlist_items').insert({ customer_id: user.id, product_id: productId })
      if (!error) setWishlist(prev => new Set(prev).add(productId))
    }
  }, [user, wishlist])

  const filtered = useMemo(() => {
    if (!products) return null
    let list = products
    if (categoryFilter) list = list.filter(p => p.category_id === categoryFilter)
    if (search) {
      list = list.filter(p => p.name.toLowerCase().includes(search) || (p.sku ?? '').toLowerCase().includes(search) || (p.description ?? '').toLowerCase().includes(search))
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
  const setCategory = (id: string) => {
    const next = new URLSearchParams(params)
    if (id) next.set('category', id); else next.delete('category')
    setParams(next)
  }

  if (err) return <div className="container" style={{ padding: '40px 0' }}><ErrorState message={err} onRetry={() => location.reload()} /></div>
  if (cats === null || products === null || filtered === null) {
    return (
      <div className="page">
        <section className="page-header"><div className="container"><div className="eyebrow">Cartiva catalogue</div><h1>Shop everything.</h1></div></section>
        <section className="section"><div className="container"><div className="product-grid"><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></div></div></section>
      </div>
    )
  }

  const activeCat = categoryFilter ? cats.find(c => c.id === categoryFilter) : null

  return (
    <div className="page">
      <section className="page-header">
        <div className="container">
          <div className="eyebrow">Cartiva catalogue</div>
          <h1>{activeCat ? displayCategoryName(activeCat.name) : 'Shop everything.'}</h1>
          <p>Find the things that make student life easier.</p>
        </div>
      </section>

      <section className="section">
        <div className="container shop-layout">
          <aside className="filters">
            <div className="filter-group">
              <h4>Categories</h4>
              <button className={`filter-option${!categoryFilter ? ' active' : ''}`} onClick={() => setCategory('')}>All products</button>
              {cats.map(c => (
                <button key={c.id} className={`filter-option${categoryFilter === c.id ? ' active' : ''}`} onClick={() => setCategory(c.id)}>
                  {displayCategoryName(c.name)}
                </button>
              ))}
            </div>
            <div className="filter-group">
              <h4>Availability</h4>
              <button className="filter-option" onClick={() => {}}>In stock</button>
            </div>
          </aside>

          <div>
            <div className="shop-toolbar">
              <span style={{ fontSize: 12, color: '#6B7280' }}>{filtered.length} product{filtered.length !== 1 ? 's' : ''}</span>
              <select className="sort-select" value={sortBy} onChange={e => setSort(e.target.value)}>
                <option value="popular">Recommended</option>
                <option value="price-asc">Price: Low to high</option>
                <option value="price-desc">Price: High to low</option>
              </select>
            </div>

            {filtered.length === 0 ? (
              <Placeholder title="No results" desc="No products match your filters." />
            ) : (
              <div className="product-grid">
                {filtered.map(p => {
                  const displayPrice = variantPrices[p.id] ?? (p.sale_price ?? p.base_price)
                  const wished = wishlist.has(p.id)
                  return (
                    <Link key={p.id} to={`/product/${p.id}`} className="product-card">
                      <div className="product-image-wrap">
                        {imageUrls[p.id] ? <img className="product-image" src={imageUrls[p.id]} alt={p.name} loading="lazy" /> : <span style={{ fontSize: 32 }}>📦</span>}
                        <button className={`wishlist-button${wished ? ' active' : ''}`} onClick={e => toggleWishlist(p.id, e)} aria-label="Wishlist">
                          <svg viewBox="0 0 24 24" fill={wished ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8"><path d="M20.8 8.6c0 5.2-8.8 10.1-8.8 10.1S3.2 13.8 3.2 8.6A4.6 4.6 0 0 1 12 6.2a4.6 4.6 0 0 1 8.8 2.4Z" /></svg>
                        </button>
                      </div>
                      <div className="product-info">
                        <div className="product-category">{displayCategoryName(cats.find(c => c.id === p.category_id)?.name ?? 'Uncategorized')}</div>
                        <div className="product-name">{p.name}</div>
                        <div className="product-bottom">
                          <div><span className="product-price">{displayPrice != null && displayPrice !== 0 ? CEDI(displayPrice) : 'Price not set'}</span></div>
                          {firstVariants[p.id] && (
                            <button className="pc-add" onClick={e => {
                              e.preventDefault(); e.stopPropagation()
                              const v = firstVariants[p.id]
                              addItem({ product_id: p.id, variant_id: v.id, product_name: p.name, variant_name: v.name, sku: v.sku ?? p.sku ?? null, unit_price: v.sale_price ?? v.price, image_path: null })
                            }}>Add to Cart</button>
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
      </section>
    </div>
  )
}
