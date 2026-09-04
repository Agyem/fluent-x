import { useState } from 'react'
import type { ReactElement } from 'react'

type TopicKey = 'order' | 'payment' | 'account' | 'shipping' | 'returns' | 'product' | 'technical' | 'contact'

interface Topic {
  key: TopicKey
  title: string
  desc: string
  icon: string
}

const TOPICS: Topic[] = [
  { key: 'order', title: 'Order issues', desc: 'Problems with your order, delivery, or returns', icon: 'bag' },
  { key: 'payment', title: 'Payment help', desc: 'Issues with payment methods or transactions', icon: 'card' },
  { key: 'account', title: 'Account support', desc: 'Login problems, password reset, account access', icon: 'user' },
  { key: 'shipping', title: 'Shipping info', desc: 'Delivery times, tracking, and shipping methods', icon: 'truck' },
  { key: 'returns', title: 'Returns & refunds', desc: 'Return policy, refund status, exchange requests', icon: 'return' },
  { key: 'product', title: 'Product questions', desc: 'Specifications, compatibility, availability', icon: 'help' },
  { key: 'technical', title: 'Technical support', desc: 'Device setup, troubleshooting, warranty claims', icon: 'wrench' },
  { key: 'contact', title: 'Contact us', desc: 'Reach our support team directly', icon: 'mail' },
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

function TopicContent({ topic }: { topic: TopicKey }) {
  const sectionStyle = { marginBottom: 20 }
  const h4Style = { fontSize: 13, fontWeight: 700 as const, marginBottom: 6 }
  const pStyle = { fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.6 }
  const liStyle = { fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }

  if (topic === 'payment') return (
    <div>
      <p style={pStyle}>CARTIVA aims to make your shopping experience simple and secure.</p>
      <div style={sectionStyle}><h4 style={h4Style}>Payment Methods</h4><p style={pStyle}>We accept the payment methods displayed on our website at checkout. Available payment options may vary depending on your location.</p></div>
      <div style={sectionStyle}><h4 style={h4Style}>Payment Confirmation</h4><p style={pStyle}>Your order will be processed once payment has been successfully confirmed. Please keep your payment confirmation or transaction details until your order has been received.</p></div>
      <div style={sectionStyle}><h4 style={h4Style}>Failed or Pending Payments</h4><p style={pStyle}>If your payment fails or remains pending, please avoid making multiple payments for the same order. Contact us with your order details so we can assist you.</p></div>
      <div style={sectionStyle}><h4 style={h4Style}>Payment Issues</h4><p style={pStyle}>If you have been charged but your order has not been confirmed, please contact CARTIVA customer support and provide your payment or transaction reference where available.</p></div>
      <p style={{ ...pStyle, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>For assistance with payment, please contact our support team.</p>
    </div>
  )

  if (topic === 'technical') return (
    <div>
      <p style={pStyle}>Having trouble using the CARTIVA website? We're here to help.</p>
      <p style={pStyle}>Our technical support team can assist with issues such as:</p>
      <ul style={{ paddingLeft: 20, marginBottom: 14 }}>
        {['Creating or accessing your account','Adding products to your cart','Completing checkout','Problems submitting an order','Issues with product customisation','Problems uploading or providing customisation details','Payment or checkout errors','Order confirmation issues'].map(item => (
          <li key={item} style={liStyle}>{item}</li>
        ))}
      </ul>
      <p style={pStyle}>When contacting us, please provide a description of the problem and, where possible, a screenshot of the issue. This helps us resolve the problem faster.</p>
      <p style={{ ...pStyle, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>For technical assistance, please contact CARTIVA customer support.</p>
    </div>
  )

  if (topic === 'product') return (
    <div>
      <p style={pStyle}>Choosing the right lab coat is important. If you have questions about any CARTIVA product, our team is happy to assist.</p>
      <p style={pStyle}>You can contact us about:</p>
      <ul style={{ paddingLeft: 20, marginBottom: 14 }}>
        {['Available sizes','Lab coat fit and measurements','Colours and styles','Long-sleeve and short-sleeve options','Fabric and product quality','Embroidery and customisation','Personalised names, logos, or details','Product availability','Care and maintenance','Bulk or multiple-item orders'].map(item => (
          <li key={item} style={liStyle}>{item}</li>
        ))}
      </ul>
      <p style={pStyle}>For the best assistance, include the name of the product you are interested in and your question.</p>
      <p style={{ ...pStyle, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>If you're unsure which lab coat is right for you, contact our team before placing your order.</p>
    </div>
  )

  if (topic === 'returns') return (
    <div>
      <p style={pStyle}>At CARTIVA, we want you to be satisfied with your purchase. If you experience an issue with your order, please contact us as soon as possible.</p>
      <div style={sectionStyle}><h4 style={h4Style}>Return Requests</h4><p style={pStyle}>Products may be eligible for return or exchange depending on the condition of the item and the reason for the return. Items must generally be returned in their original condition and should not have been used, washed, damaged, or altered.</p></div>
      <div style={sectionStyle}><h4 style={h4Style}>Customised Products</h4><p style={pStyle}>Because customised and embroidered products are made according to the customer's specifications, they may have different return or exchange conditions. Please confirm your customisation details carefully before placing your order.</p></div>
      <div style={sectionStyle}><h4 style={h4Style}>Damaged or Incorrect Items</h4><p style={pStyle}>If you receive a damaged, defective, or incorrect product, contact us promptly with your order details and clear photographs of the item so we can review the issue and assist you.</p></div>
      <div style={sectionStyle}><h4 style={h4Style}>Refunds</h4><p style={pStyle}>Where a refund is approved, the refund process and timeframe will depend on the payment method and circumstances of the return.</p></div>
      <div style={sectionStyle}><h4 style={h4Style}>Before Returning an Item</h4><p style={pStyle}>Please contact CARTIVA customer support before sending any item back. We will provide the appropriate instructions for your return or exchange.</p></div>
      <p style={{ ...pStyle, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>For return, exchange, or refund assistance, please contact our customer support team.</p>
    </div>
  )

  if (topic === 'order') return (
    <div>
      <p style={pStyle}>If you're experiencing issues with your order, here's how we can help.</p>
      <div style={sectionStyle}><h4 style={h4Style}>Order Status</h4><p style={pStyle}>You can track your order status from the Orders section in your account. Each order shows its current status and delivery progress.</p></div>
      <div style={sectionStyle}><h4 style={h4Style}>Order Changes</h4><p style={pStyle}>If you need to change or cancel your order, please contact us as soon as possible. Orders that have already been processed or shipped may not be eligible for changes.</p></div>
      <div style={sectionStyle}><h4 style={h4Style}>Missing Items</h4><p style={pStyle}>If your order is missing items, please contact us with your order number and we will investigate and resolve the issue promptly.</p></div>
      <p style={{ ...pStyle, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>For order-related assistance, please contact our support team with your order number.</p>
    </div>
  )

  if (topic === 'account') return (
    <div>
      <p style={pStyle}>Need help with your CARTIVA account?</p>
      <div style={sectionStyle}><h4 style={h4Style}>Login Issues</h4><p style={pStyle}>If you're having trouble logging in, make sure you're using the correct email and password. You can reset your password from the login page.</p></div>
      <div style={sectionStyle}><h4 style={h4Style}>Account Access</h4><p style={pStyle}>If you've been locked out or are experiencing persistent login issues, contact our support team for assistance.</p></div>
      <div style={sectionStyle}><h4 style={h4Style}>Profile Updates</h4><p style={pStyle}>You can update your name, email, and phone number from the Profile section in your account settings.</p></div>
      <p style={{ ...pStyle, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>For account-related issues, please contact our support team.</p>
    </div>
  )

  if (topic === 'shipping') return (
    <div>
      <p style={pStyle}>CARTIVA offers delivery options to fit your schedule.</p>
      <div style={sectionStyle}><h4 style={h4Style}>Delivery Methods</h4><p style={pStyle}>We offer Air Freight (3-7 business days) and Sea Freight (14-30 business days). You can select your preferred method at checkout.</p></div>
      <div style={sectionStyle}><h4 style={h4Style}>Delivery Areas</h4><p style={pStyle}>We deliver to all regions in Ghana. Delivery times may vary depending on your location.</p></div>
      <div style={sectionStyle}><h4 style={h4Style}>Track Your Order</h4><p style={pStyle}>Once your order has been shipped, you can track its progress from the Orders section in your account.</p></div>
      <p style={{ ...pStyle, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>For shipping questions, please contact our support team.</p>
    </div>
  )

  if (topic === 'contact') return (
    <div>
      <p style={pStyle}>We're here to help. Reach out to us through any of these channels.</p>
      <div style={sectionStyle}><h4 style={h4Style}>Email</h4><p style={pStyle}>support@cartiva.com</p></div>
      <div style={sectionStyle}><h4 style={h4Style}>WhatsApp</h4><p style={pStyle}>Message us on WhatsApp for quick support.</p></div>
      <div style={sectionStyle}><h4 style={h4Style}>Telegram</h4><p style={pStyle}>Join our Telegram channel for updates and support.</p></div>
      <div style={sectionStyle}><h4 style={h4Style}>Facebook</h4><p style={pStyle}>Send us a message on our Facebook page.</p></div>
      <p style={{ ...pStyle, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>We aim to respond to all inquiries within 24 hours.</p>
    </div>
  )

  return null
}

export default function AccountSupport() {
  const [active, setActive] = useState<TopicKey | null>(null)
  const activeTopic = TOPICS.find(t => t.key === active)

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Help center</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 18 }}>Choose a topic below to get help with your question.</p>

      {active && activeTopic && (
        <div className="card" style={{ padding: 20, marginBottom: 16 }}>
          <button className="back-link" onClick={() => setActive(null)} style={{ marginBottom: 14 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Back to topics
          </button>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{activeTopic.title}</h3>
          <TopicContent topic={active} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {TOPICS.map(t => (
          <div key={t.title} className="card support-tile" style={{ cursor: 'pointer' }} onClick={() => setActive(t.key)}>
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
