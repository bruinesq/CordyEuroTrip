import { useState, useEffect, useRef } from 'react'
import { CURRENCIES, getExchangeRate } from '../lib/supabase'

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
  const [showValidation, setShowValidation] = useState(false)
  const descRef = useRef(null)

  useEffect(() => {
    if (currency === 'USD') { setRateInfo({ rate: 1, source: 'same currency' }); return }
    setRateLoading(true)
    getExchangeRate(currency, 'USD').then(info => { setRateInfo(info); setRateLoading(false) })
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
    if (!amount || !description.trim()) {
      setShowValidation(true)
      if (descRef.current) descRef.current.focus()
      return
    }
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

  // Compact shared styles — tighter padding for iPhone
  const inp = {
    background: '#1e4a34', border: '1.5px solid rgba(255,255,255,.25)',
    borderRadius: 9, padding: '8px 11px',
    fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 600,
    color: '#ffffff', outline: 'none', width: '100%',
  }
  const sel = { ...inp, appearance: 'none', fontSize: 12, padding: '8px 9px' }
  const lbl = {
    fontFamily: 'Syne, sans-serif', fontSize: 9, fontWeight: 700,
    color: 'rgba(255,255,255,.7)', textTransform: 'uppercase',
    letterSpacing: '.05em', marginBottom: 3, display: 'block',
  }
  const key = {
    height: 44, borderRadius: 9, border: 'none',
    fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 700,
    background: '#5a8a70', color: '#ffffff', cursor: 'pointer',
  }
  const fg = e => e.target.style.borderColor = '#e8c84a'
  const bg = e => e.target.style.borderColor = 'rgba(255,255,255,.25)'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 900,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '8px',
    }}>
      <div style={{
        background: '#0d2b1f', borderRadius: 16,
        boxShadow: '0 8px 40px rgba(0,0,0,0.55)',
        width: 'min(96vw, 390px)',
        maxHeight: 'calc(100vh - 16px)',
        overflowY: 'auto', WebkitOverflowScrolling: 'touch', zIndex: 910,
      }}>
        {/* Handle */}
        <div style={{ width: 28, height: 3, background: 'rgba(255,255,255,.2)', borderRadius: 99, margin: '10px auto 0' }} />

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px 0' }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 800, color: '#e8c84a', textTransform: 'uppercase', letterSpacing: '.08em' }}>
            Log Expense
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,.75)', fontSize: 14 }}>
            <i className="ti ti-x" />
          </button>
        </div>

        <div style={{ padding: '8px 12px 12px' }}>

          {/* ── Amount box ── */}
          <div style={{ background: '#1e4a34', border: '1.5px solid rgba(255,255,255,.25)', borderRadius: 9, padding: '7px 12px', marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontSize: 9, fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'rgba(255,255,255,.7)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Amount</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {CURRENCIES.map(c => (
                  <button key={c} onClick={() => setCurrency(c)} style={{
                    padding: '2px 8px', borderRadius: 99, border: 'none',
                    fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, fontWeight: 700,
                    background: currency === c ? '#e8c84a' : 'rgba(255,255,255,.12)',
                    color: currency === c ? '#0d2b1f' : 'rgba(255,255,255,.75)',
                    cursor: 'pointer',
                  }}>{c} {CURRENCY_SYMBOLS[c]}</button>
                ))}
              </div>
            </div>
            {/* Amount display */}
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 28, fontWeight: 700, color: '#f0e080', textAlign: 'right', lineHeight: 1 }}>
              <span style={{ fontSize: 13, color: '#e8c84a', marginRight: 2 }}>{sym}</span>{amount.toFixed(2)}
            </div>
            {/* Conversion */}
            {isConverted && (
              <div style={{ marginTop: 5, padding: '4px 8px', borderRadius: 7, background: '#2a5040', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {rateLoading ? (
                  <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 10, color: 'rgba(255,255,255,.65)' }}>Fetching rate…</span>
                ) : (
                  <>
                    <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.75)' }}>1 {currency} = ${rateInfo.rate.toFixed(4)}</span>
                    <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, fontWeight: 700, color: '#f0e080' }}>= ${amountUSD.toFixed(2)}</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── Description + Date (same row) ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 6, marginBottom: 6 }}>
            <div>
              <span style={lbl}>Description *</span>
              <input ref={descRef} placeholder="What was this for?"
                value={description} onChange={e => setDescription(e.target.value)} autoFocus
                style={{ ...inp, borderColor: !description.trim() && showValidation ? '#c0392b' : 'rgba(255,255,255,.25)' }}
                onFocus={fg} onBlur={bg} />
            </div>
            <div>
              <span style={lbl}>Date</span>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                style={{ ...inp, fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, padding: '8px 5px' }}
                onFocus={fg} onBlur={bg} />
            </div>
          </div>
          {showValidation && !description.trim() && (
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 10, color: '#fca5a5', fontWeight: 700, marginBottom: 4, marginTop: -3 }}>
              ⚠️ Description is required
            </div>
          )}

          {/* ── Category + Type (same row) ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
            <div>
              <span style={lbl}>Category</span>
              <select value={category} onChange={e => setCategory(e.target.value)} style={sel} onFocus={fg} onBlur={bg}>
                {CATEGORIES.map(c => <option key={c} value={c} style={{ background: '#1e4a34' }}>{c}</option>)}
              </select>
            </div>
            <div>
              <span style={lbl}>Type</span>
              <select value={type} onChange={e => setType(e.target.value)} style={sel} onFocus={fg} onBlur={bg}>
                <option value="ge" style={{ background: '#1e4a34' }}>Group</option>
                <option value="pe" style={{ background: '#1e4a34' }}>Personal</option>
              </select>
            </div>
          </div>

          {/* ── Split with ── */}
          {type === 'ge' && (
            <div style={{ background: '#1e4a34', border: '1.5px solid rgba(255,255,255,.25)', borderRadius: 9, padding: '7px 9px', marginBottom: 6 }}>
              <div style={{ fontSize: 9, fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'rgba(255,255,255,.7)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
                Split with
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4 }}>
                {travelers.map(t => {
                  const s = participants.includes(t.id)
                  return (
                    <button key={t.id} onClick={() => toggleParticipant(t.id)} style={{
                      padding: '5px 2px', borderRadius: 7,
                      border: s ? 'none' : '1px solid rgba(255,255,255,.5)',
                      fontFamily: 'Syne, sans-serif', fontSize: 9, fontWeight: 700,
                      background: s ? '#e8c84a' : 'transparent',
                      color: s ? '#0d2b1f' : 'rgba(255,255,255,.85)', cursor: 'pointer',
                    }}>{t.name.split(' ')[0]}</button>
                  )
                })}
              </div>
              {participants.length > 0 && amount > 0 && (
                <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: '#f0e080', marginTop: 5, textAlign: 'right', fontWeight: 700 }}>
                  ${(amountUSD / participants.length).toFixed(2)} each · {participants.length} people
                </div>
              )}
            </div>
          )}

          {/* ── Numpad — 1-2-3 top, compact ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 5, marginBottom: 6 }}>
            {[1,2,3,4,5,6,7,8,9].map(n => (
              <button key={n} onClick={() => kd(String(n))} style={key}>{n}</button>
            ))}
            <button onClick={() => setRaw('')} style={{ ...key, fontSize: 11 }}>Clear</button>
            <button onClick={() => kd('0')} style={key}>0</button>
            <button onClick={() => kd('del')} style={{ ...key, background: '#c0392b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="ti ti-backspace" style={{ fontSize: 20 }} />
            </button>
          </div>

          {/* ── Save button — sticky at bottom ── */}
          <button onClick={handleSave} disabled={loading || rateLoading} style={{
            width: '100%', height: 46, borderRadius: 11, border: 'none',
            background: amount > 0 && !loading && !rateLoading ? '#e8c84a' : 'rgba(232,200,74,0.25)',
            color: amount > 0 && !loading && !rateLoading ? '#0d2b1f' : 'rgba(255,255,255,.35)',
            fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 800, letterSpacing: '.03em',
            cursor: loading || rateLoading ? 'default' : 'pointer', transition: 'all 0.15s',
          }}>
            {loading ? 'Saving…' : rateLoading ? 'Loading rate…' :
              !amount ? 'Enter an amount' :
              !description.trim() ? 'Enter a description ↑' :
              `Save · ${currency === 'USD' ? `$${amountUSD.toFixed(2)}` : `${sym}${amount.toFixed(2)} → $${amountUSD.toFixed(2)}`}`
            }
          </button>

        </div>
      </div>
    </div>
  )
}
