import { useState } from 'react'
import { supabase, userTheme, initials } from '../lib/supabase'

const MASTER_PIN = '1515'

export default function SettingsPage({ currentUser, travelers, tripName, onTripNameChange, onReload, refreshUser }) {
  const [masterBuf, setMasterBuf] = useState('')
  const [masterUnlocked, setMasterUnlocked] = useState(false)
  const [masterError, setMasterError] = useState('')
  const [showMasterPin, setShowMasterPin] = useState(false)
  const [pendingAction, setPendingAction] = useState(null) // 'rename_trip' | 'rename_user' | 'reset_trip'
  const [newTripName, setNewTripName] = useState(tripName)
  const [editingUser, setEditingUser] = useState(null)
  const [newUserName, setNewUserName] = useState('')
  const [saving, setSaving] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [clearStep, setClearStep] = useState(1)
  const [clearing, setClearing] = useState(false)

  const theme = userTheme(currentUser?.name)

  function enterMaster(v) {
    if (v === 'del') { setMasterBuf(b => b.slice(0, -1)); setMasterError(''); return }
    if (masterBuf.length >= 4) return
    const next = masterBuf + v
    setMasterBuf(next)
    if (next.length === 4) {
      setTimeout(() => {
        if (next === MASTER_PIN) {
          setMasterUnlocked(true)
          setMasterError('')
          setMasterBuf('')
          setShowMasterPin(false)
        } else {
          setMasterError('Incorrect master PIN.')
          setMasterBuf('')
        }
      }, 150)
    }
  }

  function requireMaster(action) {
    if (masterUnlocked) {
      setPendingAction(action)
    } else {
      setPendingAction(action)
      setShowMasterPin(true)
    }
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
    if (currentUser.id === editingUser.id) {
      refreshUser({ ...currentUser, name: newUserName.trim() })
    }
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

  function Section({ title, children }) {
    return (
      <div style={{ marginBottom: 20 }}>
        <div className="section-label">{title}</div>
        <div className="card" style={{ padding: 0 }}>
          {children}
        </div>
      </div>
    )
  }

  function SettingRow({ icon, label, sub, color, onPress, danger }) {
    return (
      <button
        onClick={onPress}
        style={{
          width: '100%', padding: '13px 14px',
          background: 'none', border: 'none', borderBottom: '1px solid var(--warm-100)',
          display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
          textAlign: 'left',
        }}
      >
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, padding: '12px 14px', background: theme.bg, borderRadius: 14 }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 800, color: theme.text, flexShrink: 0 }}>
          {initials(currentUser?.name)}
        </div>
        <div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 800, color: theme.text }}>{currentUser?.name}</div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 11, color: theme.text, opacity: 0.7, marginTop: 2 }}>{tripName}</div>
        </div>
      </div>

      <Section title="My data">
        <SettingRow icon="ti-trash" label="Clear my data" sub="Remove all your flights, expenses and hotel entries" danger onPress={() => setShowClearConfirm(true)} />
      </Section>

      <Section title="Master settings">
        <SettingRow
          icon="ti-map-2"
          label="Rename trip"
          sub={tripName}
          color="var(--cardinal)"
          onPress={() => { requireMaster('rename_trip'); setNewTripName(tripName) }}
        />
        <SettingRow
          icon="ti-user-edit"
          label="Rename a traveler"
          sub="Change any user's display name"
          color="var(--cardinal)"
          onPress={() => requireMaster('rename_user')}
        />
        <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className={`ti ${masterUnlocked ? 'ti-lock-open' : 'ti-lock'}`} style={{ color: masterUnlocked ? 'var(--green)' : 'var(--warm-300)', fontSize: 16 }} />
          <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, color: masterUnlocked ? 'var(--green)' : 'var(--warm-300)', fontWeight: 700 }}>
            {masterUnlocked ? 'Master PIN verified this session' : 'Requires master PIN'}
          </span>
          {masterUnlocked && (
            <button onClick={() => setMasterUnlocked(false)} style={{ marginLeft: 'auto', fontFamily: 'Syne, sans-serif', fontSize: 11, color: 'var(--warm-400)', background: 'none', border: 'none', cursor: 'pointer' }}>Lock</button>
          )}
        </div>
      </Section>

      {/* Master PIN sheet */}
      {showMasterPin && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(61,46,30,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--cream)', borderRadius: 20, padding: '28px 24px', width: 300, textAlign: 'center' }}>
            <div style={{ width: 54, height: 54, borderRadius: '50%', background: 'var(--cardinal-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <i className="ti ti-shield-lock" style={{ fontSize: 26, color: 'var(--cardinal)' }} />
            </div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 17, fontWeight: 800, marginBottom: 6 }}>Master PIN</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, color: 'var(--warm-500)', marginBottom: 16 }}>Enter the master PIN to unlock admin settings</div>
            {masterError && <div style={{ color: 'var(--red-err)', fontSize: 13, marginBottom: 10, fontFamily: 'Syne, sans-serif' }}>{masterError}</div>}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginBottom: 20 }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{ width: 14, height: 14, borderRadius: '50%', background: i < masterBuf.length ? 'var(--cardinal)' : 'var(--warm-200)', border: '2px solid ' + (i < masterBuf.length ? 'var(--cardinal)' : 'var(--warm-200)'), transition: 'all 0.15s' }} />
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, maxWidth: 240, margin: '0 auto 12px' }}>
              {[1,2,3,4,5,6,7,8,9].map(n => (
                <button key={n} className="pin-key" onClick={() => enterMaster(String(n))}>{n}</button>
              ))}
              <button className="pin-key" style={{ fontSize: 11 }} onClick={() => { setMasterBuf(''); setMasterError('') }}>Clear</button>
              <button className="pin-key" onClick={() => enterMaster('0')}>0</button>
              <button className="pin-key" onClick={() => enterMaster('del')}><i className="ti ti-backspace" style={{ fontSize: 17 }} /></button>
            </div>
            <button onClick={() => { setShowMasterPin(false); setMasterBuf(''); setMasterError(''); setPendingAction(null) }} style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, color: 'var(--warm-500)', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Rename trip */}
      {pendingAction === 'rename_trip' && masterUnlocked && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(61,46,30,0.5)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }} onClick={e => e.target === e.currentTarget && setPendingAction(null)}>
          <div style={{ background: 'var(--cream)', borderRadius: '22px 22px 0 0', padding: '20px 18px calc(40px + env(safe-area-inset-bottom,16px))' }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 800, marginBottom: 14 }}>Rename trip</div>
            <div className="form-field">
              <label className="form-label">Trip name</label>
              <input className="form-input" value={newTripName} onChange={e => setNewTripName(e.target.value)} placeholder="EuroTrip 2026" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
              <button onClick={() => setPendingAction(null)} style={{ padding: '14px', background: 'var(--warm-100)', color: 'var(--warm-800)', border: 'none', borderRadius: 13, fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700 }}>Cancel</button>
              <button className="kp-submit" style={{ margin: 0 }} onClick={saveTripName}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Rename user */}
      {pendingAction === 'rename_user' && masterUnlocked && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(61,46,30,0.5)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }} onClick={e => e.target === e.currentTarget && setPendingAction(null)}>
          <div style={{ background: 'var(--cream)', borderRadius: '22px 22px 0 0', padding: '20px 18px calc(40px + env(safe-area-inset-bottom,16px))' }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 800, marginBottom: 6 }}>Rename traveler</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, color: 'var(--warm-500)', marginBottom: 14 }}>Select a traveler then enter their new name.</div>

            {!editingUser ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                {travelers.map(t => {
                  const th = userTheme(t.name)
                  return (
                    <button key={t.id} onClick={() => { setEditingUser(t); setNewUserName(t.name) }} style={{ padding: '12px', background: th.bg, border: 'none', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 800, color: th.text }}>{initials(t.name)}</div>
                      <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 700, color: th.text }}>{t.name.split(' ')[0]}</div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 11, color: 'var(--warm-500)', marginBottom: 6 }}>Renaming: <strong>{editingUser.name}</strong></div>
                  <div className="form-field">
                    <label className="form-label">New full name</label>
                    <input className="form-input" value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="First Last" />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button onClick={() => setEditingUser(null)} style={{ padding: '14px', background: 'var(--warm-100)', color: 'var(--warm-800)', border: 'none', borderRadius: 13, fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700 }}>Back</button>
                  <button className="kp-submit" style={{ margin: 0 }} onClick={saveUserName} disabled={saving}>{saving ? 'Saving...' : 'Save name'}</button>
                </div>
              </>
            )}

            <button onClick={() => { setPendingAction(null); setEditingUser(null) }} style={{ width: '100%', marginTop: 10, padding: '12px', background: 'none', border: 'none', fontFamily: 'Syne, sans-serif', fontSize: 13, color: 'var(--warm-500)', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Clear my data confirmation */}
      {showClearConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(61,46,30,0.5)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div style={{ background: 'var(--cream)', borderRadius: '22px 22px 0 0', padding: '24px 18px calc(40px + env(safe-area-inset-bottom,16px))' }}>
            {clearStep === 1 && (
              <>
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>⚠️</div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 17, fontWeight: 800, color: 'var(--red-err)', marginBottom: 8 }}>Clear all my data?</div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, color: 'var(--warm-600)', lineHeight: 1.5 }}>
                    Your flights, hotels, group expenses, and personal expenses will be placed on <strong>death row with no appellate review</strong>. No stay of execution. No cert petition. No Hail Mary. They will be gone. Forever.
                  </div>
                  <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--warm-400)', marginTop: 10 }}>
                    (Even Cochran can't save them now.)
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button onClick={() => setShowClearConfirm(false)} style={{ padding: '14px', background: 'var(--warm-100)', color: 'var(--warm-800)', border: 'none', borderRadius: 13, fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700 }}>
                    Spare them
                  </button>
                  <button onClick={() => setClearStep(2)} style={{ padding: '14px', background: 'var(--red-err)', color: '#fff', border: 'none', borderRadius: 13, fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700 }}>
                    Execute
                  </button>
                </div>
              </>
            )}
            {clearStep === 2 && (
              <>
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>🪦</div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 17, fontWeight: 800, color: 'var(--red-err)', marginBottom: 8 }}>Last chance, counselor.</div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, color: 'var(--warm-600)', lineHeight: 1.5 }}>
                    The court has reviewed your motion. The verdict is final. All data entered by <strong>{currentUser?.name?.split(' ')[0]}</strong> will be permanently deleted. This action is not appealable, reversible, or forgivable.
                  </div>
                  <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--red-err)', marginTop: 10, fontWeight: 600 }}>
                    Objection overruled. Proceed?
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button onClick={() => { setShowClearConfirm(false); setClearStep(1) }} style={{ padding: '14px', background: 'var(--warm-100)', color: 'var(--warm-800)', border: 'none', borderRadius: 13, fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700 }}>
                    Grant clemency
                  </button>
                  <button
                    onClick={clearMyData}
                    disabled={clearing}
                    style={{ padding: '14px', background: 'var(--red-err)', color: '#fff', border: 'none', borderRadius: 13, fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700 }}
                  >
                    {clearing ? 'Deleting...' : 'DELETE ALL'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
