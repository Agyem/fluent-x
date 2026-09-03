import { Link } from 'react-router-dom'
import { X, ShoppingBag } from 'lucide-react'
import { useCart } from '../context/CartContext'

export default function FloatingCart({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { items, subtotal, removeItem, increase, decrease } = useCart()
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white h-full shadow-xl flex flex-col">
        <div className="p-4 border-b border-zinc-200 flex items-center justify-between">
          <h3 className="font-bold flex items-center gap-2"><ShoppingBag className="w-4 h-4" /> Cart ({items.reduce((s, i) => s + i.quantity, 0)})</h3>
          <button onClick={onClose} className="w-8 h-8 grid place-items-center rounded-full hover:bg-zinc-100"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-auto p-4 space-y-3">
          {items.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto rounded-full bg-zinc-100 grid place-items-center text-zinc-400"><ShoppingBag className="w-6 h-6" /></div>
              <p className="text-sm text-zinc-500 mt-3">Your cart is empty</p>
              <Link to="/catalogue" onClick={onClose} className="inline-flex mt-4 px-4 py-2 rounded-xl bg-zinc-900 text-white text-sm">Browse products</Link>
            </div>
          ) : items.map(item => (
            <div key={item.variant_id} className="flex gap-3 p-3 bg-zinc-50 rounded-xl border border-zinc-100">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{item.product_name}</div>
                <div className="text-xs text-zinc-500">{item.variant_name ?? 'Default'} {item.sku ? `· ${item.sku}` : ''}</div>
                <div className="text-sm font-bold mt-1">GH₵ {item.unit_price} <span className="text-xs font-normal text-zinc-400">× {item.quantity}</span></div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-1">
                  <button onClick={() => decrease(item.variant_id)} className="w-7 h-7 grid place-items-center rounded-lg border border-zinc-200 text-sm">−</button>
                  <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                  <button onClick={() => increase(item.variant_id)} className="w-7 h-7 grid place-items-center rounded-lg border border-zinc-200 text-sm">+</button>
                </div>
                <button onClick={() => removeItem(item.variant_id)} className="text-xs text-red-600 hover:underline">Remove</button>
              </div>
            </div>
          ))}
        </div>
        {items.length > 0 && (
          <div className="p-4 border-t border-zinc-200 space-y-3">
            <div className="flex justify-between text-sm"><span className="text-zinc-500">Subtotal</span><span className="font-bold font-mono">GH₵ {subtotal.toFixed(2)}</span></div>
            <div className="grid grid-cols-2 gap-2">
              <Link to="/cart" onClick={onClose} className="text-center py-3 rounded-xl border border-zinc-200 text-sm font-semibold">View cart</Link>
              <Link to="/checkout" onClick={onClose} className="text-center py-3 rounded-xl bg-[#5B5FEF] text-white text-sm font-semibold">Checkout</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
