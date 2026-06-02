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

  const empty = {
    hotel_name: '', city: '', address: '', phone: '',
    confirmation_number: '', check_in: '', check_out: '',
    original_amount: '', original_currency: 'USD', notes: ''
  }
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

  // ── Get Hotel category ID ────────────────────────────────────────────────────
  async function getHotelCategoryId() {
    const { data } = await supabase.from('categories').select('id').eq('name', 'Hotel').single()
    return data?.id ?? 1
  }

  // ── Sync hotel → group_expenses ──────────────────────────────────────────────
  // Creates or updates a group expense record linked to this hotel.
  // The link is stored via hotel.group_expense_id column (add migration below).
  async function syncGroupExpense(hotelId, payload, guestIds, bookedBy, isEdit, existingGeId) {
    const categoryId = await getHotelCategoryId()
    const description = [payload.hotel_name, payload.city].filter(Boolean).join(' · ')
    const gePayload = {
      paid_by: bookedBy,
      description,
      original_amount: payload.original_amount,
      original_currency: payload.original_currency,
      amount_usd: payload.total_cost_usd,
      exchange_rate: payload.exchange_rate,
      expense_date: payload.check_in,
      category_id: categoryId,
      hotel_id: hotelId,   // back-reference so we can find it later
    }

    let geId = existingGeId

    if (isEdit && existingGeId) {
      // Update existing group expense
      const { error } = await supabase.from('group_expenses').update(gePayload).eq('id', existingGeId)
      if (error) { console.error('[Hotels] GE update error:', error); return }
      // Rebuild participants
      await supabase.from('group_expense_participants').delete().eq('expense_id', existingGeId)
    } else {
      // Insert new group expense
      const { data: ge, error } = await supabase.from('group_expenses').insert(gePayload).select().single()
      if (error || !ge) { console.error('[Hotels] GE insert error:', error); return }
      geId = ge.id
      // Save group_expense_id back on the hotel row
      await supabase.from('hotels').update({ group_expense_id: geId }).eq('id', hotelId)
    }

    // Insert participants (equal share)
    if (geId && guestIds.length) {
      const share = parseFloat((payload.total_cost_usd / guestIds.length).toFixed(2))
      await supabase.from('group_expense_participants').insert(
        guestIds.map(tid => ({ expense_id: geId, traveler_id: tid, share_usd: share }))
      )
    }
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
    if (!form.hotel_name || !form.city || !form.check_in || !form.check_out || !form.original_amount) {
      setSaveError('Please fill in all required fields (marked with *).')
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
    const isEdit = !!editHotel
    const existingGeId = editHotel?.group_expense_id ?? null
    const bookedBy = isEdit ? editHotel.booked_by : currentUser.id

    if (isEdit) {
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

    // Insert hotel guests
    if (hotelId && guests.length) {
      const { error: guestError } = await supabase
        .from('hotel_guests')
        .insert(guests.map(tid => ({ hotel_id: hotelId, traveler_id: tid })))
      if (guestError) console.error('[Hotels] guest insert error:', guestError)
    }

    // Sync to group expenses
    await syncGroupExpense(hotelId, payload, guests, bookedBy, isEdit, existingGeId)

    await load()
    setSaving(false)
    setShowForm(false)
  }

  async function deleteHotel(id) {
    if (!confirm('Delete this hotel and its group expense record?')) return
    // Find linked group expense and delete it first
    const hotel = hotels.find(h => h.id === id)
    if (hotel?.group_expense_id) {
      await supabase.from('group_expense_participants').delete().eq('expense_id', hotel.group_expense_id)
      await supabase.from('group_expenses').delete().eq('id', hotel.group_expense_id)
    }
    await supabase.from('hotels').delete().eq('id', id)
    setSelectedHotel(null)
    await load()
  }

  function toggleGuest(id) {
    setGuests(g => g.includes(id) ? g.filter(x => x !== id) : [...g, id])
  }

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
                {h.check_in} → {h.check_out}
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

      {/* ── Hotel detail panel ── */}
      {selectedHotel && (() => {
        const hotelGuests = guestMap[selectedHotel.id] ?? []
        const guestCount = hotelGuests.length
        const booker = travelers.find(t => t.id === selectedHotel.booked_by)
        const isOwner = selectedHotel.booked_by === currentUser.id
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

              {/* Cost summary */}
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

              {/* Group expense sync indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: selectedHotel.group_expense_id ? '#E8F5EA' : '#FFF8D6', borderRadius: 8, padding: '7px 10px', marginBottom: 12 }}>
                <i className={`ti ${selectedHotel.group_expense_id ? 'ti-circle-check' : 'ti-alert-triangle'}`}
                  style={{ fontSize: 13, color: selectedHotel.group_expense_id ? 'var(--green)' : '#B8920A' }} />
                <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 11, fontWeight: 700, color: selectedHotel.group_expense_id ? 'var(--green)' : '#B8920A' }}>
                  {selectedHotel.group_expense_id ? 'Synced to Group expenses & Balances' : 'Not yet synced to Group expenses'}
                </span>
              </div>

              {/* Guests */}
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

              {/* Edit/Delete — only for the person who booked it */}
              {isOwner ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="add-btn" style={{ flex: 1 }} onClick={() => openEdit(selectedHotel)}>
                    <i className="ti ti-edit" /> Edit
                  </button>
                  <button onClick={() => deleteHotel(selectedHotel.id)}
                    style={{ padding: '14px 16px', background: 'var(--red-light)', color: 'var(--red-err)', border: 'none', borderRadius: 13, fontFamily: 'Syne, sans-serif', fontWeight: 700 }}>
                    <i className="ti ti-trash" />
                  </button>
                </div>
              ) : (
                <div style={{ background: 'var(--warm-100)', borderRadius: 10, padding: '10px 12px', marginBottom: 4 }}>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, color: 'var(--warm-500)', textAlign: 'center' }}>
                    Only {booker?.name?.split(' ')[0] ?? 'the booker'} can edit this hotel.
                  </div>
                </div>
              )}

              <button onClick={() => setSelectedHotel(null)}
                style={{ marginTop: 10, width: '100%', padding: '13px', background: 'var(--warm-100)', color: 'var(--warm-800)', border: 'none', borderRadius: 13, fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700 }}>
                Close
              </button>
            </div>
          </div>
        )
      })()}

      {/* ── Add / Edit hotel — CareConnect centered dark-green card ── */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}
          onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div style={{ background: '#0d2b1f', borderRadius: 16, boxShadow: '0 8px 40px rgba(0,0,0,0.55)', width: 'min(96vw,420px)', maxHeight: '92vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch', zIndex: 910 }}>
            <div style={{ width: 32, height: 3, background: 'rgba(255,255,255,.2)', borderRadius: 99, margin: '14px auto 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px 0' }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 800, color: '#e8c84a', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                {editHotel ? 'Edit hotel' : 'Add hotel'}
              </div>
              <button onClick={() => setShowForm(false)} style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 99, padding: '5px 14px', fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.75)', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>

            <div style={{ padding: '12px 16px 20px' }}>
              {/* Hotel name + City */}
              <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 8, marginBottom: 8 }}>
                {[['Hotel name *', 'Hotel Artemide', 'hotel_name'], ['City *', 'Rome', 'city']].map(([lbl, ph, field]) => (
                  <div key={field}>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.75)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>{lbl}</div>
                    <input style={{ background: '#1e4a34', border: '1.5px solid rgba(255,255,255,.25)', borderRadius: 10, padding: '11px 13px', fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 600, color: '#fff', outline: 'none', width: '100%' }}
                      placeholder={ph} value={form[field]} onChange={set(field)}
                      onFocus={e => e.target.style.borderColor='#e8c84a'} onBlur={e => e.target.style.borderColor='rgba(255,255,255,.25)'} />
                  </div>
                ))}
              </div>

              {/* Address */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.75)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Address</div>
                <input style={{ background: '#1e4a34', border: '1.5px solid rgba(255,255,255,.25)', borderRadius: 10, padding: '11px 13px', fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 600, color: '#fff', outline: 'none', width: '100%' }}
                  placeholder="Via Nazionale 22, Rome" value={form.address} onChange={set('address')}
                  onFocus={e => e.target.style.borderColor='#e8c84a'} onBlur={e => e.target.style.borderColor='rgba(255,255,255,.25)'} />
              </div>

              {/* Phone + Confirmation */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                {[['Phone', '+39 06...', 'phone'], ['Confirmation #', 'ABC123', 'confirmation_number']].map(([lbl, ph, field]) => (
                  <div key={field}>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.75)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>{lbl}</div>
                    <input style={{ background: '#1e4a34', border: '1.5px solid rgba(255,255,255,.25)', borderRadius: 10, padding: '11px 10px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: '#fff', outline: 'none', width: '100%' }}
                      placeholder={ph} value={form[field]} onChange={set(field)}
                      onFocus={e => e.target.style.borderColor='#e8c84a'} onBlur={e => e.target.style.borderColor='rgba(255,255,255,.25)'} />
                  </div>
                ))}
              </div>

              {/* Check-in / Check-out */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                {[['Check-in *', 'check_in'], ['Check-out *', 'check_out']].map(([lbl, field]) => (
                  <div key={field}>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.75)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>{lbl}</div>
                    <input type="date" style={{ background: '#1e4a34', border: '1.5px solid rgba(255,255,255,.25)', borderRadius: 10, padding: '11px 10px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: '#fff', outline: 'none', width: '100%' }}
                      value={form[field]} onChange={set(field)}
                      onFocus={e => e.target.style.borderColor='#e8c84a'} onBlur={e => e.target.style.borderColor='rgba(255,255,255,.25)'} />
                  </div>
                ))}
              </div>

              {/* Total cost + Currency */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginBottom: 8 }}>
                <div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.75)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Total cost *</div>
                  <input type="number" style={{ background: '#1e4a34', border: '1.5px solid rgba(255,255,255,.25)', borderRadius: 10, padding: '11px 13px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 14, color: '#f0e080', outline: 'none', width: '100%' }}
                    placeholder="0.00" value={form.original_amount} onChange={set('original_amount')}
                    onFocus={e => e.target.style.borderColor='#e8c84a'} onBlur={e => e.target.style.borderColor='rgba(255,255,255,.25)'} />
                </div>
                <div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.75)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Currency</div>
                  <select style={{ background: '#1e4a34', border: '1.5px solid rgba(255,255,255,.25)', borderRadius: 10, padding: '11px 8px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 13, color: '#fff', outline: 'none', width: '100%', appearance: 'none' }}
                    value={form.original_currency} onChange={set('original_currency')}
                    onFocus={e => e.target.style.borderColor='#e8c84a'} onBlur={e => e.target.style.borderColor='rgba(255,255,255,.25)'}>
                    {CURRENCIES.map(c => <option key={c} style={{ background: '#1e4a34' }}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Guests */}
              <div style={{ background: '#1e4a34', border: '1.5px solid rgba(255,255,255,.25)', borderRadius: 10, padding: 10, marginBottom: 8 }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.75)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
                  Guests staying · split equally
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 5 }}>
                  {travelers.map(t => {
                    const sel = guests.includes(t.id)
                    return (
                      <button key={t.id} onClick={() => toggleGuest(t.id)} style={{ padding: '6px 3px', borderRadius: 8, border: sel ? 'none' : '1px solid rgba(255,255,255,.5)', fontFamily: 'Syne, sans-serif', fontSize: 10, fontWeight: 700, background: sel ? '#e8c84a' : 'transparent', color: sel ? '#0d2b1f' : 'rgba(255,255,255,.85)', cursor: 'pointer' }}>
                        {t.name.split(' ')[0]}
                      </button>
                    )
                  })}
                </div>
                {form.original_amount && guests.length > 0 && (
                  <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: '#f0e080', marginTop: 8, textAlign: 'right', fontWeight: 700 }}>
                    {fmtUSD(parseFloat(form.original_amount) / guests.length)} / person
                  </div>
                )}
              </div>

              {/* Notes */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.75)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Notes</div>
                <input style={{ background: '#1e4a34', border: '1.5px solid rgba(255,255,255,.25)', borderRadius: 10, padding: '11px 13px', fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 600, color: '#fff', outline: 'none', width: '100%' }}
                  placeholder="Breakfast included, parking, WiFi..." value={form.notes} onChange={set('notes')}
                  onFocus={e => e.target.style.borderColor='#e8c84a'} onBlur={e => e.target.style.borderColor='rgba(255,255,255,.25)'} />
              </div>

              {/* Auto-sync note */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#1a3d2a', border: '1px solid #2a6040', borderRadius: 10, padding: '8px 12px', marginBottom: 8 }}>
                <i className="ti ti-info-circle" style={{ fontSize: 13, color: '#6dbf8b', flexShrink: 0 }} />
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 11, color: '#6dbf8b', fontWeight: 600 }}>
                  Hotel cost auto-logs to Group expenses and Balances.
                </div>
              </div>

              {/* Error */}
              {saveError && (
                <div style={{ background: 'rgba(185,28,28,.2)', border: '1px solid #B91C1C', borderRadius: 10, padding: '10px 12px', marginBottom: 8, fontFamily: 'Syne, sans-serif', fontSize: 13, color: '#fca5a5', fontWeight: 600 }}>
                  {saveError}
                </div>
              )}

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowForm(false)} style={{ flex: 1, height: 50, borderRadius: 12, border: 'none', background: 'rgba(255,255,255,.1)', color: 'rgba(255,255,255,.75)', fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={save} disabled={saving} style={{ flex: 2, height: 50, borderRadius: 12, border: 'none', background: saving ? 'rgba(232,200,74,0.25)' : '#e8c84a', color: saving ? 'rgba(255,255,255,.35)' : '#0d2b1f', fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 800, cursor: saving ? 'default' : 'pointer' }}>
                  {saving ? 'Saving…' : 'Save hotel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
