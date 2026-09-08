import { useEffect, useState, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getActiveCategories, getActiveProducts, getProductVariants, getProductImages, getPublicImageUrl } from '../lib/catalogue'
import type { Category, Product, ProductVariant } from '../lib/catalogue'
import { SkeletonCard } from '../components/Loading'
import ErrorState from '../components/ErrorState'
import Placeholder from '../components/Placeholder'
import { displayCategoryName } from '../lib/categoryDisplay'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const CEDI = (n: number) => 'GH₵ ' + n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function catIcon(name: string, i: number) {
  const n = name.toLowerCase()
  if (n.includes('stud') || n.includes('station') || n.includes('book')) return '📚'
  if (n.includes('laptop') || n.includes('tech') || n.includes('accessor') || n.includes('audio') || n.includes('wear')) return '⌨️'
  if (n.includes('hostel') || n.includes('home') || n.includes('appliance')) return '🎒'
  if (n.includes('lab')) return '🧪'
  if (n.includes('fashion') || n.includes('cloth') || n.includes('shoe')) return '👟'
  if (n.includes('sport') || n.includes('fit')) return '🏃'
  if (n.includes('phone') || n.includes('smart')) return '📱'
  if (n.includes('head') || n.includes('ear')) return '🎧'
  return ['📚', '⌨️', '🎒', '🧪', '👟', '🏃'][i % 6]
}
function catBlurb(name: string) {
  const n = name.toLowerCase()
  if (n.includes('stud')) return 'Notes, stationery & supplies'
  if (n.includes('tech') || n.includes('accessor') || n.includes('laptop')) return 'Devices & accessories'
  if (n.includes('hostel') || n.includes('home')) return 'Everyday campus essentials'
  if (n.includes('lab')) return 'Practical-ready essentials'
  if (n.includes('fashion')) return 'Everyday campus style'
  if (n.includes('sport')) return 'Move, train & recover'
  return 'Shop the collection'
}

