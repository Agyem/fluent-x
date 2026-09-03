export default function Placeholder({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="empty-state" style={{ padding: '54px 20px' }}>
      <div className="empty-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
      </div>
      <h3>{title}</h3>
      <p>{desc}</p>
    </div>
  )
}
