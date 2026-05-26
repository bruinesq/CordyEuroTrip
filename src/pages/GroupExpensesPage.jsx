import { useState, useEffect } from 'react'
import { supabase, fmtUSD, CATEGORY_ICONS, CATEGORY_COLORS, TRAVELER_COLORS } from '../lib/supabase'
import Keypad from '../components/Keypad'

export default function GroupExpensesPage({ currentUser, travelers, defaultType = 'ge' }) {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showKeypad, setShowKeypad] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('group_expenses')
      .select('*, travelers(name), categories(name), group_expense_participants(traveler_id, share_usd)')
      .order('expense_date', { ascending: false })
    setExpenses(data ?? [])
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

  const totalUSD = expenses.reduce((s, e) => s + (e.amount_usd ?? 0), 0)
  const myShare  = expenses.reduce((s, e) => {
    const p = e.group_expense_participants?.find(p => p.traveler_id === currentUser?.id)
    return s + (p?.share_usd ?? 0)
  }, 0)
  const iPaid = expenses.filter(e => e.paid_by === currentUser?.id).reduce((s, e) => s + (e.amount_usd ?? 0), 0)

  return (
    <>
      <div className="metrics">
        <div className="metric"><div className="metric-label">Group total</div><div className="metric-value">{fmtUSD(totalUSD)}</div></div>
        <div className="metric"><div className="metric-label">My share</div><div className="metric-value">{fmtUSD(myShare)}</div></div>
        <div className="metric"><div className="metric-label">I paid</div><div className="metric-value" style={{ color: 'var(--green)' }}>{fmtUSD(iPaid)}</div></div>
        <div className="metric"><div className="metric-label">Net</div><div className="metric-value" style={{ color: iPaid - myShare >= 0 ? 'var(--green)' : 'var(--red-err)' }}>{fmtUSD(iPaid - myShare)}</div></div>
      </div>

      <button className="add-btn" onClick={() => setShowKeypad(true)} style={{ marginBottom: 16 }}>
        <i className="ti ti-plus" /> Log Expense
      </button>

      <div className="section-label">Group expense history</div>
      {loading ? <div className="loading">Loading...</div> : expenses.length === 0 ? (
        <div className="empty"><i className="ti ti-receipt" /><p>No group expenses yet</p></div>
      ) : (
        <div className="card">
          {expenses.map(e => {
            const payer = travelers.find(t => t.id === e.paid_by)
            const catName = e.categories?.name ?? 'Other'
            const cc = CATEGORY_COLORS[catName] ?? { bg: '#F7F0E8', icon: '#8A7560' }
            const icon = CATEGORY_ICONS[catName] ?? 'ti-dots'
            const count = e.group_expense_participants?.length ?? 0
            const share = count > 0 ? (e.amount_usd / count).toFixed(2) : '?'
            return (
              <div key={e.id} className="row">
                <div className="row-left">
                  <div className="icon-box" style={{ background: cc.bg }}>
                    <i className={`ti ${icon}`} style={{ color: cc.icon }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="fs13 fw6 truncate syne">{e.description}</div>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--warm-500)', marginTop: 2 }}>
                      {payer?.name?.split(' ')[0]} · {e.expense_date} · {count} people
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                  <div className="fw6 fs13 mono">{fmtUSD(e.amount_usd)}</div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--warm-500)' }}>${share} ea.</div>
                </div>
                <button className="icon-action" style={{ marginLeft: 6 }} onClick={() => deleteExpense(e.id)}>
                  <i className="ti ti-trash" style={{ color: 'var(--red-err)' }} />
                </button>
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
    </>
  )
}
