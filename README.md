# GPS Manhunt — Real-Life Outdoor Multiplayer Chase Game

An original, authoritative real-time multiplayer mobile game where players turn outdoor parks, campuses, and neighborhoods into an active playing field. 

Inspired by the core mechanics of real-life GPS manhunts:
- **Hunters (Chasers)** track runners via tactical radar maps with periodic location snapshots.
- **Runners** navigate using a high-precision directional geodesic compass and tactical evasive power-ups (Stealth, Decoy, Map View).
- **Referees** monitor safety and enforce geofenced boundaries in Family Mode.

---

## Architecture & Status

- **Phase 0 (Discovery & Reference Research)**: Completed & Documented.
- **Phase 1 (Foundation, Design System & Geo Engine)**: Completed & Tested (45/45 Unit Tests Passing).
- **Phase 2 (Auth & Lobbies)**: Next Phase.

---

## Key Technical Features

1. **Pure Mathematical Geo Engine (`src/lib/geo/`)**:
   - Haversine great-circle distance calculation with finite bounds validation.
   - Initial bearing (forward azimuth) normalized to $[0, 360)$.
   - Relative device bearing $(Bearing - Heading + 360) \pmod{360}$ with graceful degradation when sensors are uncalibrated.
   - Point-in-Circle and Point-in-Polygon (Ray-Casting) geofencing with out-of-bounds warning grace zones.
   - Location freshness evaluation (`FRESH`, `DELAYED`, `STALE`, `EXPIRED`) and GPS accuracy filtering.
2. **Tactical Outdoor Design System (`src/theme/`, `src/components/ui/`)**:
   - High-contrast obsidian dark palette (`#0B0E14`) optimized for outdoor sunlight legibility and OLED battery conservation.
   - Faction visual accents: Cyber Cyan for Hunters, Neon Amber for Runners, Overseer Violet for Referees.
   - Reusable tactical components: `Button`, `Card`, `Badge`, `LoadingSpinner`, `ErrorFallback`, `PermissionPrompt`.
3. **Decoupled Location Abstraction (`src/services/location/`)**:
   - `ILocationService` interface separating device APIs from game state.
   - Real `ExpoLocationService` using `expo-location` with high navigation accuracy and drift filtering.
   - Isolated `MockLocationService` for automated multi-client simulations.
   - Zero auto-tracking on app launch; tracking is explicitly triggered by match flows.

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

### 3. Run Unit Tests
```bash
npm test
```
Runs 45 unit tests covering geodesic calculations, bearings, heading transitions, geofencing, freshness, and location service contracts.

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
- Or scan QR code with physical phone using Expo Go.

---

## Documentation Index
- [Reference Product Research](file:///c:/Users/SHIVAM/Desktop/manhunt/docs/REFERENCE_RESEARCH.md)
- [System Architecture](file:///c:/Users/SHIVAM/Desktop/manhunt/docs/ARCHITECTURE.md)
- [Game Rules & Mechanics](file:///c:/Users/SHIVAM/Desktop/manhunt/docs/GAME_RULES.md)
- [Database Schema & RLS](file:///c:/Users/SHIVAM/Desktop/manhunt/docs/DATABASE_SCHEMA.md)
- [API & Realtime Contracts](file:///c:/Users/SHIVAM/Desktop/manhunt/docs/API_CONTRACTS.md)
- [Location & Data Privacy](file:///c:/Users/SHIVAM/Desktop/manhunt/docs/LOCATION_PRIVACY.md)
- [Testing Strategy](file:///c:/Users/SHIVAM/Desktop/manhunt/docs/TESTING.md)
- [Deployment Guide](file:///c:/Users/SHIVAM/Desktop/manhunt/docs/DEPLOYMENT.md)
- [Known Limitations](file:///c:/Users/SHIVAM/Desktop/manhunt/docs/KNOWN_LIMITATIONS.md)
