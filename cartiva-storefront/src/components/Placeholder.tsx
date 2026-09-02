export default function Placeholder({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-8">
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="text-sm text-zinc-500 mt-1">{desc}</p>
      <div className="mt-4 text-xs inline-flex items-center gap-2 bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-full">
        Placeholder — backend not connected yet (next stage: Supabase products/variants/orders)
      </div>
    </div>
  )
}
