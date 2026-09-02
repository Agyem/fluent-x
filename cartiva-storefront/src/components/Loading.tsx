export function Loading({ label = 'Loading...' }: { label?: string }) {
  return <div className="animate-pulse bg-zinc-200 rounded-xl h-24 grid place-items-center text-sm text-zinc-500">{label}</div>
}
export function SkeletonCard() {
  return <div className="animate-pulse bg-zinc-100 border border-zinc-200 rounded-2xl h-[180px]" />
}
