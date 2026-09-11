import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Loading } from '../../components/Loading'
import ErrorState from '../../components/ErrorState'

interface Address { id: string; label: string; full_name: string; phone: string; address_line1: string; address_line2?: string; city: string; region: string; is_default: boolean }

export default function AccountAddresses() {
  const { user } = useAuth()
  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ label: 'Home', full_name: '', phone: '', address_line1: '', address_line2: '', city: '', region: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function load() {
      try {
        const { data, error } = await supabase.from('customer_addresses').select('*').eq('customer_id', user!.id).order('is_default', { ascending: false })
        if (error) throw error
        if (!cancelled) setAddresses((data || []) as Address[])
      } catch (e) { if (!cancelled) setErr((e as Error).message) }
      finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [user])

  async function handleSave() {
    if (!user || !form.address_line1 || !form.city) return
    setSaving(true)
    try {
      const { error } = await supabase.from('customer_addresses').insert({
        customer_id: user.id, label: form.label, full_name: form.full_name, phone: form.phone,
        address_line1: form.address_line1, address_line2: form.address_line2 || null,
        city: form.city, region: form.region, is_default: addresses.length === 0,
      })
      if (error) throw error
      setShowModal(false)
      setForm({ label: 'Home', full_name: '', phone: '', address_line1: '', address_line2: '', city: '', region: '' })
      const { data } = await supabase.from('customer_addresses').select('*').eq('customer_id', user.id).order('is_default', { ascending: false })
      setAddresses((data || []) as Address[])
    } catch (e) { alert((e as Error).message) }
    finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this address?')) return
    const { error } = await supabase.from('customer_addresses').delete().eq('id', id)
    if (!error) setAddresses(prev => prev.filter(a => a.id !== id))
  }

  async function handleDefault(id: string) {
    if (!user) return
    await supabase.from('customer_addresses').update({ is_default: false }).eq('customer_id', user.id)
    await supabase.from('customer_addresses').update({ is_default: true }).eq('id', id)
    setAddresses(prev => prev.map(a => ({ ...a, is_default: a.id === id })))
  }

  if (loading) return <Loading label="Loading addresses..." />
  if (err) return <ErrorState message={err} />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Addresses</h2>
        <button className="btn primary sm" onClick={() => setShowModal(true)}>+ Add address</button>
      </div>

      {addresses.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div>
          <h3>No addresses yet</h3>
          <p>Add a delivery address for faster checkout.</p>
          <button className="btn primary" onClick={() => setShowModal(true)}>Add address</button>
        </div>
      ) : (
        <div className="offers-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          {addresses.map(a => (
            <div key={a.id} className="card addr-card">
              <div className="addr-top">
                <div className="addr-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{a.label || 'Address'}</div>
                  {a.is_default && <span className="pill" style={{ background: 'var(--success-light)', color: 'var(--success)', marginTop: 4 }}>Default</span>}
                </div>
              </div>
              <div className="addr-details">
                {a.full_name && <div style={{ fontWeight: 600 }}>{a.full_name}</div>}
                <div>{a.address_line1}{a.address_line2 ? `, ${a.address_line2}` : ''}</div>
                <div>{a.city}, {a.region}</div>
                {a.phone && <div style={{ marginTop: 4 }}>{a.phone}</div>}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {!a.is_default && <button className="btn sm ghost" onClick={() => handleDefault(a.id)}>Set default</button>}
                <button className="btn sm ghost" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(a.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head"><h3>Add address</h3><button className="btn sm ghost" onClick={() => setShowModal(false)}>✕</button></div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Label</label>
                  <select className="field" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', fontSize: 13 }}>
                    <option>Home</option><option>Work</option><option>Other</option>
                  </select>
                </div>
                <div><label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Full name</label><input className="field" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', fontSize: 13 }} /></div>
                <div><label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Phone</label><input className="field" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', fontSize: 13 }} /></div>
                <div><label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Address line 1</label><input className="field" value={form.address_line1} onChange={e => setForm(f => ({ ...f, address_line1: e.target.value }))} style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', fontSize: 13 }} /></div>
                <div><label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Address line 2 (optional)</label><input className="field" value={form.address_line2} onChange={e => setForm(f => ({ ...f, address_line2: e.target.value }))} style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', fontSize: 13 }} /></div>
                <div className="address-form-row">
                  <div><label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>City</label><input className="field" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', fontSize: 13 }} /></div>
                  <div><label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Region</label><input className="field" value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))} style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', fontSize: 13 }} /></div>
                </div>
              </div>
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save address'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