export default function Home() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [cats, setCats] = useState<Category[] | null>(null)
  const [products, setProducts] = useState<Product[] | null>(null)
  const [variantPrices, setVariantPrices] = useState<Record<string, number | null>>({})
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [catOf, setCatOf] = useState<Record<string, string>>({})
  const [wishlist, setWishlist] = useState<Set<string>>(new Set())
  const [err, setErr] = useState<string | null>(null)
  const [heroIndex, setHeroIndex] = useState(0)
  const [heroChanging, setHeroChanging] = useState(false)
  const railRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [c, p] = await Promise.all([getActiveCategories(), getActiveProducts()])
        if (cancelled) return
        setCats(c); setProducts(p)
        const cmap: Record<string, string> = {}
        c.forEach(x => { cmap[x.id] = displayCategoryName(x.name) })
        setCatOf(cmap)
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
        if (!cancelled) { setVariantPrices(priceMap); setImageUrls(urlMap) }
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

  const featured = (products ?? []).filter(p => imageUrls[p.id]).slice(0, 6)
  const heroList = featured.length > 0 ? featured : (products ?? []).slice(0, 6)

  useEffect(() => {
    if (heroList.length === 0) return
    setHeroIndex(Math.floor(Date.now() / 6000) % heroList.length)
    const t = setInterval(() => {
      setHeroChanging(true)
      setTimeout(() => {
        setHeroIndex(i => (i + 1) % heroList.length)
        setHeroChanging(false)
      }, 350)
    }, 6000)
    return () => clearInterval(t)
  }, [heroList.length])

  if (err) return <div className="container" style={{ padding: '40px 0' }}><ErrorState message={err} onRetry={() => location.reload()} /></div>
  const loading = cats === null || products === null

  const hero = heroList[heroIndex] as Product | undefined
  const heroPrice = hero ? (variantPrices[hero.id] ?? hero.sale_price ?? hero.base_price) : null

  const card = (p: Product) => {
    const price = variantPrices[p.id] ?? p.sale_price ?? p.base_price
    const wished = wishlist.has(p.id)
    return (
      <Link key={p.id} to={`/product/${p.id}`} className="product-card">
        <div className="product-image-wrap">
          {imageUrls[p.id] ? <img className="product-image" src={imageUrls[p.id]} alt={p.name} loading="lazy" /> : <span style={{ fontSize: 34 }}>📦</span>}
          <button className={`wishlist-button${wished ? ' active' : ''}`} onClick={e => toggleWishlist(p.id, e)} aria-label="Wishlist">
            <svg viewBox="0 0 24 24" fill={wished ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8"><path d="M20.8 8.6c0 5.2-8.8 10.1-8.8 10.1S3.2 13.8 3.2 8.6A4.6 4.6 0 0 1 12 6.2a4.6 4.6 0 0 1 8.8 2.4Z" /></svg>
          </button>
        </div>
        <div className="product-info">
          <div className="product-category">{(p.category_id && catOf[p.category_id]) ?? 'Uncategorized'}</div>
          <div className="product-name">{p.name}</div>
          <div className="product-bottom">
            <div><span className="product-price">{price != null && price !== 0 ? CEDI(price) : 'Price not set'}</span></div>
          </div>
        </div>
      </Link>
    )
  }

  return (
    <div className="page">
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <div className="hero-kicker"><span className="live-dot" />STUDENT COMMERCE, REIMAGINED</div>
            <h1 className="hero-title">Everything you need. <em>Delivered.</em></h1>
            <p className="hero-description">From study essentials and gadgets to fashion, laboratory gear and hostel needs — Cartiva brings everyday student shopping into one simple place.</p>
            <div className="hero-buttons">
              <button className="primary-btn" onClick={() => navigate('/catalogue')}>Shop Cartiva →</button>
              <button className="secondary-btn" onClick={() => document.getElementById('categoriesSection')?.scrollIntoView({ behavior: 'smooth' })}>Explore categories</button>
            </div>
          </div>
          <div className={`hero-product-stage${heroChanging ? ' changing' : ''}`}>
            <div className="hero-progress"><div className="hero-progress-fill" key={heroIndex} style={{ width: '100%', transition: 'width 6s linear' }} /></div>
            <div className="hero-number">{String(heroIndex + 1).padStart(2, '0')} / {String(Math.max(heroList.length, 1)).padStart(2, '0')}</div>
            {hero && imageUrls[hero.id] && <img className="hero-image" src={imageUrls[hero.id]} alt={hero.name} onClick={() => navigate(`/product/${hero.id}`)} style={{ cursor: 'pointer' }} />}
            {hero && (
              <div className="hero-info">
                <div className="hero-info-left">
                  <div className="hero-category">{(hero.category_id && catOf[hero.category_id]) ?? ''}</div>
                  <div className="hero-product-name">{hero.name}</div>
                </div>
                <div>
                  <div className="hero-price">{heroPrice != null ? CEDI(heroPrice) : ''}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="ticker">
        <div className="ticker-track">
          {['Campus essentials', 'Fast campus delivery', 'Study smarter', 'Shop student life', 'Cartiva', 'Campus essentials', 'Fast campus delivery'].map((t, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 35 }}>
              <span className="ticker-item">{t}</span><span className="ticker-dot">●</span>
            </span>
          ))}
        </div>
      </div>

      <section className="section" id="categoriesSection">
        <div className="container">
          <div className="section-head">
            <div>
              <div className="eyebrow">Shop your way</div>
              <h2 className="section-title">What do you need?</h2>
            </div>
            <button className="text-button" onClick={() => navigate('/catalogue')}>View all →</button>
          </div>
          <div className="need-grid">
            {loading ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="need-card"><SkeletonCard /></div>)
              : (cats ?? []).slice(0, 6).map((c, i) => (
                <div key={c.id} className="need-card" onClick={() => navigate(`/catalogue?category=${c.id}`)}>
                  <div className="need-icon">{catIcon(c.name, i)}</div>
                  <div><strong>{displayCategoryName(c.name)}</strong><br /><span>{catBlurb(c.name)}</span></div>
                </div>
              ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 20 }}>
        <div className="container">
          <div className="section-head">
            <div>
              <div className="eyebrow">Moving fast</div>
              <h2 className="section-title">Trending on Cartiva</h2>
            </div>
            <div className="rail-controls">
              <button className="rail-control" onClick={() => railRef.current?.scrollBy({ left: -290, behavior: 'smooth' })}>←</button>
              <button className="rail-control" onClick={() => railRef.current?.scrollBy({ left: 290, behavior: 'smooth' })}>→</button>
            </div>
          </div>
          {loading ? <div className="product-rail">{Array.from({ length: 4 }).map((_, i) => <div key={i} style={{ minWidth: 260 }}><SkeletonCard /></div>)}</div>
            : products && products.length > 0 ? (
              <div className="product-rail" ref={railRef}>{products.slice(0, 7).map(card)}</div>
            ) : <Placeholder title="No products" desc="No active products in database." />}
        </div>
      </section>

      <section className="section" style={{ background: '#f7f7f5' }}>
        <div className="container">
          <div className="section-head">
            <div>
              <div className="eyebrow">Fresh drops</div>
              <h2 className="section-title">New arrivals</h2>
              <p className="section-description">New products entering the Cartiva catalogue.</p>
            </div>
            <button className="text-button" onClick={() => navigate('/catalogue')}>Shop all →</button>
          </div>
          {loading ? <div className="product-grid">{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}</div>
            : products && products.length > 0 ? (
              <div className="product-grid">{products.slice(0, 8).map(card)}</div>
            ) : <Placeholder title="No products" desc="No active products in database." />}
        </div>
      </section>

      <section className="section editorial">
        <div className="container">
          <div className="editorial-grid">
            <div className="editorial-main">
              <img className="editorial-main-image" src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1400&q=85" alt="Students" loading="lazy" />
              <div className="editorial-content">
                <div className="eyebrow">Built for campus life</div>
                <h2>Your campus. Your essentials.</h2>
                <p>Cartiva is designed around the things students actually need — not a giant catalogue full of things you don&apos;t.</p>
                <br />
                <button className="primary-btn" onClick={() => navigate('/catalogue')}>Start shopping</button>
              </div>
            </div>
            <div className="editorial-side">
              <div className="editorial-small">
                <div className="mini-icon">📦</div>
                <h3>Simple ordering.</h3>
                <p>Choose your product, select your variant, add it to your cart and checkout.</p>
              </div>
              <div className="editorial-small">
                <div className="mini-icon">📍</div>
                <h3>Built around campus.</h3>
                <p>Choose your campus delivery location at checkout and keep things simple.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="benefit-grid">
            <div className="benefit"><div className="benefit-icon">⚡</div><h4>Made for students</h4><p>Products selected around everyday student life.</p></div>
            <div className="benefit"><div className="benefit-icon">📍</div><h4>Campus focused</h4><p>Delivery designed around your campus location.</p></div>
            <div className="benefit"><div className="benefit-icon">🛍</div><h4>Simple shopping</h4><p>No unnecessary steps between you and your order.</p></div>
            <div className="benefit"><div className="benefit-icon">✓</div><h4>Order tracking</h4><p>Keep your order information available after checkout.</p></div>
          </div>
        </div>
      </section>
    </div>
  )
}
