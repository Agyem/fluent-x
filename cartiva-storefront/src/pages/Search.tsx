import { useEffect, useMemo, useState, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getActiveProducts, getProductImages, getPublicImageUrl, getProductVariants, getActiveCategories } from '../lib/catalogue'
import type { Product, ProductVariant } from '../lib/catalogue'
import { displayCategoryName } from '../lib/categoryDisplay'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { SkeletonCard } from '../components/Loading'
import ErrorState from '../components/ErrorState'

const CEDI = (n: number) => 'GH₵ ' + n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function Search() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const [products, setProducts] = useState<Product[] | null>(null)
  const [cats, setCats] = useState<{ id: string; name: string }[]>([])
  const [prices, setPrices] = useState<Record<string, number | null>>({})
  const [images, setImages] = useState<Record<string, string>>({})
  const [wishlist, setWishlist] = useState<Set<string>>(new Set())
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [p, c] = await Promise.all([getActiveProducts(), getActiveCategories()])
        if (cancelled) return
        setProducts(p)
        setCats(c.map(x => ({ id: x.id, name: x.name })))
        const priceMap: Record<string, number | null> = {}
        const urlMap: Record<string, string> = {}
        await Promise.all(p.map(async prod => {
          if (prod.product_type === 'variable') {
            try {
              const vars: ProductVariant[] = await getProductVariants(prod.id)
              const priced = vars.filter(v => v.price > 0 || (v.sale_price ?? 0) > 0)
              if (priced.length > 0) {
                const best = priced.reduce((min, v) => ((v.sale_price ?? v.price) < (min.sale_price ?? min.price) ? v : min))
                priceMap[prod.id] = best.sale_price ?? best.price
              } else priceMap[prod.id] = null
            } catch { priceMap[prod.id] = null }
          } else {
            priceMap[prod.id] = prod.sale_price ?? prod.base_price ?? null
          }
          try {
            const imgs = await getProductImages(prod.id)
            if (imgs.length > 0 && imgs[0].storage_path) {
              const url = getPublicImageUrl(imgs[0].storage_path)
              if (url) urlMap[prod.id] = url
            }
          } catch { /* no image */ }
        }))
        if (!cancelled) { setPrices(priceMap); setImages(urlMap) }
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

  const results = useMemo(() => {
    if (!products) return null
    const query = q.trim().toLowerCase()
    if (!query) return products.slice(0, 8)
    return products.filter(p => [p.name, p.description ?? '', p.sku ?? ''].join(' ').toLowerCase().includes(query))
  }, [products, q])

  if (err) return <div className="container" style={{ padding: '40px 0' }}><ErrorState message={err} onRetry={() => location.reload()} /></div>

  return (
    <div className="page">
      <section className="page-header">
        <div className="container">
          <div className="eyebrow">Find something</div>
          <h1>Search Cartiva.</h1>
          <p>Search products, categories and student essentials.</p>
        </div>
      </section>
      <section className="section">
        <div className="container">
          <input
            className="search-large"
            type="search"
            placeholder="Search for laptops, lab coats, headphones..."
            value={q}
            onChange={e => { const next = new URLSearchParams(params); if (e.target.value) next.set('q', e.target.value); else next.delete('q'); setParams(next) }}
          />
          <div className="search-results-meta">
            <span>{q ? `${results?.length ?? 0} result${(results?.length ?? 0) === 1 ? '' : 's'} for "${q}"` : 'Popular products'}</span>
          </div>
          {!results ? (
            <div className="product-grid">{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}</div>
          ) : results.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">⌕</div>
              <h2>We couldn&apos;t find that.</h2>
              <p>Try another search term or browse our categories.</p>
              <Link to="/catalogue" className="primary-btn">Browse shop</Link>
            </div>
          ) : (
            <div className="product-grid">
              {results.map(p => {
                const price = prices[p.id] ?? p.sale_price ?? p.base_price
                const wished = wishlist.has(p.id)
                return (
                  <Link key={p.id} to={`/product/${p.id}`} className="product-card">
                    <div className="product-image-wrap">
                      {images[p.id] ? <img className="product-image" src={images[p.id]} alt={p.name} loading="lazy" /> : <span style={{ fontSize: 32 }}>📦</span>}
                      <button className={`wishlist-button${wished ? ' active' : ''}`} onClick={e => toggleWishlist(p.id, e)} aria-label="Wishlist">
                        <svg viewBox="0 0 24 24" fill={wished ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8"><path d="M20.8 8.6c0 5.2-8.8 10.1-8.8 10.1S3.2 13.8 3.2 8.6A4.6 4.6 0 0 1 12 6.2a4.6 4.6 0 0 1 8.8 2.4Z" /></svg>
                      </button>
                    </div>
                    <div className="product-info">
                      <div className="product-category">{displayCategoryName(cats.find(c => c.id === p.category_id)?.name ?? 'Uncategorized')}</div>
                      <div className="product-name">{p.name}</div>
                      <div className="product-bottom">
                        <div><span className="product-price">{price != null ? CEDI(price) : 'Price not set'}</span></div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
