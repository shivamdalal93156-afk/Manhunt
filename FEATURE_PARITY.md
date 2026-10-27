# Feature Parity Matrix: GPS Manhunt

This matrix captures **every single feature, setting, screen, and capability** in the GPS Manhunt mobile app. Every item is verified against active code and tagged as either **EXISTS** (with exact source file and line numbers) or **NEW (reference-only)**.

---

## 1. Authentication & Operative Profile

| Feature | Status | Location in Code / Reference | Notes |
| :--- | :--- | :--- | :--- |
| **Google Sign-In** | **NEW (reference-only)** | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in `.env` | Uses `@react-native-google-signin/google-signin` + Supabase `signInWithIdToken`. Google Client ID: `608816354275-30hq31gar3ffhocdp6rq67nnfo1m6j0h.apps.googleusercontent.com`. |
| **Email/Password Auth** | **EXISTS (To be removed)** | [src/services/auth/authService.ts:241-295](file:///c:/Users/SHIVAM/Desktop/manhunt/src/services/auth/authService.ts#L241-L295), [src/app/auth.tsx:1-453](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/auth.tsx#L1-L453) | Deprecated; wiped cleanly in Phase 3. |
| **Guest Mode & Accounts** | **EXISTS (To be wiped)** | [src/services/auth/guestAuth.ts:1-140](file:///c:/Users/SHIVAM/Desktop/manhunt/src/services/auth/guestAuth.ts#L1-L140) | Dead code; pending SQL count verification before wipe. |
| **First-Time Profile Setup** | **NEW (reference-only)** | Plan requirement | Unique username (3–16 chars, alphanumeric/underscore), avatar chooser (Google photo, 4 local presets, or user upload via `expo-image-picker` resized to ~512px). |
| **Session Persistence** | **EXISTS** | [src/services/session/sessionManager.ts:18-52](file:///c:/Users/SHIVAM/Desktop/manhunt/src/services/session/sessionManager.ts#L18-L52) | Restores active match and authenticated session on cold boot. |
| **Sign Out** | **EXISTS** | [src/app/settings.tsx:50-65](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/settings.tsx#L50-L65), [src/services/auth/authService.ts:317-335](file:///c:/Users/SHIVAM/Desktop/manhunt/src/services/auth/authService.ts#L317-L335) | Clears session and returns to Welcome screen. |

---

## 2. Home Screen (Ref 8 & Current Screen `6.47.10 PM (2).jpeg` / `6.47.11 PM.jpeg`)

| Feature | Status | Location in Code / Reference | Notes |
| :--- | :--- | :--- | :--- |
| **Top-Left "Add a friend" Pill** | **NEW (reference-only)** | Ref 8 top-left | Replaces bottom tab bar; navigates to `/friends`. |
| **Top-Right Profile Capsule** | **NEW (reference-only)** | Ref 8 top-right | Shows avatar, username, level; navigates to `/profile`. |
| **Top-Right Stacked Rules Button `(?)`** | **EXISTS** | [src/app/index.tsx:446-452](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/index.tsx#L446-L452) | Vector icon button navigating to Game Rules (`/rules`). |
| **Sound Toggle** | **DOES NOT EXIST in code** | None (no audio engine in codebase) | **HIDDEN** from UI per audit verification. |
| **Standalone Map Editor on Home** | **EXISTS (To be removed from Home)** | [src/app/index.tsx:438-444](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/index.tsx#L438-L444) | Duplicates zone editor; removed from Home, accessed via Lobby Play Zone tile. |
| **"Got a code?" Match Join** | **EXISTS** | [src/app/index.tsx:165-183](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/index.tsx#L165-L183) | 5–6 slot input + submit arrow `->`. |
| **Role Choice at Join** | **EXISTS** | [src/app/index.tsx:50](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/index.tsx#L50) (`inlineRole`) | Tactical role chips (Runner / Chaser / Referee) displayed upon join. |
| **Host New Match Button** | **EXISTS** | [src/app/index.tsx:370-385](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/index.tsx#L370-L385) | Ref 8 full-width gradient button "Start a new game". |
| **Active Mission Resume/Leave** | **EXISTS** | [src/app/index.tsx:103-116](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/index.tsx#L103-L116) | Detects active match and displays floating card with Resume / Leave. |
| **Satellite & GPS Telemetry Badge** | **EXISTS** | [src/app/index.tsx:455-467](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/index.tsx#L455-L467) | Header badge: `GPS ±16.8m • ONLINE`. |

---

## 3. Create Match Wizard (Ref 6 ➔ Ref 9)

*Note: Mode selection step (Ref 5) removed per user decision (Hide & Seek / Family not in v1). Wizard starts at Duration.*

| Feature | Status | Location in Code / Reference | Notes |
| :--- | :--- | :--- | :--- |
| **Wizard Step 1: Duration (Ref 6)** | **EXISTS** | [src/app/create.tsx:21-24](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/create.tsx#L21-L24) | Giant text ("1 hour") + chips (`15m`, `30m`, `1h` [default], `2h`, `Custom...`). |
| **Wizard Step 2: Location Interval (Ref 9)** | **EXISTS** | [src/app/create.tsx:26-29](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/create.tsx#L26-L29) | Giant text ("30 seconds") + chips (`15s`, `30s` [default], `1m`, `2m`, `5m`, `10m`, `Custom...`). |
| **Match Creation & Transition** | **EXISTS** | [src/services/lobby/lobbyService.ts:49-148](file:///c:/Users/SHIVAM/Desktop/manhunt/src/services/lobby/lobbyService.ts#L49-L148) | Submits initial parameters and immediately routes host into Lobby (Ref 7). |

---

## 4. Default Values for Non-Wizard Parameters (Copied Directly from Code)

The two-step wizard asks only for **Duration** and **Location Interval**. All other match parameters initialize with these exact defaults from current code:

| Parameter | Default Value | Source in Active Code | Configurable Later In |
| :--- | :--- | :--- | :--- |
| **Game Mode** | `STANDARD_MANHUNT` | [src/types/lobby.ts:18](file:///c:/Users/SHIVAM/Desktop/manhunt/src/types/lobby.ts#L18) | Fixed in v1 |
| **Runner Hearts** | `3` Hearts (Survival Lives) | [src/app/create.tsx:41](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/create.tsx#L41) | Advanced Settings (Ref 1) |
| **Head Start** | `60` Seconds (1 minute) | [src/app/create.tsx:47](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/create.tsx#L47) | Advanced Settings (Ref 1) |
| **Zone Radius** | `500` Meters | [src/app/create.tsx:31](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/create.tsx#L31) | Play Zone Editor (Ref 3, 2) |
| **Zone Origin** | `'GPS'` (Host GPS) | [src/app/create.tsx:36](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/create.tsx#L36) | Play Zone Editor |
| **Zone Shrink Mode** | `'NONE'` (Static - No Shrink) | [src/app/create.tsx:44](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/create.tsx#L44) | Advanced Settings (Ref 1) |
| **Tactical Abilities** | `true` (Enabled) | [src/app/create.tsx:50](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/create.tsx#L50) | Advanced Settings (Ref 1) |
| **Allowed Abilities** | All 5 Active (`stealth`, `mapScan`, `jammer`, `radarPing`, `decoy`) | [src/app/create.tsx:51-63](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/create.tsx#L51-L63) | Advanced Settings (Ref 1) |
| **Ability Max Uses** | `null` (Unlimited) | [src/app/create.tsx:64](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/create.tsx#L64) | Advanced Settings (Ref 1) |
| **Allow Spectators** | `true` (Enabled) | [src/app/create.tsx:70](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/create.tsx#L70) | Advanced Settings (Ref 1) |
| **Arrested Become Chasers** | `false` (Disabled) | [src/app/lobby/[id].tsx:34](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/lobby/%5Bid%5D.tsx#L34) | Advanced Settings (Ref 1) |
| **Catch Proximity Radius** | `15` Meters | [src/services/lobby/lobbyService.ts:43](file:///c:/Users/SHIVAM/Desktop/manhunt/src/services/lobby/lobbyService.ts#L43) | Fixed engine rule |

---

## 5. Match Lobby Screen (Ref 7 & Current Screen `6.47.08 PM (1).jpeg`)

| Feature | Status | Location in Code / Reference | Notes |
| :--- | :--- | :--- | :--- |
| **Join Code Capsule & Invite** | **EXISTS** | [src/app/lobby/[id].tsx:106-110](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/lobby/%5Bid%5D.tsx#L106-L110) | Code `74069` with `+ Invite` button. |
| **Chasers Roster Column** | **EXISTS** | [src/app/lobby/[id].tsx:102](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/lobby/%5Bid%5D.tsx#L102) | List of chasers with avatar, name, host crown `👑`, ready status. |
| **Runners Roster Column** | **EXISTS** | [src/app/lobby/[id].tsx:103](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/lobby/%5Bid%5D.tsx#L103) | List of runners with avatar, name, host crown `👑`, ready status. |
| **Referee Roster Section** | **EXISTS** | [src/types/lobby.ts:14](file:///c:/Users/SHIVAM/Desktop/manhunt/src/types/lobby.ts#L14), [src/app/lobby/[id].tsx:85-86](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/lobby/%5Bid%5D.tsx#L85-L86) | Dedicated section below player columns for assigned Referee. |
| **Host Role Toggle per Player** | **EXISTS** | [src/app/lobby/[id].tsx:195-237](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/lobby/%5Bid%5D.tsx#L195-L237) | Host switches players between Chaser, Runner, and Referee. |
| **2x3 Settings Grid** | **NEW (reference-only)** | Ref 7 | Cards: Mode (Manhunt), Duration, Updates, Abilities, Play Zone, Advanced. |
| **Real Abilities Count Tile** | **EXISTS** | [src/app/create.tsx:50-65](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/create.tsx#L50-L65) | Shows real active count: e.g. `"5 Active • Unlimited"` or `"3 Active • 2 Uses"`. |
| **Start Match Validation** | **EXISTS** | [src/app/lobby/[id].tsx:104, 127](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/lobby/%5Bid%5D.tsx#L104) | Requires >=1 Chaser and >=1 Runner; solo practice prompt if alone. |
| **Leave Lobby Confirmation** | **EXISTS** | [src/app/lobby/[id].tsx:112-124](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/lobby/%5Bid%5D.tsx#L112-L124) | Intercepts back tap with confirmation modal. |

---

## 6. Advanced Settings / "The Finer Details" (Ref 1 — Strictly Existing Controls)

*Note: All NEW reference-only items ("What runners see" and "Show how far away") have been removed.*

| Feature | Status | Location in Code / Reference | Notes |
| :--- | :--- | :--- | :--- |
| **Head Start Picker** | **EXISTS** | [src/app/create.tsx:47](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/create.tsx#L47) | `30s`, `1m`, `2m`, `3m`, `5m`. |
| **Caught Runners Become Chasers** | **EXISTS** | [src/types/lobby.ts:32](file:///c:/Users/SHIVAM/Desktop/manhunt/src/types/lobby.ts#L32), [src/app/lobby/[id].tsx:34](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/lobby/%5Bid%5D.tsx#L34) | Switch toggle (`Yes` / `No`). |
| **Survival Hearts Range** | **EXISTS** | [src/app/create.tsx:40-42](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/create.tsx#L40-L42) | `1 Life (Sudden Death)` or `2` to `10` Hearts. |
| **Spectator Access Toggle** | **EXISTS** | [src/app/create.tsx:70](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/create.tsx#L70), [src/app/lobby/[id].tsx:35-37](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/lobby/%5Bid%5D.tsx#L35-L37) | Switch toggle (`Yes` / `No`). |
| **Safe Zone Shrink Mode** | **EXISTS** | [src/app/create.tsx:44](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/create.tsx#L44), [src/lib/geo/battleRoyaleZone.ts](file:///c:/Users/SHIVAM/Desktop/manhunt/src/lib/geo/battleRoyaleZone.ts) | 3 cards: `Static (No Shrink)`, `Concentric Shrink`, `Battle Royale`. |
| **Tactical Abilities Master Toggle** | **EXISTS** | [src/app/create.tsx:50](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/create.tsx#L50) | Switch toggle (`Enabled` / `Disabled`). |
| **Individual Ability Toggles** | **EXISTS** | [src/app/create.tsx:51-63](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/create.tsx#L51-L63) | Stealth Cloak, Map Scan, Jammer, Radar Ping, Decoy. |
| **Ability Max Uses Per Player** | **EXISTS** | [src/app/create.tsx:64](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/create.tsx#L64) | Chips: `Unlimited`, `1 Use`, `2 Uses`, `3 Uses`, `5 Uses`. |

---

## 7. Play Zone Editor (Ref 3, Ref 2, Ref 4)

| Feature | Status | Location in Code / Reference | Notes |
| :--- | :--- | :--- | :--- |
| **Circle Mode (Center & Resize Handles)** | **EXISTS** | [src/components/game/LivePlayZoneMap.tsx:1-1302](file:///c:/Users/SHIVAM/Desktop/manhunt/src/components/game/LivePlayZoneMap.tsx#L1-L1302) | Ref 3 center drag handle `✥` + perimeter resize handle `↔`. |
| **Radius Presets (300m to 400km)** | **EXISTS** | [src/app/create.tsx:88](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/create.tsx#L88) | `300m`, `1km`, `5km`, `25km`, `100km`, `400km` + custom input. |
| **Custom Polygon Mode (3–12 Points)** | **NEW (User Approved)** | Ref 2 | Tap to add numbered vertices, drag handles, undo/clear, live points & area calculation. Static only in v1. |
| **"Off" Play Zone (No Boundary)** | **NEW (Analysis in UI_PLAN.md)** | Ref 4 | Roam anywhere on the map. Null-safe handling proposed below. |
| **Place Search & Landmarks** | **EXISTS** | [src/app/map/editor.tsx:31-36, 49-52](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/map/editor.tsx#L31-L36) | Geocoding search + DTU, Connaught Place, India Gate presets. |
| **Street vs Satellite Toggle** | **EXISTS** | [src/components/game/LivePlayZoneMap.tsx:72-74](file:///c:/Users/SHIVAM/Desktop/manhunt/src/components/game/LivePlayZoneMap.tsx#L72-L74) | Vector button to toggle imagery. |
| **Safety & Boundary Notice** | **EXISTS** | [src/app/map/editor.tsx:431-436](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/map/editor.tsx#L431-L436) | Physical safety warning text. |

---

## 8. In-Game Screens (Current Screens `6.47.07 PM.jpeg` & `6.47.08 PM.jpeg`)

| Feature | Status | Location in Code / Reference | Notes |
| :--- | :--- | :--- | :--- |
| **Chaser Satellite Map** | **EXISTS** | [src/app/game/hunter.tsx:34](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/game/hunter.tsx#L34), `6.47.07 PM.jpeg` | **Google Satellite imagery** with runner radar pings. |
| **Chaser 4-Tab Bottom Drawer** | **EXISTS** | [src/components/game/GameBottomDrawer.tsx:21](file:///c:/Users/SHIVAM/Desktop/manhunt/src/components/game/GameBottomDrawer.tsx#L21) | `Players`, `Hacks`, `Chat`, `Arrest` PIN keypad. |
| **Runner Directional Compass** | **EXISTS** | [src/components/game/DirectionalCompass.tsx:1-1267](file:///c:/Users/SHIVAM/Desktop/manhunt/src/components/game/DirectionalCompass.tsx#L1-L1267) | Concentric radar rings, heading needle, distance lines, escape vector (`RUN ◄`). |
| **Runner DAY MODE Toggle** | **EXISTS** | [src/app/game/runner.tsx:342-360](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/game/runner.tsx#L342-L360), `6.47.08 PM.jpeg` | Top HUD button toggling Day Mode vs Black Stealth Mode. |
| **Survival Hearts Bar (❤️ ❤️ ❤️)** | **EXISTS** | [src/app/game/runner.tsx:377-397](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/game/runner.tsx#L377-L397), `6.47.08 PM.jpeg` | Real-time hearts count or Sudden Death badge. |
| **Secret Catch Code Card** | **EXISTS** | [src/app/game/runner.tsx:400-430](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/game/runner.tsx#L400-L430), `6.47.08 PM.jpeg` | Private 4-digit catch PIN (`[9] [2] [4] [6]`). |
| **Lethal Threat Banner** | **EXISTS** | [src/components/game/DirectionalCompass.tsx:550-575](file:///c:/Users/SHIVAM/Desktop/manhunt/src/components/game/DirectionalCompass.tsx#L550-L575), `6.47.08 PM.jpeg` | "LETHAL THREAT: Alex is 21m away" + "ESCAPE SW" badge. |
| **Active Pursuit Roster** | **EXISTS** | [src/components/game/DirectionalCompass.tsx:580-620](file:///c:/Users/SHIVAM/Desktop/manhunt/src/components/game/DirectionalCompass.tsx#L580-L620), `6.47.08 PM.jpeg` | Horizontal proximity scroll list of approaching chasers. |
| **Runner Abilities Dock** | **EXISTS** | [src/app/game/runner.tsx:504-509](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/game/runner.tsx#L504-L509), `6.47.08 PM.jpeg` | Stealth, Map Scan, Jammer cards. |
| **NO Tab Drawer on Runner** | **EXISTS (Verified)** | `6.47.08 PM.jpeg`, [src/app/game/runner.tsx](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/game/runner.tsx) | Clean linear layout. No bottom tab drawer. |
| **Catch Verification: Proximity + PIN** | **EXISTS** | [src/services/lobby/lobbyService.ts:376-430](file:///c:/Users/SHIVAM/Desktop/manhunt/src/services/lobby/lobbyService.ts#L376-L430) | Server checks $\le 20\text{m}$ GPS proximity + runner 4-digit PIN. |
| **Referee God-Mode & Boundary Log** | **EXISTS** | [src/app/game/referee.tsx:1-150](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/game/referee.tsx#L1-L150) | Full map showing all operatives + boundary violations. |
| **Referee Match Pause/Resume** | **EXISTS** | [src/app/game/referee.tsx:78-95](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/game/referee.tsx#L78-L95) | Authoritative pause/resume override for supervisor. |

---

## 9. Friends, Profile, and Results Screens

| Feature | Status | Location in Code / Reference | Notes |
| :--- | :--- | :--- | :--- |
| **Friend Code Copy & Typed Add** | **EXISTS** | [src/app/index.tsx:185-195](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/index.tsx#L185-L195) | Reached from Home top-left `+ Add a friend` pill. No camera scanner. |
| **Friends Roster with Level & XP** | **EXISTS** | [src/app/index.tsx:750-800](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/index.tsx#L750-L800) | Displays friends with rank, XP, and delete button. |
| **Profile Stats (Sanitized 0m / 0.0km)** | **EXISTS** | [src/app/index.tsx:810-850](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/index.tsx#L810-L850) | Total play time, distance, games played, catches made. |
| **Achievements Carousel** | **EXISTS** | [src/types/progression.ts:62](file:///c:/Users/SHIVAM/Desktop/manhunt/src/types/progression.ts#L62), [src/services/progression/progressionService.ts:235, 357](file:///c:/Users/SHIVAM/Desktop/manhunt/src/services/progression/progressionService.ts#L235) | Initialized, evaluated, and rendered in code. |
| **XP Multiplier Badge** | **EXISTS** | [src/services/progression/progressionService.ts:224](file:///c:/Users/SHIVAM/Desktop/manhunt/src/services/progression/progressionService.ts#L224) | Displayed in Profile next to XP bar (`1.5x XP Boost` or `1.0x XP`). |
| **Coins System** | **EXISTS (Hidden)** | [src/types/progression.ts:59](file:///c:/Users/SHIVAM/Desktop/manhunt/src/types/progression.ts#L59) | Hidden from UI per user decision (no shop). |
| **PRO Badge** | **EXISTS (Hidden)** | [src/app/index.tsx:332](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/index.tsx#L332) | Cosmetic label; hidden from UI. |
| **Match History List** | **EXISTS** | [src/app/index.tsx:980-1040](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/index.tsx#L980-L1040) | Chronological log of matches played. |
| **Results Screen** | **EXISTS** | [src/app/game/results.tsx:1-120](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/game/results.tsx#L1-L120) | Victory/Defeat announcement, duration, distance, XP earned. |
| **Settings Screen** | **EXISTS** | [src/app/settings.tsx:1-270](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/settings.tsx#L1-L270) | Reached from Profile gear `⚙️`; diagnostics, sign out, account info. |
