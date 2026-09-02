import { Link } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import Placeholder from '../components/Placeholder'

export default function Cart() {
  const { items, removeItem, increase, decrease, clear, subtotal } = useCart()

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <Placeholder title="Your cart is empty" desc="Add a product variant — simple products use their Default variant automatically." />
        <Link to="/catalogue" className="inline-flex mt-4 px-4 py-2 rounded-xl bg-zinc-900 text-white text-sm">Continue shopping</Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Cart</h1>
        <button onClick={clear} className="text-sm text-zinc-500 hover:text-zinc-900 underline">Clear cart</button>
      </div>

      <div className="space-y-3">
        {items.map(item => (
          <div key={item.variant_id} className="bg-white border border-zinc-200 rounded-2xl p-4 flex gap-4">
            <div className="flex-1">
              <div className="font-semibold text-sm">{item.product_name}</div>
              <div className="text-xs text-zinc-500 mt-1">{item.variant_name ?? '—'} {item.sku ? `· SKU ${item.sku}` : ''}</div>
              <div className="text-sm font-bold mt-2">GH₵ {item.unit_price} <span className="text-xs font-normal text-zinc-400">× {item.quantity}</span></div>
              <div className="text-xs text-zinc-400 mt-1">Display price — authoritative price re-fetched at checkout later</div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="text-sm font-bold">GH₵ {(item.unit_price * item.quantity).toFixed(2)}</div>
              <div className="flex items-center gap-2">
                <button onClick={() => decrease(item.variant_id)} className="w-8 h-8 grid place-items-center rounded-xl border border-zinc-200 text-sm">−</button>
                <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                <button onClick={() => increase(item.variant_id)} className="w-8 h-8 grid place-items-center rounded-xl border border-zinc-200 text-sm">+</button>
              </div>
              <button onClick={() => removeItem(item.variant_id)} className="text-xs text-red-600 hover:underline">Remove</button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-zinc-200 rounded-2xl p-4 flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div>
          <div className="text-sm text-zinc-500">Subtotal (display)</div>
          <div className="text-xl font-bold">GH₵ {subtotal.toFixed(2)}</div>
        </div>
        <div className="flex gap-2">
          <Link to="/catalogue" className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-semibold">Continue shopping</Link>
          <Link to="/checkout" className="px-4 py-2.5 rounded-xl bg-[#5B5FEF] text-white text-sm font-semibold">Checkout</Link>
        </div>
      </div>
    </div>
  )
}
