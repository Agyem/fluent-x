import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getProductById, getProductVariants, getProductOptions, getProductOptionValues, getProductImages, getPublicImageUrl, getActiveCategories } from '../lib/catalogue'
import type { Product, ProductVariant, ProductOption, ProductOptionValue, ProductImage, Category } from '../lib/catalogue'
import { Loading } from '../components/Loading'
import ErrorState from '../components/ErrorState'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const CEDI = (n: number) => 'GH₵ ' + n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function ProductDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [product, setProduct] = useState<Product | null | undefined>(undefined)
  const [category, setCategory] = useState<Category | null>(null)
  const [variants, setVariants] = useState<ProductVariant[] | null>(null)
  const [options, setOptions] = useState<ProductOption[] | null>(null)
  const [optionValues, setOptionValues] = useState<ProductOptionValue[] | null>(null)
  const [images, setImages] = useState<ProductImage[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null)
  const [qty, setQty] = useState(1)
  const { addItem } = useCart()
  const { user } = useAuth()
  const [added, setAdded] = useState(false)
  const [inWishlist, setInWishlist] = useState(false)

  useEffect(() => {
    if (!id) { setProduct(null); return }
    let cancelled = false
    async function load() {
      try {
        setErr(null); setProduct(undefined)
        const prod = await getProductById(id!)
        if (cancelled) return
        if (!prod) { setProduct(null); return }
        setProduct(prod)
        const [vars, opts, cats, imgs] = await Promise.all([
          getProductVariants(prod.id),
          getProductOptions(prod.id),
          getActiveCategories(),
          getProductImages(prod.id),
        ])
        if (cancelled) return
        setVariants(vars); setOptions(opts); setImages(imgs)
        setCategory(cats.find(c => c.id === prod.category_id) ?? null)
        if (vars.length > 0) setSelectedVariantId(vars[0].id)
        if (opts.length > 0) {
          const vals = await getProductOptionValues(opts.map(o => o.id))
          if (cancelled) return
          setOptionValues(vals)
        } else setOptionValues([])
      } catch (e) { if (!cancelled) setErr((e as Error).message) }
    }
    load()
    return () => { cancelled = true }
  }, [id])

  useEffect(() => {
    if (!user || !id) return
    supabase.from('wishlist_items').select('id').eq('customer_id', user.id).eq('product_id', id).maybeSingle().then(({ data }) => {
      setInWishlist(!!data)
    })
  }, [user, id])

  const toggleWishlist = async () => {
    if (!user) { window.location.href = '/login'; return }
    if (!id) return
    if (inWishlist) {
      await supabase.from('wishlist_items').delete().eq('customer_id', user.id).eq('product_id', id)
      setInWishlist(false)
    } else {
      const { error } = await supabase.from('wishlist_items').insert({ customer_id: user.id, product_id: id })
      if (!error) setInWishlist(true)
    }
  }

  if (err) return <div className="container" style={{ padding: '40px 0' }}><ErrorState message={err} onRetry={() => location.reload()} /></div>
  if (product === undefined) return <div className="container" style={{ padding: '40px 0' }}><Loading label="Loading product..." /></div>
  if (product === null) return <div className="container" style={{ padding: '40px 0' }}><ErrorState message="Product not found or inactive." /></div>

  const selectedVariant = variants?.find(v => v.id === selectedVariantId) ?? null
  const primaryImage = (selectedImageId ? images?.find(i => i.id === selectedImageId) : null) ?? images?.find(i => i.is_primary) ?? images?.[0] ?? null
  const publicUrl = primaryImage?.storage_path ? getPublicImageUrl(primaryImage.storage_path) : null
  const currentPrice = selectedVariant ? (selectedVariant.sale_price ?? selectedVariant.price) : (product.sale_price ?? product.base_price)
  const hasPrice = currentPrice != null && currentPrice !== 0

  const doAdd = (buyNow: boolean) => {
    if (!selectedVariant || !product) return
    addItem({
      product_id: product.id,
      variant_id: selectedVariant.id,
      product_name: product.name,
      variant_name: selectedVariant.name,
      sku: selectedVariant.sku ?? product.sku ?? null,
      unit_price: selectedVariant.sale_price ?? selectedVariant.price,
      image_path: primaryImage?.storage_path ?? null,
    })
    if (buyNow) navigate('/checkout')
    else { setAdded(true); setTimeout(() => setAdded(false), 1800) }
  }

  return (
    <div className="page">
      <section className="product-detail">
        <div className="container">
          <button className="back-button" onClick={() => navigate('/catalogue')}>← Back to shop</button>
          <div className="product-detail-grid">
            <div className="detail-gallery">
              <div className="detail-main-image">
                {publicUrl ? <img src={publicUrl} alt={product.name} /> : <span style={{ fontSize: 64 }}>📦</span>}
              </div>
              {images && images.length > 1 && (
                <div className="thumbnail-row">
                  {images.map(img => {
                    const url = img.storage_path ? getPublicImageUrl(img.storage_path) : null
                    return (
                      <button key={img.id} className={`thumbnail${img.id === primaryImage?.id ? ' active' : ''}`} onClick={() => setSelectedImageId(img.id)}>
                        {url ? <img src={url} alt="" /> : <span>📦</span>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div>
              <div className="detail-category">{category?.name ?? 'Uncategorized'}</div>
              <h1 className="detail-title">{product.name}</h1>
              <div className="rating"><span className="stars">★★★★★</span> New on Cartiva</div>
              <div className="detail-price">{hasPrice ? CEDI(currentPrice!) : 'Price not set'}</div>
              {product.description && <p className="detail-description">{product.description}</p>}

              {options && options.length > 0 && options.map(opt => {
                const vals = optionValues?.filter(v => v.option_id === opt.id) ?? []
                if (vals.length === 0) return null
                return (
                  <div className="variant-row" key={opt.id}>
                    <span className="option-label" style={{ width: '100%' }}>{opt.name}</span>
                    {vals.map(v => <span key={v.id} className="variant-button" style={{ cursor: 'default' }}>{v.value}</span>)}
                  </div>
                )
              })}

              {variants && variants.length > 0 && (
                <div className="variant-row">
                  <span className="option-label" style={{ width: '100%' }}>Choose variant</span>
                  {variants.map(v => (
                    <button key={v.id} className={`variant-button${selectedVariantId === v.id ? ' active' : ''}`} onClick={() => setSelectedVariantId(v.id)}>
                      {v.name}
                    </button>
                  ))}
                </div>
              )}

              <div className="quantity-row">
                <span className="option-label">Quantity</span>
                <div className="quantity-box">
                  <button onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
                  <span id="productQuantity">{qty}</span>
                  <button onClick={() => setQty(qty + 1)}>+</button>
                </div>
              </div>

              <div className="detail-actions">
                <button className="secondary-btn" onClick={toggleWishlist}>{inWishlist ? '♥ Saved' : '♡ Add to wishlist'}</button>
                <button className="primary-btn" disabled={!selectedVariant} onClick={() => doAdd(false)}>{added ? 'Added ✓' : 'Add to cart'}</button>
              </div>
              <button className="primary-btn full-btn" style={{ marginTop: 9 }} disabled={!selectedVariant} onClick={() => doAdd(true)}>Buy now →</button>
              <a className="more-photos" href="https://wa.me/qr/Y4QSV6G5HXJMO1" target="_blank" rel="noopener noreferrer">More photos? View more on WhatsApp →</a>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
