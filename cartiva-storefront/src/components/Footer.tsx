import { useNavigate } from 'react-router-dom'

export default function Footer() {
  const navigate = useNavigate()
  const year = new Date().getFullYear()

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <div className="logo">CARTIVA<span>.</span></div>
            <p>Everything you need. Delivered to you. A student-focused commerce platform built around everyday campus life.</p>
            <div className="footer-social">
              <a href="https://www.facebook.com/profile.php?id=61594272832003" target="_blank" rel="noopener noreferrer" title="Facebook">f</a>
              <a href="https://wa.me/qr/Y4QSV6G5HXJMO1" target="_blank" rel="noopener noreferrer" title="WhatsApp">wa</a>
              <a href="https://t.me/cartivashop" target="_blank" rel="noopener noreferrer" title="Telegram">tg</a>
            </div>
            <div className="footer-contact-note">support@cartiva.com</div>
          </div>

          <div>
            <div className="footer-title">Shop</div>
            <div className="footer-links">
              <button onClick={() => navigate('/catalogue')}>All products</button>
              <button onClick={() => navigate('/catalogue')}>Study</button>
              <button onClick={() => navigate('/catalogue')}>Laboratory</button>
              <button onClick={() => navigate('/catalogue')}>Fashion</button>
            </div>
          </div>

          <div>
            <div className="footer-title">Cartiva</div>
            <div className="footer-links">
              <button onClick={() => navigate('/account/orders')}>Orders</button>
              <button onClick={() => navigate('/account/wishlist')}>Wishlist</button>
              <button onClick={() => navigate('/account')}>Account</button>
              <a href="mailto:cartiva.info@gmail.com">Contact</a>
            </div>
          </div>

          <div>
            <div className="footer-title">Information</div>
            <div className="footer-links">
              <button onClick={() => navigate('/account/support')}>Delivery policies</button>
              <button onClick={() => navigate('/account/support')}>Terms &amp; conditions</button>
              <button onClick={() => navigate('/account/support')}>Privacy policy</button>
              <button onClick={() => navigate('/refund-policy')}>Refund policy</button>
              <a href="mailto:cartiva.info@gmail.com">cartiva.info@gmail.com</a>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© {year} CARTIVA</span>
          <span>Built for student life.</span>
        </div>
      </div>
    </footer>
  )
}
