import { useState, useEffect, useRef } from 'react'
import { CURRENCIES, CURRENCY_SYMBOLS, CATEGORY_ICONS, CATEGORY_COLORS, getExchangeRate } from '../lib/supabase'

const CATEGORIES = ['Hotel','Meals','Transport','Activities','Shopping','Drinks','Groceries','Other']

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
  const descRef = useRef(null)

  useEffect(() => {
    if (currency !== 'USD') { getExchangeRate(currency, 'USD').then(setRate) } else { setRate(1) }
  }, [currency])

  useEffect(() => {
    setTimeout(() => descRef.current?.focus(), 400)
  }, [])

  const amount = parseInt(raw || '0') / 100
  const amountUSD = parseFloat((amount * rate).toFixed(2))
  const sym = CURRENCY_SYMBOLS[currency] ?? currency

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
    <div className="sheet-overlay">
      <div className="sheet">
        <div className="sheet-handle" />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 800, color: 'var(--warm-800)' }}>Log Expense</div>
          <button onClick={onClose} className="slide-panel-close"><i className="ti ti-x" /></button>
        </div>

        <div className="kp-display">
          <div style={{ fontSize: 11, color: 'var(--warm-500)', marginBottom: 4, fontFamily: 'Syne, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>Amount</div>
          <div className="kp-amount">{sym}{amount.toFixed(2)}</div>
          {currency !== 'USD' && <div className="kp-rate">approx. ${amountUSD.toFixed(2)} USD</div>}
        </div>

        <div className="kp-currency-row">
          {CURRENCIES.map(c => (
            <button key={c} className={`cur-btn ${currency === c ? 'active' : ''}`} onClick={() => setCurrency(c)}>{c}</button>
          ))}
        </div>

        <div className="form-field">
          <label className="form-label">Description</label>
          <input ref={descRef} className="form-input" placeholder="e.g. Dinner at Da Enzo" value={description} onChange={e => setDescription(e.target.value)} autoFocus enterKeyHint="done" />
        </div>

        <div className="form-field">
          <label className="form-label">Date</label>
          <input className="form-input mono" type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>

        <div className="type-row">
          <button className={`type-btn ${type === 'pe' ? 'active-pe' : ''}`} onClick={() => setType('pe')}>
            <i className="ti ti-lock" /> Personal
          </button>
          <button className={`type-btn ${type === 'ge' ? 'active-ge' : ''}`} onClick={() => setType('ge')}>
            <i className="ti ti-users" /> Group
          </button>
        </div>

        {type === 'ge' && (
          <div style={{ background: 'var(--warm-100)', borderRadius: 10, padding: 10, marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warm-500)', marginBottom: 8, fontFamily: 'Syne, sans-serif', textTransform: 'uppercase', letterSpacing: '.05em' }}>Split with</div>
            <div className="traveler-grid">
              {travelers.map(t => (
                <button key={t.id} className={`tv-btn ${participants.includes(t.id) ? 'selected' : ''}`} onClick={() => toggleParticipant(t.id)}>
                  {t.name.split(' ')[0]}
                </button>
              ))}
            </div>
            {participants.length > 0 && amount > 0 && (
              <div className="mono" style={{ fontSize: 11, color: 'var(--green)', marginTop: 8, textAlign: 'right', fontWeight: 600 }}>
                ${(amountUSD / participants.length).toFixed(2)} / person ({participants.length} people)
              </div>
            )}
          </div>
        )}

        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warm-500)', marginBottom: 8, fontFamily: 'Syne, sans-serif', textTransform: 'uppercase', letterSpacing: '.05em' }}>Category</div>
          <div className="category-grid">
            {CATEGORIES.map(cat => {
              const cc = CATEGORY_COLORS[cat] ?? { bg: '#F7F0E8', icon: '#8A7560' }
              return (
                <button key={cat} className={`cat-btn ${category === cat ? 'selected' : ''}`} onClick={() => setCategory(cat)}>
                  <i className={`ti ${CATEGORY_ICONS[cat]}`} style={{ color: category === cat ? 'var(--cardinal)' : cc.icon }} />
                  {cat}
                </button>
              )
            })}
          </div>
        </div>

        <div className="kp-grid">
          {[7,8,9,4,5,6,1,2,3].map(n => (
            <button key={n} className="kp-key" onClick={() => kd(String(n))}>{n}</button>
          ))}
          <button className="kp-key wide" onClick={() => kd('0')}>0</button>
          <button className="kp-key del" onClick={() => kd('del')}><i className="ti ti-backspace" /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8, marginTop: 4 }}>
          <button onClick={onClose} style={{ padding: '14px', background: 'var(--warm-100)', color: 'var(--warm-800)', border: 'none', borderRadius: 13, fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700 }}>
            Cancel
          </button>
          <button className="kp-submit" style={{ margin: 0 }} onClick={handleSave} disabled={loading || !amount || !description.trim()}>
            {loading ? 'Saving...' : 'Log Expense'}
          </button>
        </div>
      </div>
    </div>
  )
}
