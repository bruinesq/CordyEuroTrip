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

  const canSave = amount > 0 && description.trim().length > 0 && !rateLoading

  // Shared input style
  const inputStyle = {
    background: '#1e4a34',
    border: '1.5px solid rgba(255,255,255,.25)',
    borderRadius: 10,
    padding: '11px 13px',
    fontFamily: 'Syne, sans-serif',
    fontSize: 14,
    fontWeight: 600,
    color: '#ffffff',
    outline: 'none',
    width: '100%',
  }

  const selectStyle = {
    ...inputStyle,
    appearance: 'none',
    fontSize: 12,
    padding: '11px 10px',
  }

  const keyStyle = {
    height: 54,
    borderRadius: 10,
    border: 'none',
    fontFamily: 'Syne, sans-serif',
    fontSize: 26,
    fontWeight: 700,
    background: '#5a8a70',
    color: '#ffffff',
    cursor: 'pointer',
  }

  return (
    // Full-screen overlay
    <div style={{
      position: 'fixed', inset: 0, zIndex: 900,
      background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '12px',
    }}>
      {/* Floating dark-green card */}
      <div style={{
        background: '#0d2b1f',
        borderRadius: 16,
        boxShadow: '0 8px 40px rgba(0,0,0,0.55)',
        width: 'min(96vw, 420px)',
        maxHeight: '92vh',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        zIndex: 910,
      }}>
        {/* Handle bar */}
        <div style={{ width: 32, height: 3, background: 'rgba(255,255,255,.2)', borderRadius: 99, margin: '14px auto 0' }} />

        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px 0' }}>
          <div style={{
            fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 800,
            color: '#e8c84a', textTransform: 'uppercase', letterSpacing: '.08em',
          }}>
            Log Expense
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)',
            borderRadius: 99, padding: '5px 14px',
            fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 700,
            color: 'rgba(255,255,255,.75)', cursor: 'pointer',
          }}>Cancel</button>
        </div>

        <div style={{ padding: '10px 14px 16px' }}>

          {/* ── Amount box ── */}
          <div style={{
            background: '#1e4a34', border: '1.5px solid rgba(255,255,255,.25)',
            borderRadius: 10, padding: '10px 14px', marginBottom: 8,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontSize: 10, fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'rgba(255,255,255,.75)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                Amount
              </div>
              {/* Currency toggle */}
              <div style={{ display: 'flex', gap: 5 }}>
                {CURRENCIES.map(c => (
                  <button key={c} onClick={() => setCurrency(c)} style={{
                    padding: '3px 10px', borderRadius: 99, border: 'none',
                    fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, fontWeight: 700,
                    background: currency === c ? '#e8c84a' : 'rgba(255,255,255,.12)',
                    color: currency === c ? '#0d2b1f' : 'rgba(255,255,255,.75)',
                    cursor: 'pointer',
                  }}>{c} {CURRENCY_SYMBOLS[c]}</button>
                ))}
              </div>
            </div>

            {/* Large amount */}
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 34, fontWeight: 700, color: '#f0e080', textAlign: 'right' }}>
              <span style={{ fontSize: 16, color: '#e8c84a', marginRight: 3 }}>{sym}</span>
              {amount.toFixed(2)}
            </div>

            {/* Conversion banner */}
            {isConverted && (
              <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, background: '#2a5040', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {rateLoading ? (
                  <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 11, color: 'rgba(255,255,255,.65)' }}>Fetching live rate…</span>
                ) : (
                  <>
                    <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.75)' }}>
                      1 {currency} = ${rateInfo.rate.toFixed(4)} USD
                    </span>
                    <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 13, fontWeight: 700, color: '#f0e080' }}>
                      = ${amountUSD.toFixed(2)}
                    </span>
                  </>
                )}
              </div>
            )}
            {isConverted && !rateLoading && (
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 10, color: 'rgba(255,255,255,.5)', textAlign: 'right', marginTop: 3 }}>
                via {rateInfo.source}
              </div>
            )}
          </div>

          {/* ── Description + Date ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 116px', gap: 7, marginBottom: 7 }}>
            <input
              ref={descRef}
              placeholder="Description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              autoFocus
              style={{ ...inputStyle, fontSize: 14 }}
              onFocus={e => e.target.style.borderColor = '#e8c84a'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,.25)'}
            />
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              style={{ ...inputStyle, fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, padding: '11px 7px' }}
              onFocus={e => e.target.style.borderColor = '#e8c84a'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,.25)'}
            />
          </div>

          {/* ── Category + Type ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 7 }}>
            <select value={category} onChange={e => setCategory(e.target.value)} style={selectStyle}>
              {CATEGORIES.map(c => <option key={c} value={c} style={{ background: '#1e4a34' }}>{c}</option>)}
            </select>
            <select value={type} onChange={e => setType(e.target.value)} style={selectStyle}>
              <option value="ge" style={{ background: '#1e4a34' }}>Group expense</option>
              <option value="pe" style={{ background: '#1e4a34' }}>Personal expense</option>
            </select>
          </div>

          {/* ── Split with (group only) ── */}
          {type === 'ge' && (
            <div style={{
              background: '#1e4a34', border: '1.5px solid rgba(255,255,255,.25)',
              borderRadius: 10, padding: 10, marginBottom: 8,
            }}>
              <div style={{ fontSize: 10, fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'rgba(255,255,255,.75)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
                Split with
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 5 }}>
                {travelers.map(t => {
                  const sel = participants.includes(t.id)
                  return (
                    <button key={t.id} onClick={() => toggleParticipant(t.id)} style={{
                      padding: '6px 3px', borderRadius: 8,
                      border: sel ? 'none' : '1px solid rgba(255,255,255,.5)',
                      fontFamily: 'Syne, sans-serif', fontSize: 10, fontWeight: 700,
                      background: sel ? '#e8c84a' : 'transparent',
                      color: sel ? '#0d2b1f' : 'rgba(255,255,255,.85)',
                      cursor: 'pointer',
                    }}>
                      {t.name.split(' ')[0]}
                    </button>
                  )
                })}
              </div>
              {participants.length > 0 && amount > 0 && (
                <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: '#f0e080', marginTop: 8, textAlign: 'right', fontWeight: 700 }}>
                  ${(amountUSD / participants.length).toFixed(2)} each · {participants.length} people
                </div>
              )}
            </div>
          )}

          {/* ── Number pad — calculator order 1-2-3 top ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 7, marginBottom: 8 }}>
            {[1,2,3,4,5,6,7,8,9].map(n => (
              <button key={n} onClick={() => kd(String(n))} style={keyStyle}>{n}</button>
            ))}
            <button onClick={() => setRaw('')} style={{ ...keyStyle, fontSize: 12 }}>Clear</button>
            <button onClick={() => kd('0')} style={keyStyle}>0</button>
            <button onClick={() => kd('del')} style={{ ...keyStyle, background: '#c0392b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="ti ti-backspace" style={{ fontSize: 22 }} />
            </button>
          </div>

          {/* ── Save button ── */}
          <button
            onClick={handleSave}
            disabled={!canSave || loading}
            style={{
              width: '100%', height: 50, borderRadius: 12, border: 'none',
              background: canSave && !loading ? '#e8c84a' : 'rgba(232,200,74,0.25)',
              color: canSave && !loading ? '#0d2b1f' : 'rgba(255,255,255,.35)',
              fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 800,
              letterSpacing: '.03em',
              cursor: canSave && !loading ? 'pointer' : 'default',
              transition: 'all 0.15s',
            }}
          >
            {loading ? 'Saving…' : rateLoading ? 'Loading rate…' :
              amount > 0
                ? `Save · ${currency === 'USD' ? `$${amountUSD.toFixed(2)}` : `${sym}${amount.toFixed(2)} → $${amountUSD.toFixed(2)}`}`
                : 'Enter an amount'
            }
          </button>

        </div>
      </div>
    </div>
  )
}
