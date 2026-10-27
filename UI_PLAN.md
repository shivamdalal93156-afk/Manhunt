# UI/UX Redesign & Implementation Plan: GPS Manhunt

**Branch**: `cleanup/optimization`  
**Auditor & Lead Architect**: Senior React Native / Expo Engineer & Mobile Product Designer  
**Status**: PHASE 1 — PLAN (READ-ONLY, STOPPED FOR APPROVAL)

---

## 1. Pixel-Sampled Color Palette & Design Tokens

Sampled directly from the reference screenshots (`references/reference-app/`) via pixel-level analysis using `System.Drawing.Bitmap`:

| Token | Exact Sampled Range | Standardized Hex | Usage |
| :--- | :--- | :--- | :--- |
| **Gradient Left (Magenta/Berry)** | `#C34D89` – `#C64B8C` | `#C44C8B` | Primary button gradient start, selected option borders, active tab text |
| **Gradient Middle (Coral Pink)** | `#DB5F53` – `#DD5F50` | `#DC5F52` | Primary button gradient midpoint |
| **Gradient Right (Vibrant Orange)** | `#F1731E` – `#F3731C` | `#F2731D` | Primary button gradient end, active switch toggles, drag handles |
| **Button Gradient** | `['#C44C8B', '#DC5F52', '#F2731D']` | As array | Full-width rounded action buttons ("Start a new game", "Continue", "Apply") |
| **App Background** | `#FBFBFB` – `#FCFCFC` | `#F8F9FA` | Screen background beneath cards and faded map overlay |
| **Card Surface** | `#FFFFFF` | `#FFFFFF` | Rounded cards (~20–24px radius, soft drop shadow) |
| **Card Border (Subtle)** | `#F0F2F5` – `#E5E7EB` | `#E5E7EB` | Unselected card and chip borders |
| **Text Primary (Heading)** | `#111827` | `#111827` | Inter ExtraBold ~34px tight-tracked headings |
| **Text Secondary (Body)** | `#4B5563` – `#6B7280` | `#4B5563` | Regular grey explanatory text |
| **Selected Card Border** | Gradient outline | `#C44C8B` ➔ `#F2731D` | Selected option cards and active chips |

---

## 2. Navigation Architecture (No Bottom Tab Bar)

There is **NO bottom tab bar** in the redesigned app. All views are structured as clean, focused stack screens navigated directly from Home or in-game headers:

```
                      [ Welcome / Google Sign-In ]
                                   │
                                   ▼
                       [ First-Time Profile Setup ]
                                   │
                                   ▼
                            [ Home (Ref 8) ]
                     ┌─────────────┴─────────────┐
                     ▼                           ▼
            [Friends Screen]              [Profile Screen]
            (Top-Left Pill)               (Top-Right Capsule)
                     │                           │
                     │                           ▼
                     │                   [Settings Screen]
                     │                   (Profile Gear '⚙')
                     │
      ┌──────────────┴──────────────┐
      ▼                             ▼
[Join Match Code]           [Create Match Wizard]
      │                     (Step 1: Duration ➔ Step 2: Interval)
      │                             │
      └──────────────┬──────────────┘
                     ▼
             [Match Lobby (Ref 7)]
        (Grid ➔ Zone Editor & Advanced)
                     │
                     ▼
             [Active Match HUD]
   (Chaser: Satellite Map | Runner: Compass HUD | Referee: God View)
                     │
                     ▼
             [Results Screen]
```

* **Home Header**: Contains **ONLY** `+ Add a friend` pill on the top-left and the user profile capsule (avatar, username, level) on the top-right.
* **Rules Entry**: A small circular button with vector icon `Ionicons name="help-circle-outline"` stacked on the right side below the profile capsule.
* **Sound Toggle**: **HIDDEN** (verified absent in code; no audio engine exists).
* **Standalone Map Editor**: **REMOVED from Home** (verified as a 100% duplicate of the Play Zone Editor; accessed exclusively via the Lobby Play Zone tile).
* **Settings**: Reached via settings gear vector icon `Ionicons name="settings-outline"` inside the Profile screen.

