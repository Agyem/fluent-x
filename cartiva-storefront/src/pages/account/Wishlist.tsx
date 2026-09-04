import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useCart } from '../../context/CartContext'
import { Loading } from '../../components/Loading'
import ErrorState from '../../components/ErrorState'

interface WishlistItem { id: string; product_id: string; created_at: string; products?: { id: string; name: string; thumbnail_path?: string; active: boolean }[] }

export default function AccountWishlist() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { addItem } = useCart()
  const [items, setItems] = useState<WishlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function load() {
      try {
        const { data, error } = await supabase.from('wishlist_items').select('id, product_id, created_at, products(id, name, thumbnail_path, active)').eq('customer_id', user!.id).order('created_at', { ascending: false })
        if (error) throw error
        if (!cancelled) setItems((data || []) as WishlistItem[])
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
    if (!p) return
    addItem({ product_id: item.product_id, variant_id: item.product_id, product_name: p.name, variant_name: null, sku: null, unit_price: 0, quantity: 1 })
    await removeItem(item.id)
  }

  if (loading) return <Loading label="Loading wishlist..." />
  if (err) return <ErrorState message={err} />

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Wishlist</h2>
      {items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg></div>
          <h3>Your wishlist is empty</h3>
          <p>Save items you love for later.</p>
          <button className="btn primary" onClick={() => navigate('/catalogue')}>Browse products</button>
        </div>
      ) : (
        <div className="card" style={{ padding: 4 }}>
          {items.map(item => (
            <div key={item.id} className="product-row" style={{ padding: '14px 14px' }}>
              <div className="product-thumb" style={{ cursor: 'pointer' }} onClick={() => item.products?.[0] && navigate(`/product/${item.products[0].id}`)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
              </div>
              <div style={{ flex: 1 }}>
                <div className="product-name" style={{ cursor: 'pointer' }} onClick={() => item.products?.[0] && navigate(`/product/${item.products[0].id}`)}>{item.products?.[0]?.name || 'Product'}</div>
                <div className="product-var">Added {new Date(item.created_at).toLocaleDateString()}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn sm primary" onClick={() => moveToCart(item)}>Add to cart</button>
                <button className="btn sm ghost" style={{ color: 'var(--danger)' }} onClick={() => removeItem(item.id)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
