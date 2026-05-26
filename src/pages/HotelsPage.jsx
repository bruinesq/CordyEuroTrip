import { useState, useEffect } from 'react'
import { supabase, TRAVELER_COLORS, initials, fmtUSD, getExchangeRate, CURRENCIES } from '../lib/supabase'

export default function HotelsPage({ currentUser, travelers }) {
  const [hotels, setHotels] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editHotel, setEditHotel] = useState(null)
  const [selectedHotel, setSelectedHotel] = useState(null)
  const [saving, setSaving] = useState(false)
  const empty = { hotel_name:'', city:'', country:'', address:'', phone:'', confirmation_number:'', check_in:'', check_in_time:'', check_out:'', check_out_time:'', original_amount:'', original_currency:'USD', notes:'' }
  const [form, setForm] = useState(empty)
  const [guests, setGuests] = useState([])

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('hotels').select('*, travelers(name), hotel_guests(traveler_id, travelers(name))').order('check_in')
    setHotels(data ?? [])
    setLoading(false)
  }

  function set(field) { return e => setForm(p => ({ ...p, [field]: e.target.value })) }

  function openNew() {
    setEditHotel(null)
    setForm(empty)
    setGuests(travelers.map(t => t.id))
    setShowForm(true)
  }

  function openEdit(h) {
    setEditHotel(h)
    setForm({ hotel_name: h.hotel_name ?? '', city: h.city ?? '', country: h.country ?? '', address: h.address ?? '', phone: h.phone ?? '', confirmation_number: h.confirmation_number ?? '', check_in: h.check_in ?? '', check_in_time: h.check_in_time ?? '', check_out: h.check_out ?? '', check_out_time: h.check_out_time ?? '', original_amount: h.original_amount ?? h.total_cost_usd ?? '', original_currency: h.original_currency ?? 'USD', notes: h.notes ?? '' })
    setGuests(h.hotel_guests?.map(g => g.traveler_id) ?? [])
    setSelectedHotel(null)
    setShowForm(true)
  }

  async function save() {
    if (!form.hotel_name || !form.check_in || !form.check_out || !form.original_amount) return
    setSaving(true)
    const rate = await getExchangeRate(form.original_currency, 'USD')
    const usd = parseFloat((parseFloat(form.original_amount) * rate).toFixed(2))
    const payload = { hotel_name: form.hotel_name, city: form.city, country: form.country, address: form.address, phone: form.phone, confirmation_number: form.confirmation_number, check_in: form.check_in, check_in_time: form.check_in_time, check_out: form.check_out, check_out_time: form.check_out_time, original_amount: parseFloat(form.original_amount), original_currency: form.original_currency, total_cost_usd: usd, exchange_rate: rate, notes: form.notes }
    if (editHotel) {
      await supabase.from('hotels').update(payload).eq('id', editHotel.id)
      await supabase.from('hotel_guests').delete().eq('hotel_id', editHotel.id)
      if (guests.length) await supabase.from('hotel_guests').insert(guests.map(tid => ({ hotel_id: editHotel.id, traveler_id: tid })))
    } else {
      const { data: h } = await supabase.from('hotels').insert({ ...payload, booked_by: currentUser.id }).select().single()
      if (h && guests.length) await supabase.from('hotel_guests').insert(guests.map(tid => ({ hotel_id: h.id, traveler_id: tid })))
    }
    await load()
    setSaving(false)
    setShowForm(false)
  }

  async function deleteHotel(id) {
    if (!confirm('Delete this hotel?')) return
    await supabase.from('hotels').delete().eq('id', id)
    await load()
    setSelectedHotel(null)
  }

  function toggleGuest(id) { setGuests(g => g.includes(id) ? g.filter(x => x !== id) : [...g, id]) }

  const sorted = [...hotels].sort((a, b) => (a.check_in ?? '').localeCompare(b.check_in ?? ''))

  return (
    <>
      <div className="section-label">Accommodations</div>
      {loading ? <div className="loading">Loading...</div> : sorted.length === 0 ? (
        <div className="empty"><i className="ti ti-building" /><p>No hotels yet</p></div>
      ) : (
        <div style={{ overflowY: 'auto' }}>
          {sorted.map((h, idx) => {
            const booker = travelers.find(t => t.id === h.booked_by)
            const guestCount = h.hotel_guests?.length ?? 0
            const perPerson = guestCount > 0 ? (h.total_cost_usd / guestCount) : 0
            const isOld = h.check_out && h.check_out < new Date().toISOString().slice(0,10)
            return (
              <div key={h.id} className="card" style={{ marginBottom: 10, opacity: isOld ? 0.6 : 1, cursor: 'pointer' }} onClick={() => setSelectedHotel(h)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 15, color: isOld ? 'var(--warm-300)' : 'var(--warm-800)' }}>{h.hotel_name}</div>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--warm-500)', marginTop: 2 }}>{h.city}, {h.country}</div>
                  </div>
                  <i className="ti ti-chevron-right" style={{ fontSize: 16, color: 'var(--warm-300)', marginLeft: 8 }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                  <span className="badge mono" style={{ background: isOld ? 'var(--warm-100)' : 'var(--cardinal-light)', color: isOld ? 'var(--warm-300)' : 'var(--cardinal)' }}>
                    {h.check_in} → {h.check_out}
                  </span>
                  <span className="mono fw6" style={{ fontSize: 13, color: 'var(--green)' }}>{fmtUSD(h.total_cost_usd)}</span>
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
                  {h.hotel_guests?.map(g => {
                    const gc = TRAVELER_COLORS[g.travelers?.name] ?? { bg: '#FFE8E8', text: '#990000' }
                    return <div key={g.traveler_id} className="avatar avatar-sm" style={{ background: gc.bg, color: gc.text }}>{initials(g.travelers?.name)}</div>
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <button className="add-btn" onClick={openNew}><i className="ti ti-plus" /> Add hotel</button>

      {selectedHotel && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex' }} onClick={() => setSelectedHotel(null)}>
          <div style={{ flex: 1 }} />
          <div onClick={e => e.stopPropagation()} style={{ width: '88vw', maxWidth: 380, background: 'var(--cream)', boxShadow: '-4px 0 24px rgba(0,0,0,0.2)', height: '100%', overflowY: 'auto', padding: '52px 16px 32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 17, color: 'var(--cardinal)' }}>{selectedHotel.hotel_name}</div>
                <div className="mono" style={{ fontSize: 12, color: 'var(--warm-500)' }}>{selectedHotel.city}, {selectedHotel.country}</div>
              </div>
              <button onClick={() => setSelectedHotel(null)} style={{ background: 'none', border: 'none', fontSize: 24, color: 'var(--warm-500)' }}><i className="ti ti-x" /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 10, fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'var(--warm-300)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Check-in</div>
                <div className="mono" style={{ fontSize: 13 }}>{selectedHotel.check_in}</div>
                {selectedHotel.check_in_time && <div className="mono" style={{ fontSize: 12, color: 'var(--warm-500)' }}>{selectedHotel.check_in_time}</div>}
              </div>
              <div>
                <div style={{ fontSize: 10, fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'var(--warm-300)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Check-out</div>
                <div className="mono" style={{ fontSize: 13 }}>{selectedHotel.check_out}</div>
                {selectedHotel.check_out_time && <div className="mono" style={{ fontSize: 12, color: 'var(--warm-500)' }}>{selectedHotel.check_out_time}</div>}
              </div>
              <div>
                <div style={{ fontSize: 10, fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'var(--warm-300)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Total cost</div>
                <div className="mono fw6" style={{ fontSize: 14, color: 'var(--green)' }}>{fmtUSD(selectedHotel.total_cost_usd)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'var(--warm-300)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Per person</div>
                <div className="mono fw6" style={{ fontSize: 14, color: 'var(--green)' }}>{fmtUSD(selectedHotel.hotel_guests?.length > 0 ? selectedHotel.total_cost_usd / selectedHotel.hotel_guests.length : 0)}</div>
              </div>
            </div>

            {selectedHotel.address && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'var(--warm-300)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Address</div>
                <div className="mono" style={{ fontSize: 13 }}>{selectedHotel.address}</div>
              </div>
            )}
            {selectedHotel.phone && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'var(--warm-300)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Phone</div>
                <a href={'tel:' + selectedHotel.phone} className="mono" style={{ fontSize: 13, color: 'var(--cardinal)', textDecoration: 'none' }}>{selectedHotel.phone}</a>
              </div>
            )}
            {selectedHotel.confirmation_number && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'var(--warm-300)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Confirmation #</div>
                <div className="mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--cardinal)' }}>{selectedHotel.confirmation_number}</div>
              </div>
            )}

            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'var(--warm-300)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Booked by</div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 700 }}>{travelers.find(t => t.id === selectedHotel.booked_by)?.name ?? '?'}</div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'var(--warm-300)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Guests staying</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {selectedHotel.hotel_guests?.map(g => {
                  const gc = TRAVELER_COLORS[g.travelers?.name] ?? { bg: '#FFE8E8', text: '#990000' }
                  return (
                    <div key={g.traveler_id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid var(--warm-200)', borderRadius: 99, padding: '4px 10px 4px 4px' }}>
                      <div className="avatar avatar-sm" style={{ background: gc.bg, color: gc.text }}>{initials(g.travelers?.name)}</div>
                      <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 700 }}>{g.travelers?.name?.split(' ')[0]}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {selectedHotel.notes && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'var(--warm-300)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Notes</div>
                <div className="mono" style={{ fontSize: 12, color: 'var(--warm-500)' }}>{selectedHotel.notes}</div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="add-btn" style={{ flex: 1 }} onClick={() => openEdit(selectedHotel)}><i className="ti ti-edit" /> Edit</button>
              <button onClick={() => deleteHotel(selectedHotel.id)} style={{ padding: '14px 16px', background: 'var(--red-light)', color: 'var(--red-err)', border: 'none', borderRadius: 13, fontFamily: 'Syne, sans-serif', fontWeight: 700 }}><i className="ti ti-trash" /></button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="sheet-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-title">{editHotel ? 'Edit hotel' : 'Add hotel'}</div>

            <div className="form-field">
              <label className="form-label">Hotel name</label>
              <input className="form-input" placeholder="Hotel Artemide" value={form.hotel_name} onChange={set('hotel_name')} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">City</label>
                <input className="form-input" placeholder="Rome" value={form.city} onChange={set('city')} />
              </div>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">Country</label>
                <input className="form-input" placeholder="Italy" value={form.country} onChange={set('country')} />
              </div>
            </div>
            <div className="form-field">
              <label className="form-label">Address</label>
              <input className="form-input" placeholder="Via Nazionale 22, Rome" value={form.address} onChange={set('address')} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">Phone</label>
                <input className="form-input mono" placeholder="+39 06..." value={form.phone} onChange={set('phone')} />
              </div>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">Confirmation #</label>
                <input className="form-input mono" placeholder="ABC123" value={form.confirmation_number} onChange={set('confirmation_number')} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">Check-in date</label>
                <input className="form-input mono" type="date" value={form.check_in} onChange={set('check_in')} />
              </div>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">Check-in time</label>
                <input className="form-input mono" type="time" value={form.check_in_time} onChange={set('check_in_time')} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">Check-out date</label>
                <input className="form-input mono" type="date" value={form.check_out} onChange={set('check_out')} />
              </div>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">Check-out time</label>
                <input className="form-input mono" type="time" value={form.check_out_time} onChange={set('check_out_time')} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginBottom: 10 }}>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">Total cost</label>
                <input className="form-input mono" type="number" placeholder="0.00" value={form.original_amount} onChange={set('original_amount')} />
              </div>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">Currency</label>
                <select className="form-select mono" value={form.original_currency} onChange={set('original_currency')}>
                  {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div style={{ background: 'var(--warm-100)', borderRadius: 10, padding: 10, marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warm-500)', fontFamily: 'Syne, sans-serif', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Guests staying</div>
              <div className="traveler-grid">
                {travelers.map(t => (
                  <button key={t.id} className={`tv-btn ${guests.includes(t.id) ? 'selected' : ''}`} onClick={() => toggleGuest(t.id)}>
                    {t.name.split(' ')[0]}
                  </button>
                ))}
              </div>
              {form.original_amount && guests.length > 0 && (
                <div className="mono" style={{ fontSize: 11, color: 'var(--green)', marginTop: 8, textAlign: 'right', fontWeight: 600 }}>
                  {fmtUSD(parseFloat(form.original_amount) / guests.length)} / person
                </div>
              )}
            </div>

            <div className="form-field">
              <label className="form-label">Notes</label>
              <input className="form-input" placeholder="Breakfast included, parking, WiFi..." value={form.notes} onChange={set('notes')} />
            </div>
            <button className="kp-submit" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save hotel'}</button>
          </div>
        </div>
      )}
    </>
  )
}
