import { useState, useEffect } from 'react'
import { supabase, fmtUSD, CATEGORY_ICONS, CATEGORY_COLORS } from '../lib/supabase'
import Keypad from '../components/Keypad'
import bcrypt from 'bcryptjs'

export default function PersonalExpensesPage({ currentUser, travelers }) {
  const [pinState, setPinState] = useState('idle')
  const [pinBuf, setPinBuf] = useState('')
  const [pinError, setPinError] = useState('')
  const [expenses, setExpenses] = useState([])
  const [geShare, setGeShare] = useState(0)
  const [loading, setLoading] = useState(false)
  const [showKeypad, setShowKeypad] = useState(false)

  useEffect(() => { if (currentUser) checkPin() }, [currentUser])

  async function checkPin() {
    const { data } = await supabase.from('travelers').select('pin_hash').eq('id', currentUser.id).single()
    setPinState(data?.pin_hash ? 'entry' : 'setup')
  }

  async function handlePinKey(v) {
    if (v === 'del') { setPinBuf(b => b.slice(0, -1)); setPinError(''); return }
    if (pinBuf.length >= 4) return
    const next = pinBuf + v
    setPinBuf(next)
    if (next.length === 4) setTimeout(() => attemptPin(next), 150)
  }

  async function attemptPin(pin) {
    if (pinState === 'setup') {
      const hash = await bcrypt.hash(pin, 10)
      await supabase.from('travelers').update({ pin_hash: hash }).eq('id', currentUser.id)
      setPinState('unlocked')
      loadData()
    } else {
      const { data } = await supabase.from('travelers').select('pin_hash').eq('id', currentUser.id).single()
      const ok = await bcrypt.compare(pin, data?.pin_hash ?? '')
      if (ok) { setPinState('unlocked'); loadData() }
      else { setPinError('Incorrect PIN. Try again.'); setPinBuf('') }
    }
  }

  async function loadData() {
    setLoading(true)
    const [{ data: pe }, { data: gep }] = await Promise.all([
      supabase.from('personal_expenses')
        .select('*, categories(name)')
        .eq('traveler_id', currentUser.id)
        .order('expense_date', { ascending: false }),
      supabase.from('group_expense_participants')
        .select('share_usd')
        .eq('traveler_id', currentUser.id)
    ])
    setExpenses(pe ?? [])
    setGeShare((gep ?? []).reduce((s, r) => s + (r.share_usd ?? 0), 0))
    setLoading(false)
  }

  async function getCategoryId(name) {
    const { data } = await supabase.from('categories').select('id').eq('name', name).single()
    return data?.id ?? 2
  }

  async function handleSave(entry) {
    await supabase.from('personal_expenses').insert({
      traveler_id: currentUser.id,
      description: entry.description,
      original_amount: entry.original_amount,
      original_currency: entry.original_currency,
      amount_usd: entry.amount_usd,
      exchange_rate: entry.exchange_rate,
      expense_date: entry.expense_date,
      category_id: await getCategoryId(entry.category),
    })
    await loadData()
  }

  async function deleteExpense(id) {
    if (!confirm('Delete this expense?')) return
    await supabase.from('personal_expenses').delete().eq('id', id)
    await loadData()
  }

  const peTotal = expenses.reduce((s, e) => s + (e.amount_usd ?? 0), 0)
  const tripTotal = geShare + peTotal

  if (pinState === 'idle') return <div className="loading">Loading...</div>

  if (pinState === 'entry' || pinState === 'setup') {
    return (
      <div className="pin-screen">
        <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--cardinal-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <i className="ti ti-lock" style={{ fontSize: 28, color: 'var(--cardinal)' }} />
        </div>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 800 }}>Personal expenses</div>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, color: 'var(--warm-500)', marginTop: 6, textAlign: 'center' }}>
          {pinState === 'setup' ? 'Create a 4-digit PIN' : 'Enter your PIN, ' + (currentUser?.name?.split(' ')[0] ?? '')}
        </div>
        {pinError && <div style={{ color: 'var(--red-err)', fontSize: 13, marginTop: 6, fontFamily: 'Syne, sans-serif' }}>{pinError}</div>}
        <div className="pin-dots">
          {[0,1,2,3].map(i => <div key={i} className={`pin-dot ${i < pinBuf.length ? 'filled' : ''}`} />)}
        </div>
        <div className="pin-grid">
          {[1,2,3,4,5,6,7,8,9].map(n => (
            <button key={n} className="pin-key" onClick={() => handlePinKey(String(n))}>{n}</button>
          ))}
          <button className="pin-key" style={{ fontSize: 12, fontFamily: 'Syne, sans-serif' }} onClick={() => { setPinBuf(''); setPinError('') }}>Clear</button>
          <button className="pin-key" onClick={() => handlePinKey('0')}>0</button>
          <button className="pin-key" onClick={() => handlePinKey('del')}><i className="ti ti-backspace" style={{ fontSize: 18 }} /></button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div style={{ background: '#fff', border: '1px solid var(--warm-200)', borderRadius: 14, padding: '12px 14px', marginBottom: 12 }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 11, fontWeight: 800, color: 'var(--warm-500)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>
          {currentUser?.name?.split(' ')[0]}'s trip summary
        </div>
        <div className="row" style={{ padding: '6px 0' }}>
          <div className="fs13 syne">Group expense share</div>
          <div className="fw6 fs13 mono">{fmtUSD(geShare)}</div>
        </div>
        <div className="row" style={{ padding: '6px 0' }}>
          <div className="fs13 syne">Personal expenses</div>
          <div className="fw6 fs13 mono">{fmtUSD(peTotal)}</div>
        </div>
        <div className="row" style={{ padding: '6px 0', borderBottom: 'none' }}>
          <div className="fs13 fw6 syne">Total trip spend</div>
          <div className="fw6 fs13 mono" style={{ color: 'var(--green)' }}>{fmtUSD(tripTotal)}</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div className="section-label" style={{ marginBottom: 0 }}>My personal expenses</div>
        <button onClick={() => { setPinState('entry'); setPinBuf(''); setPinError('') }} style={{ fontSize: 11, color: 'var(--warm-500)', background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'Syne, sans-serif', fontWeight: 700 }}>
          <i className="ti ti-lock" style={{ fontSize: 13 }} /> Lock
        </button>
      </div>

      {loading ? <div className="loading">Loading...</div> : expenses.length === 0 ? (
        <div className="empty"><i className="ti ti-receipt" /><p>No personal expenses yet</p></div>
      ) : (
        <div className="card">
          {expenses.map(e => {
            const catName = e.categories?.name ?? 'Other'
            const cc = CATEGORY_COLORS[catName] ?? { bg: '#F7F0E8', icon: '#8A7560' }
            const icon = CATEGORY_ICONS[catName] ?? 'ti-dots'
            return (
              <div key={e.id} className="row">
                <div className="row-left">
                  <div className="icon-box" style={{ background: cc.bg }}>
                    <i className={`ti ${icon}`} style={{ color: cc.icon }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="fs13 fw6 truncate syne">{e.description}</div>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--warm-500)', marginTop: 2 }}>{e.expense_date} · {e.categories?.name ?? 'Other'}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <div className="fw6 fs13 mono">{fmtUSD(e.amount_usd)}</div>
                  <button className="icon-action" onClick={() => deleteExpense(e.id)}>
                    <i className="ti ti-trash" style={{ color: 'var(--red-err)' }} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <button className="add-btn" onClick={() => setShowKeypad(true)}>
        <i className="ti ti-plus" /> Log Expense
      </button>

      {showKeypad && (
        <Keypad onSave={handleSave} onClose={() => setShowKeypad(false)} travelers={travelers} currentUser={currentUser} defaultType="pe" />
      )}
    </>
  )
}
