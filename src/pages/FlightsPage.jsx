import { useState, useEffect } from 'react'
import { supabase, TRAVELER_COLORS, initials, hashPin, verifyPin, MASTER_PIN } from '../lib/supabase'

const STATUS = {
  confirmed: { bg: '#E8F5EA', text: '#1B7A4A', label: 'Confirmed' },
  pending:   { bg: '#FFF8D6', text: '#B8920A', label: 'Pending' },
}

// ── Shared dark-green form styles ────────────────────────────────────────────
const KP = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 900,
    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12,
  },
  card: {
    background: '#0d2b1f', borderRadius: 16,
    boxShadow: '0 8px 40px rgba(0,0,0,0.55)',
    width: 'min(96vw, 420px)', maxHeight: '92vh',
    overflowY: 'auto', WebkitOverflowScrolling: 'touch', zIndex: 910,
  },
  field: {
    background: '#1e4a34', border: '1.5px solid rgba(255,255,255,.25)',
    borderRadius: 10, padding: '11px 13px',
    fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 600,
    color: '#ffffff', outline: 'none', width: '100%',
  },
  select: {
    background: '#1e4a34', border: '1.5px solid rgba(255,255,255,.25)',
    borderRadius: 10, padding: '11px 10px',
    fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 600,
    color: '#ffffff', outline: 'none', width: '100%', appearance: 'none',
  },
  label: {
    fontFamily: 'Syne, sans-serif', fontSize: 10, fontWeight: 700,
    color: 'rgba(255,255,255,.75)', textTransform: 'uppercase',
    letterSpacing: '.05em', display: 'block', marginBottom: 5,
  },
  sectionLabel: {
    fontFamily: 'Syne, sans-serif', fontSize: 10, fontWeight: 700,
    color: 'rgba(255,255,255,.6)', textTransform: 'uppercase',
    letterSpacing: '.05em', marginBottom: 6,
  },
  saveBtn: (enabled) => ({
    width: '100%', height: 50, borderRadius: 12, border: 'none',
    background: enabled ? '#e8c84a' : 'rgba(232,200,74,0.25)',
    color: enabled ? '#0d2b1f' : 'rgba(255,255,255,.35)',
    fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 800,
    letterSpacing: '.03em', cursor: enabled ? 'pointer' : 'default',
  }),
  cancelBtn: {
    flex: 1, height: 50, borderRadius: 12, border: 'none',
    background: 'rgba(255,255,255,.1)', color: 'rgba(255,255,255,.75)',
    fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700, cursor: 'pointer',
  },
}

function focusGold(e) { e.target.style.borderColor = '#e8c84a' }
function blurGray(e)  { e.target.style.borderColor = 'rgba(255,255,255,.25)' }

