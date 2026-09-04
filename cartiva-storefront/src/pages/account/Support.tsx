import type { ReactElement } from 'react'

const TOPICS = [
  { title: 'Order issues', desc: 'Problems with your order, delivery, or returns', icon: 'bag' },
  { title: 'Payment help', desc: 'Issues with payment methods or transactions', icon: 'card' },
  { title: 'Account support', desc: 'Login problems, password reset, account access', icon: 'user' },
  { title: 'Shipping info', desc: 'Delivery times, tracking, and shipping methods', icon: 'truck' },
  { title: 'Returns & refunds', desc: 'Return policy, refund status, exchange requests', icon: 'return' },
  { title: 'Product questions', desc: 'Specifications, compatibility, availability', icon: 'help' },
  { title: 'Technical support', desc: 'Device setup, troubleshooting, warranty claims', icon: 'wrench' },
  { title: 'Contact us', desc: 'Reach our support team directly', icon: 'mail' },
]

function TopicIcon({ name }: { name: string }) {
  const s = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const icons: Record<string, ReactElement> = {
    bag: <svg {...s}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
    card: <svg {...s}><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,
    user: <svg {...s}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    truck: <svg {...s}><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>,
    return: <svg {...s}><path d="M9 14l-4-4 4-4"/><path d="M5 10h11a4 4 0 0 1 0 8h-1"/></svg>,
    help: <svg {...s}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>,
    wrench: <svg {...s}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
    mail: <svg {...s}><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>,
  }
  return icons[name] || <svg {...s}><circle cx="12" cy="12" r="10"/></svg>
}

export default function AccountSupport() {
  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Help center</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 18 }}>Choose a topic below to get help with your question.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {TOPICS.map(t => (
          <div key={t.title} className="card support-tile" style={{ cursor: 'pointer' }}>
            <div className="support-icon">
              <TopicIcon name={t.icon} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{t.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{t.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
