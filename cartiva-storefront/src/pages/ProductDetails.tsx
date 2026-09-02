import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getProductById, getProductVariants, getProductOptions, getProductOptionValues, getVariantOptionValues, getProductImages, getPublicImageUrl, getActiveCategories } from '../lib/catalogue'
import type { Product, ProductVariant, ProductOption, ProductOptionValue, VariantOptionValue, ProductImage, Category } from '../lib/catalogue'
import { Loading } from '../components/Loading'
import ErrorState from '../components/ErrorState'
import Placeholder from '../components/Placeholder'
import { useCart } from '../context/CartContext'

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
        // Parallel fetch for related data
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
  if (product === null) return <div className="space-y-4"><ErrorState message="Product not found or inactive." /><Link to="/catalogue" className="inline-flex px-4 py-2 rounded-xl bg-zinc-900 text-white text-sm">Back to catalogue</Link></div>

  const selectedVariant = variants?.find(v => v.id === selectedVariantId) ?? null
  const primaryImage = images?.find(i => i.is_primary) ?? images?.[0] ?? null
  const publicUrl = getPublicImageUrl(primaryImage?.storage_path)

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div>
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 aspect-[4/3] grid place-items-center">
          {publicUrl ? (
            <img src={publicUrl} alt={product.name} className="max-w-full max-h-full object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
          ) : (
            <Placeholder title="No image" desc={images?.length === 0 ? "No product_images records — placeholder (bucket missing, Stage 2A)" : "Image placeholder — bucket missing, isolated via getPublicImageUrl()"} />
          )}
        </div>
        {images && images.length > 1 && <div className="mt-3 text-xs text-zinc-500">{images.length} image records in DB (public URL attempted via isolated layer)</div>}
      </div>

      <div className="space-y-4">
        <div>
          <div className="text-xs text-zinc-500 uppercase tracking-wide">{category?.name ?? 'Uncategorized'} · {product.product_type}</div>
          <h1 className="text-2xl font-bold mt-1">{product.name}</h1>
          <div className="text-sm text-zinc-500 mt-1">SKU {selectedVariant?.sku ?? product.sku ?? '—'}</div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-4">
          <div className="text-lg font-bold">
            {selectedVariant ? (
              <>{selectedVariant.sale_price != null ? `GH₵ ${selectedVariant.sale_price}` : `GH₵ ${selectedVariant.price}`} {selectedVariant.sale_price != null && selectedVariant.sale_price < selectedVariant.price && <span className="ml-2 text-sm font-normal line-through text-zinc-400">GH₵ {selectedVariant.price}</span>}</>
            ) : product.sale_price != null ? `GH₵ ${product.sale_price}` : product.base_price != null ? `GH₵ ${product.base_price}` : '—'}
          </div>
          <div className="text-xs text-zinc-500 mt-1">{product.active ? 'Active · available to customers' : 'Inactive · not visible to storefront'}</div>
          {product.description && <p className="text-sm text-zinc-600 mt-3 leading-relaxed">{product.description}</p>}
        </div>

        {options && options.length > 0 && (
          <div className="bg-white border border-zinc-200 rounded-2xl p-4">
            <h3 className="text-sm font-bold mb-3">Options</h3>
            {options.map(opt => {
              const vals = optionValues?.filter(v => v.option_id === opt.id) ?? []
              return (
                <div key={opt.id} className="mb-3 last:mb-0">
                  <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">{opt.name}</div>
                  <div className="flex flex-wrap gap-2">
                    {vals.map(v => {
                      // Show which variants contain this value (read-only, no mutation)
                      const variantIdsWithValue = variantOptionMap?.filter(m => m.option_value_id === v.id).map(m => m.variant_id) ?? []
                      return <span key={v.id} className="px-3 py-1.5 rounded-full border border-zinc-200 text-sm bg-zinc-50" title={`In variants: ${variantIdsWithValue.join(', ') || '—'}`}>{v.value}</span>
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="bg-white border border-zinc-200 rounded-2xl p-4">
          <h3 className="text-sm font-bold mb-2">Variants ({variants?.length ?? 0})</h3>
          {variants && variants.length === 0 ? <div className="text-sm text-zinc-500">No active variants — product unavailable</div>
          : <div className="space-y-2">
              {variants?.map(v => (
                <button key={v.id} onClick={() => setSelectedVariantId(v.id)} className={`w-full text-left px-3 py-2 rounded-xl border text-sm flex justify-between items-center ${selectedVariantId === v.id ? 'bg-[#FDF2E9] border-[#F2720E] text-[#D35F09]' : 'bg-white border-zinc-200 hover:border-zinc-300'}`}>
                  <span>{v.name} <span className="text-zinc-400">· {v.sku ?? 'no SKU'}</span></span>
                  <span className="font-bold">{v.sale_price != null ? `GH₵ ${v.sale_price}` : `GH₵ ${v.price}`}</span>
                </button>
              ))}
            </div>}
          <div className="mt-3 text-xs text-zinc-500">Simple products have hidden "Default" variant — read existing variant, not created (docs §4.2).</div>
        </div>

        <div className="flex gap-2">
          <button
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
            disabled={!selectedVariant}
            className={`flex-1 py-3 rounded-xl text-sm font-semibold ${!selectedVariant ? 'bg-zinc-200 text-zinc-500' : 'bg-[#5B5FEF] text-white hover:bg-[#4a4fd6]'}`}
          >
            {added ? 'Added ✓' : 'Add to cart'}
          </button>
          <Link to="/catalogue" className="px-4 py-3 rounded-xl border border-zinc-200 text-sm font-semibold">Back</Link>
        </div>
        <div className="text-xs text-zinc-400">Display price is from variant — authoritative price will be re-fetched at order creation (Stage 6).</div>
      </div>
    </div>
  )
}
