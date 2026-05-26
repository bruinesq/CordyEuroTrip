import { useState, useEffect } from 'react'
import { supabase, TRAVELER_COLORS, initials } from './lib/supabase'
import FlightsPage from './pages/FlightsPage'
import HotelsPage from './pages/HotelsPage'
import GroupExpensesPage from './pages/GroupExpensesPage'
import PersonalExpensesPage from './pages/PersonalExpensesPage'
import BalancesPage from './pages/BalancesPage'
import LogsPage from './pages/LogsPage'

const TABS = [
  { id: 'flights',  label: 'Flights',  icon: 'ti-plane' },
  { id: 'hotels',   label: 'Hotels',   icon: 'ti-building' },
  { id: 'group',    label: 'Group',    icon: 'ti-users' },
  { id: 'personal', label: 'Personal', icon: 'ti-lock' },
  { id: 'balances', label: 'Balances', icon: 'ti-scale' },
  { id: 'logs',     label: 'Logs',     icon: 'ti-list' },
]

const TAGLINES = [
  'Esquire. Abroad.',
  'Motion to adjourn — to Europe.',
  'Objection: too much fun.',
  'Bar-passed. Passport-stamped.',
  'Sustained. Also: rosé.',
  'Where the only briefs are bikini.',
  'Discovery phase: gelato.',
  'USC Trojans. Fight On. Check In.',
]

export default function App() {
  const [tab, setTab]                   = useState('flights')
  const [travelers, setTravelers]       = useState([])
  const [currentUser, setCurrentUser]   = useState(null)
  const [showUserPicker, setShowUserPicker] = useState(false)
  const [tagline] = useState(() => TAGLINES[Math.floor(Math.random() * TAGLINES.length)])

  useEffect(() => {
    loadTravelers()
    const saved = localStorage.getItem('eurotrip_user')
    if (saved) setCurrentUser(JSON.parse(saved))
    else setShowUserPicker(true)
  }, [])

  async function loadTravelers() {
    const { data } = await supabase
      .from('travelers')
      .select('*')
      .order('name', { ascending: true })
    setTravelers(data ?? [])
  }

  function selectUser(traveler) {
    setCurrentUser(traveler)
    localStorage.setItem('eurotrip_user', JSON.stringify(traveler))
    setShowUserPicker(false)
  }

  if (showUserPicker) {
    return (
      <div className="app">
        <div style={{
          background: 'var(--cardinal)',
          padding: '52px 20px 24px',
          textAlign: 'center',
        }}>
          <div style={{
            fontFamily: 'Syne, sans-serif',
            fontSize: 28, fontWeight: 800,
            color: '#fff',
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
          }}>
            ✈ EuroTrip 2026
          </div>
          <div style={{
            fontFamily: 'Syne, sans-serif',
            fontSize: 11, fontWeight: 700,
            color: 'var(--gold)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginTop: 6,
          }}>
            {tagline}
          </div>
          <div style={{
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: 10, color: 'rgba(255,255,255,0.5)',
            marginTop: 4,
          }}>
            USC Gould School of Law · Class Reunion
          </div>
        </div>

        <div style={{ padding: '24px 18px' }}>
          <div style={{
            fontFamily: 'Syne, sans-serif',
            fontSize: 13, fontWeight: 800,
            color: 'var(--warm-500)',
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            marginBottom: 14,
            textAlign: 'center',
          }}>
            Who are you, counselor?
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {travelers.map(t => {
              const c = TRAVELER_COLORS[t.name] ?? { bg: '#FFE8E8', text: '#990000' }
              return (
                <button
                  key={t.id}
                  onClick={() => selectUser(t)}
                  style={{
                    padding: '14px 12px',
                    border: '1.5px solid var(--warm-200)',
                    borderRadius: 14,
                    background: '#fff',
                    display: 'flex', alignItems: 'center', gap: 10,
                    fontFamily: 'Syne, sans-serif',
                    fontSize: 14, fontWeight: 700,
                    color: 'var(--warm-800)',
                  }}
                >
                  <div className="avatar" style={{ background: c.bg, color: c.text }}>
                    {initials(t.name)}
                  </div>
                  {t.name}
                </button>
              )
            })}
          </div>
          <div style={{
            marginTop: 28,
            textAlign: 'center',
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: 10,
            color: 'var(--warm-300)',
          }}>
            Fight On ✌ · 8 Trojans · 1 Europe
          </div>
        </div>
      </div>
    )
  }

  const userColor = TRAVELER_COLORS[currentUser?.name] ?? { bg: '#FFE8E8', text: '#990000' }
  const pageProps = { currentUser, travelers }

  return (
    <div className="app">
      <div className="topbar">
        <div>
          <div className="topbar-title">✈ EuroTrip 2026</div>
          <div className="topbar-subtitle">{tagline}</div>
        </div>
        <button
          onClick={() => setShowUserPicker(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: 99, padding: '5px 10px 5px 5px',
            fontFamily: 'Syne, sans-serif',
            fontSize: 13, fontWeight: 700, color: '#fff',
          }}
        >
          <div className="avatar avatar-sm" style={{ background: userColor.bg, color: userColor.text }}>
            {initials(currentUser?.name)}
          </div>
          {currentUser?.name}
        </button>
      </div>

      <div className="content" style={{ padding: 0 }}>
        {tab === 'flights'  && <div style={{ padding: '14px 12px' }}><FlightsPage  {...pageProps} /></div>}
        {tab === 'hotels'   && <div style={{ padding: '14px 12px' }}><HotelsPage   {...pageProps} /></div>}
        {tab === 'group'    && <div style={{ padding: '14px 12px' }}><GroupExpensesPage {...pageProps} /></div>}
        {tab === 'personal' && <div style={{ padding: '14px 12px' }}><PersonalExpensesPage {...pageProps} /></div>}
        {tab === 'balances' && <div style={{ padding: '14px 12px' }}><BalancesPage {...pageProps} /></div>}
        {tab === 'logs'     && <div style={{ padding: '14px 12px' }}><LogsPage     {...pageProps} /></div>}
      </div>

      <nav className="bottom-nav">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`nav-item ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <i className={`ti ${t.icon}`} />
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
