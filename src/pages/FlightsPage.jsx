import { useState, useEffect } from 'react'
import { supabase, TRAVELER_COLORS, initials, hashPin, verifyPin, MASTER_PIN } from '../lib/supabase'

const STATUS = {
  confirmed: { bg: '#E8F5EA', text: '#1B7A4A', label: 'Confirmed' },
  pending:   { bg: '#FFF8D6', text: '#B8920A', label: 'Pending' },
}

// Inline PIN pad used to unlock Notes in the flight panel
function PinPrompt({ onVerify, onCancel, travelerId, travelers }) {
  const [buf, setBuf] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)

  async function handleKey(v) {
    if (v === 'del') { setBuf(b => b.slice(0, -1)); setError(''); return }
    if (buf.length >= 4) return
    const next = buf + v
    setBuf(next)
    if (next.length === 4) {
      setTimeout(() => attempt(next), 150)
    }
  }

  async function attempt(pin) {
    setChecking(true)
    // Master PIN unlocks silently
    if (pin === MASTER_PIN) {
      onVerify(true)
      return
    }
    // Look up this traveler's pin_hash
    const { data } = await supabase.from('travelers').select('pin_hash').eq('id', travelerId).single()
    const ok = await verifyPin(pin, data?.pin_hash ?? '')
    if (ok) {
      onVerify(false)
    } else {
      setError('Incorrect PIN. Try again.')
      setBuf('')
    }
    setChecking(false)
  }

  // Find traveler first name for display
  const traveler = travelers?.find(t => t.id === travelerId)
  const firstName = traveler?.name?.split(' ')[0] ?? 'this traveler'

  return (
    <div style={{
      background: 'var(--warm-50, #FDFAF6)',
      border: '1px solid var(--warm-200)',
      borderRadius: 14,
      padding: '16px',
      marginTop: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <i className="ti ti-lock" style={{ fontSize: 16, color: 'var(--cardinal)' }} />
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 700 }}>
          Enter {firstName}'s PIN to view notes
        </div>
      </div>
      {error && (
        <div style={{ color: 'var(--red-err)', fontSize: 12, fontFamily: 'Syne, sans-serif', marginBottom: 8 }}>
          {error}
        </div>
      )}
      {/* PIN dots */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 12 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{
            width: 12, height: 12, borderRadius: '50%',
            background: i < buf.length ? 'var(--cardinal)' : 'var(--warm-200)',
            transition: 'background 0.15s',
          }} />
        ))}
      </div>
      {/* Numpad */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10 }}>
        {[1,2,3,4,5,6,7,8,9].map(n => (
          <button key={n}
            onClick={() => handleKey(String(n))}
            disabled={checking}
            style={{
              padding: '11px 0', fontSize: 18, fontFamily: 'Syne, sans-serif', fontWeight: 700,
              background: 'var(--warm-100)', border: 'none', borderRadius: 10, cursor: 'pointer',
            }}
          >{n}</button>
        ))}
        <button onClick={() => setBuf('')} disabled={checking}
          style={{ padding: '11px 0', fontSize: 11, fontFamily: 'Syne, sans-serif', fontWeight: 700, background: 'var(--warm-100)', border: 'none', borderRadius: 10, cursor: 'pointer' }}>
          Clear
        </button>
        <button onClick={() => handleKey('0')} disabled={checking}
          style={{ padding: '11px 0', fontSize: 18, fontFamily: 'Syne, sans-serif', fontWeight: 700, background: 'var(--warm-100)', border: 'none', borderRadius: 10, cursor: 'pointer' }}>
          0
        </button>
        <button onClick={() => handleKey('del')} disabled={checking}
          style={{ padding: '11px 0', background: 'var(--warm-100)', border: 'none', borderRadius: 10, cursor: 'pointer' }}>
          <i className="ti ti-backspace" style={{ fontSize: 18 }} />
        </button>
      </div>
      <button onClick={onCancel}
        style={{ width: '100%', padding: '10px', background: 'none', border: 'none', fontFamily: 'Syne, sans-serif', fontSize: 13, color: 'var(--warm-500)', cursor: 'pointer' }}>
        Cancel
      </button>
    </div>
  )
}

