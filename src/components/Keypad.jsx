import { useState, useEffect, useRef } from 'react'
import { CURRENCIES, CATEGORY_ICONS, CATEGORY_COLORS, getExchangeRate } from '../lib/supabase'

const CATEGORIES = ['Hotel','Meals','Transport','Activities','Shopping','Drinks','Groceries','Other']

const CURRENCY_SYMBOLS = {
  USD:'$', EUR:'€', GBP:'£', CHF:'₣', CZK:'Kč',
  HUF:'Ft', PLN:'zł', DKK:'kr', SEK:'kr', NOK:'kr'
}

export default function Keypad({ onSave, onClose, travelers, currentUser, defaultType = 'ge' }) {
  const [raw, setRaw] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [type, setType] = useState(defaultType)
  const [category, setCategory] = useState('Meals')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [participants, setParticipants] = useState(travelers.map(t => t.id))
  const [loading, setLoading] = useState(false)
  const [rate, setRate] = useState(1)
  const [rateLoading, setRateLoading] = useState(false)
  const descRef = useRef(null)

  useEffect(() => {
    if (currency !== 'USD') {
      setRateLoading(true)
      getExchangeRate(currency, 'USD').then(r => { setRate(r); setRateLoading(false) })
    } else {
      setRate(1)
      setRateLoading(false)
    }
  }, [currency])

  const amount = parseInt(raw || '0') / 100
  const amountUSD = parseFloat((amount * rate).toFixed(2))
  const sym = CURRENCY_SYMBOLS[currency] ?? currency
  const isConverted = currency !== 'USD' && amount > 0

  function kd(v) {
    if (v === 'del') { setRaw(r => r.slice(0, -1)); return }
    if (raw.length >= 8) return
    setRaw(r => r + v)
  }

  function toggleParticipant(id) {
    setParticipants(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  }

  async function handleSave() {
    if (!amount || !description.trim()) return
    setLoading(true)
    await onSave({
      type, category,
      description: description.trim(),
      original_amount: amount,
      original_currency: currency,
      amount_usd: amountUSD,
      exchange_rate: rate,
      expense_date: date,
      participants: type === 'ge' ? participants : [],
    })
    setLoading(false)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', background: 'rgba(61,46,30,0.45)' }}>
      <div style={{
        background: 'var(--cream)',
        borderRadius: '22px 22px 0 0',
        padding: '12px 14px',
        paddingBottom: 'calc(80px + var(--safe-bottom))',
        maxHeight: '94vh',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}>
        <div style={{ width: 38, height: 4, background: 'var(--warm-200)', borderRadius: 2, margin: '0 auto 12px' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 800, color: 'var(--warm-800)' }}>Log Expense</div>
          <button onClick={onClose} className="slide-panel-close"><i className="ti ti-x" /></button>
        </div>

        <div style={{ background: 'var(--warm-100)', borderRadius: 12, padding: '8px 14px', marginBottom: 8, textAlign: 'right' }}>
          <div className="kp-amount" style={{ fontSize: 30 }}>{sym}{amount.toFixed(2)}</div>
          {isConverted && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 4 }}>
              <i className="ti ti-arrows-exchange" style={{ fontSize: 14, color: 'var(--gold-dark)' }} />
              <span className="mono" style={{ fontSize: 12, color: 'var(--gold-dark)', fontWeight: 600 }}>
                {rateLoading ? 'Converting...' : `= $${amountUSD.toFixed(2)} USD (rate: ${rate.toFixed(4)})`}
              </span>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 8 }}>
          <input
            ref={descRef}
            className="form-input"
            placeholder="Description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            autoFocus
            style={{ fontSize: 14 }}
          />
          <input
            className="form-input mono"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            style={{ fontSize: 12, padding: '12px 6px', width: 130 }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
          <select className="form-select mono" value={currency} onChange={e => setCurrency(e.target.value)} style={{ fontSize: 12, padding: '9px 6px' }}>
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="form-select" value={category} onChange={e => setCategory(e.target.value)} style={{ fontSize: 12, padding: '9px 6px' }}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="form-select" value={type} onChange={e => setType(e.target.value)} style={{ fontSize: 12, padding: '9px 6px' }}>
            <option value="ge">Group</option>
            <option value="pe">Personal</option>
          </select>
        </div>

        {type === 'ge' && (
          <div style={{ background: 'var(--warm-100)', borderRadius: 10, padding: '8px 10px', marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-500)', marginBottom: 6, fontFamily: 'Syne, sans-serif', textTransform: 'uppercase', letterSpacing: '.05em' }}>Split with</div>
            <div className="traveler-grid">
              {travelers.map(t => (
                <button key={t.id} className={`tv-btn ${participants.includes(t.id) ? 'selected' : ''}`} onClick={() => toggleParticipant(t.id)} style={{ padding: '5px 2px', fontSize: 10 }}>
                  {t.name.split(' ')[0]}
                </button>
              ))}
            </div>
            {participants.length > 0 && amount > 0 && (
              <div className="mono" style={{ fontSize: 10, color: 'var(--green)', marginTop: 6, textAlign: 'right', fontWeight: 600 }}>
                ${(amountUSD / participants.length).toFixed(2)} each · {participants.length} people
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 6 }}>
          {[1,2,3,4,5,6,7,8,9].map(n => (
            <button key={n} className="kp-key" style={{ height: 46, fontSize: 20 }} onClick={() => kd(String(n))}>{n}</button>
          ))}
          <button className="kp-key wide" style={{ height: 46, fontSize: 20 }} onClick={() => kd('0')}>0</button>
          <button className="kp-key del" style={{ height: 46 }} onClick={() => kd('del')}><i className="ti ti-backspace" /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '13px', background: 'var(--warm-100)', color: 'var(--warm-800)', border: 'none', borderRadius: 13, fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700 }}>
            Cancel
          </button>
          <button className="kp-submit" style={{ margin: 0, padding: '13px' }} onClick={handleSave} disabled={loading || !amount || !description.trim()}>
            {loading ? 'Saving...' : 'Log Expense'}
          </button>
        </div>
      </div>
    </div>
  )
}
