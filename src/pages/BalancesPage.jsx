import { useState, useEffect } from 'react'
import { supabase, TRAVELER_COLORS, initials, fmtUSD } from '../lib/supabase'

export default function BalancesPage({ currentUser, travelers }) {
  const [expenses, setExpenses] = useState([])
  const [settlements, setSettlements] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: exp }, { data: sett }] = await Promise.all([
      supabase.from('group_expenses').select('*, group_expense_participants(traveler_id, share_usd)').order('expense_date'),
      supabase.from('settlements').select('*')
    ])
    setExpenses(exp ?? [])
    setSettlements(sett ?? [])
    setLoading(false)
  }

  function calcBalances() {
    const paid = {}, owed = {}
    travelers.forEach(t => { paid[t.id] = 0; owed[t.id] = 0 })
    expenses.forEach(e => {
      if (paid[e.paid_by] !== undefined) paid[e.paid_by] += e.amount_usd ?? 0
      e.group_expense_participants?.forEach(p => {
        if (owed[p.traveler_id] !== undefined) owed[p.traveler_id] += p.share_usd ?? 0
      })
    })
    return travelers.map(t => ({
      ...t,
      paid: paid[t.id] ?? 0,
      owed: owed[t.id] ?? 0,
      net: (paid[t.id] ?? 0) - (owed[t.id] ?? 0),
    })).sort((a, b) => b.net - a.net)
  }

  function calcSettlements() {
    const balances = calcBalances()
    const creditors = balances.filter(b => b.net > 0.01).map(b => ({ ...b, remaining: b.net }))
    const debtors   = balances.filter(b => b.net < -0.01).map(b => ({ ...b, remaining: -b.net }))
    const transfers = []
    let ci = 0, di = 0
    while (ci < creditors.length && di < debtors.length) {
      const c = creditors[ci], d = debtors[di]
      const amt = Math.min(c.remaining, d.remaining)
      if (amt > 0.01) {
        const existing = settlements.find(s => s.payer_id === d.id && s.payee_id === c.id)
        transfers.push({ from: d, to: c, amount: parseFloat(amt.toFixed(2)), settled: existing?.settled ?? false, settlementId: existing?.id })
      }
      c.remaining -= amt; d.remaining -= amt
      if (c.remaining < 0.01) ci++
      if (d.remaining < 0.01) di++
    }
    return transfers
  }

  async function markSettled(transfer) {
    if (transfer.settlementId) {
      await supabase.from('settlements').update({ settled: !transfer.settled, settled_at: !transfer.settled ? new Date().toISOString() : null }).eq('id', transfer.settlementId)
    } else {
      await supabase.from('settlements').insert({ payer_id: transfer.from.id, payee_id: transfer.to.id, amount_usd: transfer.amount, settled: true, settled_at: new Date().toISOString() })
    }
    await load()
  }

  const balances  = calcBalances()
  const transfers = calcSettlements()
  const totalGroup = expenses.reduce((s, e) => s + (e.amount_usd ?? 0), 0)

  // Total each traveler actually owes (their real share across all expenses)
  const totalOwed = balances.reduce((s, b) => s + b.owed, 0)
  const participantCount = balances.filter(b => b.owed > 0).length

  return (
    <>
      <div className="metrics">
        <div className="metric">
          <div className="metric-label">Group total</div>
          <div className="metric-value">{fmtUSD(totalGroup)}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Active participants</div>
          <div className="metric-value">{participantCount} travelers</div>
        </div>
      </div>

      <div className="section-label">Settlement summary</div>
      {loading ? <div className="loading">Loading…</div> : transfers.length === 0 ? (
        <div className="empty"><i className="ti ti-circle-check" /><p>All settled up!</p></div>
      ) : (
        <div className="card" style={{ marginBottom: 14 }}>
          {transfers.map((t, i) => {
            const fc = TRAVELER_COLORS[t.from.name] ?? { bg: '#FFE8E8', text: '#990000' }
            const tc = TRAVELER_COLORS[t.to.name]   ?? { bg: '#FFE8E8', text: '#990000' }
            return (
              <div key={i} className="row">
                <div className="row-left" style={{ gap: 6, flexWrap: 'wrap' }}>
                  <div className="avatar avatar-sm" style={{ background: fc.bg, color: fc.text }}>{initials(t.from.name)}</div>
                  <span className="fs12 syne fw6">{t.from.name.split(' ')[0]}</span>
                  <i className="ti ti-arrow-right" style={{ fontSize: 13, color: 'var(--warm-300)' }} />
                  <div className="avatar avatar-sm" style={{ background: tc.bg, color: tc.text }}>{initials(t.to.name)}</div>
                  <span className="fs12 syne fw6">{t.to.name.split(' ')[0]}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span className="fw6 fs13 mono" style={{ color: t.settled ? 'var(--green)' : 'var(--red-err)' }}>{fmtUSD(t.amount)}</span>
                  <button
                    onClick={() => markSettled(t)}
                    className="badge"
                    style={{ background: t.settled ? '#E8F5EA' : '#FFE8E8', color: t.settled ? 'var(--green)' : 'var(--cardinal)', border: 'none', cursor: 'pointer' }}
                  >
                    {t.settled ? 'Settled' : 'Unsettled'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="section-label">Who paid what</div>
      <div className="card">
        {balances.map(b => {
          const c = TRAVELER_COLORS[b.name] ?? { bg: '#FFE8E8', text: '#990000' }
          return (
            <div key={b.id} className="row">
              <div className="row-left">
                <div className="avatar" style={{ background: c.bg, color: c.text }}>{initials(b.name)}</div>
                <div>
                  <div className="fs13 fw6 syne">{b.name}</div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--warm-500)', marginTop: 2 }}>
                    Paid {fmtUSD(b.paid)} · owes {fmtUSD(b.owed)}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div className="fw6 fs13 mono" style={{ color: b.net >= 0 ? 'var(--green)' : 'var(--red-err)' }}>
                  {b.net >= 0 ? '+' : ''}{fmtUSD(b.net)}
                </div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--warm-500)' }}>
                  {b.net >= 0 ? 'is owed' : 'owes'}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