export default function FlightsPage({ currentUser, travelers, isPinUnlocked, onPinUnlocked, lockUser }) {
  const [flights, setFlights] = useState([])
  const [panelFlights, setPanelFlights] = useState([])
  const [loading, setLoading] = useState(true)
  const [panelLoading, setPanelLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [selectedTraveler, setSelectedTraveler] = useState(null)
  const [editFlight, setEditFlight] = useState(null)
  const [saving, setSaving] = useState(false)

  // Per-flight notes reveal state (which flight IDs are showing the PIN prompt)
  const [showingPinFor, setShowingPinFor] = useState(null) // flight id

  const empty = {
    origin: '', destination: '', flight_number: '', airline: '',
    departure_date: '', departure_time: '', arrival_date: '', arrival_time: '',
    status: 'confirmed', notes: ''
  }
  const [form, setForm] = useState(empty)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('flights').select('*').order('departure_date')
    setFlights(data ?? [])
    setLoading(false)
  }

  async function loadPanelFlights(travelerId) {
    setPanelLoading(true)
    setPanelFlights([])
    const { data, error } = await supabase
      .from('flights')
      .select('*')
      .eq('traveler_id', travelerId)
      .order('departure_date', { ascending: true })
    console.log('panel flights', travelerId, data, error)
    setPanelFlights(data ?? [])
    setPanelLoading(false)
  }

  async function openPanel(traveler) {
    setSelectedTraveler(traveler)
    setShowingPinFor(null)
    await loadPanelFlights(traveler.id)
  }

  function closePanel() {
    setSelectedTraveler(null)
    setPanelFlights([])
    setShowingPinFor(null)
  }

  function travelerSummary(tid) {
    const tfl = flights.filter(f => f.traveler_id === tid)
    return { count: tfl.length, latest: tfl[0] }
  }

  function set(field) { return e => setForm(p => ({ ...p, [field]: e.target.value })) }

  function openAdd() { setEditFlight(null); setForm(empty); setShowForm(true) }

  function openEdit(fl) {
    setEditFlight(fl)
    setForm({
      origin: fl.origin ?? '',
      destination: fl.destination ?? '',
      flight_number: fl.flight_number ?? '',
      airline: fl.airline ?? '',
      departure_date: fl.departure_date ?? '',
      departure_time: fl.departure_time ?? '',
      arrival_date: fl.arrival_date ?? '',
      arrival_time: fl.arrival_time ?? '',
      status: fl.status ?? 'confirmed',
      notes: fl.notes ?? ''
    })
    closePanel()
    setShowForm(true)
  }

  async function save() {
    if (!form.origin || !form.destination || !form.departure_date) return
    setSaving(true)
    if (editFlight) {
      await supabase.from('flights').update({ ...form }).eq('id', editFlight.id)
    } else {
      await supabase.from('flights').insert({ ...form, traveler_id: currentUser.id })
    }
    await load()
    setSaving(false)
    setShowForm(false)
    if (selectedTraveler) await loadPanelFlights(selectedTraveler.id)
  }

  async function deleteFlight(id) {
    if (!confirm('Delete this flight?')) return
    await supabase.from('flights').delete().eq('id', id)
    await load()
    if (selectedTraveler) await loadPanelFlights(selectedTraveler.id)
  }

  function formatDate(dateStr) {
    if (!dateStr) return null
    try {
      const d = new Date(dateStr + 'T00:00:00')
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } catch { return dateStr }
  }

  function InfoRow({ label, value }) {
    if (!value) return null
    return (
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 10, fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'var(--warm-300)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
        <div className="mono" style={{ fontSize: 13 }}>{value}</div>
      </div>
    )
  }

  // Notes section — locked behind PIN for all viewers
  function NotesSection({ fl }) {
    const travelerId = fl.traveler_id
    const unlocked = isPinUnlocked ? isPinUnlocked(travelerId) : false
    const hasPinPromptOpen = showingPinFor === fl.id

    if (!fl.notes) return null

    if (unlocked) {
      return (
        <div style={{ borderTop: '1px solid var(--warm-100)', paddingTop: 8, marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <i className="ti ti-lock-open" style={{ fontSize: 11, color: 'var(--warm-300)' }} />
            <div style={{ fontSize: 10, fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'var(--warm-300)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Notes</div>
          </div>
          <div className="mono" style={{ fontSize: 12, color: 'var(--warm-700)' }}>{fl.notes}</div>
        </div>
      )
    }

    if (hasPinPromptOpen) {
      return (
        <PinPrompt
          travelerId={travelerId}
          travelers={travelers}
          onVerify={(usedMaster) => {
            if (onPinUnlocked) onPinUnlocked(travelerId, usedMaster)
            setShowingPinFor(null)
          }}
          onCancel={() => setShowingPinFor(null)}
        />
      )
    }

    return (
      <div style={{ borderTop: '1px solid var(--warm-100)', paddingTop: 8, marginTop: 8 }}>
        <button
          onClick={() => setShowingPinFor(fl.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--warm-100)', border: 'none', borderRadius: 10,
            padding: '8px 12px', width: '100%', cursor: 'pointer',
          }}
        >
          <i className="ti ti-lock" style={{ fontSize: 14, color: 'var(--cardinal)' }} />
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 700, color: 'var(--warm-600)' }}>
            Notes · Tap to unlock
          </div>
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="section-label">Everyone's flights</div>
      {loading ? <div className="loading">Loading...</div> : (
        <div className="card">
          {travelers.map(t => {
            const { count, latest } = travelerSummary(t.id)
            const c = TRAVELER_COLORS[t.name] ?? { bg: '#FFE8E8', text: '#990000' }
            const sc = latest ? (STATUS[latest.status] ?? STATUS.pending) : null
            return (
              <div key={t.id} className="row" style={{ cursor: 'pointer' }} onClick={() => openPanel(t)}>
                <div className="row-left">
                  <div className="avatar" style={{ background: c.bg, color: c.text }}>{initials(t.name)}</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="fs13 fw6 syne truncate">{t.name}</div>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--warm-500)', marginTop: 2 }}>
                      {count > 0 ? count + ' flight' + (count > 1 ? 's' : '') : 'No flights entered'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {sc
                    ? <span className="badge" style={{ background: sc.bg, color: sc.text }}>{sc.label}</span>
                    : <span className="badge" style={{ background: 'var(--warm-100)', color: 'var(--warm-300)' }}>Missing</span>
                  }
                  <i className="ti ti-chevron-right" style={{ fontSize: 14, color: 'var(--warm-300)' }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      <button className="add-btn" onClick={openAdd}>
        <i className="ti ti-plus" /> Add my flight
      </button>

      {/* Flight detail panel */}
      {selectedTraveler && (
        <div className="panel-overlay" onClick={closePanel}>
          <div style={{ flex: 1 }} />
          <div className="slide-panel" onClick={e => e.stopPropagation()}>
            <div className="slide-panel-header">
              <div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 17 }}>{selectedTraveler.name}</div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 11, color: 'var(--warm-500)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  {panelLoading ? 'Loading...' : panelFlights.length + ' flight' + (panelFlights.length !== 1 ? 's' : '')}
                </div>
              </div>
              <button className="slide-panel-close" onClick={closePanel}>
                <i className="ti ti-x" />
              </button>
            </div>

            {panelLoading ? (
              <div className="loading">Loading flights...</div>
            ) : panelFlights.length === 0 ? (
              <div className="empty"><i className="ti ti-plane" /><p>No flights entered yet</p></div>
            ) : panelFlights.map(fl => {
              const sc = STATUS[fl.status] ?? STATUS.pending
              return (
                <div key={fl.id} className="card" style={{ marginBottom: 12, flexShrink: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span className="badge" style={{ background: sc.bg, color: sc.text }}>{sc.label}</span>
                    {selectedTraveler.id === currentUser.id && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="icon-action" onClick={() => openEdit(fl)}><i className="ti ti-edit" /></button>
                        <button className="icon-action" onClick={() => deleteFlight(fl.id)}><i className="ti ti-trash" style={{ color: 'var(--red-err)' }} /></button>
                      </div>
                    )}
                  </div>

                  <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 17, fontWeight: 800, color: 'var(--cardinal)', marginBottom: 10 }}>
                    {fl.origin} → {fl.destination}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <InfoRow label="Airline" value={fl.airline} />
                    <InfoRow label="Flight #" value={fl.flight_number} />
                    <InfoRow label="Departs" value={fl.departure_date ? `${formatDate(fl.departure_date)}${fl.departure_time ? ' · ' + fl.departure_time : ''}` : null} />
                    <InfoRow label="Arrives" value={
                      (fl.arrival_date || fl.arrival_time)
                        ? `${fl.arrival_date ? formatDate(fl.arrival_date) : ''}${fl.arrival_date && fl.arrival_time ? ' · ' : ''}${fl.arrival_time ?? ''}`
                        : null
                    } />
                  </div>

                  <NotesSection fl={fl} />
                </div>
              )
            })}

            {selectedTraveler.id === currentUser.id && (
              <button className="add-btn" style={{ flexShrink: 0, marginTop: 8 }} onClick={() => { closePanel(); openAdd() }}>
                <i className="ti ti-plus" /> Add another flight
              </button>
            )}

            <button onClick={closePanel} style={{ marginTop: 10, width: '100%', padding: '13px', background: 'var(--warm-100)', color: 'var(--warm-800)', border: 'none', borderRadius: 13, fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* Add / Edit flight form */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', background: 'rgba(61,46,30,0.45)' }}
          onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div style={{ background: 'var(--cream)', borderRadius: '22px 22px 0 0', padding: '16px 16px', paddingBottom: 'calc(90px + env(safe-area-inset-bottom, 16px))', maxHeight: '92vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <div style={{ width: 38, height: 4, background: 'var(--warm-200)', borderRadius: 2, margin: '0 auto 16px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 800 }}>{editFlight ? 'Edit flight' : 'Add flight'}</div>
              <button onClick={() => setShowForm(false)} className="slide-panel-close"><i className="ti ti-x" /></button>
            </div>

            {/* Route */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">From</label>
                <input className="form-input mono" placeholder="LAX" value={form.origin} onChange={e => setForm(p => ({ ...p, origin: e.target.value.toUpperCase() }))} />
              </div>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">To</label>
                <input className="form-input mono" placeholder="CDG" value={form.destination} onChange={e => setForm(p => ({ ...p, destination: e.target.value.toUpperCase() }))} />
              </div>
            </div>

            {/* Airline + Flight # */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">Airline</label>
                <input className="form-input" placeholder="Air France" value={form.airline} onChange={set('airline')} />
              </div>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">Flight no.</label>
                <input className="form-input mono" placeholder="AF 65" value={form.flight_number} onChange={set('flight_number')} />
              </div>
            </div>

            {/* Departure row */}
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 10, fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'var(--warm-400)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Departure</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div className="form-field" style={{ marginBottom: 0 }}>
                  <label className="form-label">Date</label>
                  <input className="form-input mono" type="date" value={form.departure_date} onChange={set('departure_date')} />
                </div>
                <div className="form-field" style={{ marginBottom: 0 }}>
                  <label className="form-label">Time</label>
                  <input className="form-input mono" type="time" value={form.departure_time} onChange={set('departure_time')} />
                </div>
              </div>
            </div>

            {/* Arrival row */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'var(--warm-400)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Arrival</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div className="form-field" style={{ marginBottom: 0 }}>
                  <label className="form-label">Date</label>
                  <input className="form-input mono" type="date" value={form.arrival_date} onChange={set('arrival_date')} />
                </div>
                <div className="form-field" style={{ marginBottom: 0 }}>
                  <label className="form-label">Time</label>
                  <input className="form-input mono" type="time" value={form.arrival_time} onChange={set('arrival_time')} />
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="form-field">
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status} onChange={set('status')}>
                <option value="confirmed">Confirmed</option>
                <option value="pending">Pending</option>
              </select>
            </div>

            {/* Notes — always editable by owner, but locked for others when viewing */}
            <div className="form-field">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="ti ti-lock" style={{ fontSize: 11, color: 'var(--cardinal)' }} />
                Notes (private — PIN protected)
              </label>
              <input className="form-input" placeholder="Reservation #, seat, terminal..." value={form.notes} onChange={set('notes')} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button onClick={() => setShowForm(false)} style={{ padding: '14px', background: 'var(--warm-100)', color: 'var(--warm-800)', border: 'none', borderRadius: 13, fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700 }}>
                Cancel
              </button>
              <button className="kp-submit" style={{ margin: 0 }} onClick={save} disabled={saving}>
                {saving ? 'Saving...' : 'Save flight'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
