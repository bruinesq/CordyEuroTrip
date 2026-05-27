import { useState, useEffect, useRef } from 'react'
import { CURRENCIES, CATEGORY_ICONS, CATEGORY_COLORS, getExchangeRate } from '../lib/supabase'

const CATEGORIES = ['Hotel','Meals','Transport','Activities','Shopping','Drinks','Groceries','Other']

const CURRENCY_SYMBOLS = { USD: '$', EUR: '€' }

export default function Keypad({ onSave, onClose, travelers, currentUser, defaultType = 'ge' }) {
  const [raw, setRaw] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [type, setType] = useState(defaultType)
  const [category, setCategory] = useState('Meals')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [participants, setParticipants] = useState(travelers.map(t => t.id))
  const [loading, setLoading] = useState(false)
  const [rateInfo, setRateInfo] = useState({ rate: 1, source: 'same currency' })
  const [rateLoading, setRateLoading] = useState(false)
  const descRef = useRef(null)

  useEffect(() => {
    if (currency === 'USD') {
      setRateInfo({ rate: 1, source: 'same currency' })
      return
    }
    setRateLoading(true)
    getExchangeRate(currency, 'USD').then(info => {
      setRateInfo(info)
      setRateLoading(false)
    })
  }, [currency])

  const amount = parseInt(raw || '0') / 100
  const amountUSD = currency === 'USD' ? amount : parseFloat((amount * rateInfo.rate).toFixed(2))
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
      exchange_rate: rateInfo.rate,
      expense_date: date,
      participants: type === 'ge' ? participants : [],
    })
    setLoading(false)
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      background: 'rgba(61,46,30,0.45)'
    }}>
      <div style={{
        background: 'var(--cream)',
        borderRadius: '22px 22px 0 0',
        padding: '12px 14px',
        paddingBottom: 'calc(90px + env(safe-area-inset-bottom, 16px))',
        maxHeight: '92vh',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}>
        <div style={{ width: 38, height: 4, background: 'var(--warm-200)', borderRadius: 2, margin: '0 auto 12px' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 800 }}>Log Expense</div>
          <button onClick={onClose} className="slide-panel-close"><i className="ti ti-x" /></button>
        </div>

        {/* Amount display */}
        <div style={{ background: 'var(--warm-100)', borderRadius: 12, padding: '10px 14px', marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 11, fontWeight: 700, color: 'var(--warm-500)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Amount</div>
            {/* Currency toggle — just 2 buttons */}
            <div style={{ display: 'flex', gap: 6 }}>
              {CURRENCIES.map(c => (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  style={{
                    padding: '4px 10px', borderRadius: 8, border: 'none',
                    fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, fontWeight: 600,
                    background: currency === c ? 'var(--cardinal)' : 'var(--warm-200)',
                    color: currency === c ? '#fff' : 'var(--warm-500)',
                    cursor: 'pointer',
                  }}
                >{c} {CURRENCY_SYMBOLS[c]}</button>
              ))}
            </div>
          </div>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 32, fontWeight: 600, textAlign: 'right', marginTop: 4 }}>
            {sym}{amount.toFixed(2)}
          </div>
          {isConverted && (
            <div style={{
              marginTop: 6, padding: '6px 10px', borderRadius: 8,
              background: rateLoading ? 'var(--warm-200)' : 'var(--gold-light)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              {rateLoading ? (
                <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 11, color: 'var(--warm-500)' }}>
                  Fetching live rate...
                </span>
              ) : (
                <>
                  <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 11, fontWeight: 700, color: 'var(--gold-dark)' }}>
                    <i className="ti ti-arrows-exchange" style={{ marginRight: 4 }} />
                    1 {currency} = ${rateInfo.rate.toFixed(4)} USD
                  </span>
                  <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 13, fontWeight: 700, color: 'var(--cardinal)' }}>
                    = ${amountUSD.toFixed(2)} USD
                  </span>
                </>
              )}
            </div>
          )}
          {isConverted && !rateLoading && (
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 10, color: 'var(--warm-300)', textAlign: 'right', marginTop: 3 }}>
              via {rateInfo.source}
            </div>
          )}
        </div>

        {/* Description + Date */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 8, marginBottom: 8 }}>
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
            style={{ fontSize: 11, padding: '12px 6px' }}
          />
        </div>

        {/* Category + Type */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <select className="form-select" value={category} onChange={e => setCategory(e.target.value)} style={{ fontSize: 13, padding: '10px 8px' }}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="form-select" value={type} onChange={e => setType(e.target.value)} style={{ fontSize: 13, padding: '10px 8px' }}>
            <option value="ge">Group expense</option>
            <option value="pe">Personal expense</option>
          </select>
        </div>

        {/* Split with */}
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
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--green)', marginTop: 6, textAlign: 'right', fontWeight: 600 }}>
                ${(amountUSD / participants.length).toFixed(2)} each · {participants.length} people
              </div>
            )}
          </div>
        )}

        {/* Number pad — calculator layout 1-2-3 top */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 8 }}>
          {[1,2,3,4,5,6,7,8,9].map(n => (
            <button key={n} className="kp-key" style={{ height: 48, fontSize: 22 }} onClick={() => kd(String(n))}>{n}</button>
          ))}
          <button className="kp-key wide" style={{ height: 48, fontSize: 22 }} onClick={() => kd('0')}>0</button>
          <button className="kp-key del" style={{ height: 48 }} onClick={() => kd('del')}>
            <i className="ti ti-backspace" style={{ fontSize: 20 }} />
          </button>
        </div>

        {/* Cancel / Save */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '14px', background: 'var(--warm-100)', color: 'var(--warm-800)', border: 'none', borderRadius: 13, fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700 }}>
            Cancel
          </button>
          <button
            className="kp-submit"
            style={{ margin: 0, padding: '14px', opacity: (!amount || !description.trim() || rateLoading) ? 0.45 : 1 }}
            onClick={handleSave}
            disabled={loading || !amount || !description.trim() || rateLoading}
          >
            {loading ? 'Saving...' : rateLoading ? 'Loading rate...' : 'Log Expense'}
          </button>
        </div>
      </div>
    </div>
  )
}
