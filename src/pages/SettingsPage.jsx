import { useState } from 'react'
import { supabase, userTheme, initials } from '../lib/supabase'

const MASTER_PIN = '1515'

export default function SettingsPage({ currentUser, travelers, tripName, onTripNameChange, onReload, refreshUser }) {
  const [showMasterPin, setShowMasterPin] = useState(false)
  const [masterBuf, setMasterBuf] = useState('')
  const [masterError, setMasterError] = useState('')
  const [pendingAction, setPendingAction] = useState(null)
  const [newTripName, setNewTripName] = useState(tripName)
  const [editingUser, setEditingUser] = useState(null)
  const [newUserName, setNewUserName] = useState('')
  const [saving, setSaving] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [clearStep, setClearStep] = useState(1)
  const [clearing, setClearing] = useState(false)
  const theme = userTheme(currentUser?.name)

  function openMasterPin(action) {
    setPendingAction(action)
    setMasterBuf('')
    setMasterError('')
    setShowMasterPin(true)
  }

  function enterMaster(v) {
    if (v === 'del') { setMasterBuf(b => b.slice(0, -1)); setMasterError(''); return }
    if (masterBuf.length >= 4) return
    const next = masterBuf + v
    setMasterBuf(next)
    if (next.length === 4) {
      setTimeout(() => {
        if (next === MASTER_PIN) {
          setMasterBuf('')
          setMasterError('')
          setShowMasterPin(false)
          if (pendingAction === 'rename_trip') setNewTripName(tripName)
        } else {
          setMasterError('Incorrect master PIN. Try again.')
          setMasterBuf('')
        }
      }, 150)
    }
  }

  function cancelMaster() {
    setShowMasterPin(false)
    setMasterBuf('')
    setMasterError('')
    setPendingAction(null)
  }

  async function saveTripName() {
    if (!newTripName.trim()) return
    onTripNameChange(newTripName.trim())
    setPendingAction(null)
  }

  async function saveUserName() {
    if (!newUserName.trim() || !editingUser) return
    setSaving(true)
    await supabase.from('travelers').update({ name: newUserName.trim() }).eq('id', editingUser.id)
    if (currentUser.id === editingUser.id) refreshUser({ ...currentUser, name: newUserName.trim() })
    await onReload()
    setSaving(false)
    setPendingAction(null)
    setEditingUser(null)
  }

  async function clearMyData() {
    setClearing(true)
    await Promise.all([
      supabase.from('flights').delete().eq('traveler_id', currentUser.id),
      supabase.from('personal_expenses').delete().eq('traveler_id', currentUser.id),
      supabase.from('group_expenses').delete().eq('paid_by', currentUser.id),
      supabase.from('hotel_guests').delete().eq('traveler_id', currentUser.id),
      supabase.from('hotels').delete().eq('booked_by', currentUser.id),
    ])
    setClearing(false)
    setShowClearConfirm(false)
    setClearStep(1)
  }

  function SettingRow({ icon, label, sub, color, onPress, danger, last }) {
    return (
      <button onClick={onPress} style={{ width: '100%', padding: '13px 14px', background: 'none', border: 'none', borderBottom: last ? 'none' : '1px solid var(--warm-100)', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left' }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: danger ? 'var(--red-light)' : 'var(--warm-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <i className={`ti ${icon}`} style={{ fontSize: 18, color: danger ? 'var(--red-err)' : (color ?? 'var(--warm-500)') }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700, color: danger ? 'var(--red-err)' : 'var(--warm-800)' }}>{label}</div>
          {sub && <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 11, color: 'var(--warm-500)', marginTop: 2 }}>{sub}</div>}
        </div>
        <i className="ti ti-chevron-right" style={{ fontSize: 14, color: 'var(--warm-300)' }} />
      </button>
    )
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, padding: '14px', background: theme.bg, borderRadius: 14 }}>
        <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 800, color: theme.text, flexShrink: 0 }}>
          {initials(currentUser?.name)}
        </div>
        <div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 800, color: theme.text }}>{currentUser?.name}</div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 11, color: theme.text, opacity: 0.7, marginTop: 2 }}>{tripName}</div>
        </div>
      </div>

      <div className="section-label">My data</div>
      <div className="card" style={{ padding: 0, marginBottom: 20 }}>
        <SettingRow icon="ti-trash" label="Clear my data" sub="Remove all your flights, expenses and hotel entries" danger last onPress={() => { setShowClearConfirm(true); setClearStep(1) }} />
      </div>

      <div className="section-label">Trip management</div>
      <div style={{ background: 'var(--warm-100)', borderRadius: 10, padding: '8px 12px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        <i className="ti ti-shield-lock" style={{ color: 'var(--cardinal)', fontSize: 16 }} />
        <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, color: 'var(--warm-600)', fontWeight: 600 }}>Master PIN required — use when starting a new trip.</span>
      </div>
      <div className="card" style={{ padding: 0, marginBottom: 20 }}>
        <SettingRow icon="ti-map-2" label="Rename trip" sub={tripName} color="var(--cardinal)" onPress={() => openMasterPin('rename_trip')} />
        <SettingRow icon="ti-user-edit" label="Rename a traveler" sub="Update any user's display name" color="var(--cardinal)" last onPress={() => openMasterPin('rename_user')} />
      </div>

      {showMasterPin && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(61,46,30,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => e.target === e.currentTarget && cancelMaster()}>
          <div style={{ background: 'var(--cream)', borderRadius: 20, padding: '28px 24px', width: 300, textAlign: 'center' }}>
            <div style={{ width: 54, height: 54, borderRadius: '50%', background: 'var(--cardinal-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <i className="ti ti-shield-lock" style={{ fontSize: 26, color: 'var(--cardinal)' }} />
            </div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 17, fontWeight: 800, marginBottom: 4 }}>Master PIN</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, color: 'var(--warm-500)', marginBottom: 16 }}>
              {pendingAction === 'rename_trip' ? 'Required to rename the trip' : 'Required to rename a traveler'}
            </div>
            {masterError && <div style={{ color: 'var(--red-err)', fontSize: 13, marginBottom: 10, fontFamily: 'Syne, sans-serif', fontWeight: 600 }}>{masterError}</div>}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginBottom: 20 }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{ width: 14, height: 14, borderRadius: '50%', background: i < masterBuf.length ? 'var(--cardinal)' : 'var(--warm-200)', border: '2px solid ' + (i < masterBuf.length ? 'var(--cardinal)' : 'var(--warm-200)'), transition: 'all 0.15s' }} />
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, maxWidth: 240, margin: '0 auto 16px' }}>
              {[1,2,3,4,5,6,7,8,9].map(n => (
                <button key={n} className="pin-key" onClick={() => enterMaster(String(n))}>{n}</button>
              ))}
              <button className="pin-key" style={{ fontSize: 11, fontFamily: 'Syne, sans-serif' }} onClick={() => { setMasterBuf(''); setMasterError('') }}>Clear</button>
              <button className="pin-key" onClick={() => enterMaster('0')}>0</button>
              <button className="pin-key" onClick={() => enterMaster('del')}><i className="ti ti-backspace" style={{ fontSize: 17 }} /></button>
            </div>
            <button onClick={cancelMaster} style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, color: 'var(--warm-500)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
          </div>
        </div>
      )}
{pendingAction === 'rename_trip' && !showMasterPin && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(61,46,30,0.5)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }} onClick={e => e.target === e.currentTarget && setPendingAction(null)}>
          <div style={{ background: 'var(--cream)', borderRadius: '22px 22px 0 0', padding: '20px 18px', paddingBottom: 'calc(40px + env(safe-area-inset-bottom,16px))' }}>
            <div style={{ width: 38, height: 4, background: 'var(--warm-200)', borderRadius: 2, margin: '0 auto 16px' }} />
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 800, marginBottom: 6 }}>Rename trip</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, color: 'var(--warm-500)', marginBottom: 14 }}>This updates the trip name shown on all devices instantly.</div>
            <div className="form-field">
              <label className="form-label">Trip name</label>
              <input className="form-input" value={newTripName} onChange={e => setNewTripName(e.target.value)} placeholder="EuroTrip 2026" autoFocus />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
              <button onClick={() => setPendingAction(null)} style={{ padding: '14px', background: 'var(--warm-100)', color: 'var(--warm-800)', border: 'none', borderRadius: 13, fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700 }}>Cancel</button>
              <button className="kp-submit" style={{ margin: 0 }} onClick={saveTripName}>Save</button>
            </div>
          </div>
        </div>
      )}

      {pendingAction === 'rename_user' && !showMasterPin && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(61,46,30,0.5)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div style={{ background: 'var(--cream)', borderRadius: '22px 22px 0 0', padding: '20px 18px', paddingBottom: 'calc(40px + env(safe-area-inset-bottom,16px))' }}>
            <div style={{ width: 38, height: 4, background: 'var(--warm-200)', borderRadius: 2, margin: '0 auto 16px' }} />
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 800, marginBottom: 6 }}>Rename traveler</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, color: 'var(--warm-500)', marginBottom: 14 }}>
              {!editingUser ? 'Select the traveler to rename.' : 'Enter the new full name.'}
            </div>
            {!editingUser ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                  {travelers.map(t => {
                    const th = userTheme(t.name)
                    return (
                      <button key={t.id} onClick={() => { setEditingUser(t); setNewUserName(t.name) }} style={{ padding: '12px 10px', background: th.bg, border: 'none', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 800, color: th.text, flexShrink: 0 }}>{initials(t.name)}</div>
                        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 700, color: th.text }}>{t.name.split(' ')[0]}</div>
                      </button>
                    )
                  })}
                </div>
                <button onClick={() => setPendingAction(null)} style={{ width: '100%', padding: '12px', background: 'none', border: 'none', fontFamily: 'Syne, sans-serif', fontSize: 13, color: 'var(--warm-500)', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, padding: '10px 12px', background: userTheme(editingUser.name).bg, borderRadius: 10 }}>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 20, fontWeight: 800, color: userTheme(editingUser.name).text }}>{initials(editingUser.name)}</div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 700, color: userTheme(editingUser.name).text }}>Renaming: {editingUser.name}</div>
                </div>
                <div className="form-field">
                  <label className="form-label">New full name</label>
                  <input className="form-input" value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="First Last" autoFocus />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                  <button onClick={() => setEditingUser(null)} style={{ padding: '14px', background: 'var(--warm-100)', color: 'var(--warm-800)', border: 'none', borderRadius: 13, fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700 }}>Back</button>
                  <button className="kp-submit" style={{ margin: 0 }} onClick={saveUserName} disabled={saving}>{saving ? 'Saving...' : 'Save name'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showClearConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(61,46,30,0.5)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div style={{ background: 'var(--cream)', borderRadius: '22px 22px 0 0', padding: '24px 18px', paddingBottom: 'calc(40px + env(safe-area-inset-bottom,16px))' }}>
            {clearStep === 1 && (
              <>
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <div style={{ fontSize: 44, marginBottom: 10 }}>⚠️</div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 17, fontWeight: 800, color: 'var(--red-err)', marginBottom: 10 }}>Clear all my data?</div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, color: 'var(--warm-800)', lineHeight: 1.6 }}>
                    Your flights, hotels, expenses and all entries will be placed on <strong>death row with no appellate review</strong>. No stay of execution. No cert petition. No Hail Mary. They will be gone. Forever.
                  </div>
                  <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--warm-400)', marginTop: 10 }}>Even Cochran can't save them now.</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button onClick={() => setShowClearConfirm(false)} style={{ padding: '14px', background: 'var(--warm-100)', color: 'var(--warm-800)', border: 'none', borderRadius: 13, fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700 }}>Spare them</button>
                  <button onClick={() => setClearStep(2)} style={{ padding: '14px', background: 'var(--red-err)', color: '#fff', border: 'none', borderRadius: 13, fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700 }}>Execute</button>
                </div>
              </>
            )}
            {clearStep === 2 && (
              <>
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <div style={{ fontSize: 44, marginBottom: 10 }}>🪦</div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 17, fontWeight: 800, color: 'var(--red-err)', marginBottom: 10 }}>Last chance, counselor.</div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, color: 'var(--warm-800)', lineHeight: 1.6 }}>
                    The court has reviewed your motion. The verdict is final. All data entered by <strong>{currentUser?.name?.split(' ')[0]}</strong> will be permanently deleted. Not reversible. Not appealable. Not forgivable.
                  </div>
                  <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--red-err)', marginTop: 10, fontWeight: 600 }}>Objection overruled. Proceed?</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button onClick={() => { setShowClearConfirm(false); setClearStep(1) }} style={{ padding: '14px', background: '#E3F5EC', color: 'var(--green)', border: 'none', borderRadius: 13, fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700 }}>Grant clemency</button>
                  <button onClick={clearMyData} disabled={clearing} style={{ padding: '14px', background: 'var(--red-err)', color: '#fff', border: 'none', borderRadius: 13, fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700 }}>{clearing ? 'Deleting...' : 'DELETE ALL'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
