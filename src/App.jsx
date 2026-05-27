import { useState, useEffect } from 'react'
import { supabase, userTheme, initials } from './lib/supabase'
import FlightsPage from './pages/FlightsPage'
import HotelsPage from './pages/HotelsPage'
import GroupExpensesPage from './pages/GroupExpensesPage'
import PersonalExpensesPage from './pages/PersonalExpensesPage'
import BalancesPage from './pages/BalancesPage'
import LogsPage from './pages/LogsPage'
import SettingsPage from './pages/SettingsPage'

const TABS = [
  { id: 'flights',  label: 'Flights',  icon: 'ti-plane' },
  { id: 'hotels',   label: 'Hotels',   icon: 'ti-building' },
  { id: 'group',    label: 'Group',    icon: 'ti-users' },
  { id: 'personal', label: 'Personal', icon: 'ti-lock' },
  { id: 'balances', label: 'Balances', icon: 'ti-scale' },
  { id: 'logs',     label: 'Logs',     icon: 'ti-list' },
  { id: 'settings', label: 'Settings', icon: 'ti-settings' },
]

const TAGLINES = [
  'Esquire. Abroad.',
  'Motion to adjourn — to Europe.',
  'Objection: too much fun.',
  'Bar-passed. Passport-stamped.',
  'Sustained. Also: rose.',
  'Where the only briefs are bikini.',
  'Discovery phase: gelato.',
  'USC Trojans. Fight On. Check In.',
]

const DEFAULT_TRIP = 'EuroTrip 2026'

export default function App() {
  const [tab, setTab] = useState('flights')
  const [travelers, setTravelers] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [showUserPicker, setShowUserPicker] = useState(false)
  const [tagline] = useState(() => TAGLINES[Math.floor(Math.random() * TAGLINES.length)])
  const [tripName, setTripName] = useState(() => localStorage.getItem('eurotrip_name') ?? DEFAULT_TRIP)

  useEffect(() => {
    loadTravelers()
    const saved = localStorage.getItem('eurotrip_user')
    if (saved) setCurrentUser(JSON.parse(saved))
    else setShowUserPicker(true)
  }, [])

  async function loadTravelers() {
    const { data } = await supabase.from('travelers').select('*').order('name', { ascending: true })
    setTravelers(data ?? [])
  }

  function selectUser(traveler) {
    setCurrentUser(traveler)
    localStorage.setItem('eurotrip_user', JSON.stringify(traveler))
    setShowUserPicker(false)
  }

  function handleTripNameChange(name) {
    setTripName(name)
    localStorage.setItem('eurotrip_name', name)
  }

  function refreshUser(updatedUser) {
    setCurrentUser(updatedUser)
    localStorage.setItem('eurotrip_user', JSON.stringify(updatedUser))
    loadTravelers()
  }

  if (showUserPicker) {
    return (
      <div className="app">
        <div style={{ background: 'var(--cardinal)', padding: '52px 20px 28px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            {tripName}
          </div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 11, fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 6 }}>
            {tagline}
          </div>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
            USC Gould School of Law · Celebration 2026
          </div>
        </div>
        <div style={{ padding: '20px 16px', overflowY: 'auto', flex: 1 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 800, color: 'var(--warm-500)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12, textAlign: 'center' }}>
            Who are you, counselor?
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {travelers.map(t => {
              const theme = userTheme(t.name)
              return (
                <button
                  key={t.id}
                  onClick={() => selectUser(t)}
                  style={{
                    padding: '0',
                    border: 'none',
                    borderRadius: 14,
                    background: theme.bg,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    overflow: 'hidden',
                    minHeight: 90,
                  }}
                >
                  <div style={{
                    fontFamily: 'Syne, sans-serif',
                    fontSize: 28,
                    fontWeight: 800,
                    color: theme.text,
                    lineHeight: 1,
                  }}>
                    {initials(t.name)}
                  </div>
                  <div style={{
                    fontFamily: 'Syne, sans-serif',
                    fontSize: 11,
                    fontWeight: 700,
                    color: theme.text,
                    opacity: 0.85,
                    paddingBottom: 12,
                    textAlign: 'center',
                    padding: '0 8px 12px',
                  }}>
                    {t.name.split(' ')[0]}
                  </div>
                </button>
              )
            })}
          </div>
          <div style={{ marginTop: 20, textAlign: 'center', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: 'var(--warm-300)' }}>
            Fight On · {travelers.length} Trojans · 1 Europe
          </div>
        </div>
      </div>
    )
  }

  const theme = userTheme(currentUser?.name)
  const pageProps = { currentUser, travelers, refreshUser }

  return (
    <div className="app">
      <div className="topbar" style={{ background: theme.bg }}>
        <div>
          <div className="topbar-title" style={{ color: theme.text }}>{tripName}</div>
          <div className="topbar-subtitle" style={{ color: theme.text, opacity: 0.7 }}>{tagline}</div>
        </div>
        <button
          onClick={() => setShowUserPicker(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: 'rgba(255,255,255,0.2)',
            border: '1.5px solid rgba(255,255,255,0.4)',
            borderRadius: 99, padding: '5px 12px 5px 5px',
            fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 700,
            color: theme.text, cursor: 'pointer',
          }}
        >
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'rgba(255,255,255,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Syne, sans-serif', fontSize: 11, fontWeight: 800, color: theme.text,
          }}>
            {initials(currentUser?.name)}
          </div>
          {currentUser?.name?.split(' ')[0]}
        </button>
      </div>

      <div className="content-scroll">
        {tab === 'flights'  && <FlightsPage  {...pageProps} />}
        {tab === 'hotels'   && <HotelsPage   {...pageProps} />}
        {tab === 'group'    && <GroupExpensesPage {...pageProps} defaultType="ge" />}
        {tab === 'personal' && <PersonalExpensesPage {...pageProps} />}
        {tab === 'balances' && <BalancesPage {...pageProps} />}
        {tab === 'logs'     && <LogsPage     {...pageProps} />}
        {tab === 'settings' && <SettingsPage {...pageProps} tripName={tripName} onTripNameChange={handleTripNameChange} onReload={loadTravelers} />}
      </div>

      <nav className="bottom-nav">
        {TABS.map(t => {
          const isActive = tab === t.id
          return (
            <button
              key={t.id}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
              style={isActive ? { color: theme.bg } : {}}
            >
              <i className={`ti ${t.icon}`} style={isActive ? { color: theme.bg } : {}} />
              {t.label}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
