import { useState, useEffect } from 'react'
import { supabase, TRAVELER_COLORS, initials, fmtUSD, getExchangeRate, CURRENCIES } from '../lib/supabase'

export default function HotelsPage({ currentUser, travelers }) {
  const [hotels, setHotels] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editHotel, setEditHotel] = useState(null)
  const [form, setForm] = useState({
    hotel_name: '', city: '', country: '', check_in: '', check_out: '',
    original_amount: '', original_currency: 'USD', notes: ''
  })
  const [guests, setGuests] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('hotels')
      .select('*, travelers(name), hotel_guests(traveler_id, travelers(name))')
      .order('check_in')
    setHotels(data ?? [])
    setLoading(false)
  }

  function openNew() {
    setEditHotel(null)
    setForm({ hotel_name:'',city:'',country:'',check_in:'',check_out:'',original_amount:'',original_currency:'USD',notes:'' })
    setGuests(travelers.map(t => t.id))
    setShowForm(true)
  }

  function openEdit(h) {
    setEditHotel(h)
    setForm({
      hotel_name: h.hotel_name, city: h.city, country: h.country,
      check_in: h.check_in, check_out: h.check_out,
      original_amount: h.original_amount ?? h.total_cost_usd,
      original_currency: h.original_currency ?? 'USD', notes: h.notes ?? ''
    })
    setGuests(h.hotel_guests.map(g => g.traveler_id))
    setShowForm(true)
  }

  async function save() {
    if (!form.hotel_name || !form.check_in || !form.check_out || !form.original_amount) return
    setSaving(true)
    const rate = await getExchangeRate(form.original_currency, 'USD')
    const usd = parseFloat((parseFloat(form.original_amount) * rate).toFixed(2))

    if (editHotel) {
      await supabase.from('hotels').update({
        hotel_name: form.hotel_name, city: form.city, country: form.country,
        check_in: form.check_in, check_out: form.check_out,
        original_amount: parseFloat(form.original_amount),
        original_currency: form.original_currency,
        total_cost_usd: usd, exchange_rate: rate, notes: form.notes,
      }).eq('id', editHotel.id)
      await supabase.from('hotel_guests').delete().eq('hotel_id', editHotel.id)
      if (guests.length) {
        await supabase.from('hotel_guests').insert(guests.map(tid => ({ hotel_id: editHotel.id, traveler_id: tid })))
      }
    } else {
      const { data: h } = await supabase.from('hotels').insert({
        booked_by: currentUser.id,
        hotel_name: form.hotel_name, city: form.city, country: form.country,
        check_in: form.check_in, check_out: form.check_out,
        original_amount: parseFloat(form.original_amount),
        original_currency: form.original_currency,
        total_cost_usd: usd, exchange_rate: rate, notes: form.notes,
      }).select().single()
      if (h && guests.length) {
        await supabase.from('hotel_guests').insert(guests.map(tid => ({ hotel_id: h.id, traveler_id: tid })))
      }
    }
    await load()
    setSaving(false)
    setShowForm(false)
  }

  async function deleteHotel(id) {
    if (!confirm('Delete this hotel?')) return
    await supabase.from('hotels').delete().eq('id', id)
    await load()
  }

  return (
    <>
      <div className="section-label">Accommodations</div>
      {loading ? <div className="loading">Loading…</div> : hotels.length === 0 ? (
        <div className="empty"><i className="ti ti-building" /><p>No hotels yet</p></div>
      ) : hotels.map(h => {
        const booker = travelers.find(t => t.id === h.booked_by)
        const guestCount = h.hotel_guests?.length ?? 0
        const perPerson = guestCount > 0 ? (h.total_cost_usd / guestCount).toFixed(2) : '—'
        return (
          <div key={h.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <div className="fw6 fs13 syne">{h.hotel_name}</div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--warm-500)', marginTop: 2 }}>
                  <i className="ti ti-map-pin" style={{ fontSize: 11 }} /> {h.city}, {h.country}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="icon-action" onClick={() => openEdit(h)}><i className="ti ti-edit" /></button>
                <button className="icon-action" onClick={() => deleteHotel(h.id)}><i className="ti ti-trash" style={{ color: 'var(--red-err)' }} /></button>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span className="badge mono" style={{ background: 'var(--cardinal-light)', color: 'var(--cardinal)' }}>
                {h.check_in} → {h.check_out}
              </span>
              <span className="fw6 mono" style={{ color: 'var(--green)' }}>{fmtUSD(h.total_cost_usd)}</span>
            </div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--warm-500)', marginBottom: 8 }}>
              Booked by <span style={{ fontWeight: 600, color: 'var(--warm-800)', fontFamily: 'Syne, sans-serif' }}>{booker?.name ?? '—'}</span>
              {' '}· {fmtUSD(parseFloat(perPerson))}/person · {guestCount} guests
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {h.hotel_guests?.map(g => {
                const gc = TRAVELER_COLORS[g.travelers?.name] ?? { bg: '#FFE8E8', text: '#990000' }
                return (
                  <div key={g.traveler_id} className="avatar avatar-sm" style={{ background: gc.bg, color: gc.text }}>
                    {initials(g.travelers?.name)}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      <button className="add-btn" onClick={openNew}>
        <i className="ti ti-plus" /> Add hotel
      </button>

      {showForm && (
        <div className="sheet-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-title">{editHotel ? 'Edit hotel' : 'Add hotel'}</div>

            <div className="form-field">
              <label className="form-label">Hotel name</label>
              <input className="form-input" placeholder="Hotel Artemide" value={form.hotel_name} onChange={e => setForm(f => ({ ...f, hotel_name: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">City</label>
                <input className="form-input" placeholder="Rome" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
              </div>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">Country</label>
                <input className="form-input" placeholder="Italy" value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">Check-in</label>
                <input className="form-input mono" type="date" value={form.check_in} onChange={e => setForm(f => ({ ...f, check_in: e.target.value }))} />
              </div>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">Check-out</label>
                <input className="form-input mono" type="date" value={form.check_out} onChange={e => setForm(f => ({ ...f, check_out: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginBottom: 10 }}>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">Total cost</label>
                <input className="form-input mono" type="number" placeholder="0.00" value={form.original_amount} onChange={e => setForm(f => ({ ...f, original_amount: e.target.value }))} />
              </div>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">Currency</label>
                <select className="form-select mono" value={form.original_currency} onChange={e => setForm(f => ({ ...f, original_currency: e.target.value }))}>
                  {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div style={{ background: 'var(--warm-100)', borderRadius: 10, padding: 10, marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warm-500)', fontFamily: 'Syne, sans-serif', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Guests staying</div>
              <div className="traveler-grid">
                {travelers.map(t => (
                  <button
                    key={t.id}
                    className={`tv-btn ${guests.includes(t.id) ? 'selected' : ''}`}
                    onClick={() => setGuests(g => g.includes(t.id) ? g.filter(x => x !== t.id) : [...g, t.id])}
                  >{t.name.split(' ')[0]}</button>
                ))}
              </div>
            </div>

            <div className="form-field">
              <label className="form-label">Notes</label>
              <input className="form-input" placeholder="Booking ref, breakfast included, etc." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            <button className="kp-submit" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save hotel'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
