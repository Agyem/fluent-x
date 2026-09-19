import { useNavigate } from 'react-router-dom'

export default function RefundPolicy() {
  const navigate = useNavigate()

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 20px 80px' }}>
      <button onClick={() => navigate(-1)} style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 32, color: '#555' }}>← Back</button>

      <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Refund Policy</h1>
      <p style={{ color: '#888', fontSize: 13, marginBottom: 32 }}>Last updated: September 2026</p>

      <div style={{ fontSize: 14, lineHeight: 1.8, color: '#444', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <section>
          <h2 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>1. Eligibility for Refunds</h2>
          <p>You may request a refund if your order meets any of the following conditions:</p>
          <ul style={{ paddingLeft: 20, marginTop: 6 }}>
            <li>The product arrived damaged or defective.</li>
            <li>The wrong item was delivered.</li>
            <li>The product does not match its description on our platform.</li>
            <li>The order was cancelled before shipment and payment was already processed.</li>
          </ul>
        </section>

        <section>
          <h2 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>2. Refund Request Window</h2>
          <p>Refund requests must be submitted within <strong>7 days</strong> of receiving your order. Requests made after this period may not be accepted.</p>
        </section>

        <section>
          <h2 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>3. How to Request a Refund</h2>
          <p>Contact our support team via:</p>
          <ul style={{ paddingLeft: 20, marginTop: 6 }}>
            <li>Email: <strong>cartiva.info@gmail.com</strong></li>
            <li>WhatsApp: <a href="https://wa.me/qr/Y4QSV6G5HXJMO1" target="_blank" rel="noopener noreferrer" style={{ color: '#f97316' }}>Message us on WhatsApp</a></li>
          </ul>
          <p style={{ marginTop: 6 }}>Please include your order ID, a description of the issue, and photos of the product (if applicable).</p>
        </section>

        <section>
          <h2 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>4. Non-Refundable Items</h2>
          <p>The following are not eligible for refunds:</p>
          <ul style={{ paddingLeft: 20, marginTop: 6 }}>
            <li>Products that have been used, worn, or altered after delivery.</li>
            <li>Items returned without original packaging.</li>
            <li>Products purchased during special clearance or final-sale promotions.</li>
          </ul>
        </section>

        <section>
          <h2 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>5. Refund Processing</h2>
          <p>Once your refund request is approved, the refund will be processed to your original payment method within <strong>5–10 business days</strong>. You will receive a confirmation once the refund has been initiated.</p>
        </section>

        <section>
          <h2 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>6. Exchanges</h2>
          <p>If you received a defective or wrong item, you may request an exchange instead of a refund. Contact our support team to arrange an exchange.</p>
        </section>

        <section>
          <h2 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>7. Contact</h2>
          <p>For any questions about this refund policy, reach out to us at <strong>cartiva.info@gmail.com</strong> or via <a href="https://wa.me/qr/Y4QSV6G5HXJMO1" target="_blank" rel="noopener noreferrer" style={{ color: '#f97316' }}>WhatsApp</a>.</p>
        </section>
      </div>
    </div>
  )
}
