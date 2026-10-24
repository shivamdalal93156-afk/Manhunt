# Reference Research: Hunting Game (GPS Manhunt)

## 1. Executive Summary & Methodology
This document captures the publicly observable product specifications, reverse-engineered mechanics, and architecture analysis for the reference application **"Hunting Game: GPS Manhunt"** (Android `com.jasperaelvoet.HuntingGame`, iOS ID `1615829631`, website `hunting-game.com` by Jasper Aelvoet).

*Note: In accordance with project instructions, no proprietary reverse-engineering skill was present in the environment; a structured, lawful, manual inspection of public product surfaces was performed (Google Play Store, Apple App Store, official website documentation, community guides, and published privacy policy).*

---

## 2. Feature & Rules Matrix

| Feature Name | Description | Player Role Affected | Trigger Conditions | Expected Result | Edge Cases | Evidence Source | Confidence Level | Implementation Notes |
|---|---|---|---|---|---|---|---|---|
| **Lobby Creation & Join Code** | Host creates game lobby; an alphanumeric join code is generated. Players enter code to enter. | All | Host taps "Create Game"; Guests enter code | Player joins lobby state, role selector appears, real-time list updates | Malformed code, expired match, full lobby | Store listing, hunting-game.com | High | 6-char cryptographically random unguessable code, rate-limited join attempts. |
| **Play Zone Geofence** | Host defines bounding radius or polygon around a center location. | All | Map setup screen before match launch | Boundary polygon rendered; coordinates enforced by server | GPS drift outside boundary, poor signal | hunting-game.com, Store description | High | PostGIS / Turf.js point-in-polygon/circle calculations; 10-15m grace distance. |
| **Head Start Period** | Countdown grace period at game start (default: 60-120s). | Hunters & Runners | Game starts from LOBBY -> COUNTDOWN -> ACTIVE | Runners can disperse; hunter radars are dark; catches disabled | Reconnection during countdown, host pause | hunting-game.com rules documentation | High | Server-side authoritative timestamp `head_start_ends_at`. |
| **Hunter Radar / Map** | Interactive map showing play zone, team members, and periodic runner pings. | Hunters | Active match phase after head start | Markers rendered with location freshness indicators and timestamps | Runners invisible due to stealth, delayed updates | Store listing & screenshots | High | Server filters runner coordinates to only authorized snapshots (never leaks raw coords). |
| **Runner Compass** | Asymmetric tracking tool: direction arrow pointing toward nearest hunter. | Runners | Active match phase | Device compass calculates relative bearing: `(bearing - heading + 360) % 360` | Magnetic interference, missing device heading, zero hunters left | hunting-game.com rules, Store listing | High | Fallback to GPS course heading if magnetometer sensor is unavailable. |
| **Catch Proximity & Confirmation** | Hunter gets within ~15m of runner and issues catch. Runner gets prompt or code. | Hunter & Runner | Hunter < 15m distance to Runner | Hunter initiates catch request; runner has countdown to accept or code entry | GPS inaccuracy, simultaneous catch requests, timer expiring mid-catch | hunting-game.com documentation | High | Server-validated distance checking with threshold; match-scoped catch codes or 20s confirmation. |
| **Hearts / Lives System** | Runners have lives (typically 1-3). Hunters have lives or infinite. | Runners / Hunters | Catch confirmed or boundary violation timeout | Runner loses 1 heart; at 0 hearts runner becomes Spectator / Caught | Out of bounds draining hearts, disconnects | hunting-game.com rules | High | Authoritative `hearts_remaining` on `game_players` table. |
| **Stealth / Invisibility Power-up** | Runner activates stealth; runner's location is suppressed from hunter radar. | Runners | Runner taps stealth ability | Hunter radar excludes runner for configured duration (e.g. 60s) | Hunter pings while stealth is active | hunting-game.com store listing | High | Server explicitly filters out runner during `active_effects` window. |
| **Radar Ping / Force Update** | Hunter forces instant location refresh for all runners. | Hunters | Hunter triggers ping ability | Immediate fresh location snapshot distributed to hunter radar | Runner under Stealth effect (Stealth overrides Ping) | hunting-game.com, Store listing | High | Server queries latest authorized runner position and creates visibility snapshot. |
| **Blind / Blackout Power-up** | Disrupts opponent's primary sensor (runner compass or hunter map). | Both | Player activates Blind | Target screen shows "Jammed / Blinded" overlay for duration | Disconnection while blinded | hunting-game.com rules | High | Server broadcasts active effect flag; client shows interference HUD. |
| **Map View Power-up** | Runner temporarily gains full map view of hunters. | Runners | Runner activates Map View | Map unlocked for runner for e.g. 15-30s | GPS signal loss during map reveal | hunting-game.com rules | High | Server issues temporary hunter snapshot stream to runner. |
| **Fake Location / Decoy** | Hunter or runner drops a decoy marker at false coordinates. | Both | Player activates Decoy | Opponents see false position marker | Real position leakage | hunting-game.com rules | High | Separate `decoy_locations` entity; real GPS coordinates are never modified. |
| **Shrinking Play Zone** | Play area progressively contracts over match duration to force confrontation. | All | Configured in match settings (start time & shrink duration) | Play zone radius/boundary scales down over time | Players caught outside shrinking border | Store listing & Pro features | High | Server calculates current radius based on `elapsed_time` interpolation. |
| **Supervisor / Referee Role** | Dedicated non-playing moderator to view all players and enforce safety. | Referee | Assigned in lobby | Views unredacted map, boundary status, pause/resume game controls | Unauthorized client trying to claim supervisor | Store listing "Family mode" & supervisor role | High | RLS + backend validation strictly restricts supervisor view to verified role. |
| **Safety Guidelines & Privacy Wipe** | 5-minute post-match data wipe of location breadcrumbs and chat logs. | All | Game state -> FINISHED | Transient locations deleted; tracking stops immediately | Abrupt app kill | hunting-game.com Privacy Policy | High | Native foreground service stops on match end; DB cleanup cron/trigger. |

---

## 3. Verified Behavior vs Assumptions

### Verified Behavior:
1. **Asymmetric UX**: Hunters have live/interval map tracking; Runners rely on a directional compass and threat proximity.
2. **Periodic Location Snapshots**: Hunter radar does not stream continuous millisecond coordinates; it updates at configurable intervals (e.g. 30s, 60s, or live) to balance battery and gameplay tension.
3. **Catch Verification**: Distance must be <= ~15 meters; prevents accidental or fraudulent remote catches.
4. **Data Privacy**: Location is strictly gathered only during active games; background tracking is stopped immediately upon match completion.

### Assumptions & Defaults:
1. **Catch Resolution**: Reference app supports both physical code entry and a 20-second timeout/tap response. We will implement both: a match-scoped 4-digit runner catch code or direct proximity prompt with server validation.
2. **Cross-Platform Compatibility**: Use Expo + React Native with native location foreground services on Android (`expo-location` with `startLocationUpdatesAsync`) and iOS background location modes.
3. **Offline / Drift Grace**: 15-meter GPS buffer before declaring an out-of-bounds warning, requiring 2 consecutive out-of-bounds readings to avoid false positives from indoor or high-rise GPS multipath.
