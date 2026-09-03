import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

export default function AccountSecurity() {
  const { user, signOut } = useAuth()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function handleChangePassword() {
    if (!newPassword || newPassword.length < 6) { setErr('Password must be at least 6 characters.'); return }
    if (newPassword !== confirmPassword) { setErr('Passwords do not match.'); return }
    setSaving(true); setMsg(null); setErr(null)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setMsg('Password updated successfully.')
      setNewPassword(''); setConfirmPassword('')
    } catch (e) { setErr((e as Error).message) }
    finally { setSaving(false) }
  }

  async function handleDeleteAccount() {
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) return
    if (!confirm('This will permanently delete all your data. Type "DELETE" in your mind and click OK.')) return
    try {
      const { error } = await supabase.rpc('delete_own_account')
      if (error) throw error
      await signOut()
    } catch (e) { alert((e as Error).message) }
  }

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Security</h2>

      <div className="card" style={{ padding: 18, marginBottom: 16, maxWidth: 480 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Change password</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>New password</label>
            <input type="password" className="field" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', fontSize: 13 }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Confirm password</label>
            <input type="password" className="field" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', fontSize: 13 }} />
          </div>
          {msg && <div style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>{msg}</div>}
          {err && <div style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 600 }}>{err}</div>}
          <button className="btn primary" style={{ width: 'fit-content' }} onClick={handleChangePassword} disabled={saving}>{saving ? 'Updating...' : 'Update password'}</button>
        </div>
      </div>

      <div className="card" style={{ padding: 18, maxWidth: 480 }}>
        <div className="settings-row" style={{ borderBottom: 'none' }}>
          <div>
            <div className="lbl">Sign out</div>
            <div className="sub">Sign out from your account on this device.</div>
          </div>
          <button className="btn sm" onClick={signOut}>Sign out</button>
        </div>
        <div className="settings-row" style={{ borderBottom: 'none' }}>
          <div>
            <div className="lbl" style={{ color: 'var(--danger)' }}>Delete account</div>
            <div className="sub">Permanently delete your account and all associated data.</div>
          </div>
          <button className="btn sm danger" onClick={handleDeleteAccount}>Delete</button>
        </div>
      </div>
    </div>
  )
}
