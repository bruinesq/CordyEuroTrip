import { useState, useEffect } from 'react'
import { supabase, TRAVELER_COLORS, initials } from '../lib/supabase'

const STATUS = {
  confirmed: { bg: '#E8F5EA', text: '#1B7A4A', label: 'Confirmed' },
  pending:   { bg: '#FFF8D6', text: '#B8920A', label: 'Pending' },
}

export default function FlightsPage({ currentUser, travelers }) {
  const [flights, setFlights] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedTraveler, setSelectedTraveler] = useState(null)
  const [editFlight, setEditFlight] = useState(null)
  const [form, setForm] = useState({ origin:'', destination:'', flight_number:'', airline:'', departure_date:'', return_date:'', return_flight_number:'', return_airline:'', status:'confirmed', notes:'' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('flights').select('*, travelers(name)').order('departure_date')
    setFlights(data ?? [])
    setLoading(false)
  }

  function travelerFlights(tid) { return flights.filter(f => f.traveler_id === tid) }

  function openAdd() {
    setEditFlight(null)
    setForm({ origin:'', destination:'', flight_number:'', airline:'', departure_date:'', return_date:'', return_flight_number:'', return_airline:'', status:'confirmed', notes:'' })
    setShowForm(true)
  }

  function openEdit(fl) {
    setEditFlight(fl)
    setForm({ origin: fl.origin ?? '', destination: fl.destination ?? '', flight_number: fl.flight_number ?? '', airline: fl.airline ?? '', departure_date: fl.departure_date ?? '', return_date: fl.return_date ?? '', return_flight_number: fl.return_flight_number ?? '', return_airline: fl.return_airline ?? '', status: fl.status ?? 'confirmed', notes: fl.notes ?? '' })
    setSelectedTraveler(null)
    setShowForm(true)
  }

  function set(field) { return e => setForm(p => ({ ...p, [field]: e.target.value })) }

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
  }

  async function deleteFlight(id) {
    if (!confirm('Delete this flight?')) return
    await supabase.from('flights').delete().eq('id', id)
    await load()
  }

  return (
    <>
      <div className="section-label">Everyone's flights</div>
      {loading ? <div className="loading">Loading...</div> : (
        <div className="card">
          {travelers.map(t => {
            const tFlights = travelerFlights(t.id)
            const c = TRAVELER_COLORS[t.name] ?? { bg: '#FFE8E8', text: '#990000' }
            const latest = tFlights[0]
            const sc = latest ? (STATUS[latest.status] ?? STATUS.pending) : null
            return (
              <div key={t.id} className="row" style={{ cursor: 'pointer' }} onClick={() => setSelectedTraveler(selectedTraveler?.id === t.id ? null : t)}>
                <div className="row-left">
                  <div className="avatar" style={{ background: c.bg, color: c.text }}>{initials(t.name)}</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="fs13 fw6 syne truncate">{t.name}</div>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--warm-500)', marginTop: 2 }}>
                      {tFlights.length > 0 ? tFlights.length + ' flight' + (tFlights.length > 1 ? 's' : '') + ' entered' : 'No flights entered'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {sc
                    ? <span className="badge" style={{ background: sc.bg, color: sc.text }}>{sc.label}</span>
                    : <span className="badge" style={{ background: 'var(--warm-100)', color: 'var(--warm-300)' }}>Missing</span>
                  }
                  <i className={`ti ${selectedTraveler?.id === t.id ? 'ti-chevron-up' : 'ti-chevron-right'}`} style={{ fontSize: 14, color: 'var(--warm-300)' }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {selectedTraveler && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex' }} onClick={() => setSelectedTraveler(null)}>
          <div style={{ flex: 1 }} />
          <div onClick={e => e.stopPropagation()} style={{ width: '85vw', maxWidth: 360, background: 'var(--cream)', boxShadow: '-4px 0 24px rgba(0,0,0,0.18)', height: '100%', overflowY: 'auto', padding: '52px 16px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 17 }}>{selectedTraveler.name}</div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 11, color: 'var(--warm-500)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Flight details</div>
              </div>
              <button onClick={() => setSelectedTraveler(null)} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--warm-500)' }}>
                <i className="ti ti-x" />
              </button>
            </div>
            {travelerFlights(selectedTraveler.id).length === 0 ? (
              <div className="empty"><i className="ti ti-plane" /><p>No flights yet</p></div>
            ) : travelerFlights(selectedTraveler.id).map(fl => {
              const sc = STATUS[fl.status] ?? STATUS.pending
              return (
                <div key={fl.id} className="card" style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span className="badge mono" style={{ background: sc.bg, color: sc.text }}>{sc.label}</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {selectedTraveler.id === currentUser.id && (
                        <button className="icon-action" onClick={() => openEdit(fl)}><i className="ti ti-edit" /></button>
                      )}
                      {selectedTraveler.id === currentUser.id && (
                        <button className="icon-action" onClick={() => deleteFlight(fl.id)}><i className="ti ti-trash" style={{ color: 'var(--red-err)' }} /></button>
                      )}
                    </div>
                  </div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{fl.origin} to {fl.destination}</div>
                  <div className="mono" style={{ fontSize: 12, color: 'var(--warm-500)', marginBottom: 2 }}>{fl.airline} {fl.flight_number}</div>
                  <div className="mono" style={{ fontSize: 12, color: 'var(--warm-500)', marginBottom: 2 }}>Departs: {fl.departure_date}</div>
                  {fl.return_date && <div className="mono" style={{ fontSize: 12, color: 'var(--warm-500)', marginBottom: 2 }}>Returns: {fl.return_date} · {fl.return_airline} {fl.return_flight_number}</div>}
                  {fl.notes && <div className="mono" style={{ fontSize: 11, color: 'var(--warm-300)', marginTop: 4 }}>{fl.notes}</div>}
                </div>
              )
            })}
            {selectedTraveler.id === currentUser.id && (
              <button className="add-btn" onClick={openAdd}><i className="ti ti-plus" /> Add flight</button>
            )}
          </div>
        </div>
      )}

      <button className="add-btn" onClick={openAdd}><i className="ti ti-plus" /> Add my flight</button>

      {showForm && (
        <div className="sheet-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-title">{editFlight ? 'Edit flight' : 'Add flight'}</div>
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
            <div className="form-field">
              <label className="form-label">Departure date</label>
              <input className="form-input mono" type="date" value={form.departure_date} onChange={set('departure_date')} />
            </div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 11, fontWeight: 700, color: 'var(--warm-500)', textTransform: 'uppercase', letterSpacing: '.05em', margin: '12px 0 8px' }}>Return (optional)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">Airline</label>
                <input className="form-input" placeholder="Air France" value={form.return_airline} onChange={set('return_airline')} />
              </div>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">Flight no.</label>
                <input className="form-input mono" placeholder="AF 66" value={form.return_flight_number} onChange={set('return_flight_number')} />
              </div>
            </div>
            <div className="form-field">
              <label className="form-label">Return date</label>
              <input className="form-input mono" type="date" value={form.return_date} onChange={set('return_date')} />
            </div>
            <div className="form-field">
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status} onChange={set('status')}>
                <option value="confirmed">Confirmed</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            <div className="form-field">
              <label className="form-label">Notes</label>
              <input className="form-input" placeholder="Seat numbers, booking ref..." value={form.notes} onChange={set('notes')} />
            </div>
            <button className="kp-submit" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save flight'}</button>
          </div>
        </div>
      )}
    </>
  )
}
