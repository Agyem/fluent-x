import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getProductById, getProductVariants, getProductOptions, getProductOptionValues, getVariantOptionValues, getProductImages, getPublicImageUrl, getActiveCategories } from '../lib/catalogue'
import type { Product, ProductVariant, ProductOption, ProductOptionValue, VariantOptionValue, ProductImage, Category } from '../lib/catalogue'
import { Loading } from '../components/Loading'
import ErrorState from '../components/ErrorState'
import { useCart } from '../context/CartContext'
import { Package, Truck, Shield, Clock } from 'lucide-react'

const CEDI = (n: number) => 'GH₵ ' + n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function ProductDetails() {
  const { id } = useParams<{ id: string }>()
  const [product, setProduct] = useState<Product | null | undefined>(undefined)
  const [category, setCategory] = useState<Category | null>(null)
  const [variants, setVariants] = useState<ProductVariant[] | null>(null)
  const [options, setOptions] = useState<ProductOption[] | null>(null)
  const [optionValues, setOptionValues] = useState<ProductOptionValue[] | null>(null)
  const [variantOptionMap, setVariantOptionMap] = useState<VariantOptionValue[] | null>(null)
  const [images, setImages] = useState<ProductImage[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [qty, setQty] = useState(1)
  const { addItem } = useCart()
  const [added, setAdded] = useState(false)

  useEffect(() => {
    if (!id) { setProduct(null); return }
    let cancelled = false
    async function load() {
      try {
        setErr(null)
        setProduct(undefined)
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
        setVariants(vars)
        setOptions(opts)
        setImages(imgs)
        const cat = cats.find(c => c.id === prod.category_id) ?? null
        setCategory(cat)
        if (vars.length > 0) setSelectedVariantId(vars[0].id)
        if (opts.length > 0) {
          const vals = await getProductOptionValues(opts.map(o => o.id))
          if (cancelled) return
          setOptionValues(vals)
          const vov = await getVariantOptionValues(vars.map(v => v.id))
          if (cancelled) return
          setVariantOptionMap(vov)
        } else {
          setOptionValues([])
          setVariantOptionMap([])
        }
      } catch (e) {
        if (!cancelled) setErr((e as Error).message)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id])

  if (err) return <ErrorState message={err} onRetry={() => location.reload()} />
  if (product === undefined) return <Loading label="Loading product..." />
  if (product === null) return <div className="space-y-4"><ErrorState message="Product not found or inactive." /><Link to="/catalogue" className="btn primary">Back to catalogue</Link></div>

  const selectedVariant = variants?.find(v => v.id === selectedVariantId) ?? null
  const primaryImage = images?.find(i => i.is_primary) ?? images?.[0] ?? null
  const publicUrl = primaryImage?.storage_path ? getPublicImageUrl(primaryImage.storage_path) : null

  const currentPrice = selectedVariant
    ? (selectedVariant.sale_price ?? selectedVariant.price)
    : (product.sale_price ?? product.base_price)
  const hasPrice = currentPrice != null && currentPrice !== 0
  const hasOldPrice = selectedVariant
    ? (selectedVariant.sale_price != null && selectedVariant.sale_price !== 0 && selectedVariant.sale_price < selectedVariant.price)
    : (product.sale_price != null && product.sale_price !== 0 && product.sale_price < product.base_price)
  const oldPrice = selectedVariant ? selectedVariant.price : product.base_price

  return (
    <div className="pd-layout">
      <div>
        <div className="pd-gallery-main">
          {publicUrl ? (
            <img src={publicUrl} alt={product.name} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
          ) : (
            <Package />
          )}
        </div>
        {images && images.length > 1 && (
          <div className="pd-thumbs">
            {images.map(img => {
              const url = img.storage_path ? getPublicImageUrl(img.storage_path) : null
              return (
                <div key={img.id} className={`pd-thumb ${img.id === primaryImage?.id ? 'active' : ''}`}>
                  {url ? <img src={url} alt="" /> : <Package />}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <div className="pd-cat-link">{category?.name ?? 'Uncategorized'}</div>
          <h1 className="pd-title">{product.name}</h1>
          <div className="pd-rating-row">
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Be the first to review this product</span>
          </div>
        </div>

        <div className="pd-price-row">
          <span className="pd-price">{hasPrice ? CEDI(currentPrice!) : 'Price not set'}</span>
          {hasOldPrice && <span className="pd-oldprice">{CEDI(oldPrice!)}</span>}
        </div>

        {options && options.length > 0 && options.map(opt => {
          const vals = optionValues?.filter(v => v.option_id === opt.id) ?? []
          return (
            <div key={opt.id} className="variant-group">
              <h4>{opt.name}</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0 }}>
                {vals.map(v => (
                  <span key={v.id} className="variant-chip">{v.value}</span>
                ))}
              </div>
            </div>
          )
        })}

        {variants && variants.length > 0 && (
          <div className="variant-group">
            <h4>Variant</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0 }}>
              {variants.map(v => {
                const vp = v.sale_price ?? v.price
                return (
                  <button key={v.id} onClick={() => setSelectedVariantId(v.id)} className={`variant-chip ${selectedVariantId === v.id ? 'active' : ''}`}>
                    {v.name}{vp != null && vp !== 0 ? ` — ${CEDI(vp)}` : ''}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="qty-stepper">
          <button onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 14 }}>{qty}</span>
          <button onClick={() => setQty(qty + 1)}>+</button>
        </div>

        <div className="pd-actions">
          <button
            className="btn primary block"
            disabled={!selectedVariant}
            onClick={() => {
              if (!selectedVariant || !product) return
              const price = selectedVariant.sale_price ?? selectedVariant.price
              addItem({
                product_id: product.id,
                variant_id: selectedVariant.id,
                product_name: product.name,
                variant_name: selectedVariant.name,
                sku: selectedVariant.sku ?? product.sku ?? null,
                unit_price: price,
                image_path: primaryImage?.storage_path ?? null,
              })
              setAdded(true)
              setTimeout(() => setAdded(false), 1800)
            }}
          >
            {added ? 'Added ✓' : 'Add to cart'}
          </button>
        </div>

        <div className="trust-row">
          <div className="trust-item"><Truck /> Free delivery over GH₵ 500</div>
          <div className="trust-item"><Shield /> Secure checkout</div>
          <div className="trust-item"><Clock /> 3–7 day delivery</div>
        </div>

        {product.description && (
          <div className="pd-tabs">
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Description</h3>
            <div className="pd-desc">{product.description}</div>
          </div>
        )}
      </div>
    </div>
  )
}
