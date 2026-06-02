import { useState, useEffect } from 'react'
import { supabase, fmtUSD, CATEGORY_ICONS, CATEGORY_COLORS, TRAVELER_COLORS, initials, CURRENCIES, getExchangeRate } from '../lib/supabase'
import Keypad from '../components/Keypad'

const CATEGORIES = ['Hotel','Meals','Transport','Activities','Shopping','Drinks','Groceries','Other']

export default function GroupExpensesPage({ currentUser, travelers, defaultType = 'ge' }) {
  const [expenses, setExpenses] = useState([])
  const [participants, setParticipants] = useState({})
  const [categories, setCategories] = useState({})
  const [loading, setLoading] = useState(true)
  const [showKeypad, setShowKeypad] = useState(false)
  const [sortBy, setSortBy] = useState('date')
  const [editEntry, setEditEntry] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: expData } = await supabase.from('group_expenses').select('*').order('expense_date', { ascending: false })
    const { data: partData } = await supabase.from('group_expense_participants').select('expense_id, traveler_id, share_usd')
    const { data: catData } = await supabase.from('categories').select('id, name')
    const catMap = {}
    for (const c of catData ?? []) catMap[c.id] = c.name
    const partMap = {}
    for (const p of partData ?? []) {
      if (!partMap[p.expense_id]) partMap[p.expense_id] = []
      partMap[p.expense_id].push(p)
    }
    setExpenses(expData ?? [])
    setParticipants(partMap)
    setCategories(catMap)
    setLoading(false)
  }

  async function getCategoryId(name) {
    const { data } = await supabase.from('categories').select('id').eq('name', name).single()
    return data?.id ?? 2
  }

  const [saveError, setSaveError] = useState('')

  async function handleSave(entry) {
    setSaveError('')
    const catId = await getCategoryId(entry.category)
    if (entry.type === 'pe') {
      const { error } = await supabase.from('personal_expenses').insert({
        traveler_id: currentUser.id,
        description: entry.description,
        original_amount: entry.original_amount,
        original_currency: entry.original_currency,
        amount_usd: entry.amount_usd,
        exchange_rate: entry.exchange_rate,
        expense_date: entry.expense_date,
        category_id: catId,
      })
      if (error) { console.error('[GE] PE insert error:', error); setSaveError('PE: ' + error.message) }
    } else {
      const { data: exp, error: expError } = await supabase.from('group_expenses').insert({
        paid_by: currentUser.id,
        description: entry.description,
        original_amount: entry.original_amount,
        original_currency: entry.original_currency,
        amount_usd: entry.amount_usd,
        exchange_rate: entry.exchange_rate,
        expense_date: entry.expense_date,
        category_id: catId,
      }).select().single()
      if (expError) { console.error('[GE] GE insert error:', expError); setSaveError('GE insert: ' + expError.message); return }
      if (exp && entry.participants.length) {
        const share = parseFloat((entry.amount_usd / entry.participants.length).toFixed(2))
        const { error: partError } = await supabase.from('group_expense_participants').insert(
          entry.participants.map(tid => ({ expense_id: exp.id, traveler_id: tid, share_usd: share }))
        )
        if (partError) { console.error('[GE] participants insert error:', partError); setSaveError('Participants: ' + partError.message) }
      }
    }
    await load()
  }

  async function deleteExpense(id) {
    if (!confirm('Delete this expense?')) return
    await supabase.from('group_expenses').delete().eq('id', id)
    await load()
  }

  function openEdit(e) {
    setEditEntry(e)
    const currentParticipants = (participants[e.id] ?? []).map(p => p.traveler_id)
    setEditForm({
      description: e.description ?? '',
      original_amount: e.original_amount ?? e.amount_usd ?? '',
      original_currency: e.original_currency ?? 'USD',
      expense_date: e.expense_date ?? '',
      category: categories[e.category_id] ?? 'Meals',
      participants: currentParticipants.length > 0 ? currentParticipants : travelers.map(t => t.id),
    })
  }

  async function saveEdit() {
    if (!editEntry) return
    setSaving(true)
    setSaveError('')
    const rateInfo = await getExchangeRate(editForm.original_currency, 'USD')
    const rate = rateInfo.rate
    const usd = parseFloat((parseFloat(editForm.original_amount) * rate).toFixed(2))
    const { data: cat } = await supabase.from('categories').select('id').eq('name', editForm.category).single()
    const { error: updateError } = await supabase.from('group_expenses').update({
      description: editForm.description,
      original_amount: parseFloat(editForm.original_amount),
      original_currency: editForm.original_currency,
      amount_usd: usd,
      exchange_rate: rate,
      expense_date: editForm.expense_date,
      category_id: cat?.id ?? 2,
    }).eq('id', editEntry.id)
    if (updateError) {
      console.error('[GE] update error:', updateError)
      setSaveError('Update failed: ' + updateError.message)
      setSaving(false)
      return
    }
    // Rebuild participants
    if (editForm.participants?.length > 0) {
      await supabase.from('group_expense_participants').delete().eq('expense_id', editEntry.id)
      const share = parseFloat((usd / editForm.participants.length).toFixed(2))
      const { error: partError } = await supabase.from('group_expense_participants').insert(
        editForm.participants.map(tid => ({ expense_id: editEntry.id, traveler_id: tid, share_usd: share }))
      )
      if (partError) {
        console.error('[GE] participants update error:', partError)
        setSaveError('Participants failed: ' + partError.message)
      }
    }
    await load()
    setSaving(false)
    setEditEntry(null)
  }

  const totalUSD = expenses.reduce((s, e) => s + (e.amount_usd ?? 0), 0)
  const myShare = expenses.reduce((s, e) => {
    const p = (participants[e.id] ?? []).find(p => p.traveler_id === currentUser?.id)
    return s + (p?.share_usd ?? 0)
  }, 0)
  const iPaid = expenses.filter(e => e.paid_by === currentUser?.id).reduce((s, e) => s + (e.amount_usd ?? 0), 0)

  const sorted = [...expenses].sort((a, b) => {
    if (sortBy === 'payer') {
      const ta = travelers.find(t => t.id === a.paid_by)?.name ?? ''
      const tb = travelers.find(t => t.id === b.paid_by)?.name ?? ''
      return ta.localeCompare(tb)
    }
    return (b.expense_date ?? '').localeCompare(a.expense_date ?? '')
  })

  return (
    <>
      <div className="metrics">
        <div className="metric"><div className="metric-label">Group total</div><div className="metric-value">{fmtUSD(totalUSD)}</div></div>
        <div className="metric"><div className="metric-label">My share</div><div className="metric-value">{fmtUSD(myShare)}</div></div>
        <div className="metric"><div className="metric-label">I paid</div><div className="metric-value" style={{ color: 'var(--green)' }}>{fmtUSD(iPaid)}</div></div>
        <div className="metric"><div className="metric-label">Net</div><div className="metric-value" style={{ color: iPaid - myShare >= 0 ? 'var(--green)' : 'var(--red-err)' }}>{fmtUSD(iPaid - myShare)}</div></div>
      </div>

      {saveError && (
        <div style={{ background: '#FEE2E2', border: '1px solid #B91C1C', borderRadius: 10, padding: '10px 14px', marginBottom: 10, fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: '#B91C1C', wordBreak: 'break-all' }}>
          ⚠️ {saveError}
        </div>
      )}

      <button className="add-btn" onClick={() => setShowKeypad(true)} style={{ marginBottom: 14 }}>
        <i className="ti ti-plus" /> Log Expense
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div className="section-label" style={{ marginBottom: 0 }}>Group expense history</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className={`sort-btn ${sortBy === 'date' ? 'active' : ''}`} onClick={() => setSortBy('date')}>Date</button>
          <button className={`sort-btn ${sortBy === 'payer' ? 'active' : ''}`} onClick={() => setSortBy('payer')}>Paid by</button>
        </div>
      </div>

      {loading ? <div className="loading">Loading...</div> : expenses.length === 0 ? (
        <div className="empty"><i className="ti ti-receipt" /><p>No group expenses yet</p></div>
      ) : (
        <div className="card" style={{ maxHeight: '48vh', overflowY: 'auto' }}>
          {sorted.map(e => {
            const payer = travelers.find(t => t.id === e.paid_by)
            const catName = categories[e.category_id] ?? 'Other'
            const cc = CATEGORY_COLORS[catName] ?? { bg: '#F7F0E8', icon: '#8A7560' }
            const icon = CATEGORY_ICONS[catName] ?? 'ti-dots'
            const parts = participants[e.id] ?? []
            const count = parts.length
            const myPart = parts.find(p => p.traveler_id === currentUser?.id)
            const pc = TRAVELER_COLORS[payer?.name] ?? { bg: '#FFE8E8', text: '#990000' }
            const converted = e.original_currency && e.original_currency !== 'USD'
            const isHotel = !!e.hotel_id
            return (
              <div key={e.id} className="row">
                <div className="row-left">
                  <div className="icon-box" style={{ background: cc.bg }}>
                    <i className={`ti ${icon}`} style={{ color: cc.icon }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div className="fs13 fw6 truncate syne">{e.description}</div>
                      {isHotel && (
                        <span style={{ fontSize: 9, fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'var(--cardinal)', background: 'var(--cardinal-light)', borderRadius: 4, padding: '1px 5px', flexShrink: 0 }}>
                          HOTEL
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, flexWrap: 'wrap' }}>
                      <div className="avatar avatar-sm" style={{ background: pc.bg, color: pc.text }}>{initials(payer?.name)}</div>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--warm-500)' }}>{e.expense_date} · {count} ppl</span>
                      {converted && (
                        <span className="mono" style={{ fontSize: 10, color: 'var(--gold-dark)', background: 'var(--gold-light)', borderRadius: 4, padding: '1px 4px' }}>
                          {e.original_currency} {e.original_amount?.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 6 }}>
                  <div className="fw6 fs13 mono">{fmtUSD(e.amount_usd)}</div>
                  {myPart && <div className="mono" style={{ fontSize: 10, color: 'var(--cardinal)' }}>my: {fmtUSD(myPart.share_usd)}</div>}
                </div>
                <div style={{ display: 'flex', gap: 4, marginLeft: 4, flexShrink: 0 }}>
                  {isHotel ? (
                    // Hotel-linked expenses are managed from the Hotels tab
                    <span style={{ fontSize: 10, fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'var(--warm-400)', padding: '4px 6px', background: 'var(--warm-100)', borderRadius: 6, alignSelf: 'center' }}>
                      via Hotels
                    </span>
                  ) : (
                    <>
                      <button className="icon-action" onClick={() => openEdit(e)}>
                        <i className="ti ti-edit" style={{ fontSize: 13 }} />
                      </button>
                      <button className="icon-action" onClick={() => deleteExpense(e.id)}>
                        <i className="ti ti-trash" style={{ fontSize: 13, color: 'var(--red-err)' }} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showKeypad && (
        <Keypad
          onSave={handleSave}
          onClose={() => setShowKeypad(false)}
          travelers={travelers}
          currentUser={currentUser}
          defaultType={defaultType}
        />
      )}

      {editEntry && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}
          onClick={e => e.target === e.currentTarget && setEditEntry(null)}>
          <div style={{ background: '#0d2b1f', borderRadius: 16, boxShadow: '0 8px 40px rgba(0,0,0,0.55)', width: 'min(96vw,420px)', maxHeight: '88vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch', zIndex: 910 }}>
            <div style={{ width: 32, height: 3, background: 'rgba(255,255,255,.2)', borderRadius: 99, margin: '14px auto 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px 0' }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 800, color: '#e8c84a', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                Edit expense
              </div>
              <button onClick={() => setEditEntry(null)} style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 99, padding: '5px 14px', fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.75)', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>

            <div style={{ padding: '12px 16px 20px' }}>
              {/* Description */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.75)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Description</div>
                <input style={{ background: '#1e4a34', border: '1.5px solid rgba(255,255,255,.25)', borderRadius: 10, padding: '11px 13px', fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 600, color: '#fff', outline: 'none', width: '100%' }}
                  value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                  onFocus={e => e.target.style.borderColor='#e8c84a'} onBlur={e => e.target.style.borderColor='rgba(255,255,255,.25)'} />
              </div>

              {/* Amount + Currency */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginBottom: 8 }}>
                <div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.75)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Amount</div>
                  <input type="number" style={{ background: '#1e4a34', border: '1.5px solid rgba(255,255,255,.25)', borderRadius: 10, padding: '11px 13px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 14, color: '#f0e080', outline: 'none', width: '100%' }}
                    value={editForm.original_amount} onChange={e => setEditForm(f => ({ ...f, original_amount: e.target.value }))}
                    onFocus={e => e.target.style.borderColor='#e8c84a'} onBlur={e => e.target.style.borderColor='rgba(255,255,255,.25)'} />
                </div>
                <div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.75)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Currency</div>
                  <select style={{ background: '#1e4a34', border: '1.5px solid rgba(255,255,255,.25)', borderRadius: 10, padding: '11px 8px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 13, color: '#fff', outline: 'none', width: '100%', appearance: 'none' }}
                    value={editForm.original_currency} onChange={e => setEditForm(f => ({ ...f, original_currency: e.target.value }))}
                    onFocus={e => e.target.style.borderColor='#e8c84a'} onBlur={e => e.target.style.borderColor='rgba(255,255,255,.25)'}>
                    {CURRENCIES.map(c => <option key={c} style={{ background: '#1e4a34' }}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Date + Category */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.75)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Date</div>
                  <input type="date" style={{ background: '#1e4a34', border: '1.5px solid rgba(255,255,255,.25)', borderRadius: 10, padding: '11px 8px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: '#fff', outline: 'none', width: '100%' }}
                    value={editForm.expense_date} onChange={e => setEditForm(f => ({ ...f, expense_date: e.target.value }))}
                    onFocus={e => e.target.style.borderColor='#e8c84a'} onBlur={e => e.target.style.borderColor='rgba(255,255,255,.25)'} />
                </div>
                <div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.75)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Category</div>
                  <select style={{ background: '#1e4a34', border: '1.5px solid rgba(255,255,255,.25)', borderRadius: 10, padding: '11px 8px', fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 600, color: '#fff', outline: 'none', width: '100%', appearance: 'none' }}
                    value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                    onFocus={e => e.target.style.borderColor='#e8c84a'} onBlur={e => e.target.style.borderColor='rgba(255,255,255,.25)'}>
                    {CATEGORIES.map(c => <option key={c} style={{ background: '#1e4a34' }}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Participants */}
              <div style={{ background: '#1e4a34', border: '1.5px solid rgba(255,255,255,.25)', borderRadius: 10, padding: 10, marginBottom: 14 }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.75)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
                  Split with
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 5 }}>
                  {travelers.map(t => {
                    const sel = editForm.participants?.includes(t.id) ?? false
                    return (
                      <button key={t.id}
                        onClick={() => setEditForm(f => ({
                          ...f,
                          participants: sel
                            ? (f.participants ?? []).filter(id => id !== t.id)
                            : [...(f.participants ?? []), t.id]
                        }))}
                        style={{ padding: '6px 3px', borderRadius: 8, border: sel ? 'none' : '1px solid rgba(255,255,255,.5)', fontFamily: 'Syne, sans-serif', fontSize: 10, fontWeight: 700, background: sel ? '#e8c84a' : 'transparent', color: sel ? '#0d2b1f' : 'rgba(255,255,255,.85)', cursor: 'pointer' }}>
                        {t.name.split(' ')[0]}
                      </button>
                    )
                  })}
                </div>
                {editForm.participants?.length > 0 && editForm.original_amount > 0 && (
                  <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: '#f0e080', marginTop: 8, textAlign: 'right', fontWeight: 700 }}>
                    ${(parseFloat(editForm.original_amount) / editForm.participants.length).toFixed(2)} each · {editForm.participants.length} people
                  </div>
                )}
              </div>

              {/* Error */}
              {saveError && (
                <div style={{ background: 'rgba(185,28,28,.2)', border: '1px solid #B91C1C', borderRadius: 10, padding: '10px 12px', marginBottom: 8, fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: '#fca5a5', wordBreak: 'break-all' }}>
                  ⚠️ {saveError}
                </div>
              )}

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setEditEntry(null)} style={{ flex: 1, height: 50, borderRadius: 12, border: 'none', background: 'rgba(255,255,255,.1)', color: 'rgba(255,255,255,.75)', fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={saveEdit} disabled={saving} style={{ flex: 2, height: 50, borderRadius: 12, border: 'none', background: saving ? 'rgba(232,200,74,0.25)' : '#e8c84a', color: saving ? 'rgba(255,255,255,.35)' : '#0d2b1f', fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 800, cursor: saving ? 'default' : 'pointer' }}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
