import { useState, useEffect } from 'react'
import { supabase, TRAVELER_COLORS, initials, fmtUSD, CATEGORY_ICONS, CATEGORY_COLORS, CURRENCIES, getExchangeRate } from '../lib/supabase'

const CATEGORIES = ['Hotel','Meals','Transport','Activities','Shopping','Drinks','Groceries','Other']

export default function LogsPage({ currentUser, travelers }) {
  const [allGE, setAllGE] = useState([])
  const [myPE, setMyPE] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTraveler, setSelectedTraveler] = useState(null)
  const [editEntry, setEditEntry] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [currentUser])

  async function load() {
    if (!currentUser) return
    setLoading(true)
    const [{ data: ge }, { data: pe }] = await Promise.all([
      supabase.from('group_expenses').select('id, description, amount_usd, original_amount, original_currency, expense_date, paid_by, categories(name), group_expense_participants(traveler_id, share_usd)').order('expense_date', { ascending: false }),
      supabase.from('personal_expenses').select('id, description, amount_usd, original_amount, original_currency, expense_date, traveler_id, categories(name)').eq('traveler_id', currentUser.id).order('expense_date', { ascending: false })
    ])
    setAllGE(ge ?? [])
    setMyPE(pe ?? [])
    setLoading(false)
  }

  function travelerGE(tid) {
    return allGE.filter(e => e.paid_by === tid).sort((a,b) => (b.expense_date ?? '').localeCompare(a.expense_date ?? ''))
  }

  function travelerTotal(tid) {
    return allGE.filter(e => e.paid_by === tid).reduce((s, e) => s + (e.amount_usd ?? 0), 0)
  }

  function openEdit(e, type) {
    setEditEntry({ ...e, _type: type, _category: e.categories?.name ?? 'Other' })
    setForm({ description: e.description, original_amount: e.original_amount ?? e.amount_usd, original_currency: e.original_currency ?? 'USD', expense_date: e.expense_date, category: e.categories?.name ?? 'Other' })
  }

  async function deleteEntry(e, type) {
    if (!confirm('Delete this entry?')) return
    const table = type === 'group' ? 'group_expenses' : 'personal_expenses'
    await supabase.from(table).delete().eq('id', e.id)
    await load()
  }

  async function saveEdit() {
    if (!editEntry) return
    setSaving(true)
    const rate = await getExchangeRate(form.original_currency, 'USD')
    const usd = parseFloat((parseFloat(form.original_amount) * rate).toFixed(2))
    const { data: cat } = await supabase.from('categories').select('id').eq('name', form.category).single()
    const table = editEntry._type === 'group' ? 'group_expenses' : 'personal_expenses'
    await supabase.from(table).update({ description: form.description, original_amount: parseFloat(form.original_amount), original_currency: form.original_currency, amount_usd: usd, exchange_rate: rate, expense_date: form.expense_date, category_id: cat?.id ?? 2 }).eq('id', editEntry.id)
    await load()
    setSaving(false)
    setEditEntry(null)
  }

  if (loading) return <div className="loading">Loading...</div>

  return (
    <>
      <div className="section-label">Transactions by traveler</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        {travelers.map(t => {
          const c = TRAVELER_COLORS[t.name] ?? { bg: '#FFE8E8', text: '#990000' }
          const total = travelerTotal(t.id)
          const count = travelerGE(t.id).length
          return (
            <button key={t.id} onClick={() => setSelectedTraveler(t)} style={{ background: '#fff', border: '1.5px solid var(--warm-200)', borderRadius: 14, padding: '14px 12px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, width: '100%' }}>
                <div className="avatar" style={{ background: c.bg, color: c.text }}>{initials(t.name)}</div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 700, color: 'var(--warm-800)', flex: 1, textAlign: 'left' }}>{t.name.split(' ')[0]}</div>
                <i className="ti ti-chevron-right" style={{ fontSize: 14, color: 'var(--warm-300)' }} />
              </div>
              <div className="mono" style={{ fontSize: 18, fontWeight: 600, color: 'var(--cardinal)', marginBottom: 2 }}>{fmtUSD(total)}</div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 10, color: 'var(--warm-300)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                {count} group payment{count !== 1 ? 's' : ''}
              </div>
            </button>
          )
        })}
      </div>

      {currentUser && (
        <>
          <div className="section-label">My personal expenses</div>
          {myPE.length === 0 ? (
            <div className="empty"><i className="ti ti-receipt" /><p>No personal expenses</p></div>
          ) : (
            <div className="card">
              {myPE.map(e => {
                const catName = e.categories?.name ?? 'Other'
                const cc = CATEGORY_COLORS[catName] ?? { bg: '#F7F0E8', icon: '#8A7560' }
                const icon = CATEGORY_ICONS[catName] ?? 'ti-dots'
                return (
                  <div key={e.id} className="row">
                    <div className="row-left">
                      <div className="icon-box" style={{ background: cc.bg }}><i className={`ti ${icon}`} style={{ color: cc.icon }} /></div>
                      <div style={{ minWidth: 0 }}>
                        <div className="fs13 fw6 truncate syne">{e.description}</div>
                        <div className="mono" style={{ fontSize: 11, color: 'var(--warm-500)', marginTop: 2 }}>{e.expense_date} · {catName}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <div className="fw6 fs13 mono">{fmtUSD(e.amount_usd)}</div>
                      <button className="icon-action" onClick={() => openEdit(e, 'personal')}><i className="ti ti-edit" style={{ fontSize: 13 }} /></button>
                      <button className="icon-action" onClick={() => deleteEntry(e, 'personal')}><i className="ti ti-trash" style={{ fontSize: 13, color: 'var(--red-err)' }} /></button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {selectedTraveler && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex' }} onClick={() => setSelectedTraveler(null)}>
          <div style={{ flex: 1 }} />
          <div onClick={e => e.stopPropagation()} style={{ width: '88vw', maxWidth: 380, background: 'var(--cream)', boxShadow: '-4px 0 24px rgba(0,0,0,0.2)', height: '100%', overflowY: 'auto', padding: '52px 16px 32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 17 }}>{selectedTraveler.name}</div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 600, color: 'var(--cardinal)', marginTop: 2 }}>{fmtUSD(travelerTotal(selectedTraveler.id))}</div>
              </div>
              <button onClick={() => setSelectedTraveler(null)} style={{ background: 'none', border: 'none', fontSize: 24, color: 'var(--warm-500)' }}><i className="ti ti-x" /></button>
            </div>

            {travelerGE(selectedTraveler.id).length === 0 ? (
              <div className="empty"><i className="ti ti-receipt" /><p>No group payments yet</p></div>
            ) : travelerGE(selectedTraveler.id).map(e => {
              const catName = e.categories?.name ?? 'Other'
              const cc = CATEGORY_COLORS[catName] ?? { bg: '#F7F0E8', icon: '#8A7560' }
              const icon = CATEGORY_ICONS[catName] ?? 'ti-dots'
              const count = e.group_expense_participants?.length ?? 0
              return (
                <div key={e.id} className="row">
                  <div className="row-left">
                    <div className="icon-box" style={{ background: cc.bg }}><i className={`ti ${icon}`} style={{ color: cc.icon }} /></div>
                    <div style={{ minWidth: 0 }}>
                      <div className="fs13 fw6 truncate syne">{e.description}</div>
                      <div className="mono" style={{ fontSize: 11, color: 'var(--warm-500)', marginTop: 2 }}>{e.expense_date} · {count} people</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div className="fw6 fs13 mono">{fmtUSD(e.amount_usd)}</div>
                      {count > 0 && <div className="mono" style={{ fontSize: 11, color: 'var(--warm-500)' }}>${(e.amount_usd / count).toFixed(2)} ea.</div>}
                    </div>
                    {selectedTraveler.id === currentUser.id && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="icon-action" onClick={() => openEdit(e, 'group')}><i className="ti ti-edit" style={{ fontSize: 13 }} /></button>
                        <button className="icon-action" onClick={() => deleteEntry(e, 'group')}><i className="ti ti-trash" style={{ fontSize: 13, color: 'var(--red-err)' }} /></button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {editEntry && (
        <div className="sheet-overlay" onClick={e => e.target === e.currentTarget && setEditEntry(null)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-title">Edit entry</div>
            <div className="form-field">
              <label className="form-label">Description</label>
              <input className="form-input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginBottom: 10 }}>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">Amount</label>
                <input className="form-input mono" type="number" value={form.original_amount} onChange={e => setForm(f => ({ ...f, original_amount: e.target.value }))} />
              </div>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">Currency</label>
                <select className="form-select mono" value={form.original_currency} onChange={e => setForm(f => ({ ...f, original_currency: e.target.value }))}>
                  {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="form-field">
              <label className="form-label">Date</label>
              <input className="form-input mono" type="date" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} />
            </div>
            <div className="form-field">
              <label className="form-label">Category</label>
              <div className="category-grid">
                {CATEGORIES.map(cat => {
                  const cc = CATEGORY_COLORS[cat] ?? { icon: '#8A7560' }
                  return (
                    <button key={cat} className={`cat-btn ${form.category === cat ? 'selected' : ''}`} onClick={() => setForm(f => ({ ...f, category: cat }))}>
                      <i className={`ti ${CATEGORY_ICONS[cat]}`} style={{ color: form.category === cat ? 'var(--cardinal)' : cc.icon }} />
                      {cat}
                    </button>
                  )
                })}
              </div>
            </div>
            <button className="kp-submit" onClick={saveEdit} disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button>
          </div>
        </div>
      )}
    </>
  )
}
