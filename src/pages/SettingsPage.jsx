import { useState } from 'react'
import { supabase, userTheme, initials } from '../lib/supabase'

const MASTER_PIN = '1515'

const Modal = ({ children, onClose }) => (
  <div
    onClick={e => e.target === e.currentTarget && onClose && onClose()}
    style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(61,46,30,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px',
    }}
  >
    <div style={{
      background: 'var(--cream)', borderRadius: 20,
      padding: '24px 20px', width: '100%', maxWidth: 360,
      maxHeight: '80vh', overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
    }}>
      {children}
    </div>
  </div>
)

const ModalTitle = ({ children }) => (
  <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 17, fontWeight: 800, marginBottom: 8, color: 'var(--warm-800)' }}>{children}</div>
)

const ModalSub = ({ children }) => (
  <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, color: 'var(--warm-500)', marginBottom: 16, lineHeight: 1.5 }}>{children}</div>
)

const BtnRow = ({ children }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 16 }}>{children}</div>
)

const Btn = ({ label, onPress, disabled, variant }) => {
  const styles = {
    default: { background: 'var(--warm-100)', color: 'var(--warm-800)' },
    primary: { background: 'var(--cardinal)', color: '#fff' },
    danger:  { background: 'var(--red-err)',  color: '#fff' },
    safe:    { background: '#E3F5EC',          color: 'var(--green)' },
  }
  const s = styles[variant ?? 'default']
  return (
    <button
      onClick={onPress}
      disabled={disabled}
      style={{
        padding: '14px', border: 'none', borderRadius: 13,
        fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700,
        cursor: 'pointer', opacity: disabled ? 0.5 : 1,
        ...s,
      }}
    >
      {label}
    </button>
  )
}

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
        <Modal onClose={cancelMaster}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 54, height: 54, borderRadius: '50%', background: 'var(--cardinal-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <i className="ti ti-shield-lock" style={{ fontSize: 26, color: 'var(--cardinal)' }} />
            </div>
            <ModalTitle>Master PIN</ModalTitle>
            <ModalSub>{pendingAction === 'rename_trip' ? 'Required to rename the trip' : 'Required to rename a traveler'}</ModalSub>
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
        </Modal>
      )}
