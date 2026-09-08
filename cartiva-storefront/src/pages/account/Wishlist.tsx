import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useCart } from '../../context/CartContext'
import { Loading } from '../../components/Loading'
import ErrorState from '../../components/ErrorState'
import { getPublicImageUrl } from '../../lib/catalogue'

const CEDI_FULL = (n: number) => 'GH₵' + Number(n).toLocaleString('en-GH', { maximumFractionDigits: 0 })

interface WishlistItem {
  id: string; product_id: string; created_at: string;
  products?: { id: string; name: string; active: boolean; category_id?: string | null }[];
}

export default function AccountWishlist() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { addItem } = useCart()
  const [items, setItems] = useState<WishlistItem[]>([])
  const [imgMap, setImgMap] = useState<Record<string, string>>({})
  const [priceMap, setPriceMap] = useState<Record<string, number | null>>({})
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function load() {
      try {
        const { data, error } = await supabase.from('wishlist_items').select('id, product_id, created_at, products(id, name, active)').eq('customer_id', user!.id).order('created_at', { ascending: false })
        if (error) throw error
        const list = (data || []) as WishlistItem[]
        if (!cancelled) setItems(list)
        const pids = list.map(i => i.product_id)
        if (pids.length > 0 && !cancelled) {
          const [{ data: imgs }, { data: vars }] = await Promise.all([
            supabase.from('product_images').select('product_id, storage_path').in('product_id', pids).order('is_primary', { ascending: false }),
            supabase.from('product_variants').select('product_id, price, sale_price').in('product_id', pids).eq('active', true),
          ])
          const im: Record<string, string> = {}
          for (const r of (imgs ?? []) as { product_id: string; storage_path: string }[]) {
            if (!im[r.product_id]) {
              const url = getPublicImageUrl(r.storage_path)
              if (url) im[r.product_id] = url
            }
          }
          const pm: Record<string, number | null> = {}
          for (const v of (vars ?? []) as { product_id: string; price: number; sale_price: number | null }[]) {
            const pv = v.sale_price ?? v.price
            if (pm[v.product_id] == null || pv < pm[v.product_id]!) pm[v.product_id] = pv
          }
          if (!cancelled) { setImgMap(im); setPriceMap(pm) }
        }
      } catch (e) { if (!cancelled) setErr((e as Error).message) }
      finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [user])

  async function removeItem(id: string) {
    const { error } = await supabase.from('wishlist_items').delete().eq('id', id)
    if (!error) setItems(prev => prev.filter(i => i.id !== id))
  }

  async function moveToCart(item: WishlistItem) {
    const p = item.products?.[0]
    if (!p || !p.active) return
    const { data: vars } = await supabase.from('product_variants').select('id, name, sku, price, sale_price').eq('product_id', p.id).eq('active', true).order('name').limit(1)
    const v = vars?.[0]
    if (!v) return
    addItem({
      product_id: item.product_id,
      variant_id: v.id,
      product_name: p.name,
      variant_name: v.name,
      sku: v.sku ?? null,
      unit_price: v.sale_price ?? v.price,
      quantity: 1,
    })
    await removeItem(item.id)
  }

  if (loading) return <Loading label="Loading wishlist..." />
  if (err) return <ErrorState message={err} />

  return (
    <div id="wishlist" className="section">
      <div className="section-head">
        <small>SAVED FOR LATER</small>
        <h2>Your Wishlist</h2>
        <p>Keep the products you&apos;re interested in close.</p>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">♡</div>
          <h3>Nothing here yet</h3>
          <p>Save products you love and come back to them later.</p>
          <button className="orange-btn" onClick={() => navigate('/catalogue')}>Explore products</button>
        </div>
      ) : (
        <div className="wishlist-grid">
          {items.map(item => {
            const p = item.products?.[0]
            return (
              <div key={item.id} className="wish-card">
                <div className="wish-img" onClick={() => p && navigate(`/product/${p.id}`)} style={{ cursor: p ? 'pointer' : 'default' }}>
                  {imgMap[item.product_id] ? <img src={imgMap[item.product_id]} alt={p?.name || ''} /> : <span style={{ fontSize: 40 }}>📦</span>}
                  <button className="remove-wish" onClick={() => removeItem(item.id)} aria-label="Remove">×</button>
                </div>
                <div className="wish-body">
                  <h3>{p?.name || 'Product'}</h3>
                  <div className="wish-price">{priceMap[item.product_id] != null ? CEDI_FULL(priceMap[item.product_id]!) : 'Price not set'}</div>
                  <button className="orange-btn" onClick={() => moveToCart(item)}>Add to Cart</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
