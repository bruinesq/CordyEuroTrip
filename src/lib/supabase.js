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

// High-contrast, sharply distinguishable palette — 8 unique themes
export const TRAVELER_COLORS = {
  'Ava Dimond':          { bg: '#990000', text: '#FFFFFF', light: '#FFE8E8', lightText: '#990000' },
  'Camille Shaw':        { bg: '#1A5C2A', text: '#FFFFFF', light: '#E3F5E8', lightText: '#1A5C2A' },
  'Christina Toldalagi': { bg: '#1A3A7C', text: '#FFFFFF', light: '#E6EDFB', lightText: '#1A3A7C' },
  'Cordy Nguyen':        { bg: '#7B2D8B', text: '#FFFFFF', light: '#F5E6FA', lightText: '#7B2D8B' },
  "Dillon O'Shea":      { bg: '#C45E1A', text: '#FFFFFF', light: '#FDF0E6', lightText: '#C45E1A' },
  'Dylan Mansourian':    { bg: '#0D6B7A', text: '#FFFFFF', light: '#E3F5F8', lightText: '#0D6B7A' },
  'Melia Harlan':        { bg: '#8B1A4A', text: '#FFFFFF', light: '#FAE6EF', lightText: '#8B1A4A' },
  'Regan Ramsey':        { bg: '#3D3D00', text: '#FFFFFF', light: '#F8F8E3', lightText: '#3D3D00' },
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
  if (from === to) return { rate: 1, source: 'same currency' }
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
  const FALLBACK = { 'EUR_USD': 1.09, 'USD_EUR': 0.917 }
  const rate = FALLBACK[`${from}_${to}`] ?? 1
  console.warn(`[FX] fallback: 1 ${from} = ${rate} ${to}`)
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

export function userTheme(name) {
  return TRAVELER_COLORS[name] ?? { bg: '#444441', text: '#FFFFFF', light: '#F1EFE8', lightText: '#444441' }
}
