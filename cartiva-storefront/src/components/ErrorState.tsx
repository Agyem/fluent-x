export default function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="empty-state" style={{ padding: '54px 20px' }}>
      <div className="empty-icon" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
      </div>
      <h3>Something went wrong</h3>
      <p>{message}</p>
      {onRetry && <button className="btn primary" onClick={onRetry}>Try again</button>}
    </div>
  )
}
