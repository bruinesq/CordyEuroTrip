import { useState, useEffect } from 'react'
import { supabase, fmtUSD, CATEGORY_ICONS, CATEGORY_COLORS, CURRENCIES, getExchangeRate } from '../lib/supabase'

const CATEGORIES = ['Hotel','Meals','Transport','Activities','Shopping','Drinks','Groceries','Other']

export default function LogsPage({ currentUser, travelers }) {
  const [logs, setLogs]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [sort, setSort]         = useState('date')
  const [editEntry, setEditEntry] = useState(null)
  const [form, setForm]         = useState({})
  const [saving, setSaving]     = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: ge }, { data: pe }] = await Promise.all([
      supabase.from('group_expenses')
        .select('*, travelers(name), categories(name), group_expense_participants(traveler_id, share_usd)'),
      supabase.from('personal_expenses')
        .select('*, travelers(name), categories(name)')
        .eq('traveler_id', currentUser?.id)
    ])

    const geLogs = (ge ?? []).map(e => ({
      ...e, _type: 'group',
      _category: e.categories?.name ?? 'Other',
      _payer: e.travelers?.name ?? '—',
      _count: e.group_expense_participants?.length ?? 0,
    }))
    const peLogs = (pe ?? []).map(e => ({
      ...e, _type: 'personal',
      _category: e.categories?.name ?? 'Other',
      _payer: currentUser?.name ?? '—',
      _count: 1,
    }))
    setLogs([...geLogs, ...peLogs])
    setLoading(false)
  }

  function sorted() {
    return [...logs].sort((a, b) => {
      if (sort === 'date') {
        return (b.expense_date ?? '').localeCompare(a.expense_date ?? '')
      }
      if (sort === 'category') {
        const catCmp = a._category.localeCompare(b._category)
        if (catCmp !== 0) return catCmp
        return (b.expense_date ?? '').localeCompare(a.expense_date ?? '')
      }
      if (sort === 'payer') {
        const payerCmp = a._payer.localeCompare(b._payer)
        if (payerCmp !== 0) return payerCmp
        return (b.expense_date ?? '').localeCompare(a.expense_date ?? '')
      }
      return 0
    })
  }

  async function deleteEntry(e) {
    if (!confirm('Delete this entry?')) return
    const table = e._type === 'group' ? 'group_expenses' : 'personal_expenses'
    await supabase.from(table).delete().eq('id', e.id)
    await load()
  }

  function openEdit(e) {
    setEditEntry(e)
    setForm({
      description: e.description,
      original_amount: e.original_amount,
      original_currency: e.original_currency ?? 'USD',
      expense_date: e.expense_date,
      category: e._category,
    })
  }

  async function saveEdit() {
    if (!editEntry) return
    setSaving(true)
    const rate = await getExchangeRate(form.original_currency, 'USD')
    const usd  = parseFloat((parseFloat(form.original_amount) * rate).toFixed(2))
    const { data: cat } = await supabase.from('categories').select('id').eq('name', form.category).single()
    const table = editEntry._type === 'group' ? 'group_expenses' : 'personal_expenses'
    await supabase.from(table).update({
      description:       form.description,
      original_amount:   parseFloat(form.original_amount),
      original_currency: form.original_currency,
      amount_usd:        usd,
      exchange_rate:     rate,
      expense_date:      form.expense_date,
      category_id:       cat?.id ?? 2,
    }).eq('id', editEntry.id)
    await load()
    setSaving(false)
    setEditEntry(null)
  }

  const items = sorted()

  return (
    <>
      <div className="sort-bar">
        <span style={{ fontSize: 12, color: 'var(--warm-500)', lineHeight: '30px', fontFamily: 'Syne, sans-serif', fontWeight: 700 }}>Sort:</span>
        {['date', 'category', 'payer'].map(s => (
          <button
            key={s}
            className={`sort-btn ${sort === s ? 'active' : ''}`}
            onClick={() => setSort(s)}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading">Loading…</div>
      ) : items.length === 0 ? (
        <div className="empty">
          <i className="ti ti-list" />
          <p>No entries yet</p>
        </div>
      ) : (
        <div className="card">
          {items.map(e => {
            const cc   = CATEGORY_COLORS[e._category] ?? { bg: '#F7F0E8', icon: '#8A7560' }
            const icon = CATEGORY_ICONS[e._category]  ?? 'ti-dots'
            return (
              <div key={e._type + e.id} className="row">
                <div className="row-left">
                  <div className="icon-box" style={{ background: cc.bg }}>
                    <i className={`ti ${icon}`} style={{ color: cc.icon }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="fs13 fw6 truncate" style={{ fontFamily: 'Syne, sans-serif' }}>
                      {e.description}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                      <span className="badge" style={{
                        background: e._type === 'group' ? '#FFE8E8' : '#FFF8D6',
                        color:      e._type === 'group' ? '#990000' : '#B8920A',
                        fontSize: 9,
                      }}>
                        {e._type === 'group' ? 'Group' : 'Personal'}
                      </span>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--warm-500)' }}>
                        {e._payer} · {e.expense_date}
                      </span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 6 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div className="fw6 fs13 mono">{fmtUSD(e.amount_usd)}</div>
                    {e._count > 1 && (
                      <div className="mono" style={{ fontSize: 11, color: 'var(--warm-500)' }}>{e._count} ppl</div>
                    )}
                  </div>
                  <div className="log-actions">
                    <button className="icon-action" onClick={() => openEdit(e)}>
                      <i className="ti ti-edit" style={{ fontSize: 13 }} />
                    </button>
                    <button className="icon-action" onClick={() => deleteEntry(e)}>
                      <i className="ti ti-trash" style={{ fontSize: 13, color: 'var(--red-err)' }} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {editEntry && (
        <div className="sheet-overlay" onClick={e => e.target === e.currentTarget && setEditEntry(null)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-title">Edit entry</div>

            <div className="form-field">
              <label className="form-label">Description</label>
              <input
                className="form-input"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginBottom: 10 }}>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">Amount</label>
                <input
                  className="form-input mono"
                  type="number"
                  value={form.original_amount}
                  onChange={e => setForm(f => ({ ...f, original_amount: e.target.value }))}
                />
              </div>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">Currency</label>
                <select
                  className="form-select mono"
                  value={form.original_currency}
                  onChange={e => setForm(f => ({ ...f, original_currency: e.target.value }))}
                >
                  {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="form-field">
              <label className="form-label">Date</label>
              <input
                className="form-input mono"
                type="date"
                value={form.expense_date}
                onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))}
              />
            </div>

            <div className="form-field">
              <label className="form-label">Category</label>
              <div className="category-grid">
                {CATEGORIES.map(cat => {
                  const cc = CATEGORY_COLORS[cat] ?? { icon: '#8A7560' }
                  return (
                    <button
                      key={cat}
                      className={`cat-btn ${form.category === cat ? 'selected' : ''}`}
                      onClick={() => setForm(f => ({ ...f, category: cat }))}
                    >
                      <i
                        className={`ti ${CATEGORY_ICONS[cat]}`}
                        style={{ color: form.category === cat ? 'var(--cardinal)' : cc.icon }}
                      />
                      {cat}
                    </button>
                  )
                })}
              </div>
            </div>

            <button className="kp-submit" onClick={saveEdit} disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
