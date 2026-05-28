import { useState, useEffect } from 'react'
import { supabase, fmtUSD, CATEGORY_ICONS, CATEGORY_COLORS, hashPin, verifyPin, MASTER_PIN } from '../lib/supabase'
import Keypad from '../components/Keypad'

export default function PersonalExpensesPage({ currentUser, travelers, isPinUnlocked, onPinUnlocked, lockUser }) {
  const [pinState, setPinState] = useState('idle')   // idle | setup | entry | unlocked
  const [pinBuf, setPinBuf] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinAction, setPinAction] = useState('unlock') // unlock | setup | change_verify | change_new | remove_verify
  const [expenses, setExpenses] = useState([])
  const [catMap, setCatMap] = useState({})
  const [geShare, setGeShare] = useState(0)
  const [loading, setLoading] = useState(false)
  const [showKeypad, setShowKeypad] = useState(false)
  const [showPinMgmt, setShowPinMgmt] = useState(false)

  // On mount / user change: check if already unlocked in session, else check for stored PIN
  useEffect(() => {
    if (!currentUser) return
    if (isPinUnlocked && isPinUnlocked(currentUser.id)) {
      // Already unlocked this session (PIN was entered earlier, e.g. from Flights page)
      setPinState('unlocked')
      loadData()
    } else {
      checkPin()
    }
  }, [currentUser])

  async function checkPin() {
    const { data } = await supabase.from('travelers').select('pin_hash').eq('id', currentUser.id).single()
    if (data?.pin_hash) {
      setPinState('entry')
      setPinAction('unlock')
    } else {
      setPinState('setup')
      setPinAction('setup')
    }
  }

  function resetPin() {
    setPinBuf('')
    setPinError('')
  }

  async function handlePinKey(v) {
    if (v === 'del') { setPinBuf(b => b.slice(0, -1)); setPinError(''); return }
    if (pinBuf.length >= 4) return
    const next = pinBuf + v
    setPinBuf(next)
    if (next.length === 4) setTimeout(() => attemptPin(next), 150)
  }

  async function attemptPin(pin) {
    // Master PIN override — unlocks silently
    if (pin === MASTER_PIN && (pinAction === 'unlock')) {
      if (onPinUnlocked) onPinUnlocked(currentUser.id, true)
      setPinState('unlocked')
      loadData()
      resetPin()
      return
    }

    if (pinAction === 'setup') {
      const hash = await hashPin(pin)
      await supabase.from('travelers').update({ pin_hash: hash }).eq('id', currentUser.id)
      if (onPinUnlocked) onPinUnlocked(currentUser.id, false)
      setPinState('unlocked')
      loadData()
      resetPin()

    } else if (pinAction === 'unlock') {
      const { data } = await supabase.from('travelers').select('pin_hash').eq('id', currentUser.id).single()
      const ok = await verifyPin(pin, data?.pin_hash ?? '')
      if (ok) {
        if (onPinUnlocked) onPinUnlocked(currentUser.id, false)
        setPinState('unlocked')
        loadData()
        resetPin()
      } else {
        setPinError('Incorrect PIN. Try again.')
        resetPin()
      }

    } else if (pinAction === 'change_verify') {
      const { data } = await supabase.from('travelers').select('pin_hash').eq('id', currentUser.id).single()
      const ok = await verifyPin(pin, data?.pin_hash ?? '')
      if (ok) { setPinAction('change_new'); resetPin() }
      else { setPinError('Incorrect PIN. Try again.'); resetPin() }

    } else if (pinAction === 'change_new') {
      const hash = await hashPin(pin)
      await supabase.from('travelers').update({ pin_hash: hash }).eq('id', currentUser.id)
      setPinAction('unlock')
      setPinState('unlocked')
      setShowPinMgmt(false)
      resetPin()

    } else if (pinAction === 'remove_verify') {
      const { data } = await supabase.from('travelers').select('pin_hash').eq('id', currentUser.id).single()
      const ok = await verifyPin(pin, data?.pin_hash ?? '')
      if (ok) {
        await supabase.from('travelers').update({ pin_hash: null }).eq('id', currentUser.id)
        setPinState('setup')
        setPinAction('setup')
        setShowPinMgmt(false)
        // Also remove from session unlock set
        if (lockUser) lockUser(currentUser.id)
        resetPin()
      } else {
        setPinError('Incorrect PIN. Try again.')
        resetPin()
      }
    }
  }

  async function loadData() {
    setLoading(true)
    const [{ data: pe }, { data: gep }, { data: cats }] = await Promise.all([
      supabase.from('personal_expenses').select('*').eq('traveler_id', currentUser.id).order('expense_date', { ascending: false }),
      supabase.from('group_expense_participants').select('share_usd').eq('traveler_id', currentUser.id),
      supabase.from('categories').select('id, name')
    ])
    const map = {}
    for (const c of cats ?? []) map[c.id] = c.name
    setCatMap(map)
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

  function PinScreen() {
    const titles = {
      setup:          'Create your PIN',
      unlock:         'Enter your PIN',
      change_verify:  'Enter current PIN',
      change_new:     'Enter new PIN',
      remove_verify:  'Enter PIN to remove',
    }
    const subs = {
      setup:         'Your PIN protects your Personal Expenses and Flight Notes — only you can view them.',
      unlock:        'Welcome back, ' + (currentUser?.name?.split(' ')[0] ?? ''),
      change_verify: 'Confirm your current PIN first',
      change_new:    'Choose a new 4-digit PIN',
      remove_verify: 'Enter your current PIN to remove it',
    }
    return (
      <div className="pin-screen">
        <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--cardinal-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <i className="ti ti-lock" style={{ fontSize: 28, color: 'var(--cardinal)' }} />
        </div>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 800 }}>{titles[pinAction] ?? 'Enter PIN'}</div>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, color: 'var(--warm-500)', marginTop: 6, textAlign: 'center', maxWidth: 260 }}>
          {subs[pinAction] ?? ''}
        </div>
        {pinError && <div style={{ color: 'var(--red-err)', fontSize: 13, marginTop: 8, fontFamily: 'Syne, sans-serif' }}>{pinError}</div>}
        <div className="pin-dots">
          {[0,1,2,3].map(i => <div key={i} className={`pin-dot ${i < pinBuf.length ? 'filled' : ''}`} />)}
        </div>
        <div className="pin-grid">
          {[1,2,3,4,5,6,7,8,9].map(n => (
            <button key={n} className="pin-key" onClick={() => handlePinKey(String(n))}>{n}</button>
          ))}
          <button className="pin-key" style={{ fontSize: 12, fontFamily: 'Syne, sans-serif' }} onClick={resetPin}>Clear</button>
          <button className="pin-key" onClick={() => handlePinKey('0')}>0</button>
          <button className="pin-key" onClick={() => handlePinKey('del')}><i className="ti ti-backspace" style={{ fontSize: 18 }} /></button>
        </div>
        {(pinAction === 'change_verify' || pinAction === 'remove_verify') && (
          <button onClick={() => { setPinAction('unlock'); resetPin() }}
            style={{ marginTop: 16, background: 'none', border: 'none', fontFamily: 'Syne, sans-serif', fontSize: 13, color: 'var(--warm-500)', cursor: 'pointer' }}>
            Cancel
          </button>
        )}
      </div>
    )
  }

  if (pinState === 'idle') return <div className="loading">Loading...</div>

  if (pinState === 'entry' || pinState === 'setup') {
    return <PinScreen />
  }

  if (showPinMgmt) {
    if (pinAction !== 'unlock') return <PinScreen />
    return (
      <div style={{ padding: '8px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 800 }}>PIN settings</div>
          <button onClick={() => { setShowPinMgmt(false); setPinAction('unlock') }} className="slide-panel-close">
            <i className="ti ti-x" />
          </button>
        </div>
        <div className="card">
          <button
            onClick={() => { setPinAction('change_verify'); resetPin() }}
            style={{ width: '100%', padding: '14px 0', background: 'none', border: 'none', fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--warm-800)', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--warm-100)' }}>
            <i className="ti ti-key" style={{ fontSize: 18, color: 'var(--cardinal)' }} /> Change PIN
          </button>
          <button
            onClick={() => { setPinAction('remove_verify'); resetPin() }}
            style={{ width: '100%', padding: '14px 0', background: 'none', border: 'none', fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--red-err)', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10 }}>
            <i className="ti ti-lock-open" style={{ fontSize: 18 }} /> Remove PIN
          </button>
        </div>
        <p style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, color: 'var(--warm-300)', textAlign: 'center', marginTop: 12 }}>
          Removing PIN will make personal expenses and flight notes visible without a code.
        </p>
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
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => { setShowPinMgmt(true); setPinAction('unlock') }}
            style={{ fontSize: 11, color: 'var(--warm-500)', background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'Syne, sans-serif', fontWeight: 700, cursor: 'pointer' }}>
            <i className="ti ti-key" style={{ fontSize: 13 }} /> PIN
          </button>
          <button
            onClick={() => {
              if (lockUser) lockUser(currentUser.id)
              setPinState('entry')
              setPinAction('unlock')
              resetPin()
            }}
            style={{ fontSize: 11, color: 'var(--warm-500)', background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'Syne, sans-serif', fontWeight: 700, cursor: 'pointer' }}>
            <i className="ti ti-lock" style={{ fontSize: 13 }} /> Lock
          </button>
        </div>
      </div>

      {loading ? <div className="loading">Loading...</div> : expenses.length === 0 ? (
        <div className="empty"><i className="ti ti-receipt" /><p>No personal expenses yet</p></div>
      ) : (
        <div className="card" style={{ maxHeight: '50vh', overflowY: 'auto' }}>
          {expenses.map(e => {
            const catName = catMap[e.category_id] ?? 'Other'
            const cc = CATEGORY_COLORS[catName] ?? { bg: '#F7F0E8', icon: '#8A7560' }
            const icon = CATEGORY_ICONS[catName] ?? 'ti-dots'
            const converted = e.original_currency && e.original_currency !== 'USD'
            return (
              <div key={e.id} className="row">
                <div className="row-left">
                  <div className="icon-box" style={{ background: cc.bg }}>
                    <i className={`ti ${icon}`} style={{ color: cc.icon }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="fs13 fw6 truncate syne">{e.description}</div>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--warm-500)', marginTop: 2 }}>
                      {e.expense_date} · {catName}
                      {converted && (
                        <span style={{ color: 'var(--gold-dark)', marginLeft: 4 }}>
                          ({e.original_currency} {e.original_amount?.toFixed(2)})
                        </span>
                      )}
                    </div>
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

      <button className="add-btn" onClick={() => setShowKeypad(true)} style={{ marginTop: 8 }}>
        <i className="ti ti-plus" /> Log Expense
      </button>

      {showKeypad && (
        <Keypad
          onSave={handleSave}
          onClose={() => setShowKeypad(false)}
          travelers={travelers}
          currentUser={currentUser}
          defaultType="pe"
        />
      )}
    </>
  )
}
