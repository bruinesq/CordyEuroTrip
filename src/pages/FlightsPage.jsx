import { useState, useEffect } from 'react'
import { supabase, TRAVELER_COLORS, initials } from '../lib/supabase'

const STATUS_COLORS = {
  confirmed: { bg: '#E8F5EA', text: '#1B7A4A', label: 'Confirmed' },
  pending:   { bg: '#FFF8D6', text: '#B8920A', label: 'Pending' },
}

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
    const { data } = await supabase
      .from('flights')
      .select('*, travelers(name)')
      .order('departure_date')
    setFlights(data ?? [])
    setLoading(false)
  }

  function myFlight() {
    return flights.find(f => f.traveler_id === currentUser?.id)
  }

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
    const existing = myFlight()
    if (existing) {
      setForm({
        origin: existing.origin ?? '',
        destination: existing.destination ?? '',
        flight_number: existing.flight_number ?? '',
        airline: existing.airline ?? '',
        departure_date: existing.departure_date ?? '',
        return_date: existing.return_date ?? '',
        return_flight_number: existing.return_flight_number ?? '',
        return_airline: existing.return_airline ?? '',
        status: existing.status ?? 'confirmed',
        notes: existing.notes ?? '',
      })
    } else {
      setForm({ origin:'',destination:'',flight_number:'',airline:'',departure_date:'',return_date:'',return_flight_number:'',return_airline:'',status:'confirmed',notes:'' })
    }
    setShowForm(true)
  }

  return (
    <>
      <div className="section-label">Everyone's flights</div>
      {loading ? <div className="loading">Loading…</div> : (
        <div className="card">
          {travelers.map(t => {
            const flight = flights.find(f => f.traveler_id === t.id)
            const c = TRAVELER_COLORS[t.name] ?? { bg: '#FFE8E8', text: '#990000' }
            const sc = flight ? STATUS_COLORS[flight.status] ?? STATUS_COLORS.pending : null
            return (
              <div key={t.id} className="row">
                <div className="row-left">
                  <div className="avatar" style={{ background: c.bg, color: c.text }}>{initials(t.name)}</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="fs13 fw6 truncate syne">
                      {flight ? `${flight.origin} → ${flight.destination}` : t.name}
                    </div>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--warm-500)', marginTop: 2 }}>
                      {flight
                        ? `${flight.departure_date ?? ''} · ${flight.airline ?? ''} ${flight.flight_number ?? ''}`
                        : 'No flight entered'}
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
        <i className="ti ti-plane" />
        {myFlight() ? 'Edit my flight' : 'Add my flight'}
      </button>

      {showForm && (
        <div className="sheet-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-title">My flight details</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">From</label>
                <input className="form-input mono" placeholder="LAX" value={form.origin} onChange={e => setForm(f => ({ ...f, origin: e.target.value.toUpperCase() }))} />
              </div>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">To</label>
                <input className="form-input mono" placeholder="CDG" value={form.destination} onChange={e => setForm(f => ({ ...f, destination: e.target.value.toUpperCase() }))} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">Airline</label>
                <input className="form-input" placeholder="Air France" value={form.airline} onChange={e => setForm(f => ({ ...f, airline: e.target.value }))} />
              </div>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">Flight #</label>
                <input className="form-input mono" placeholder="AF 65" value={form.flight_number} onCha
