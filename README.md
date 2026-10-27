# GPS Manhunt — Real-Life Tactical GPS Pursuit & Evasion

An authoritative real-time multiplayer mobile tactical chase game where outdoor parks, campuses, and neighborhoods become an active playing field.

---

## What's New: Production UI/UX Overhaul & Architecture

- **Visual Design System**:
  - Sampled sunset gradient (`#C44C8B` ➔ `#DC5F52` ➔ `#F2731D`).
  - Crisp light surface theme (`#F8F9FA` background, `#FFFFFF` cards, `#E5E7EB` borders) with high-legibility Inter typography.
  - Dedicated screen routing without bottom tab bars (Home, Friends, Profile, Settings, Rules, Play Zone Editor).
- **Google OAuth Authentication**:
  - Native Google Sign-In with Supabase ID Token exchange (`@react-native-google-signin/google-signin`).
  - Zero guest/anonymous modes — verified player accounts only.
  - Tactical callsign `@username` selection with live server-side availability checks and custom photo uploads.
- **Custom Play Zone Editor (`/map/editor`)**:
  - **Off**: Infinite/boundless play zone with null-safe game telemetry.
  - **Circle**: Interactive center anchor & perimeter resize dot handles, presets from 300m up to 400km.
  - **Custom Polygon**: 3 to 12 vertices, realtime area calculation, ray-casting boundary checks, and Jordan curve non-self-intersecting edge validation.
- **Role Hierarchy**:
  - **Chaser**: Satellite radar map tracking runners with periodic location pings and 4-digit catch verification keypad.
  - **Runner**: Geodesic directional threat compass, 4-digit secret catch-code card, hearts bar, lethal threat banner with escape vectors, and tactical abilities (Stealth, Map View, Jammer).
  - **Referee**: God-mode spectator view with boundary event logs and match pause/resume controls.

---

## System Architecture

1. **Google Auth & Profile Service (`src/services/auth/`)**:
   - Google Sign-In with Supabase ID token exchange.
   - Profile management and database synchronization in `public.profiles`.
2. **Authoritative Multiplayer Lobby (`src/services/lobby/`)**:
   - 6-character cryptographic match codes.
   - 2-column Chasers vs Runners rosters with Referee row and 2x3 settings grid.
   - Host controls with server-side validation ($\ge 1$ Chaser & $\ge 1$ Runner required for live match).
3. **Pure Mathematical Geo Engine (`src/lib/geo/`)**:
   - Haversine metric distance and forward azimuth bearing.
   - Geofence circle and polygon ray-casting with 15m out-of-bounds grace warnings.
   - Self-intersection and spherical area calculation.
4. **Authoritative Match & Catch Engine (`src/services/game/`)**:
   - Proximity verification strictly enforcing 15m capture threshold.
   - Secret 4-digit catch-code verification with atomic heart decrementing.
   - Electronic warfare tactical abilities (Stealth, Jammer, Radar Ping, Map Scan).

---

## Verification & Build

### 1. TypeScript Verification
```bash
npm run typecheck
# 0 errors
```

### 2. Unit Test Suite (99 Tests)
```bash
npm test
# 13 test suites passed, 99 tests passed
```

### 3. Project Health
```bash
npx expo-doctor
# 18/18 checks passed. No issues detected!
```

### 4. Build Release APK
```powershell
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
cd android
.\gradlew.bat assembleRelease
cd ..
```
Outputs: `Manhunt-Release.apk`
