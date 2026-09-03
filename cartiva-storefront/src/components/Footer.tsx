import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="site-footer">
      <div class="footer-inner">
        <div class="footer-top">
          <div class="footer-col footer-brand">
            <div class="brand">
              <img src="/logo.svg" alt="Cartiva" style="height:26px;width:auto;display:block;" />
              <span class="footer-wordmark">Cartiva</span>
            </div>
            <p>Everything for campus life, delivered to your hall.</p>
            <p>Cartiva makes everyday shopping convenient for university students and young customers — from lecture-hall essentials to hostel upgrades, ordered in a few taps and delivered where you live.</p>
            <div class="footer-social">
              <button title="Facebook — placeholder" onClick={() => alert('Facebook')}>f</button>
              <button title="Instagram — placeholder" onClick={() => alert('Instagram')}>ig</button>
              <button title="X (Twitter) — placeholder" onClick={() => alert('X')}>x</button>
              <button title="TikTok — placeholder" onClick={() => alert('TikTok')}>tt</button>
            </div>
            <div class="footer-contact-note">hello@cartiva.example (placeholder — add real contact details)</div>
          </div>
          <div class="footer-col">
            <h4 className="text-xs font-bold tracking-widest text-zinc-500 uppercase mb-3">Shop</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/catalogue" className="hover:text-white">Smartphones</Link></li>
              <li><Link to="/catalogue" className="hover:text-white">Laptops</Link></li>
              <li><Link to="/catalogue" className="hover:text-white">Audio & Wearables</Link></li>
              <li><Link to="/catalogue" className="hover:text-white">Accessories</Link></li>
              <li><Link to="/catalogue" className="hover:text-white">Home Appliances</Link></li>
            </ul>
          </div>
          <div class="footer-col">
            <h4 className="text-xs font-bold tracking-widest text-zinc-500 uppercase mb-3">Account</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/account" className="hover:text-white">My account</Link></li>
              <li><Link to="/orders" className="hover:text-white">Orders</Link></li>
            </ul>
          </div>
          <div class="footer-col">
            <h4 className="text-xs font-bold tracking-widest text-zinc-500 uppercase mb-3">Help</h4>
            <ul className="space-y-2 text-sm">
              <li><span className="text-zinc-500">Support — coming soon</span></li>
            </ul>
          </div>
        </div>
        <div class="footer-bottom">
          <div>© 2026 Cartiva. All rights reserved.</div>
          <div class="footer-bottom-links">
            <button className="background: none; border: none; padding: 0; cursor: pointer; font-size: 12px; color: rgba(255,255,255,0.5); transition: color .12s ease;" onClick={() => alert('Privacy policy')}>Privacy policy</button>
            <button className="background: none; border: none; padding: 0; cursor: pointer; font-size: 12px; color: rgba(255,255,255,0.5); transition: color .12s ease;" onClick={() => alert('Terms & conditions')}>Terms & conditions</button>
          </div>
        </div>
      </div>
    </footer>
  )
}