import { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type CartItem = {
  product_id: string
  variant_id: string
  product_name: string
  variant_name: string | null
  sku: string | null
  unit_price: number // display price — NOT authoritative, re-fetched at checkout creation later
  quantity: number
  image_path?: string | null
}

type CartState = {
  items: CartItem[]
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void
  removeItem: (variant_id: string) => void
  increase: (variant_id: string) => void
  decrease: (variant_id: string) => void
  clear: () => void
  count: number
  subtotal: number
}

const CartContext = createContext<CartState>({
  items: [],
  addItem: () => {},
  removeItem: () => {},
  increase: () => {},
  decrease: () => {},
  clear: () => {},
  count: 0,
  subtotal: 0,
})

const STORAGE_KEY = 'cartiva_cart_v1'

export const useCart = () => useContext(CartContext)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? (JSON.parse(raw) as CartItem[]) : []
    } catch { return [] }
  })

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)) } catch {}
  }, [items])

  const addItem = (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => {
    const qty = item.quantity ?? 1
    setItems(prev => {
      const existing = prev.find(i => i.variant_id === item.variant_id)
      if (existing) {
        return prev.map(i => i.variant_id === item.variant_id ? { ...i, quantity: i.quantity + qty } : i)
      }
      return [...prev, { ...item, quantity: qty }]
    })
  }

  const removeItem = (variant_id: string) => setItems(prev => prev.filter(i => i.variant_id !== variant_id))
  const increase = (variant_id: string) => setItems(prev => prev.map(i => i.variant_id === variant_id ? { ...i, quantity: i.quantity + 1 } : i))
  const decrease = (variant_id: string) => setItems(prev => prev.map(i => {
    if (i.variant_id !== variant_id) return i
    const next = i.quantity - 1
    return next <= 0 ? i : { ...i, quantity: next }
  }).filter(i => i.quantity > 0))
  const clear = () => setItems([])

  const count = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items])
  const subtotal = useMemo(() => items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0), [items])

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, increase, decrease, clear, count, subtotal }}>
      {children}
    </CartContext.Provider>
  )
}
