import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getActiveCategories, getActiveProducts, getProductVariants, getProductImages, getPublicImageUrl } from '../lib/catalogue'
import type { Category, Product } from '../lib/catalogue'
import { SkeletonCard } from '../components/Loading'
import ErrorState from '../components/ErrorState'
import Placeholder from '../components/Placeholder'
import { displayCategoryName } from '../lib/categoryDisplay'
import { Package, Heart } from 'lucide-react'

const CEDI = (n: number) => 'GH₵ ' + n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function Home() {
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
        setCats(c); setProducts(p)
        const priceMap: Record<string, number | null> = {}
        const imgMap: Record<string, boolean> = {}
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
          try {
            const imgs = await getProductImages(prod.id)
            if (imgs.length > 0 && imgs[0].storage_path) {
              imgMap[prod.id] = !!getPublicImageUrl(imgs[0].storage_path)
            } else imgMap[prod.id] = false
          } catch { imgMap[prod.id] = false }
        }))
        if (!cancelled) { setVariantPrices(priceMap); setImageMap(imgMap) }
      } catch (e) {
        if (!cancelled) setErr((e as Error).message)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (err) return <ErrorState message={err} onRetry={() => location.reload()} />
  const loading = cats === null || products === null

  const catColors = ['bg-red-100 text-red-600', 'bg-blue-100 text-blue-600', 'bg-green-100 text-green-600', 'bg-orange-100 text-orange-700', 'bg-purple-100 text-purple-600', 'bg-yellow-100 text-yellow-700']
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
            const hasImage = imageMap[p.id]
            return (
              <Link key={p.id} to={`/product/${p.id}`} className="card product-card">
                <div className="pc-image">
                  {hasImage ? (
                    <img src={getPublicImageUrl(p.id)} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
