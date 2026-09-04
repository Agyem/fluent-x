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
    { label: 'My orders', action: () => navigate('/account/orders') },
    { label: 'Order tracking', action: () => navigate('/account/orders') },
    { label: 'Wishlist', action: () => navigate('/account/wishlist') },
    { label: 'Cart', action: () => navigate('/account/cart') },
    { label: 'Reviews', action: () => navigate('/account/reviews') },
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
              <div className="brand-mark" style={{ width: 32, height: 32 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
              </div>
              <span className="footer-wordmark">Cartiva</span>
            </div>
            <p>Everything for campus life, delivered to your hall.</p>
            <p>Cartiva makes everyday shopping convenient for university students and young customers — from lecture-hall essentials to hostel upgrades, ordered in a few taps and delivered where you live.</p>
            <div className="footer-social">
              <a href="https://www.facebook.com/profile.php?id=61594272832003" target="_blank" rel="noopener noreferrer" title="Facebook">f</a>
              <a href="https://whatsapp.com/channel/0029VbEJ9hQI1rckYAj6XB1d" target="_blank" rel="noopener noreferrer" title="WhatsApp">wa</a>
              <a href="https://t.me/cartivashop" target="_blank" rel="noopener noreferrer" title="Telegram">tg</a>
            </div>
            <div className="footer-contact-note">support@cartiva.com</div>
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
