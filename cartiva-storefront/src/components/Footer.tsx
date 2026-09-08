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