---

## 3. Current-to-New Screen Mapping (From `references/current-app/`)

### 3.1 Home Screen
* **Current App Screen**: [`6.47.10 PM (2).jpeg` & `6.47.11 PM.jpeg`](file:///c:/Users/SHIVAM/Desktop/manhunt/references/current-app/WhatsApp%20Image%202026-10-26%20at%206.47.10%20PM%20(2).jpeg)
* **New Target Layout**: **Ref 8** (`WhatsApp Image 2026-10-26 at 6.26.16 PM (2).jpeg`)
* **Mapping Details**:
  - **Top Bar**: Left pill `+ Add a friend` (`/friends`); right capsule showing user avatar, username, and level (`/profile`); right stacked rules button `(?)` (`/rules`).
  - **GPS & Telemetry Status**: Positioned in header: `🟢 GPS ±16.8m • ONLINE`.
  - **Active Match Resume Banner**: Floating card above code input: *"Active Match in Progress (#JOINCODE)"* with **Resume** (gradient) and **Leave** (grey).
  - **"Got a code?" Match Entry**: 5–6 digit character slots with submit arrow `->`. Tapping reveals tactical role choice chips (**Runner**, **Chaser**, **Referee**).
  - **Primary Action**: Full-width rounded gradient button `"Start a new game"` launching the Create Match wizard.

---

### 3.2 Create Match Wizard (2 Steps in v1)
* **Current App Screen**: [`6.47.08 PM (2, 3).jpeg`, `6.47.09 PM (1).jpeg`, `6.47.10 PM (1).jpeg`](file:///c:/Users/SHIVAM/Desktop/manhunt/references/current-app/WhatsApp%20Image%202026-10-26%20at%206.47.08%20PM%20(2).jpeg)
* **New Target Layout**: **Ref 6 ➔ Ref 9 ➔ Ref 7 (Lobby)**
* **Step 1: Duration (Ref 6)**:
  - Heading: *"How long is the hunt?"*
  - Giant selected duration text: **"1 hour"** / **"30 minutes"**.
  - Pill chips: `15 minutes`, `30 minutes`, `1 hour` (selected gradient), `2 hours`, `Custom...` (numeric dialog).
  - Gradient `"Continue"` button.
* **Step 2: Location Interval (Ref 9)**:
  - Heading: *"How often do runner locations update?"*
  - Giant selected interval text: **"30 seconds"** / **"2 minutes"**.
  - Pill chips: `15 seconds`, `30 seconds` (selected gradient), `1 minute`, `2 minutes`, `5 minutes`, `10 minutes`, `Custom...`.
  - Gradient `"Continue"` button (creates match with defaults and opens Lobby Ref 7).

---

### 3.3 Default Values for Non-Wizard Parameters (Copied Directly from Code)

The two-step wizard asks only for **Duration** and **Location Interval**. All other parameters initialize with these exact defaults from current code:

| Parameter | Default Value in Code | Source in Code | Configurable In |
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

### 3.4 Match Lobby Screen (Ref 7)
* **Current App Screen**: [`6.47.08 PM (1).jpeg`](file:///c:/Users/SHIVAM/Desktop/manhunt/references/current-app/WhatsApp%20Image%202026-10-26%20at%206.47.08%20PM%20(1).jpeg)
* **New Target Layout**: **Ref 7** (`WhatsApp Image 2026-10-26 at 6.26.16 PM (1).jpeg`)
* **Mapping Details**:
  - **Top Bar**: Leave button `[->` (intercepted with confirmation), Join Code capsule `74069` with `+ Invite` button.
  - **Chasers Roster Column**: List of chasers with avatar circle, name, host crown `👑`, ready indicator.
  - **Runners Roster Column**: List of runners with avatar circle, name, host crown `👑`, ready indicator.
  - **Referee Roster Section**: Dedicated card below the two columns showing assigned Referee.
  - **Role Switching**: Host can toggle players between **Chaser**, **Runner**, and **Referee**.
  - **2x3 Settings Grid**:
    1. `Game Mode` ➔ Shows `"Manhunt"`.
    2. `Duration` ➔ Shows `"1 hour"` (tap opens Step 1 duration picker).
    3. `Location Updates` ➔ Shows `"Every 30s"` (tap opens Step 2 interval picker).
    4. `Tactical Abilities` ➔ Shows real values: **"5 Active • Unlimited"** (or configured max uses). Tap opens abilities config.
    5. `Play Zone` ➔ Shows `"Circle (500m)"`, `"Custom Polygon"`, or `"Anywhere"`. Tap opens Play Zone Editor.
    6. `Advanced` ➔ Shows `"The finer details"`. Tap opens Ref 1.
  - **Bottom Action**: Disabled pill `"Waiting for players"` until >=1 Chaser and >=1 Runner join; transitions to gradient `"Launch Match"`.

---

### 3.5 Updating Game Settings from Lobby (Code Extension)
* **Current Limitation**: Currently, `lobbyService` does not have an authoritative method to update settings or play zone after the game row is created.
* **Proposed Minimal Non-Breaking Change**:
  In `src/services/lobby/lobbyService.ts`, add:
  ```ts
  async updateGameSettings(
    gameId: string,
    updates: {
      settings?: Partial<MatchSettings>;
      playZone?: PlayZoneSettings;
    }
  ): Promise<void> {
    const { data: currentGame } = await supabase.from('games').select('settings, play_zone').eq('id', gameId).single();
    if (!currentGame) return;

    await supabase.from('games').update({
      ...(updates.settings ? { settings: { ...currentGame.settings, ...updates.settings } } : {}),
      ...(updates.playZone ? { play_zone: updates.playZone } : {}),
    }).eq('id', gameId);
  }
  ```
  This persists the host's changes to Supabase JSONB columns and triggers the real-time Postgres subscription so all connected players in the lobby see the updated duration, abilities, or play zone instantly.

---

### 3.6 Advanced Settings Screen (Ref 1 — Strictly Existing Controls)

*Note: All NEW reference-only items ("What runners see" and "Show how far away") have been removed.*

* **Card 1: Escape & Hearts**:
  - *Head start*: Picker (`30s`, `1m`, `2m`, `3m`, `5m`) ([src/app/create.tsx:47](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/create.tsx#L47)).
  - *Caught runners become chasers*: Switch toggle (`Yes` / `No`) ([src/types/lobby.ts:32](file:///c:/Users/SHIVAM/Desktop/manhunt/src/types/lobby.ts#L32)).
  - *Survival Hearts*: Picker (`1 Life (Sudden Death)` or `2` to `10` Hearts) ([src/app/create.tsx:40-42](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/create.tsx#L40-L42)).
  - *Allow Spectators*: Switch toggle (`Yes` / `No`) ([src/app/create.tsx:70](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/create.tsx#L70)).
* **Card 2: Zone Shrink Mode**:
  - 3 option cards: `Static (No Shrink)`, `Concentric Shrink`, `Battle Royale (PUBG)`.
* **Card 3: Tactical Abilities**:
  - Master toggle: `Enable Tactical Abilities`.
  - Max uses per player: `Unlimited`, `1 Use`, `2 Uses`, `3 Uses`, `5 Uses`.
  - Individual ability switches: Stealth Cloak, Map Scan, Jammer, Radar Ping, Decoy.
* Full-width gradient `"Apply"` button saving via `lobbyService.updateGameSettings`.

---

### 3.7 Play Zone Editor (Ref 3, Ref 2, Ref 4)
* **Bottom Segmented Control**: `⏻ Off` | `◯ Circle` | `⬡ Custom`.
* **Circle Mode (Ref 3)**:
  - Center move handle `✥` + perimeter resize handle `↔`.
  - Radius chip: `"RADIUS: 965 m"`.
  - Presets horizontal scroll: `300m`, `1km`, `5km`, `25km`, `100km`, `400km`, plus custom numeric text input.
* **Custom Polygon Mode (Ref 2)**:
  - Tap map to plot 3 to 12 numbered vertices (`1` to `N`).
  - Draggable vertices to reshape boundary.
  - Floating tools: `+` (Add), `↶` (Undo), `🗑️` (Clear).
  - Summary chips: `"POINTS: 8"`, `"AREA: 3.06 km²"`.
  - Self-intersection validation (rejects invalid polygons).
  - Static only in v1 (no dynamic shrink).
* **"Off" Play Zone (Ref 4)**:
  - Roam anywhere without boundary restriction.

---

### 3.8 Analysis of "Off" Play Zone (Files Assuming a Zone Exists & Null-Safe Handling)

Every file and code path that assumes a zone exists has been audited:
1. [src/components/game/DirectionalCompass.tsx:292-330](file:///c:/Users/SHIVAM/Desktop/manhunt/src/components/game/DirectionalCompass.tsx#L292-L330): Calculates `safeZoneVector` towards boundary.
   * *Null-Safe Handling*: If `playZone.mode === 'NONE'`, set `safeZoneVector = null`. Compass dial simply does not render a safe zone arrow.
2. [src/components/game/LivePlayZoneMap.tsx:33, 210-230](file:///c:/Users/SHIVAM/Desktop/manhunt/src/components/game/LivePlayZoneMap.tsx#L33): Renders boundary circle and tinted gradient mask.
   * *Null-Safe Handling*: If `playZone.mode === 'NONE'`, skip rendering circle SVG path and outer tint. Map displays cleanly.
3. [src/app/game/hunter.tsx:176-215](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/game/hunter.tsx#L176-L215): Renders `450m PERIMETER` badge.
   * *Null-Safe Handling*: If `playZone.mode === 'NONE'`, hide the perimeter badge.
4. [src/app/game/runner.tsx:238-286](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/game/runner.tsx#L238-L286): Evaluates `boundaryCheck.isInside`.
   * *Null-Safe Handling*: If `playZone.mode === 'NONE'`, `isInside` is always `true`. The `⚠️ OUTSIDE ACTIVE PLAY ZONE!` warning card never triggers.
5. [src/app/game/referee.tsx:106-114](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/game/referee.tsx#L106-L114): Checks player coordinates against play zone.
   * *Null-Safe Handling*: If `playZone.mode === 'NONE'`, skip boundary violation checks and log.
6. [src/services/game/gameEngine.ts:125-145](file:///c:/Users/SHIVAM/Desktop/manhunt/src/services/game/gameEngine.ts#L125-L145): `checkBoundaryViolation`.
   * *Null-Safe Handling*: If `playZone.mode === 'NONE'`, returns `{ isInside: true, distanceMeters: 0 }`.

*Conclusion on "Off" Mode*: The null-safe handling is straightforward and localized (simple `if (playZone.mode === 'NONE') return null`). It is **safe and feasible to include in v1**.

---

### 3.9 Custom Polygon Play Zones (Exhaustive File List & Minimal Change)

*Database Confirmation*: Column `public.games.play_zone` is already defined as `JSONB NOT NULL DEFAULT '{"type": "circle", "radius_meters": 500}'::jsonb`. **NO SQL migration is required.**

**Exhaustive List of All 11 Files Involving Play Zone Boundaries**:
1. [src/types/lobby.ts:35-39](file:///c:/Users/SHIVAM/Desktop/manhunt/src/types/lobby.ts#L35-L39): `PlayZoneSettings` interface.
2. [src/lib/geo/geofence.ts:14-25](file:///c:/Users/SHIVAM/Desktop/manhunt/src/lib/geo/geofence.ts#L14-L25): Implements `pointInCircle`.
3. [src/lib/geo/battleRoyaleZone.ts:31-40](file:///c:/Users/SHIVAM/Desktop/manhunt/src/lib/geo/battleRoyaleZone.ts#L31-L40): Circle shrink math (bypassed if polygon).
4. [src/services/game/gameEngine.ts:125-145](file:///c:/Users/SHIVAM/Desktop/manhunt/src/services/game/gameEngine.ts#L125-L145): Boundary check.
5. [src/components/game/LivePlayZoneMap.tsx:33](file:///c:/Users/SHIVAM/Desktop/manhunt/src/components/game/LivePlayZoneMap.tsx#L33): Renders boundary paths.
6. [src/components/game/DirectionalCompass.tsx:292-330](file:///c:/Users/SHIVAM/Desktop/manhunt/src/components/game/DirectionalCompass.tsx#L292-L330): Boundary vector.
7. [src/app/create.tsx:31-34](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/create.tsx#L31-L34): Match creation zone state.
8. [src/app/map/editor.tsx:41-47](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/map/editor.tsx#L41-L47): Play zone editor screen.
9. [src/services/lobby/lobbyService.ts:60](file:///c:/Users/SHIVAM/Desktop/manhunt/src/services/lobby/lobbyService.ts#L60): DB payload construction.
10. [src/app/game/hunter.tsx:176-215](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/game/hunter.tsx#L176-L215): Displays `"POLYGON ZONE"` on perimeter badge; renders polygon on map.
11. [src/app/game/referee.tsx:106-114](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/game/referee.tsx#L106-L114): Checks player containment within polygon.
*Server-Side Check*: Supabase RPCs `submit_player_location` and `record_catch` verify player coordinates and inter-player proximity ($\le 20\text{m}$); neither RPC enforces circular geofences on the server.

**Proposed Minimal Non-Breaking Change**:
```ts
// In src/types/lobby.ts:
export interface PlayZoneSettings {
  mode?: 'CIRCLE' | 'POLYGON' | 'NONE';
  center: [number, number]; // [lng, lat] centroid
  radiusMeters: number;      // Retained for circles
  polygonCoordinates?: Array<{ latitude: number; longitude: number }>; // 3 to 12 points
}

// In src/lib/geo/geofence.ts:
export function pointInPolygon(point: GPSLocation, polygon: Array<{ latitude: number; longitude: number }>): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].longitude, yi = polygon[i].latitude;
    const xj = polygon[j].longitude, yj = polygon[j].latitude;
    const intersect = ((yi > point.latitude) !== (yj > point.latitude)) &&
      (point.longitude < ((xj - xi) * (point.latitude - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function isPolygonSelfIntersecting(points: Array<{ latitude: number; longitude: number }>): boolean {
  // Checks line-segment intersection between non-adjacent edges
  // Returns true if self-intersecting, preventing invalid polygons
}
```

---

### 3.10 In-Game Chaser Screen
* **Current App Screen**: [`6.47.07 PM.jpeg`](file:///c:/Users/SHIVAM/Desktop/manhunt/references/current-app/WhatsApp%20Image%202026-10-26%20at%206.47.07%20PM.jpeg)
* **Map**: **Google Satellite imagery** (retained per your correction; NOT faded street map).
* **Perimeter Overlay**: Top perimeter badge (e.g. `450m PERIMETER` or `POLYGON ZONE`), zone center reticle, boundary overlay.
* **Top Bar**: Help `(?)`, Match clock pill (`29m 57s`), Leave match button `[->` (intercepted with confirmation).
* **4-Tab Bottom Drawer**:
  1. `Players`: Live list of runners with distance in meters, stale/fresh indicators, target lock.
  2. `Hacks`: Tactical abilities (Radar Ping, Jammer, Decoy) with cooldown timers and remaining use counters.
  3. `Chat`: Squad tactical radio (Team channel vs All channel).
  4. `Arrest`: 4-digit PIN verification keypad to confirm runner catch codes.

---

### 3.11 In-Game Runner Screen
* **Current App Screen**: [`6.47.08 PM.jpeg`](file:///c:/Users/SHIVAM/Desktop/manhunt/references/current-app/WhatsApp%20Image%202026-10-26%20at%206.47.08%20PM.jpeg)
* **Layout**: **NO tab drawer** (retained per your correction; clean linear layout).
* **Top Bar**: `EVADER RUNNER` badge, center `☀️ DAY MODE` toggle (Day vs Stealth Night Mode), `TIME 29:57` countdown pill.
* **Survival Hearts Bar**: `SURVIVAL HEARTS (3/3)` with red heart icons `❤️❤️❤️` (or Sudden Death badge if 1 Life).
* **Secret Catch Code Card**: `YOUR SECRET CATCH CODE` with 4 large digit boxes: `[ 9 ] [ 2 ] [ 4 ] [ 6 ]`.
* **Directional Radar Compass**:
  - Concentric rings (`35m` danger, `100m` warning, outer awareness).
  - `YOU` in center.
  - Approaching chaser markers with distances (`Alex 21m`, `Dave 63m`, `Sarah 159m`).
  - Green escape vector arrow (`RUN ◄`).
  - Cardinal points (`N`, `E`, `S`, `W`).
* **Lethal Threat Banner**: `LETHAL THREAT: Alex is 21m away` (red badge) + `ESCAPE SW` (green badge).
* **Active Pursuit Roster**: Horizontal proximity scroll list (`#1 Alex 21m N`, `#2 Dave 63m NW`, etc.).
* **Tactical Abilities Panel**: 3 action cards (`STEALTH`, `MAP SCAN`, `JAMMER`).
* **Floating Radio Trigger**: Discreet button opening chat modal.

---

### 3.12 In-Game Referee Screen
* **Current App Code**: [src/app/game/referee.tsx:1-150](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/game/referee.tsx#L1-L150)
* Fullscreen satellite/street map displaying all Chasers and Runners simultaneously.
* Boundary violation log.
* Authoritative Match Pause / Resume button.

---

### 3.13 Social & Friends Screen
* **Reached From**: Home top-left `+ Add a friend` pill.
* **Top Card**: **"Show My Code"** with player's unique friend code (`#SHIVAM-931`) and copy button.
* **Add Friend Card**: Typed text input for friend code or username with "Add Friend" button (no camera scanner).
* **Friends Roster**: Clean white cards with friend avatar, username, rank (`Level 4 • Rookie`), XP progress bar, one-tap lobby invite, and delete option.
* Back button `<` returning to Home (no bottom tab bar).

---

### 3.14 Profile & Match History Screen
* **Reached From**: Home top-right user capsule.
* **Header**: Operative username with settings gear vector icon `Ionicons name="settings-outline"` navigating to Settings screen.
* **Identity Card**: Large avatar, username (`@shivam`), rank (`Level 1 • Rookie`), XP progress bar.
* **XP Multiplier Badge**: Displayed directly next to XP progress bar as a small orange pill: `1.5x XP Boost` or `1.0x XP` (verified in code [src/services/progression/progressionService.ts:224](file:///c:/Users/SHIVAM/Desktop/manhunt/src/services/progression/progressionService.ts#L224)).
* **Coins & PRO**: **HIDDEN** from UI per decision (no shop exists).
* **"View Game History" Row**: Navigates to complete match history log.
* **Statistics Card**: Total Play Time (`0m` sanitized for new accounts), Distance Traveled (`0.0 km`), Chaser Games, Runner Games, Catches Made, Hacks Used.
* **Achievements Carousel**: Rendered from verified progression code ([src/types/progression.ts:62](file:///c:/Users/SHIVAM/Desktop/manhunt/src/types/progression.ts#L62)) with badge title, description, reward, and lock status.
* Back button `<` returning to Home (no bottom tab bar).

---

### 3.15 System Settings Screen
* **Reached From**: Profile screen settings gear icon `⚙️`.
* **Account Info**: Google email, verified operative badge.
* **Diagnostics**: Live GPS accuracy (`±16.8m`), sensor status, satellite fix.
* **Safety & Terms**: Links to Game Rules and outdoor safety guidelines.
* **Sign Out**: Red button clearing session and returning to Welcome screen.

---

### 3.16 Game Results Screen
* **Reached From**: Match conclusion (countdown reaches zero or all runners caught).
* **Victory / Defeat Banner**: "CHASERS WIN!" or "RUNNERS WIN!".
* **Match Telemetry**: Duration, distance run, hearts lost, catches made.
* **XP Reward**: Displays effective XP earned (`baseXP * xpMultiplier`).
* **Return Action**: Full-width button returning to Home Screen.

---

## 4. UI Polish & Layout Overlap Fixes

1. **Hunter Timer vs Zoom Button Overlap Fix**:
   - The top HUD bar is wrapped in `SafeAreaView` with an explicit `height: 56` and horizontal layout (`?` on left, countdown pill in center, leave on right).
   - Zoom buttons (`+`, `-`, target, compass) are anchored to `bottom: drawerHeight + 20, right: 16` in a dedicated vertical floating pill, completely separating them from the top bar.
2. **Chip Text Wrapping Fix**:
   - All chip containers enforce `flexShrink: 0`, `paddingHorizontal: 16`, `paddingVertical: 10`, `minHeight: 40`, and `alignItems: 'center'`.
   - Chip text styles set `numberOfLines={1}` and `ellipsizeMode="tail"`.
   - Preset chip groups use a horizontal `<ScrollView horizontal showsHorizontalScrollIndicator={false}>` so chips never wrap awkwardly to a second line.
3. **Cut-off Zone Editor Header Fix**:
   - Replaced multi-line colliding titles with a single unified `TopBar` component with `SafeAreaView` top inset: clean back button `<` on left, single centered title `"Play Zone Editor"`, right action slot.
4. **Floating Controls Covering Action Buttons Fix**:
   - Floating action buttons (tactical radio button, recenter button) dynamically calculate their bottom position: `bottom: isDrawerCollapsed ? COLLAPSED_DRAWER_HEIGHT + 16 : EXPANDED_DRAWER_HEIGHT + 16`. When the drawer moves, floating controls smoothly adjust.

---

## 5. Vector Iconography (Zero Emojis)

All emojis replaced with standardized vector icons from `@expo/vector-icons` (`Ionicons`, `MaterialCommunityIcons`):

| UI Element | Old Emoji | Vector Icon Specification |
| :--- | :--- | :--- |
| **Add Friend** | `+👤` | `<Ionicons name="person-add-outline" size={18} color="#C44C8B" />` |
| **Leave Match / Lobby** | `[->` | `<Ionicons name="log-out-outline" size={20} color="#EF4444" />` |
| **Settings** | `⚙️` | `<Ionicons name="settings-outline" size={22} color="#4B5563" />` |
| **Rules / Help** | `(?)` / `📖` | `<Ionicons name="help-circle-outline" size={22} color="#4B5563" />` |
| **Host Crown** | `👑` | `<MaterialCommunityIcons name="crown-outline" size={16} color="#F59E0B" />` |
| **Stealth Cloak** | `👻` | `<MaterialCommunityIcons name="ghost-outline" size={20} color="#06B6D4" />` |
| **Map Scan** | `🗺️` | `<Ionicons name="map-outline" size={20} color="#22C55E" />` |
| **Jammer** | `⚡` | `<Ionicons name="flash-outline" size={20} color="#F59E0B" />` |
| **Radar Ping** | `📡` | `<MaterialCommunityIcons name="radar" size={20} color="#F45B36" />` |
| **Decoy** | `🎯` | `<MaterialCommunityIcons name="target" size={20} color="#DE3B7E" />` |
| **Arrest / PIN** | `🔒` | `<Ionicons name="lock-closed-outline" size={20} color="#F45B36" />` |
| **Chat / Radio** | `💬` | `<Ionicons name="chatbubble-ellipses-outline" size={20} color="#C44C8B" />` |
| **Trash / Delete** | `🗑️` | `<Ionicons name="trash-outline" size={18} color="#EF4444" />` |
| **Undo** | `↶` | `<Ionicons name="arrow-undo-outline" size={18} color="#4B5563" />` |

---

## 6. Guest Accounts Wipe SQL (Inspection Only — Delete Nothing Yet)

Run this SQL query first in the Supabase SQL editor to inspect exact row counts of guest vs registered profiles and their related records:

```sql
-- ====================================================================
-- STEP 1: SAFE INSPECTION QUERY (SELECT ONLY - DELETES NOTHING)
-- ====================================================================

-- 1. Count profiles by guest status
SELECT 
    COUNT(*) FILTER (WHERE is_guest = TRUE) AS guest_profiles_count,
    COUNT(*) FILTER (WHERE is_guest = FALSE OR is_guest IS NULL) AS registered_profiles_count,
    COUNT(*) AS total_profiles_count
FROM public.profiles;

-- 2. Inspect related activity rows belonging to guest profiles
SELECT 
    (SELECT COUNT(*) FROM public.game_players gp 
     JOIN public.profiles p ON gp.profile_id = p.id 
     WHERE p.is_guest = TRUE) AS guest_game_players_count,
    
    (SELECT COUNT(*) FROM public.games g 
     JOIN public.profiles p ON g.host_profile_id = p.id 
     WHERE p.is_guest = TRUE) AS guest_hosted_games_count,
     
    (SELECT COUNT(*) FROM public.player_locations pl
     JOIN public.game_players gp ON pl.player_id = gp.id
     JOIN public.profiles p ON gp.profile_id = p.id
     WHERE p.is_guest = TRUE) AS guest_telemetry_rows_count;

-- 3. Preview guest profile details
SELECT id, display_name, is_guest, created_at 
FROM public.profiles 
WHERE is_guest = TRUE 
ORDER BY created_at DESC 
LIMIT 20;
```

*(Once you review the returned numbers and confirm, the deletion script will be executed in Phase 3).*

---

## 7. Execution Order

Upon your approval:
* **Phase 2: Foundation & Components**: Install Inter font, setup tokens with sampled hex (`#C44C8B`, `#DC5F52`, `#F2731D`), build shared UI components.
* **Phase 3: Auth & Profile**: Set `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, install Google Sign-In, remove email/password and guest code, profile setup with `@username` uniqueness check and avatar upload.
* **Phase 4: Screens** (One commit per screen):
  1. Welcome / Google Sign-In
  2. Profile Setup
  3. Home Screen (Ref 8)
  4. Create Flow Step 1 (Duration Ref 6)
  5. Create Flow Step 2 (Interval Ref 9)
  6. Match Lobby (Ref 7)
  7. Advanced Settings (Ref 1)
  8. Friends Screen
  9. Profile & History Screen
  10. Game Rules Screen
* **Phase 5: Play Zone Editor** (Ref 3 Circle, Ref 2 Polygon, Ref 4 Off).
* **Phase 6: In-Game Screens** (Chaser satellite map, Runner compass without drawer).
* **Phase 7: Verification**: `FEATURE_PARITY.md` checklist, type checks, build APK.
