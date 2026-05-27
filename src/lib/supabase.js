import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://nljurimtlzspxvvstltp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sanVyaW10bHpzcHh2dnN0bHRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDk3NzcsImV4cCI6MjA5NTM4NTc3N30.LQHr08qABCHwPG_-vUfTex-VfPfAci_ZFVKSbEHTaRw'
)

export const CURRENCIES = ['USD', 'EUR']

export const CURRENCY_SYMBOLS = {
  USD: '$',
  EUR: '€',
}

export const TRAVELER_COLORS = {
  'Ava Dimond':          { bg: '#FFE8E8', text: '#990000' },
  'Camille Shaw':        { bg: '#FFF8D6', text: '#B8920A' },
  'Christina Toldalagi': { bg: '#FDEDF2', text: '#C2476D' },
  'Cordy Nguyen':        { bg: '#EAF0FF', text: '#3B52CC' },
  "Dillon O'Shea":      { bg: '#F0E8FF', text: '#7B3CC3' },
  'Dylan Mansourian':    { bg: '#E8F5EA', text: '#1B7A4A' },
  'Melia Harlan':        { bg: '#FFF0E8', text: '#C45E1A' },
  'Regan Ramsey':        { bg: '#FDF6EC', text: '#9A6C1A' },
}

export const CATEGORY_ICONS = {
  Hotel:      'ti-building',
  Meals:      'ti-tools-kitchen-2',
  Transport:  'ti-train',
  Activities: 'ti-ticket',
  Shopping:   'ti-shopping-bag',
  Drinks:     'ti-glass',
  Groceries:  'ti-shopping-cart',
  Other:      'ti-dots',
}

export const CATEGORY_COLORS = {
  Hotel:      { bg: '#FFE8E8', icon: '#990000' },
  Meals:      { bg: '#FFF0D6', icon: '#B8920A' },
  Transport:  { bg: '#EAF0FF', icon: '#3B52CC' },
  Activities: { bg: '#F0E8FF', icon: '#7B3CC3' },
  Shopping:   { bg: '#FDEDF2', icon: '#C2476D' },
  Drinks:     { bg: '#FFF0E8', icon: '#C45E1A' },
  Groceries:  { bg: '#E8F5EA', icon: '#1B7A4A' },
  Other:      { bg: '#F7F0E8', icon: '#8A7560' },
}

// Returns { rate, source } where rate is how many `to` units per 1 `from`
// e.g. getExchangeRate('EUR','USD') => { rate: 1.09, source: 'frankfurter' }
// meaning 1 EUR = 1.09 USD
export async function getExchangeRate(from, to = 'USD') {
  if (from === to) return { rate: 1, source: 'same currency' }

  // Primary: frankfurter.app
  try {
    const res = await fetch(
      `https://api.frankfurter.app/latest?from=${from}&to=${to}`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (res.ok) {
      const data = await res.json()
      const rate = data.rates?.[to]
      if (rate && rate > 0) {
        console.log(`[FX] frankfurter: 1 ${from} = ${rate} ${to}`)
        return { rate, source: 'frankfurter.app' }
      }
    }
  } catch (e) {
    console.warn('[FX] frankfurter failed:', e.message)
  }

  // Fallback: exchangerate.host
  try {
    const res = await fetch(
      `https://api.exchangerate.host/convert?from=${from}&to=${to}&amount=1`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (res.ok) {
      const data = await res.json()
      const rate = data.result
      if (rate && rate > 0) {
        console.log(`[FX] exchangerate.host: 1 ${from} = ${rate} ${to}`)
        return { rate, source: 'exchangerate.host' }
      }
    }
  } catch (e) {
    console.warn('[FX] exchangerate.host failed:', e.message)
  }

  // Hard fallback: approximate rate (updated May 2026)
  const FALLBACK_RATES = {
    'EUR_USD': 1.09,
    'USD_EUR': 0.917,
  }
  const key = `${from}_${to}`
  const rate = FALLBACK_RATES[key] ?? 1
  console.warn(`[FX] Using hardcoded fallback: 1 ${from} = ${rate} ${to}`)
  return { rate, source: 'fallback (offline)' }
}

export function fmtUSD(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount ?? 0)
}

export function initials(name) {
  if (!name) return '??'
  const parts = name.trim().split(' ')
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
}
