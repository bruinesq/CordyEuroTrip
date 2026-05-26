import { useState, useEffect } from 'react'
import { supabase, TRAVELER_COLORS, initials } from '../lib/supabase'

export default function FlightsPage({ currentUser, travelers }) {
  const [flights, setFlights] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    origin: '', destination: '', flight_number: '', airline: '',
    departure_date: '', return_date: '', return_flight_number: '',
    return_airline: '', status: 'confirmed', notes: ''
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('flights').select('*, travelers(name)').order('departure_date')
    setFlights(data ?? [])
    setLoading(false)
  }

  function myFlight() { return flights.find(f => f.traveler_id === currentUser?.id) }

  function f(field) { return e => setForm(p => ({ ...p, [field]: e.target.value })) }

  async function save() {
    if (!form.origin || !form.destination || !form.departure_date) return
    setSaving(true)
    const existing = myFlight()
    if (existing) {
      await supabase.from('flights').update({ ...form, traveler_id: currentUser.id }).eq('id', existing.id)
    } else {
      await supabase.from('flights').insert({ ...form, traveler_id: currentUser.id })
    }
    await load()
    setSaving(false)
    setShowForm(false)
  }

  function openForm() {
    const ex = myFlight()
    if (ex) {
      setForm({ origin: ex.origin ?? '', destination: ex.destination ?? '', flight_number: ex.flight_number ?? '', airline: ex.airline ?? '', departure_date: ex.departure_date ?? '', return_date: ex.return_date ?? '', return_flight_number: ex.return_flight_number ?? '', return_airline: ex.return_airline ?? '', status: ex.status ?? 'confirmed', notes: ex.notes ?? '' })
    } else {
      setForm({ origin:'', destination:'', flight_number:'', airline:'', departure_date:'', return_date:'', return_flight_number:'', return_airline:'', status:'confirmed', notes:'' })
    }
    setShowForm(true)
  }

  const STATUS = { confirmed: { bg: '#E8F5EA', text: '#1B7A4A', label: 'Confirmed' }, pending: { bg: '#FFF8D6', text: '#B8920A', label: 'Pending' } }

  return (
    <>
      <div className="section-label">Everyone's flights</div>
      {loading ? <div className="loading">Loading...</div> : (
        <div className="card">
          {travelers.map(t => {
            const fl = flights.find(x => x.traveler_id === t.id)
            const c = TRAVELER_COLORS[t.name] ?? { bg: '#FFE8E8', text: '#990000' }
            const sc = fl ? (STATUS[fl.status] ?? STATUS.pending) : null
            return (
              <div key={t.id} className="row">
                <div className="row-left">
                  <div className="avatar" style={{ background: c.bg, color: c.text }}>{initials(t.name)}</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="fs13 fw6 truncate syne">{fl ? fl.origin + ' to ' + fl.destination : t.name}</div>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--warm-500)', marginTop: 2 }}>
                      {fl ? (fl.departure_date ?? '') + ' ' + (fl.airline ?? '') + ' ' + (fl.flight_number ?? '') : 'No flight entered'}
                    </div>
                  </div>
                </div>
                {sc
                  ? <span className="badge" style={{ background: sc.bg, color: sc.text, flexShrink: 0 }}>{sc.label}</span>
                  : <span className="badge" style={{ background: 'var(--warm-100)', color: 'var(--warm-300)', flexShrink: 0 }}>Missing</span>
                }
              </div>
            )
          })}
        </div>
      )}

      <button className="add-btn" onClick={openForm}>
        <i className="ti ti-plane" /> {myFlight() ? 'Edit my flight' : 'Add my flight'}
      </button>

      {showForm && (
        <div className="sheet-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-title">My flight details</div>
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
                <input className="form-input" placeholder="Air France" value={form.airline} onChange={f('airline')} />
              </div>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">Flight no.</label>
                <input className="form-input mono" placeholder="AF 65" value={form.flight_number} onChange={f('flight_number')} />
              </div>
            </div>
            <div className="form-field">
              <label className="form-label">Departure date</label>
              <input className="form-input mono" type="date" value={form.departure_date} onChange={f('departure_date')} />
            </div>
            <div className="form-field">
              <label className="form-label">Return airline</label>
              <input className="form-input" placeholder="Air France" value={form.return_airline} onChange={f('return_airline')} />
            </div>
            <div className="form-field">
              <label className="form-label">Return flight no.</label>
              <input className="form-input mono" placeholder="AF 66" value={form.return_flight_number} onChange={f('return_flight_number')} />
            </div>
            <div className="form-field">
              <label className="form-label">Return date</label>
              <input className="form-input mono" type="date" value={form.return_date} onChange={f('return_date')} />
            </div>
            <div className="form-field">
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status} onChange={f('status')}>
                <option value="confirmed">Confirmed</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            <div className="form-field">
              <label className="form-label">Notes</label>
              <input className="form-input" placeholder="Seat numbers, booking ref..." value={form.notes} onChange={f('notes')} />
            </div>
            <button className="kp-submit" onClick={save} disabled={saving}>
              {saving ? 'Saving...' : 'Save flight'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
