import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { getActiveCategories, getActiveProducts, getProductVariants, getProductImages, getPublicImageUrl } from '../lib/catalogue'
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

export default function Home() {
  const { user } = useAuth()
  const { addItem } = useCart()
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
        const priceMap: Record<string, number | null> = {}
        const urlMap: Record<string, string> = {}
        const varMap: Record<string, ProductVariant> = {}
        await Promise.all(p.map(async prod => {
          if (prod.product_type === 'variable') {
            try {
              const vars = await getProductVariants(prod.id)
              if (vars.length > 0) varMap[prod.id] = vars[0]
              const priced = vars.filter(v => v.price > 0 || (v.sale_price ?? 0) > 0)
              if (priced.length > 0) {
                const best = priced.reduce((min, v) => {
                  const pv = v.sale_price ?? v.price
                  const mv = min.sale_price ?? min.price
                  return pv < mv ? v : min
                })
                priceMap[prod.id] = best.sale_price ?? best.price
                if (!varMap[prod.id]) varMap[prod.id] = best
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
        if (!cancelled) { setVariantPrices(priceMap); setImageUrls(urlMap); setFirstVariants(varMap) }

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
      await supabase.from('wishlist_items').delete().eq('customer_id', user.id).eq('product_id', productId)
      setWishlist(prev => { const next = new Set(prev); next.delete(productId); return next })
    } else {
      const { error } = await supabase.from('wishlist_items').insert({ customer_id: user.id, product_id: productId })
      if (!error) setWishlist(prev => new Set(prev).add(productId))
    }
  }, [user, wishlist])

  if (err) return <ErrorState message={err} onRetry={() => location.reload()} />
  const loading = cats === null || products === null

  const catIcons = ['📱', '💻', '🎧', '🔌', '🏠', '📦']

  return (
    <>
      <div className="hero">
        <h1>Everything for campus life, delivered to your hall.</h1>
        <p>From lecture-hall essentials to hostel upgrades — shop electronics, stationery, fashion and more, with delivery timed around your schedule.</p>
        <button className="btn primary" onClick={() => window.location.href = '/catalogue'}>Shop all categories</button>
      </div>

      <div className="cat-strip">
        {loading ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="card cat-tile" style={{ padding: 16 }}><SkeletonCard /></div>)
        : cats && cats.length > 0 ? cats.map((c, i) => (
          <Link key={c.id} to={`/catalogue?category=${c.id}`} className="card cat-tile">
            <div className="cat-icon" style={{ background: 'var(--primary-light)' }}>{catIcons[i % catIcons.length]}</div>
            <div className="cat-name">{displayCategoryName(c.name)}</div>
          </Link>
        )) : null}
      </div>

      <div className="section-strip-head">
        <h2>Featured products</h2>
        <Link to="/catalogue" className="back-link" style={{ margin: 0 }}>See all</Link>
      </div>
      {loading ? <div className="product-grid" style={{ marginBottom: 32 }}>{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      : products && products.length > 0 ? (
        <div className="product-grid" style={{ marginBottom: 32 }}>
          {products.slice(0, 8).map(p => {
            const displayPrice = variantPrices[p.id] ?? (p.sale_price ?? p.base_price)
            const hasPrice = displayPrice != null && displayPrice !== 0
            const catName = displayCategoryName(cats?.find(c => c.id === p.category_id)?.name ?? 'Uncategorized')
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
      ) : <Placeholder title="No products" desc="No active products in database." />}

      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, background: 'var(--primary-light)', border: 'none', padding: '16px 18px' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--primary-dark)' }}>Browse our full catalogue</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 3 }}>Find exactly what you need for campus life</div>
        </div>
        <Link to="/catalogue" className="btn primary">Shop now</Link>
      </div>
    </>
  )
}
