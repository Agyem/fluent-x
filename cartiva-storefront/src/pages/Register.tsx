import { Link } from 'react-router-dom'

export default function Register() {
  return (
    <div style={{ maxWidth: 420, margin: '0 auto' }}>
      <div className="card" style={{ padding: 28, textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--primary)' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Accounts are invite-only</h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>New accounts can only be created by a CARTIVA administrator. If you believe you should have access, please contact our support team.</p>
        <Link to="/login" className="btn primary block" style={{ textAlign: 'center' }}>Go to login</Link>
      </div>
    </div>
  )
}
