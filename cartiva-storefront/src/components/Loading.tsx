export function Loading({ label = 'Loading...' }: { label?: string }) {
  return (
    <div style={{ background: 'var(--surface-muted)', borderRadius: 9, height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
      {label}
    </div>
  )
}

export function SkeletonCard() {
  return (
    <div className="card" style={{ height: 180, background: 'var(--surface-muted)' }} />
  )
}