// ── Inline PIN prompt for Notes ──────────────────────────────────────────────
function PinPrompt({ onVerify, onCancel, travelerId, travelers }) {
  const [buf, setBuf] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)

  async function handleKey(v) {
    if (v === 'del') { setBuf(b => b.slice(0, -1)); setError(''); return }
    if (buf.length >= 4) return
    const next = buf + v
    setBuf(next)
    if (next.length === 4) setTimeout(() => attempt(next), 150)
  }

  async function attempt(pin) {
    setChecking(true)
    if (pin === MASTER_PIN) { onVerify(true); return }
    const { data } = await supabase.from('travelers').select('pin_hash').eq('id', travelerId).single()
    const ok = await verifyPin(pin, data?.pin_hash ?? '')
    if (ok) { onVerify(false) }
    else { setError('Incorrect PIN. Try again.'); setBuf('') }
    setChecking(false)
  }

  const traveler = travelers?.find(t => t.id === travelerId)
  const firstName = traveler?.name?.split(' ')[0] ?? 'this traveler'

  return (
    <div style={{ background: 'var(--warm-50,#FDFAF6)', border: '1px solid var(--warm-200)', borderRadius: 14, padding: 16, marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <i className="ti ti-lock" style={{ fontSize: 16, color: 'var(--cardinal)' }} />
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 700 }}>
          Enter {firstName}'s PIN to view notes
        </div>
      </div>
      {error && <div style={{ color: 'var(--red-err)', fontSize: 12, fontFamily: 'Syne, sans-serif', marginBottom: 8 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 12 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: i < buf.length ? 'var(--cardinal)' : 'var(--warm-200)', transition: 'background 0.15s' }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 10 }}>
        {[1,2,3,4,5,6,7,8,9].map(n => (
          <button key={n} onClick={() => handleKey(String(n))} disabled={checking}
            style={{ padding: '11px 0', fontSize: 18, fontFamily: 'Syne, sans-serif', fontWeight: 700, background: 'var(--warm-100)', border: 'none', borderRadius: 10, cursor: 'pointer' }}>{n}</button>
        ))}
        <button onClick={() => setBuf('')} disabled={checking} style={{ padding: '11px 0', fontSize: 11, fontFamily: 'Syne, sans-serif', fontWeight: 700, background: 'var(--warm-100)', border: 'none', borderRadius: 10, cursor: 'pointer' }}>Clear</button>
        <button onClick={() => handleKey('0')} disabled={checking} style={{ padding: '11px 0', fontSize: 18, fontFamily: 'Syne, sans-serif', fontWeight: 700, background: 'var(--warm-100)', border: 'none', borderRadius: 10, cursor: 'pointer' }}>0</button>
        <button onClick={() => handleKey('del')} disabled={checking} style={{ padding: '11px 0', background: 'var(--warm-100)', border: 'none', borderRadius: 10, cursor: 'pointer' }}>
          <i className="ti ti-backspace" style={{ fontSize: 18 }} />
        </button>
      </div>
      <button onClick={onCancel} style={{ width: '100%', padding: '10px', background: 'none', border: 'none', fontFamily: 'Syne, sans-serif', fontSize: 13, color: 'var(--warm-500)', cursor: 'pointer' }}>Cancel</button>
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
  const [showingPinFor, setShowingPinFor] = useState(null)

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
    const { data } = await supabase.from('flights').select('*').eq('traveler_id', travelerId).order('departure_date', { ascending: true })
    setPanelFlights(data ?? [])
    setPanelLoading(false)
  }

  async function openPanel(traveler) { setSelectedTraveler(traveler); setShowingPinFor(null); await loadPanelFlights(traveler.id) }
  function closePanel() { setSelectedTraveler(null); setPanelFlights([]); setShowingPinFor(null) }

  function travelerSummary(tid) {
    const tfl = flights.filter(f => f.traveler_id === tid)
    return { count: tfl.length, latest: tfl[0] }
  }

  function set(field) { return e => setForm(p => ({ ...p, [field]: e.target.value })) }
  function openAdd() { setEditFlight(null); setForm(empty); setShowForm(true) }

  function openEdit(fl) {
    setEditFlight(fl)
    setForm({
      origin: fl.origin ?? '', destination: fl.destination ?? '',
      flight_number: fl.flight_number ?? '', airline: fl.airline ?? '',
      departure_date: fl.departure_date ?? '', departure_time: fl.departure_time ?? '',
      arrival_date: fl.arrival_date ?? '', arrival_time: fl.arrival_time ?? '',
      status: fl.status ?? 'confirmed', notes: fl.notes ?? ''
    })
    closePanel(); setShowForm(true)
  }

  async function save() {
    if (!form.origin || !form.destination || !form.departure_date) return
    setSaving(true)
    if (editFlight) {
      await supabase.from('flights').update({ ...form }).eq('id', editFlight.id)
    } else {
      await supabase.from('flights').insert({ ...form, traveler_id: currentUser.id })
    }
    await load(); setSaving(false); setShowForm(false)
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
    try { return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
    catch { return dateStr }
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
        <PinPrompt travelerId={travelerId} travelers={travelers}
          onVerify={(usedMaster) => { if (onPinUnlocked) onPinUnlocked(travelerId, usedMaster); setShowingPinFor(null) }}
          onCancel={() => setShowingPinFor(null)} />
      )
    }
    return (
      <div style={{ borderTop: '1px solid var(--warm-100)', paddingTop: 8, marginTop: 8 }}>
        <button onClick={() => setShowingPinFor(fl.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--warm-100)', border: 'none', borderRadius: 10, padding: '8px 12px', width: '100%', cursor: 'pointer' }}>
          <i className="ti ti-lock" style={{ fontSize: 14, color: 'var(--cardinal)' }} />
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 700, color: 'var(--warm-600)' }}>Notes · Tap to unlock</div>
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
                  {sc ? <span className="badge" style={{ background: sc.bg, color: sc.text }}>{sc.label}</span>
                      : <span className="badge" style={{ background: 'var(--warm-100)', color: 'var(--warm-300)' }}>Missing</span>}
                  <i className="ti ti-chevron-right" style={{ fontSize: 14, color: 'var(--warm-300)' }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      <button className="add-btn" onClick={openAdd}><i className="ti ti-plus" /> Add my flight</button>

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
              <button className="slide-panel-close" onClick={closePanel}><i className="ti ti-x" /></button>
            </div>
            {panelLoading ? <div className="loading">Loading flights...</div>
              : panelFlights.length === 0 ? <div className="empty"><i className="ti ti-plane" /><p>No flights entered yet</p></div>
              : panelFlights.map(fl => {
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
                      <InfoRow label="Arrives" value={(fl.arrival_date || fl.arrival_time) ? `${fl.arrival_date ? formatDate(fl.arrival_date) : ''}${fl.arrival_date && fl.arrival_time ? ' · ' : ''}${fl.arrival_time ?? ''}` : null} />
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

      {/* ── Add / Edit flight — CareConnect centered dark-green card ── */}
      {showForm && (
        <div style={KP.overlay} onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div style={KP.card}>
            {/* Handle */}
            <div style={{ width: 32, height: 3, background: 'rgba(255,255,255,.2)', borderRadius: 99, margin: '14px auto 0' }} />
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px 0' }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 800, color: '#e8c84a', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                {editFlight ? 'Edit flight' : 'Add flight'}
              </div>
              <button onClick={() => setShowForm(false)} style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 99, padding: '5px 14px', fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.75)', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>

            <div style={{ padding: '12px 16px 20px' }}>
              {/* Route */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div>
                  <div style={KP.label}>From *</div>
                  <input style={KP.field} placeholder="LAX" value={form.origin}
                    onChange={e => setForm(p => ({ ...p, origin: e.target.value.toUpperCase() }))}
                    onFocus={focusGold} onBlur={blurGray} />
                </div>
                <div>
                  <div style={KP.label}>To *</div>
                  <input style={KP.field} placeholder="CDG" value={form.destination}
                    onChange={e => setForm(p => ({ ...p, destination: e.target.value.toUpperCase() }))}
                    onFocus={focusGold} onBlur={blurGray} />
                </div>
              </div>

              {/* Airline + Flight # */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div>
                  <div style={KP.label}>Airline</div>
                  <input style={KP.field} placeholder="Air France" value={form.airline} onChange={set('airline')} onFocus={focusGold} onBlur={blurGray} />
                </div>
                <div>
                  <div style={KP.label}>Flight no.</div>
                  <input style={{ ...KP.field, fontFamily: 'IBM Plex Mono, monospace' }} placeholder="AF 65" value={form.flight_number} onChange={set('flight_number')} onFocus={focusGold} onBlur={blurGray} />
                </div>
              </div>

              {/* Departure */}
              <div style={{ marginBottom: 8 }}>
                <div style={KP.sectionLabel}>Departure</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <div style={KP.label}>Date *</div>
                    <input type="date" style={{ ...KP.field, fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }} value={form.departure_date} onChange={set('departure_date')} onFocus={focusGold} onBlur={blurGray} />
                  </div>
                  <div>
                    <div style={KP.label}>Time</div>
                    <input type="time" style={{ ...KP.field, fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }} value={form.departure_time} onChange={set('departure_time')} onFocus={focusGold} onBlur={blurGray} />
                  </div>
                </div>
              </div>

              {/* Arrival */}
              <div style={{ marginBottom: 8 }}>
                <div style={KP.sectionLabel}>Arrival</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <div style={KP.label}>Date</div>
                    <input type="date" style={{ ...KP.field, fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }} value={form.arrival_date} onChange={set('arrival_date')} onFocus={focusGold} onBlur={blurGray} />
                  </div>
                  <div>
                    <div style={KP.label}>Time</div>
                    <input type="time" style={{ ...KP.field, fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }} value={form.arrival_time} onChange={set('arrival_time')} onFocus={focusGold} onBlur={blurGray} />
                  </div>
                </div>
              </div>

              {/* Status */}
              <div style={{ marginBottom: 8 }}>
                <div style={KP.label}>Status</div>
                <select style={KP.select} value={form.status} onChange={set('status')} onFocus={focusGold} onBlur={blurGray}>
                  <option value="confirmed" style={{ background: '#1e4a34' }}>Confirmed</option>
                  <option value="pending" style={{ background: '#1e4a34' }}>Pending</option>
                </select>
              </div>

              {/* Notes */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ ...KP.label, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <i className="ti ti-lock" style={{ fontSize: 10, color: '#e8c84a' }} />
                  Notes (private — PIN protected)
                </div>
                <input style={KP.field} placeholder="Reservation #, seat, terminal..." value={form.notes} onChange={set('notes')} onFocus={focusGold} onBlur={blurGray} />
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowForm(false)} style={KP.cancelBtn}>Cancel</button>
                <button onClick={save} disabled={saving}
                  style={{ ...KP.saveBtn(!saving), flex: 2 }}>
                  {saving ? 'Saving…' : 'Save flight'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
