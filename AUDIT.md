# Comprehensive Technical Audit: GPS Manhunt Mobile App

**Date**: October 26, 2026  
**Auditor**: Senior React Native / Expo Engineer & Mobile Game Architect  
**Codebase**: React Native 0.76.9 / Expo SDK 52.0.0 (Bare/Managed Hybrid with Android folder)  
**Target Platform**: Android (Primary) / Low-End to High-End Android Devices  

---

## Executive Summary

The application is an ambitious physical outdoor GPS chase game ("GPS Manhunt") with asymmetric roles (Hunter vs Runner vs Referee), real-time Supabase replication, dynamic Battle Royale shrinking zones, and geodesic compass telemetry.

While the core networking and geodesic math engines are solid, the codebase exhibits classic symptoms of rapid **"vibe-coding"**:
1. **Extreme Monolithic Files**: Single components reaching **2,648 lines** (`index.tsx`), **1,526 lines** (`create.tsx`), and **1,302 lines** (`LivePlayZoneMap.tsx`), cramming multiple screens, sub-views, and modals into massive files.
2. **Game Loop & Performance Bottlenecks**: High-frequency GPS updates and panning gestures call React `setState` during active gestures, triggering full-tree re-renders on the JS thread without native driver transforms. Game countdown clocks use naive `setInterval` instead of wall-clock synchronization, falling out of sync when backgrounded.
3. **Severe Repository & Asset Bloat**: Over **88 unused screenshot PNGs totaling ~38.5 MB** litter the root directory and `src/app/`, while app icons are uncompressed 1.14 MB files.
4. **Security Vulnerability**: The Supabase `SERVICE_ROLE_KEY` is referenced in client source code via `EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`, exposing administrative database privileges in client bundles.
5. **Missing Mobile Game Polish**: No Android hardware back button handler (`BackHandler`), no ErrorBoundary (crashing the app on unhandled exceptions), and missing feedback (haptics/audio).

Below is the exhaustive, categorized audit report.

---

## 1. Performance and Game Loop

