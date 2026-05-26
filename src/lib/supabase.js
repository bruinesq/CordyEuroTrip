import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://nljurimtlzspxvvstltp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sanVyaW10bHpzcHh2dnN0bHRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDk3NzcsImV4cCI6MjA5NTM4NTc3N30.LQHr08qABCHwPG_-vUfTex-VfPfAci_ZFVKSbEHTaRw'
)

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'CHF', 'CZK', 'HUF', 'PLN', 'DKK', 'SEK', 'NOK']

export const CURRENCY_SYMBOLS = {
  USD: '$', EUR: '€', GBP: '£', CHF: '₣',
  CZK: 'Kč', HUF: 'Ft', PLN: 'zł', DKK: 'kr',
  SEK: 'kr', NOK: 'kr'
}

export const TRAVELER_COLORS = {
  Ava:     { bg: '#FFE8E8', text: '#990000' },
  Camille: { bg: '#FFF8D6', text: '#B8920A' },
  Cordy:   { bg: '#FDEDF2', text: '#C2476D' },
  Dillon:  { bg: '#EAF0FF', text: '#3B52CC' },
  Dylan:   { bg: '#F0E8FF', text: '#7B3CC3' },
  Melia:   { bg: '#E8F5EA', text: '#1B7A4A' },
  Reagan:  { bg: '#FFF0E8', text: '#C45E1A' },
  Tina:    { bg: '#FDF6EC', text: '#9A6C1A' },
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

export async function getExchangeRate(from, to = 'USD') {
  if (from === to) return 1
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`)
    const data = await res.json()
    return data.rates[to] ?? 1
  } catch {
    return 1
  }
}

export function fmtUSD(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount ?? 0)
}

export function initials(name) {
  return name?.slice(0, 2).toUpperCase() ?? '??'
}
