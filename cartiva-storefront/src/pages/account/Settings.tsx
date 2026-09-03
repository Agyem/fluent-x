import { useState } from 'react'

interface Setting { key: string; label: string; desc: string; defaultOn: boolean }

const SETTINGS: Setting[] = [
  { key: 'email_orders', label: 'Order updates', desc: 'Receive email notifications for order status changes.', defaultOn: true },
  { key: 'email_promotions', label: 'Promotions', desc: 'Receive emails about sales, discounts, and new products.', defaultOn: false },
  { key: 'email_newsletter', label: 'Newsletter', desc: 'Weekly digest of trending products and tech news.', defaultOn: false },
  { key: 'sms_updates', label: 'SMS updates', desc: 'Get text messages for delivery notifications.', defaultOn: true },
  { key: 'push_enabled', label: 'Push notifications', desc: 'Browser push notifications for real-time updates.', defaultOn: false },
]

export default function AccountSettings() {
  const [settings, setSettings] = useState<Record<string, boolean>>(
    Object.fromEntries(SETTINGS.map(s => [s.key, s.defaultOn]))
  )
  const [saved, setSaved] = useState(false)

  function toggle(key: string) {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }))
    setSaved(false)
  }

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Settings</h2>

      <div className="card" style={{ padding: 18, maxWidth: 520, marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Notifications</h3>
        {SETTINGS.map(s => (
          <div key={s.key} className="settings-row">
            <div>
              <div className="lbl">{s.label}</div>
              <div className="sub">{s.desc}</div>
            </div>
            <div className={`toggle${settings[s.key] ? ' on' : ''}`} onClick={() => toggle(s.key)}>
              <div className="knob" />
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 18, maxWidth: 520 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Privacy</h3>
        <div className="settings-row" style={{ borderBottom: 'none' }}>
          <div>
            <div className="lbl">Profile visibility</div>
            <div className="sub">Control who can see your profile information.</div>
          </div>
          <div className="toggle on" style={{ cursor: 'default' }}>
            <div className="knob" />
          </div>
        </div>
      </div>

      <button className="btn primary" style={{ marginTop: 16, width: 'fit-content' }} onClick={handleSave}>
        {saved ? 'Saved!' : 'Save settings'}
      </button>
    </div>
  )
}
