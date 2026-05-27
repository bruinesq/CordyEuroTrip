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

  async function handleSave(entry) {
    const catId = await getCategoryId(entry.category)
    if (entry.type === 'pe') {
      await supabase.from('personal_expenses').insert({
        traveler_id: currentUser.id,
        description: entry.description,
        original_amount: entry.original_amount,
        original_currency: entry.original_currency,
        amount_usd: entry.amount_usd,
        exchange_rate: entry.exchange_rate,
        expense_date: entry.expense_date,
        category_id: catId,
      })
    } else {
      const { data: exp } = await supabase.from('group_expenses').insert({
        paid_by: currentUser.id,
        description: entry.description,
        original_amount: entry.original_amount,
        original_currency: entry.original_currency,
        amount_usd: entry.amount_usd,
        exchange_rate: entry.exchange_rate,
        expense_date: entry.expense_date,
        category_id: catId,
      }).select().single()
      if (exp && entry.participants.length) {
        const share = parseFloat((entry.amount_usd / entry.participants.length).toFixed(2))
        await supabase.from('group_expense_participants').insert(
          entry.participants.map(tid => ({ expense_id: exp.id, traveler_id: tid, share_usd: share }))
        )
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
    setEditForm({
      description: e.description ?? '',
      original_amount: e.original_amount ?? e.amount_usd ?? '',
      original_currency: e.original_currency ?? 'USD',
      expense_date: e.expense_date ?? '',
      category: categories[e.category_id] ?? 'Meals',
    })
  }

  async function saveEdit() {
    if (!editEntry) return
    setSaving(true)
    const rate = await getExchangeRate(editForm.original_currency, 'USD')
    const usd = parseFloat((parseFloat(editForm.original_amount) * rate).toFixed(2))
    const { data: cat } = await supabase.from('categories').select('id').eq('name', editForm.category).single()
    await supabase.from('group_expenses').update({
      description: editForm.description,
      original_amount: parseFloat(editForm.original_amount),
      original_currency: editForm.original_currency,
      amount_usd: usd,
      exchange_rate: rate,
      expense_date: editForm.expense_date,
      category_id: cat?.id ?? 2,
    }).eq('id', editEntry.id)
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
            return (
              <div key={e.id} className="row">
                <div className="row-left">
                  <div className="icon-box" style={{ background: cc.bg }}>
                    <i className={`ti ${icon}`} style={{ color: cc.icon }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="fs13 fw6 truncate syne">{e.description}</div>
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
                <div style={{ display: 'flex', gap: 4, marginLeft: 4 }}>
                  <button className="icon-action" onClick={() => openEdit(e)}>
                    <i className="ti ti-edit" style={{ fontSize: 13 }} />
                  </button>
                  <button className="icon-action" onClick={() => deleteExpense(e.id)}>
                    <i className="ti ti-trash" style={{ fontSize: 13, color: 'var(--red-err)' }} />
                  </button>
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
        <div className="sheet-overlay" onClick={e => e.target === e.currentTarget && setEditEntry(null)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 800 }}>Edit expense</div>
              <button onClick={() => setEditEntry(null)} className="slide-panel-close"><i className="ti ti-x" /></button>
            </div>

            <div className="form-field">
              <label className="form-label">Description</label>
              <input className="form-input" value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginBottom: 10 }}>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">Amount</label>
                <input className="form-input mono" type="number" value={editForm.original_amount} onChange={e => setEditForm(f => ({ ...f, original_amount: e.target.value }))} />
              </div>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">Currency</label>
                <select className="form-select mono" value={editForm.original_currency} onChange={e => setEditForm(f => ({ ...f, original_currency: e.target.value }))}>
                  {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="form-field">
              <label className="form-label">Date</label>
              <input className="form-input mono" type="date" value={editForm.expense_date} onChange={e => setEditForm(f => ({ ...f, expense_date: e.target.value }))} />
            </div>

            <div className="form-field">
              <label className="form-label">Category</label>
              <select className="form-select" value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button onClick={() => setEditEntry(null)} style={{ padding: '14px', background: 'var(--warm-100)', color: 'var(--warm-800)', border: 'none', borderRadius: 13, fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700 }}>
                Cancel
              </button>
              <button className="kp-submit" style={{ margin: 0 }} onClick={saveEdit} disabled={saving}>
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