### 1.1 `setState` on PanResponder Move During Map Dragging
* **Location**: [src/components/game/LivePlayZoneMap.tsx:173-177](file:///c:/Users/SHIVAM/Desktop/manhunt/src/components/game/LivePlayZoneMap.tsx#L173-L177)
* **What's wrong**: In `onPanResponderMove`, `setPanOffset({ x: nextX, y: nextY })` triggers React `setState` on every pixel change during dragging.
* **Why it matters**: React Native must execute a full re-render pass on the JS thread for this 1,300-line component, recalculating Mercator projections and re-rendering all tile `<Image>` elements and overlays 60 times a second. On low-end Android devices, this causes severe touch lag and stutter.
* **Severity**: **High**
* **Proposed Fix**: Convert `panOffset` to `Animated.ValueXY` with `Animated.event` or transform styles using `useNativeDriver: true` so dragging transforms the tile container natively on the UI thread without re-rendering React.
* **Feasibility**: Easy.

---

### 1.2 Game Countdown Timer Desynchronization via `setInterval`
* **Location**: [src/app/game/runner.tsx:188-201](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/game/runner.tsx#L188-L201), [src/app/game/hunter.tsx:147-160](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/game/hunter.tsx#L147-L160)
* **What's wrong**: The match countdown timer decrements remaining seconds via `setTimeRemaining((prev) => prev - 1)` inside a `setInterval(..., 1000)`.
* **Why it matters**: In mobile operating systems (especially Android battery savers), JavaScript timers are throttled or suspended when the app is placed in the background or screen turns off. When the user resumes 2 minutes later, their local game clock will be 2 minutes behind the actual server match clock.
* **Severity**: **High**
* **Proposed Fix**: Store `matchEndTime` (calculated from match launch timestamp + duration) and compute `timeRemaining = Math.max(0, Math.floor((matchEndTime - Date.now()) / 1000))` on each tick and upon `AppState` resume.
* **Feasibility**: Easy.

---

### 1.3 Missing `React.memo` & Unmemoized Math in Frequent Render Loops
* **Location**: [src/components/game/TacticalRadarMap.tsx:33-57](file:///c:/Users/SHIVAM/Desktop/manhunt/src/components/game/TacticalRadarMap.tsx#L33-L57), [src/components/ui/Button.tsx:48-86](file:///c:/Users/SHIVAM/Desktop/manhunt/src/components/ui/Button.tsx#L48-L86)
* **What's wrong**: 
  - `TacticalRadarMap` recalculates `haversineDistance`, `initialBearing`, and trigonometric projections inside inline loop renders without `useMemo`. `const now = Date.now()` is evaluated inside render. The component itself lacks `React.memo`.
  - `Button.tsx` creates new arrays and style objects (`getContainerStyles()`, `getTextStyle()`) on every single render.
* **Why it matters**: When high-frequency GPS snapshots arrive (every 1s), unmemoized calculations re-allocate memory, triggering excessive garbage collection on Android.
* **Severity**: **Med**
* **Proposed Fix**: Wrap sub-components in `React.memo`, memoize radar point transformations with `useMemo`, and use static/pre-indexed stylesheet lookups for button variants.
* **Feasibility**: Easy.

---

### 1.4 Lists Rendered with `ScrollView` + `.map()` Instead of `FlatList`
* **Location**: 
  - [src/app/index.tsx:750-890](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/index.tsx#L750-L890) (Friends list & Match History)
  - [src/app/lobby/[id].tsx:244-310](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/lobby/%5Bid%5D.tsx#L244-L310) (Lobby players list)
* **What's wrong**: Player rosters and match histories are rendered as inline `.map()` iterations inside a vertical `ScrollView`.
* **Why it matters**: In matches with up to 30 players, or users with large friend lists and extended match histories, every row is permanently mounted in DOM/native memory with no windowing or view recycling.
* **Severity**: **Med**
* **Proposed Fix**: Replace `.map()` with `FlatList` with `keyExtractor` and `initialNumToRender={10}`.
* **Feasibility**: Easy.

---

### 1.5 Unused `expo-sensors` Dependency & Heading Fallback
* **Location**: [package.json:26](file:///c:/Users/SHIVAM/Desktop/manhunt/package.json#L26), [docs/ARCHITECTURE.md:44](file:///c:/Users/SHIVAM/Desktop/manhunt/docs/ARCHITECTURE.md#L44)
* **What's wrong**: `expo-sensors` is installed in `package.json` and documented as providing Magnetometer compass headings, but is **never imported or used anywhere** in `src/`. The app relies entirely on `currentLocation.heading` from GPS.
* **Why it matters**: GPS heading only updates when the user is physically moving faster than ~1 m/s. When a player stands still, hides behind cover, or turns on the spot, GPS heading becomes `NaN`, `0`, or stale, freezing the compass needle.
* **Severity**: **Med**
* **Proposed Fix**: Either implement `Magnetometer` from `expo-sensors` with a low-pass filter to smooth true device orientation when stationary, or uninstall `expo-sensors` if GPS heading is deliberately chosen to reduce battery consumption.
* **Feasibility**: Needs decision (trade-off between battery life and standing-still compass accuracy).

---

## 2. Code Quality ("Vibe-Coded" Smells)

### 2.1 Monolithic God-Components (2,600+ Line Screens)
* **Location**: 
  - [src/app/index.tsx](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/index.tsx) (2,648 lines)
  - [src/app/create.tsx](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/create.tsx) (1,526 lines)
  - [src/components/game/LivePlayZoneMap.tsx](file:///c:/Users/SHIVAM/Desktop/manhunt/src/components/game/LivePlayZoneMap.tsx) (1,302 lines)
  - [src/components/game/DirectionalCompass.tsx](file:///c:/Users/SHIVAM/Desktop/manhunt/src/components/game/DirectionalCompass.tsx) (1,267 lines)
* **What's wrong**: `index.tsx` contains 5 full sub-applications in a single file: Play Dashboard, Friends Manager, Profile & Stats Editor, Match History Viewer, and Join Match dialogs. `create.tsx` contains presets, sliders, ability toggles, map previews, and modals in one file.
* **Why it matters**: Violates single-responsibility principle; any state change causes massive re-evaluation; files are nearly impossible to maintain, review, or unit test independently.
* **Severity**: **High**
* **Proposed Fix**: Decompose `index.tsx` into modular tab views (`src/components/dashboard/PlayTab.tsx`, `FriendsTab.tsx`, `ProfileTab.tsx`, `HistoryTab.tsx`). Decompose `create.tsx` into setting sections (`ZoneConfigSection.tsx`, `AbilitiesConfigSection.tsx`).
* **Feasibility**: Easy, highly recommended refactor.

---

### 2.2 Leftover Dead Code & Deprecated Modules
* **Location**: 
  - [src/services/auth/guestAuth.ts](file:///c:/Users/SHIVAM/Desktop/manhunt/src/services/auth/guestAuth.ts) (140 lines)
  - [src/services/auth/__tests__/guestAuth.test.ts](file:///c:/Users/SHIVAM/Desktop/manhunt/src/services/auth/__tests__/guestAuth.test.ts) (112 lines)
  - [package.json:28](file:///c:/Users/SHIVAM/Desktop/manhunt/package.json#L28) (`query-string`)
  - [src/services/lobby/lobbyService.ts:12](file:///c:/Users/SHIVAM/Desktop/manhunt/src/services/lobby/lobbyService.ts#L12) (Unused `import { guestAuth }`)
* **What's wrong**: `guestAuth` was deprecated when guest accounts were removed, but the source file, unit tests, and imports remain in the repo. `query-string` is declared as a dependency in `package.json` but is never imported in the codebase.
* **Why it matters**: Dead code creates confusion, bloats test suites, and increases bundle size.
* **Severity**: **Low**
* **Proposed Fix**: Delete `guestAuth.ts` and its test; remove unused import in `lobbyService.ts`; uninstall `query-string`.
* **Feasibility**: Easy.

---

### 2.3 Missing Global Error Boundary & Crash Protection
* **Location**: [src/app/_layout.tsx](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/_layout.tsx)
* **What's wrong**: No React `ErrorBoundary` wraps the root layout.
* **Why it matters**: If an unexpected exception occurs (e.g. malformed Supabase payload, invalid JSON in storage, GPS timeout), the entire Android app crashes directly to the phone's home screen.
* **Severity**: **High**
* **Proposed Fix**: Add a React `ErrorBoundary` in `_layout.tsx` rendering `ErrorFallback.tsx` with a "Reload App" recovery button.
* **Feasibility**: Easy.

---

### 2.4 Lack of Formal Linter Setup
* **Location**: [package.json:13](file:///c:/Users/SHIVAM/Desktop/manhunt/package.json#L13)
* **What's wrong**: The `lint` script is merely `"tsc --noEmit"`. There is no ESLint config (`.eslintrc.js` or `eslint.config.js`) and no Prettier configuration.
* **Why it matters**: Style discrepancies, unused variables, unhandled hook dependencies, and dead imports go undetected by TypeScript alone.
* **Severity**: **Med**
* **Proposed Fix**: Install and configure `eslint-config-expo` and a standard `.prettierrc`.
* **Feasibility**: Easy.

---

## 3. UI/UX Polish

### 3.1 Missing Android Hardware Back Button Handling
* **Location**: All screens ([src/app/game/runner.tsx](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/game/runner.tsx), [src/app/game/hunter.tsx](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/game/hunter.tsx), [src/app/lobby/[id].tsx](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/lobby/%5Bid%5D.tsx))
* **What's wrong**: `BackHandler` is never registered.
* **Why it matters**: If a player accidentally taps Android's system back button or uses edge swipe navigation during an active chase, the app abruptly leaves the screen, breaks match state, or exits to the OS.
* **Severity**: **High**
* **Proposed Fix**: Add a reusable `useHardwareBack` hook that intercepts back gestures during active games and prompts: "Leave Match? Your squad will lose your GPS telemetry."
* **Feasibility**: Easy.

---

### 3.2 Lack of Haptic & Audio Feedback on Critical Gameplay Events
* **Location**: [src/app/game/hunter.tsx:260-278](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/game/hunter.tsx#L260-L278), [src/app/game/runner.tsx:123-140](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app/game/runner.tsx#L123-L140)
* **What's wrong**: When a catch is confirmed, a heart is lost, an ability is activated, or the radar pings, there is zero tactile or acoustic feedback. The user only gets a basic system `Alert.alert`.
* **Why it matters**: In outdoor physical chase games, players are running with their phone in their hand or looking at their surroundings. Haptic pulses (heavy impact on catch, warning vibration on danger perimeter) are essential for situational awareness.
* **Severity**: **Med**
* **Proposed Fix**: Integrate `expo-haptics` (or `Vibration` API) for catch confirmation, boundary violations, and radar clicks.
* **Feasibility**: Easy (uses free standard native APIs).

---

### 3.3 Abrupt Non-Animated Drawer Transitions
* **Location**: [src/components/game/GameBottomDrawer.tsx:137](file:///c:/Users/SHIVAM/Desktop/manhunt/src/components/game/GameBottomDrawer.tsx#L137)
* **What's wrong**: The bottom drawer toggles between collapsed and expanded states by switching style classes (`styles.sheetContainerCollapsed`) instantly without smooth animation.
* **Why it matters**: Looks jerky and unpolished.
* **Severity**: **Low**
* **Proposed Fix**: Wrap drawer vertical translation in an `Animated.Value` driven by `Animated.spring` or `Animated.timing`.
* **Feasibility**: Easy.

---

## 4. Assets and Size

### 4.1 Massive Screenshot Clutter in Repository
* **Location**: Root directory (69 PNGs, ~27.8 MB) and [src/app/](file:///c:/Users/SHIVAM/Desktop/manhunt/src/app) (19 PNGs, ~10.7 MB)
* **What's wrong**: 88 debug/verification screenshot PNGs (`verify_hunter.png`, `emulator_create.png`, etc.) are sitting directly in the source code folders.
* **Why it matters**: Bloats git repository size, slows down git operations, and risks packing unnecessary assets into build bundles.
* **Severity**: **High**
* **Proposed Fix**: Move necessary documentation screenshots to a separate `docs/screenshots/` folder (or `.gitignore` them) and delete obsolete emulator dump images from `src/app/` and project root.
* **Feasibility**: Easy.

---

### 4.2 Uncompressed 1.14 MB App Icons & Missing Splash Image
* **Location**: [assets/icon.png](file:///c:/Users/SHIVAM/Desktop/manhunt/assets/icon.png) (1.14 MB), [assets/adaptive-icon.png](file:///c:/Users/SHIVAM/Desktop/manhunt/assets/adaptive-icon.png) (1.14 MB), [app.json:10-12](file:///c:/Users/SHIVAM/Desktop/manhunt/app.json#L10-L12)
* **What's wrong**: 
  - Both icon files are uncompressed 1024x1024 PNGs taking ~2.3 MB.
  - `app.json` specifies `"splash": { "backgroundColor": "#0B0E14" }` with no `"image"` property, resulting in a blank black screen during cold boot before React Native mounts.
* **Why it matters**: Increases APK size unnecessarily; cold start appears unbranded.
* **Severity**: **Med**
* **Proposed Fix**: Losslessly compress icons with pngquant/tinypng (reducing size by ~70-80%); create a clean centered `splash.png` asset and reference it in `app.json`.
* **Feasibility**: Easy.

---

### 4.3 Proguard / R8 Minification Disabled in Release Builds
* **Location**: [android/app/build.gradle:111-114](file:///c:/Users/SHIVAM/Desktop/manhunt/android/app/build.gradle#L111-L114), [android/gradle.properties](file:///c:/Users/SHIVAM/Desktop/manhunt/android/gradle.properties)
* **What's wrong**: `enableProguardInReleaseBuilds` is not enabled in `gradle.properties`, meaning R8 code minification and unused resource shrinking (`shrinkResources`) are turned off.
* **Why it matters**: The resulting release APK is ~62.8 MB. Enabling R8 and resource shrinking typically drops release APK size by 15-25 MB by stripping unused native methods and libraries.
* **Severity**: **Med**
* **Proposed Fix**: Enable `enableProguardInReleaseBuilds=true` and `android.enableShrinkResourcesInReleaseBuilds=true` in `gradle.properties`.
* **Feasibility**: Needs validation to ensure Proguard rules preserve reflection-based Expo modules.

---

### 4.4 `expo-dev-client` in Production Dependencies
* **Location**: [package.json:22](file:///c:/Users/SHIVAM/Desktop/manhunt/package.json#L22)
* **What's wrong**: `"expo-dev-client": "~5.0.20"` is bundled in production `dependencies`.
* **Why it matters**: Adds developer menu overhead and unnecessary native modules to the release build.
* **Severity**: **Low**
* **Proposed Fix**: Move `expo-dev-client` to `devDependencies` or ensure production builds strip dev-launcher activities.
* **Feasibility**: Easy.

---

## 5. Data, Security, and Persistence

### 5.1 Critical Security Risk: Client Exposure of Supabase Service Role Key
* **Location**: [src/services/auth/authService.ts:19-29](file:///c:/Users/SHIVAM/Desktop/manhunt/src/services/auth/authService.ts#L19-L29)
* **What's wrong**: `authService.ts` checks `process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` to instantiate an administrative client (`adminSupabase`) with service role privileges.
* **Why it matters**: In Expo, all variables prefixed with `EXPO_PUBLIC_` are statically inlined into the client JavaScript bundle. Anyone decompiling the APK can extract this key and obtain unrestricted administrative access to the entire Supabase database, bypassing all Row Level Security (RLS) policies!
* **Severity**: **High (Critical)**
* **Proposed Fix**: Remove the client-side `serviceRoleKey` usage. Account creation should use standard client `supabase.auth.signUp()`, with email confirmation disabled in the Supabase project dashboard (Auth Settings -> "Confirm email: OFF"), which is free, standard, and secure for mobile games.
* **Feasibility**: Needs decision / Supabase dashboard alignment.

---

### 5.2 Background Location Tracking Permission Risk
* **Location**: [app.json:34](file:///c:/Users/SHIVAM/Desktop/manhunt/app.json#L34) (`ACCESS_BACKGROUND_LOCATION`)
* **What's wrong**: `ACCESS_BACKGROUND_LOCATION` is requested in `app.json`.
* **Why it matters**: On Android 11+ (API level 30+), requesting background location alongside foreground location automatically causes the OS to fail or deny both. Furthermore, if the app is ever listed on Google Play, Google requires an extensive video audit and justification for background location, frequently rejecting casual apps.
* **Severity**: **Med**
* **Proposed Fix**: For APK sharing and low-end Android stability, rely on Android Foreground Service (`FOREGROUND_SERVICE_LOCATION`) with an active persistent notification while the match runs. This maintains continuous GPS in pocket without requiring dangerous `ACCESS_BACKGROUND_LOCATION`.
* **Feasibility**: Easy.

---

## 6. Store-Readiness (Play Store Listing Preparation)

| Item | Current Status | Store Requirement | Severity | Proposed Fix |
| :--- | :--- | :--- | :--- | :--- |
| **Package Name** | `com.manhunt.gpsmanhunt` | Unique reverse-DNS package | Low | Retain; clean and appropriate. |
| **Version Code** | Not declared in `app.json` | Integer incrementing per release | **High** | Add `"versionCode": 1` in `app.json:android`. |
| **Signing Config** | Uses `debug.keystore` | Dedicated release keystore (upload key) | **High** | Configure a release keystore for production signing. |
| **Privacy Policy** | Missing in repo/app | Required for all GPS/location apps | **High** | Create `PRIVACY_POLICY.md` and link in Settings screen. |
| **Adaptive Icon** | Included (needs compression) | 1024x1024 icon + foreground/background | Med | Compress asset to < 200 KB. |
| **Target SDK** | Defaults to Expo SDK 52 (SDK 35) | Android 14+ (SDK 34/35) compliant | Low | Compliant with Google Play policies. |

---

## 7. Metrics Summary

| Metric | Current State | Target Post-Cleanup |
| :--- | :--- | :--- |
| **Largest File Size** | 2,648 lines (`src/app/index.tsx`) | < 500 lines per modular view |
| **Unused Repo Assets** | 88 PNG screenshots (~38.5 MB) | 0 screenshots in source tree |
| **App Icons Size** | 2.28 MB (2 files) | < 350 KB |
| **Unused Dependencies** | `query-string` | 0 unused packages |
| **Dead Code** | `guestAuth.ts` + tests (252 lines) | 0 dead files |
| **Error Handling** | No root ErrorBoundary | Full ErrorBoundary with recovery |
| **Hardware Back Button** | Unhandled (accidental exits) | Intercepted with confirmation modal |
| **Release APK Size** | 62.8 MB | ~45-50 MB (with R8 + asset cleanup) |
