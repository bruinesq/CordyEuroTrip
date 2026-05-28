# EuroTrip 2026 — App README & Dev Log

> USC Gould School of Law · Group Trip Expense Tracker
> Built with React + Vite · Supabase · GitHub Pages

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Infrastructure](#infrastructure)
3. [Travelers & Credentials](#travelers--credentials)
4. [Database Schema](#database-schema)
5. [App Architecture](#app-architecture)
6. [Feature Reference](#feature-reference)
7. [PIN System](#pin-system)
8. [Dev Log — Change History](#dev-log--change-history)
9. [How to Resume Development](#how-to-resume-development)
10. [Pending / Future Work](#pending--future-work)

---

## Project Overview

A mobile-first React web app for 8 USC law school friends to track shared and personal expenses, flights, and hotels during their 2026 European trip. Built as a Progressive Web App (PWA-style) deployed on GitHub Pages with a Supabase backend.

**Live app:** `https://[github-username].github.io/eurotrip2026`

**Design theme:** USC cardinal & gold palette, Syne font for headings, IBM Plex Mono for numbers, warm cream backgrounds.

---

## Infrastructure

| Service | Purpose | Details |
|---|---|---|
| **Supabase** | Database + Auth | Project: `EuroTrip` · URL: `https://nljurimtlzspxvvstltp.supabase.co` |
| **GitHub Pages** | Hosting | Auto-deploys via GitHub Actions on every push to `main` |
| **Frankfurter API** | Live FX rates | `api.frankfurter.app` — EUR↔USD conversion at time of entry |
| **Web Crypto API** | PIN hashing | Native browser SHA-256, no external crypto library needed |

**Supabase anon key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sanVyaW10bHpzcHh2dnN0bHRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDk3NzcsImV4cCI6MjA5NTM4NTc3N30.LQHr08qABCHwPG_-vUfTex-VfPfAci_ZFVKSbEHTaRw`

> Note: The anon key is safe to commit — Supabase Row Level Security enforces data access at the database layer.

---

## Travelers & Credentials

**Master PIN:** `1515`
- Gates: trip name changes, user name changes, data reset
- Also silently unlocks ALL travelers' Flight Notes and Personal Expenses when entered at any PIN prompt

**8 Travelers (full names as stored in DB):**

| First Name | Full Name | Color Theme |
|---|---|---|
| Ava | Ava Dimond | Cardinal `#990000` |
| Camille | Camille Shaw | Forest `#1A5C2A` |
| Tina | Christina Toldalagi | Navy `#1A3A7C` |
| Cordy | Cordy Nguyen | Purple `#7B2D8B` |
| Dillon | Dillon O'Shea | Burnt Orange `#C45E1A` |
| Dylan | Dylan Mansourian | Teal `#0D6B7A` |
| Melia | Melia Harlan | Burgundy `#8B1A4A` |
| Regan | Regan Ramsey | Olive `#3D3D00` |

**Personal PINs:** Each traveler creates their own 4-digit PIN on first access to Personal Expenses. Stored as SHA-256 hash in `travelers.pin_hash`. PINs are not recoverable — master PIN (1515) resets them.

---

## Database Schema

### Tables

**`travelers`**
```
id uuid PK
name text UNIQUE
pin_hash text  -- SHA-256 hash of personal 4-digit PIN
created_at timestamptz
```

**`flights`**
```
id uuid PK
traveler_id uuid FK → travelers
origin text            -- IATA code e.g. LAX
destination text       -- IATA code e.g. CDG
flight_number text
airline text
departure_date date
departure_time time
arrival_date date      -- Added: supports overnight/multi-day flights
arrival_time time
status text            -- 'confirmed' | 'pending'
notes text             -- PIN-protected field
created_at timestamptz
updated_at timestamptz
```

**`hotels`**
```
id uuid PK
booked_by uuid FK → travelers
hotel_name text
city text
check_in date
check_out date
total_cost_usd numeric(10,2)
original_amount numeric(10,2)
original_currency text
exchange_rate numeric(10,6)
notes text
created_at timestamptz
```

**`hotel_guests`**
```
hotel_id uuid FK → hotels
traveler_id uuid FK → travelers
PRIMARY KEY (hotel_id, traveler_id)
```

**`categories`** (seeded, not editable in UI)
```
id serial PK
name text  -- Hotel, Meals, Transport, Activities, Shopping, Drinks, Groceries, Other
icon text  -- Tabler icon class
```

**`group_expenses`**
```
id uuid PK
paid_by uuid FK → travelers
description text
total_usd numeric(10,2)
original_amount numeric(10,2)
original_currency text
exchange_rate numeric(10,6)
expense_date date
category_id int FK → categories
created_at timestamptz
```

**`group_expense_participants`**
```
id uuid PK
expense_id uuid FK → group_expenses
traveler_id uuid FK → travelers
share_usd numeric(10,2)
```

**`personal_expenses`**
```
id uuid PK
traveler_id uuid FK → travelers
description text
original_amount numeric(10,2)
original_currency text
amount_usd numeric(10,2)
exchange_rate numeric(10,6)
expense_date date
category_id int FK → categories
created_at timestamptz
```

**`settlements`**
```
id uuid PK
from_traveler uuid FK → travelers
to_traveler uuid FK → travelers
amount_usd numeric(10,2)
settled_at timestamptz
```

### Migrations Applied (in order)

```sql
-- Original schema (run at project start)
-- [Full SQL in original chat — creates all 9 tables + RLS policies]

-- Migration 1: PIN support
ALTER TABLE travelers ADD COLUMN IF NOT EXISTS pin_hash text;

-- Migration 2: Arrival date for flights
ALTER TABLE flights ADD COLUMN IF NOT EXISTS arrival_date date;

-- Migration 3: departure_time and arrival_time columns
-- (Added when return flight section was removed from form)
ALTER TABLE flights ADD COLUMN IF NOT EXISTS departure_time time;
ALTER TABLE flights ADD COLUMN IF NOT EXISTS arrival_time time;
```

---

## App Architecture

### File Structure

```
eurotrip2026/
├── src/
│   ├── lib/
│   │   └── supabase.js          # Supabase client, constants, PIN helpers, theme utils
│   ├── pages/
│   │   ├── FlightsPage.jsx      # Flight list + detail panel + PIN-gated Notes
│   │   ├── HotelsPage.jsx       # Hotel tracking
│   │   ├── GroupExpensesPage.jsx
│   │   ├── PersonalExpensesPage.jsx  # PIN-gated full page
│   │   ├── BalancesPage.jsx     # Settlement calculations
│   │   ├── LogsPage.jsx         # Full expense history
│   │   └── SettingsPage.jsx     # Trip name, user mgmt, PIN mgmt, data reset
│   ├── components/
│   │   └── Keypad.jsx           # Expense entry numpad (shared by Group + Personal)
│   ├── App.jsx                  # Root: user picker, tab nav, session PIN state
│   └── index.css                # Global styles, CSS variables, pin-screen, etc.
├── .github/
│   └── workflows/
│       └── deploy.yml           # GitHub Actions → GitHub Pages
├── index.html
├── vite.config.js
└── README.md                    ← this file
```

### Key Design Patterns

**Session PIN state** is managed in `App.jsx` and passed down via props:
- `isPinUnlocked(travelerId)` — returns true if that user's PIN is verified this session
- `onPinUnlocked(travelerId, usedMasterPin)` — registers unlock after PIN success
- `lockUser(travelerId)` — removes from session unlock set (used by Lock button)
- `masterUnlocked` boolean — set silently when 1515 is entered; unlocks everyone

**Currency conversion** happens at entry time via Frankfurter API. All stored amounts are in USD (`amount_usd`). Original currency and amount are also stored for display. Fallback rates used when offline (EUR: 1.09, USD: 0.917).

**PIN hashing** uses Web Crypto API SHA-256 with app salt `eurotrip2026_salt`. No bcrypt dependency. Functions in `supabase.js`: `hashPin(pin)` → hex string, `verifyPin(pin, storedHash)` → boolean.

---

## Feature Reference

### Tabs

| Tab | Who Sees What | PIN Required |
|---|---|---|
| Flights | Everyone sees all flights; Notes field locked | Yes — personal PIN or master |
| Hotels | Everyone sees all hotels | No |
| Group | Everyone sees group expenses | No |
| Personal | Current user only; full page locked | Yes — personal PIN or master |
| Balances | Everyone sees settlement math | No |
| Logs | Full expense history | No |
| Settings | Trip name, user mgmt, data reset | Master PIN (1515) for changes |

### Flight Cards

Each flight displays: route (ORIGIN → DESTINATION), airline, flight number, departure date + time, arrival date + time, status badge (Confirmed/Pending), and a locked Notes row.

Notes unlock behavior:
- All users see `🔒 Notes · Tap to unlock`
- Tapping opens inline PIN numpad
- Entering correct personal PIN: reveals notes for that traveler for rest of session
- Entering 1515 (master): silently reveals all travelers' notes for rest of session
- Once unlocked, navigating away and back does NOT re-lock (session state persists)

### Personal Expenses PIN Flow

1. First visit → "Create your PIN" screen (4-digit setup)
2. Subsequent visits → "Enter your PIN" screen
3. If already unlocked this session (e.g. entered PIN on Flights page) → skips PIN screen entirely
4. Lock button → re-locks and requires PIN again
5. PIN settings → Change PIN (requires current PIN first) or Remove PIN

### Expense Keypad

Shared component used by both Group and Personal tabs. Features:
- Calculator-style numpad (1-2-3 top row)
- Currency selector (USD / EUR) with live conversion preview
- Category dropdown
- Description field
- Date field (defaults to today)
- Participant selector (group only)
- Auto-converts non-USD entries and shows "≈ $X.XX USD" before saving

### Settings (Master PIN required for all changes)

- Edit trip name
- Edit user display names
- Change master PIN
- Remove master PIN
- Data reset (per-user, with warning: "data will be placed on death row with no appellate review")

---

## PIN System

### Architecture Summary

```
Personal PIN (per traveler)
  ├── Set on first visit to Personal Expenses page
  ├── Stored as SHA-256 hash in travelers.pin_hash
  ├── Gates: Personal Expenses (full page) + Flight Notes (inline)
  ├── Session unlock: once entered, stays unlocked until app reload or Lock button
  └── Forgotten PIN: master PIN (1515) resets it via Remove PIN in settings

Master PIN: 1515
  ├── Set at app build time (hardcoded in supabase.js as MASTER_PIN)
  ├── Gates: Settings page changes (trip name, user names, data reset)
  ├── Also works silently at any personal PIN prompt
  │     → unlocks ALL travelers' Notes and PE for that session
  └── Can be changed/removed in Settings (requires current master PIN)
```

### Security Notes

- PINs are UI-gated, not database-encrypted. Anyone with direct Supabase access can read Notes and PE.
- This is appropriate for the threat model: curious travel companions, not sophisticated attackers.
- The master PIN is hardcoded — if it changes via Settings, update `MASTER_PIN` in `supabase.js` or store it in Supabase.
- SHA-256 with a fixed salt is not bcrypt — acceptable for a low-stakes trip app, not for production auth.

---

## Dev Log — Change History

### Session 1 — Initial Build
- Supabase project created: `EuroTrip` at `nljurimtlzspxvvstltp.supabase.co`
- GitHub repo created: `eurotrip2026`, GitHub Pages enabled via Actions
- 9-table schema created and seeded with 8 travelers
- Full React app built: all 7 tabs, Keypad component, live FX conversion
- Traveler names: Cordy, Melia, Camille, Reagan, Dylan, Dillon, Ava, Tina

### Session 2 — UI Refinements
- Color palette upgraded to high-contrast USC themes (8 distinct per-traveler colors)
- Full names added: Ava Dimond, Camille Shaw, Christina Toldalagi (Tina), Cordy Nguyen, Dillon O'Shea, Dylan Mansourian, Melia Harlan, Regan Ramsey
- Keypad layout fixed: calculator order (1-2-3 top) instead of phone order (7-8-9 top)
- Keypad moved up to avoid nav bar overlap
- Add Hotel form: removed check-in/out time and Country fields; check-out date moved to same row as check-in
- Add Flight form: return flight section removed (enter return as separate flight)
- Flight panel: fixed `loadPanelFlights()` — now queries Supabase directly on panel open

### Session 3 — Master PIN + Data Management
- Master PIN (1515) added to Settings
- PIN can be edited and removed (requires current PIN)
- Group Expense History: edit (pencil) button added alongside delete
- Currency auto-conversion banner added to Keypad
- Data reset per user added (with humorous death row warning)
- Trip name and user name editable in Settings (master PIN required)

### Session 4 — Personal Expense PIN System
- `bcrypt` replaced with native Web Crypto API `hashPin`/`verifyPin` (no external dependency)
- Personal PIN setup flow on first visit to Personal Expenses
- PIN gates full Personal Expenses page
- PIN change and remove options in PIN settings
- `MASTER_PIN` constant exported from `supabase.js`

### Session 5 — Flight Notes PIN + Arrival Date (Current)
- **New:** `arrival_date` field added to flights (supports overnight/multi-day flights)
  - Displayed as "Arrives: Jun 15 · 08:45" on flight cards
  - Stored in `flights.arrival_date` (requires migration: `ALTER TABLE flights ADD COLUMN IF NOT EXISTS arrival_date date`)
- **New:** Flight Notes PIN protection
  - Notes field hidden behind `🔒 Notes · Tap to unlock` for ALL viewers (including owner)
  - Inline `PinPrompt` component with compact numpad opens on tap
  - Correct personal PIN: unlocks that traveler's notes for session
  - Master PIN (1515): silently unlocks all travelers' notes for session
  - Notes label in Add/Edit form updated to show 🔒 icon with "(private — PIN protected)"
- **New:** Session-level PIN state lifted to `App.jsx`
  - `unlockedUsers` Set + `masterUnlocked` boolean managed at root
  - `isPinUnlocked`, `onPinUnlocked`, `lockUser` passed as props to all pages
  - Personal Expenses page skips PIN screen if user already unlocked via Flights page
  - Personal PIN description updated: "Your PIN protects your Personal Expenses and Flight Notes"

---

## How to Resume Development

When starting a new Claude session to continue this project:

1. **Share this README** — paste it or link to the GitHub repo. It contains the full spec, schema, and change history.

2. **Share the specific file(s) you want to change** — paste the raw content from GitHub. Go to `github.com/[username]/eurotrip2026`, open the file, click **Raw**, copy all.

3. **Describe the change** — Claude will edit only what's needed and return the updated file(s).

4. **Files most likely to need changes:**
   - `src/pages/FlightsPage.jsx` — flight display and form logic
   - `src/pages/PersonalExpensesPage.jsx` — personal expense PIN and display
   - `src/App.jsx` — global state, user picker, tab routing
   - `src/lib/supabase.js` — constants, colors, PIN helpers
   - `src/components/Keypad.jsx` — expense entry numpad
   - `src/pages/SettingsPage.jsx` — settings and PIN management
   - `src/index.css` — global styles

5. **If the change requires a DB migration,** Claude will provide the SQL. Run it in Supabase → SQL Editor.

---

## Troubleshooting

### Reset a Forgotten Personal PIN

Only the trip organizer can do this — users do not have access to master PIN and cannot self-recover.

1. Go to Supabase → `https://nljurimtlzspxvvstltp.supabase.co`
2. Click **Table Editor** in the left sidebar
3. Click the **`travelers`** table
4. Find the row for the traveler whose PIN needs resetting
5. Click the `pin_hash` cell for that row
6. Delete the value — leave it empty (null)
7. Click **Save**

That traveler will be prompted to create a new PIN the next time they open Personal Expenses. No code changes or redeployment needed — takes about one minute.

---

### Testing as a Specific User (Developer Workflow)

1. Select the traveler's name from the user picker
2. When prompted, create a temporary 4-digit PIN for that user
3. Test as that user (Personal Expenses, Flight Notes, etc.)
4. When done, go to Personal Expenses → tap **PIN** (key icon, top-right) → tap **Remove PIN** → enter the temporary PIN to confirm
5. PIN is deleted — that traveler's `pin_hash` is cleared in the database
6. Next time that traveler selects their name, they will be prompted to create their own PIN from scratch

---

## Pending / Future Work

- [ ] Edit button for Personal Expenses (currently delete-only)
- [ ] Push notifications when a group expense is added (requires PWA service worker)
- [ ] Offline mode / service worker caching
- [ ] PDF/CSV export of expense summary per traveler
- [ ] Hotel cost splitting across guests (currently tracks cost but doesn't auto-split into balances)
- [ ] Photo receipts attached to expenses
- [ ] Dark mode

---

*Last updated: Session 5 — Flight Notes PIN + Arrival Date*
*Built with Claude (Anthropic) · Fight On ✌️*
