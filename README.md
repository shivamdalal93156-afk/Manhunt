# GPS Manhunt — Real-Life Outdoor Multiplayer Chase Game

An original, authoritative real-time multiplayer mobile game where players turn outdoor parks, campuses, and neighborhoods into an active playing field.

---

## Game Roles & Overview

- **Hunters (Chasers)**: Track runners across an interactive satellite radar map with periodic location pings. Close distance to within 15 meters to execute proximity capture.
- **Runners (Evaders)**: Evade hunters using a high-precision directional geodesic compass pointing toward the nearest threat, with 3 survival hearts and tactical evasion abilities (Stealth, Map View, Jammer).
- **Supervisors (Referees / Family Mode)**: Non-combatant moderators with unredacted map overwatch to monitor safety, manage geofences, and resolve disputes.

---

## System Architecture & Completed Implementation

1. **Persistent Authentication & Player Identity (`src/services/auth/`)**:
   - Stable anonymous guest profiles persisted across app restarts via AsyncStorage.
   - Live synchronization with Supabase `profiles` table.
2. **Authoritative Multiplayer Lobby Engine (`src/services/lobby/`)**:
   - 6-character cryptographically generated join codes.
   - Synchronized player rosters, squad switching (Hunter / Runner / Referee), readiness tracking.
   - Host controls with server-side validation ($\ge 1$ Hunter & $\ge 1$ Runner required before launch).
   - Resilient multi-client fallback ensuring 100% playable local & simulated matches.
3. **Pure Mathematical Geo Engine (`src/lib/geo/`)**:
   - Haversine metric distance calculation with finite bounds validation.
   - Initial forward azimuth bearing and compass relative angle normalization $[0, 360)$.
   - Geofence circle and polygon ray-casting with 15m out-of-bounds warning grace zones.
   - Location freshness tiers (`FRESH`, `DELAYED`, `STALE`, `EXPIRED`) and GPS accuracy filtering.
4. **Authoritative Match & Catch Engine (`src/services/game/`)**:
   - Server-authoritative catch validation strictly enforcing $15\text{m}$ proximity threshold (with $5\text{m}$ GPS variance allowance).
   - Atomic heart decrementing and player elimination logic.
   - Tactical ability engine: Stealth location suppression (45s), Map View reveal (15s), Radar Ping (instant refresh), and Signal Jammer (20s).
   - Win condition evaluation (All runners eliminated = Hunters win; timer expires with $\ge 1$ runner alive = Runners win).
5. **Decoupled Location Service (`src/services/location/`)**:
   - `ILocationService` abstraction with `ExpoLocationService` for real hardware and `MockLocationService` for multi-client automated testing.
   - Zero tracking on app open; tracking is explicitly gated behind live matches and automatically ceases upon match conclusion.
6. **Tactical Outdoor HUD (`src/theme/`, `src/components/`, `src/app/`)**:
   - High-contrast obsidian dark palette (`#0B0E14`) engineered for direct sunlight legibility and low OLED battery consumption.
   - Interactive Directional Geodesic Compass, Tactical Radar Map, and Ability Dock.
   - Interactive Play-Zone Editor (`src/app/map/editor.tsx`) and Tactical Handbook (`src/app/rules.tsx`).

---

## Quick Start & Verification

### 1. Prerequisites
- [Node.js](https://nodejs.org/) v18+ (tested on v24.13.0)
- npm or yarn

### 2. Setup
```bash
git clone <repo-url>
cd manhunt
npm install
cp .env.example .env
```

### 3. Run Unit Tests (67 Tests)
```bash
npm test
```
Verifies distance calculations, bearings, heading transitions, antimeridian boundary crossings, geofencing, freshness, location service contracts, lobby state machines, and authoritative catch rules.

### 4. Type Checking
```bash
npm run typecheck
```

### 5. Start Development Server
```bash
npx expo start
```
- Press `a` for Android Emulator.
- Press `w` for Web preview.
- Or scan QR code with your phone using the Expo Go mobile app.

---

## Multi-Device Testing Walkthrough

To test a live 2-player match:
1. **Device 1 (Host)**:
   - Open app $\to$ tap **CREATE MATCH**.
   - Configure parameters (Duration: 30m, Ping: 30s, Zone: 500m) $\to$ tap **INITIALIZE LOBBY**.
   - Note the 6-character Join Code (e.g. `HX89K2`).
2. **Device 2 (Guest)**:
   - Open app $\to$ tap **JOIN WITH CODE**.
   - Enter the 6-character code $\to$ select squad (Runner) $\to$ tap **JOIN SQUAD LOBBY**.
3. **In the Lobby**:
   - Both devices see the live synchronized roster.
   - Host assigns Device 1 as Hunter and Device 2 as Runner.
   - Device 2 marks **I AM READY**.
   - Host taps **LAUNCH MATCH**.
4. **During Active Gameplay**:
   - Device 1 enters the **Hunter Radar HUD**, tracking runner pings.
   - Device 2 enters the **Runner Compass HUD**, navigating via directional threat needle.
   - As Device 1 closes within 15 meters, the **CONFIRM CATCH** trigger activates.
   - Upon completing the match, both devices transition to the **Match Debrief Screen** and GPS tracking automatically stops.

---

## Database Migrations (Supabase)
The database schema and authoritative RPC functions are documented in:
- `supabase/migrations/20261024_init_lobby_schema.sql`

To apply to your Supabase project:
1. Open the [Supabase Dashboard](https://supabase.com/dashboard) for project `qlurxqgestcmrqwsbyfo`.
2. Go to **SQL Editor** $\to$ **New Query**.
3. Paste the contents of `supabase/migrations/20261024_init_lobby_schema.sql` and run.
