import { useNavigate } from 'react-router-dom'

export default function Footer() {
  const navigate = useNavigate()

  const shopLinks = [
    { label: 'Shop all', action: () => navigate('/catalogue') },
    { label: 'New arrivals', action: () => navigate('/catalogue') },
    { label: 'Popular products', action: () => navigate('/catalogue') },
    { label: 'Categories', action: () => navigate('/catalogue') },
  ]

  const customerLinks = [
    { label: 'My account', action: () => navigate('/account') },
    { label: 'My orders', action: () => navigate('/orders') },
    { label: 'Order tracking', action: () => navigate('/orders') },
    { label: 'Wishlist', action: () => navigate('/cart') },
    { label: 'Cart', action: () => navigate('/cart') },
    { label: 'Reviews', action: () => navigate('/account') },
  ]

  const supportLinks = [
    { label: 'Help & support', action: () => {} },
    { label: 'Contact us', action: () => {} },
    { label: 'FAQs', action: () => {} },
    { label: 'Delivery information', action: () => {} },
    { label: 'Payment information', action: () => {} },
    { label: 'Returns & refunds', action: () => {} },
  ]

  const legalLinks = [
    { label: 'Privacy policy', action: () => {} },
    { label: 'Terms & conditions', action: () => {} },
  ]

  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-top">
          <div className="footer-col footer-brand">
            <div className="brand">
              <div className="w-8 h-8 rounded-[9px] bg-primary flex items-center justify-center text-white font-bold text-xs shrink-0" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>C</div>
              <span className="footer-wordmark">Cartiva</span>
            </div>
            <p>Everything for campus life, delivered to your hall.</p>
            <p>Cartiva makes everyday shopping convenient for university students and young customers — from lecture-hall essentials to hostel upgrades, ordered in a few taps and delivered where you live.</p>
            <div className="footer-social">
              <button title="Facebook">f</button>
              <button title="Instagram">ig</button>
              <button title="X (Twitter)">x</button>
              <button title="TikTok">tt</button>
            </div>
            <div className="footer-contact-note">hello@cartiva.example (placeholder — add real contact details)</div>
          </div>

          <div className="footer-col">
            <h4>Shop</h4>
            <ul>
              {shopLinks.map(l => (
                <li key={l.label}>
                  <button className="footer-link" onClick={l.action}>{l.label}</button>
                </li>
              ))}
            </ul>
          </div>

          <div className="footer-col">
            <h4>Customer</h4>
            <ul>
              {customerLinks.map(l => (
                <li key={l.label}>
                  <button className="footer-link" onClick={l.action}>{l.label}</button>
                </li>
              ))}
            </ul>
          </div>

          <div className="footer-col">
            <h4>Support</h4>
            <ul>
              {supportLinks.map(l => (
                <li key={l.label}>
                  <button className="footer-link" onClick={l.action}>{l.label}</button>
                </li>
              ))}
            </ul>
          </div>

          <div className="footer-col">
            <h4>Legal</h4>
            <ul>
              {legalLinks.map(l => (
                <li key={l.label}>
                  <button className="footer-link" onClick={l.action}>{l.label}</button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <div>© 2026 Cartiva. All rights reserved.</div>
          <div className="footer-bottom-links">
            <button onClick={() => {}}>Privacy policy</button>
            <button onClick={() => {}}>Terms & conditions</button>
          </div>
        </div>
      </div>
    </footer>
  )
}
