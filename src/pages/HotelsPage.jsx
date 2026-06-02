import { useState, useEffect } from 'react'
import { supabase, TRAVELER_COLORS, initials, fmtUSD, getExchangeRate, CURRENCIES } from '../lib/supabase'

export default function HotelsPage({ currentUser, travelers }) {
  const [hotels, setHotels] = useState([])
  const [guestMap, setGuestMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editHotel, setEditHotel] = useState(null)
  const [selectedHotel, setSelectedHotel] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const empty = { hotel_name:'', city:'', address:'', phone:'', confirmation_number:'', check_in:'', check_out:'', original_amount:'', original_currency:'USD', notes:'' }
  const [form, setForm] = useState(empty)
  const [guests, setGuests] = useState([])

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: hotelData } = await supabase.from('hotels').select('*').order('check_in')
    const { data: guestData } = await supabase.from('hotel_guests').select('hotel_id, traveler_id')
    setHotels(hotelData ?? [])
    const map = {}
    for (const g of guestData ?? []) {
      if (!map[g.hotel_id]) map[g.hotel_id] = []
      const t = travelers.find(t => t.id === g.traveler_id)
      if (t) map[g.hotel_id].push(t)
    }
    setGuestMap(map)
    setLoading(false)
  }

  function set(field) { return e => setForm(p => ({ ...p, [field]: e.target.value })) }

  function openNew() {
    setEditHotel(null)
    setForm(empty)
    setGuests(travelers.map(t => t.id))
    setSaveError('')
    setShowForm(true)
  }

  function openEdit(h) {
    setEditHotel(h)
    setForm({
      hotel_name: h.hotel_name ?? '',
      city: h.city ?? '',
      address: h.address ?? '',
      phone: h.phone ?? '',
      confirmation_number: h.confirmation_number ?? '',
      check_in: h.check_in ?? '',
      check_out: h.check_out ?? '',
      original_amount: h.original_amount ?? h.total_cost_usd ?? '',
      original_currency: h.original_currency ?? 'USD',
      notes: h.notes ?? ''
    })
    const hGuests = guestMap[h.id] ?? []
    setGuests(hGuests.map(t => t.id))
    setSelectedHotel(null)
    setSaveError('')
    setShowForm(true)
  }

  async function save() {
    if (!form.hotel_name || !form.check_in || !form.check_out || !form.original_amount) {
      setSaveError('Please fill in hotel name, check-in, check-out, and total cost.')
      return
    }
    setSaving(true)
    setSaveError('')

    const rateInfo = await getExchangeRate(form.original_currency, 'USD')
    const usd = parseFloat((parseFloat(form.original_amount) * rateInfo.rate).toFixed(2))
    const payload = {
      hotel_name: form.hotel_name,
      city: form.city,
      address: form.address,
      phone: form.phone,
      confirmation_number: form.confirmation_number,
      check_in: form.check_in,
      check_out: form.check_out,
      original_amount: parseFloat(form.original_amount),
      original_currency: form.original_currency,
      total_cost_usd: usd,
      exchange_rate: rateInfo.rate,
      notes: form.notes,
    }

    let hotelId = editHotel?.id

    if (editHotel) {
      const { error } = await supabase.from('hotels').update(payload).eq('id', editHotel.id)
      if (error) {
        console.error('[Hotels] update error:', error)
        setSaveError('Save failed: ' + (error.message ?? 'unknown error'))
        setSaving(false)
        return
      }
      await supabase.from('hotel_guests').delete().eq('hotel_id', editHotel.id)
    } else {
      const { data: h, error } = await supabase
        .from('hotels')
        .insert({ ...payload, booked_by: currentUser.id })
        .select()
        .single()
      if (error || !h) {
        console.error('[Hotels] insert error:', error)
        setSaveError('Save failed: ' + (error?.message ?? 'hotel could not be created'))
        setSaving(false)
        return
      }
      hotelId = h.id
    }

    if (hotelId && guests.length) {
      const { error: guestError } = await supabase
        .from('hotel_guests')
        .insert(guests.map(tid => ({ hotel_id: hotelId, traveler_id: tid })))
      if (guestError) console.error('[Hotels] guest insert error:', guestError)
    }

    await load()
    setSaving(false)
    setShowForm(false)
  }

  async function deleteHotel(id) {
    if (!confirm('Delete this hotel?')) return
    await supabase.from('hotels').delete().eq('id', id)
    setSelectedHotel(null)
    await load()
  }

  function toggleGuest(id) { setGuests(g => g.includes(id) ? g.filter(x => x !== id) : [...g, id]) }

  function DetailRow({ label, value, link }) {
    if (!value) return null
    return (
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'var(--warm-300)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>{label}</div>
        {link
          ? <a href={link} className="mono" style={{ fontSize: 13, color: 'var(--cardinal)', textDecoration: 'none' }}>{value}</a>
          : <div className="mono" style={{ fontSize: 13 }}>{value}</div>}
      </div>
    )
  }

  return (
    <>
      <div className="section-label">Accommodations</div>
      {loading ? <div className="loading">Loading...</div> : hotels.length === 0 ? (
        <div className="empty"><i className="ti ti-building" /><p>No hotels yet</p></div>
      ) : hotels.map(h => {
        const hotelGuests = guestMap[h.id] ?? []
        const guestCount = hotelGuests.length
        const perPerson = guestCount > 0 ? h.total_cost_usd / guestCount : 0
        const isOld = h.check_out && h.check_out < new Date().toISOString().slice(0, 10)
        const booker = travelers.find(t => t.id === h.booked_by)
        return (
          <div key={h.id} className="card" style={{ marginBottom: 10, opacity: isOld ? 0.6 : 1, cursor: 'pointer' }} onClick={() => setSelectedHotel(h)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 15 }}>{h.hotel_name}</div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--warm-500)', marginTop: 2 }}>{h.city}</div>
              </div>
              <i className="ti ti-chevron-right" style={{ fontSize: 16, color: 'var(--warm-300)', marginLeft: 8 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <span className="badge mono" style={{ background: isOld ? 'var(--warm-100)' : 'var(--cardinal-light)', color: isOld ? 'var(--warm-300)' : 'var(--cardinal)' }}>
                {h.check_in} to {h.check_out}
              </span>
              <span className="mono fw6" style={{ fontSize: 13, color: 'var(--green)' }}>{fmtUSD(h.total_cost_usd)}</span>
            </div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--warm-500)', marginTop: 6 }}>
              Booked by {booker?.name?.split(' ')[0] ?? '?'} · {fmtUSD(perPerson)}/person
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
              {hotelGuests.map(t => {
                const gc = TRAVELER_COLORS[t.name] ?? { bg: '#FFE8E8', text: '#990000' }
                return <div key={t.id} className="avatar avatar-sm" style={{ background: gc.bg, color: gc.text }}>{initials(t.name)}</div>
              })}
            </div>
          </div>
        )
      })}

      <button className="add-btn" onClick={openNew}><i className="ti ti-plus" /> Add hotel</button>

      {/* Hotel detail panel */}
      {selectedHotel && (() => {
        const hotelGuests = guestMap[selectedHotel.id] ?? []
        const guestCount = hotelGuests.length
        const booker = travelers.find(t => t.id === selectedHotel.booked_by)
        return (
          <div className="panel-overlay" onClick={() => setSelectedHotel(null)}>
            <div style={{ flex: 1 }} />
            <div className="slide-panel" onClick={e => e.stopPropagation()}>
              <div className="slide-panel-header">
                <div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 17, color: 'var(--cardinal)' }}>{selectedHotel.hotel_name}</div>
                  <div className="mono" style={{ fontSize: 12, color: 'var(--warm-500)' }}>{selectedHotel.city}</div>
                </div>
                <button className="slide-panel-close" onClick={() => setSelectedHotel(null)}><i className="ti ti-x" /></button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 10, fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'var(--warm-300)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Check-in</div>
                  <div className="mono" style={{ fontSize: 13 }}>{selectedHotel.check_in}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'var(--warm-300)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Check-out</div>
                  <div className="mono" style={{ fontSize: 13 }}>{selectedHotel.check_out}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'var(--warm-300)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Total</div>
                  <div className="mono fw6" style={{ fontSize: 15, color: 'var(--green)' }}>{fmtUSD(selectedHotel.total_cost_usd)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'var(--warm-300)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Per person</div>
                  <div className="mono fw6" style={{ fontSize: 15, color: 'var(--green)' }}>{fmtUSD(guestCount > 0 ? selectedHotel.total_cost_usd / guestCount : 0)}</div>
                </div>
              </div>

              <DetailRow label="Address" value={selectedHotel.address} />
              <DetailRow label="Phone" value={selectedHotel.phone} link={'tel:' + selectedHotel.phone} />
              <DetailRow label="Confirmation #" value={selectedHotel.confirmation_number} />
              <DetailRow label="Booked by" value={booker?.name} />
              <DetailRow label="Notes" value={selectedHotel.notes} />

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'var(--warm-300)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Guests staying</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {hotelGuests.map(t => {
                    const gc = TRAVELER_COLORS[t.name] ?? { bg: '#FFE8E8', text: '#990000' }
                    return (
                      <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid var(--warm-200)', borderRadius: 99, padding: '4px 10px 4px 4px' }}>
                        <div className="avatar avatar-sm" style={{ background: gc.bg, color: gc.text }}>{initials(t.name)}</div>
                        <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 700 }}>{t.name.split(' ')[0]}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="add-btn" style={{ flex: 1 }} onClick={() => openEdit(selectedHotel)}>
                  <i className="ti ti-edit" /> Edit
                </button>
                <button onClick={() => deleteHotel(selectedHotel.id)} style={{ padding: '14px 16px', background: 'var(--red-light)', color: 'var(--red-err)', border: 'none', borderRadius: 13, fontFamily: 'Syne, sans-serif', fontWeight: 700 }}>
                  <i className="ti ti-trash" />
                </button>
              </div>
              <button onClick={() => setSelectedHotel(null)} style={{ marginTop: 10, width: '100%', padding: '13px', background: 'var(--warm-100)', color: 'var(--warm-800)', border: 'none', borderRadius: 13, fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700 }}>
                Close
              </button>
            </div>
          </div>
        )
      })()}

      {/* Add / Edit hotel form */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', background: 'rgba(61,46,30,0.45)' }}
          onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div style={{ background: 'var(--cream)', borderRadius: '22px 22px 0 0', padding: '16px 16px', paddingBottom: 'calc(90px + env(safe-area-inset-bottom, 16px))', maxHeight: '92vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <div style={{ width: 38, height: 4, background: 'var(--warm-200)', borderRadius: 2, margin: '0 auto 14px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 800 }}>{editHotel ? 'Edit hotel' : 'Add hotel'}</div>
              <button onClick={() => setShowForm(false)} className="slide-panel-close"><i className="ti ti-x" /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 8, marginBottom: 10 }}>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">Hotel name *</label>
                <input className="form-input" placeholder="Hotel Artemide" value={form.hotel_name} onChange={set('hotel_name')} />
              </div>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">City</label>
                <input className="form-input" placeholder="Rome" value={form.city} onChange={set('city')} />
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
                <label className="form-label">Check-in *</label>
                <input className="form-input mono" type="date" value={form.check_in} onChange={set('check_in')} />
              </div>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">Check-out *</label>
                <input className="form-input mono" type="date" value={form.check_out} onChange={set('check_out')} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginBottom: 10 }}>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">Total cost *</label>
                <input className="form-input mono" type="number" placeholder="0.00" value={form.original_amount} onChange={set('original_amount')} />
              </div>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">Currency</label>
                <select className="form-select mono" value={form.original_currency} onChange={set('original_currency')}>
                  {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div style={{ background: 'var(--warm-100)', borderRadius: 10, padding: 10, marginBottom: 10 }}>
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

            {/* Error message */}
            {saveError && (
              <div style={{ background: 'var(--red-light)', border: '1px solid var(--red-err)', borderRadius: 10, padding: '10px 12px', marginBottom: 10, fontFamily: 'Syne, sans-serif', fontSize: 13, color: 'var(--red-err)', fontWeight: 600 }}>
                {saveError}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button onClick={() => setShowForm(false)} style={{ padding: '14px', background: 'var(--warm-100)', color: 'var(--warm-800)', border: 'none', borderRadius: 13, fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700 }}>
                Cancel
              </button>
              <button className="kp-submit" style={{ margin: 0 }} onClick={save} disabled={saving}>
                {saving ? 'Saving...' : 'Save hotel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
