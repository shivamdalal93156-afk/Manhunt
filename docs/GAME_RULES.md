# Game Rules & Mechanics: GPS Manhunt

## 1. Game Roles & Objectives

### 1.1 The Hunters (Chasers)
- **Objective**: Track and eliminate all Runners by closing distance to within 15 meters before the match timer expires.
- **Sensory Tool**: Tactical Radar Map displaying the play zone boundary, fellow hunters, and periodic location pings of active runners.
- **Special Abilities**:
  - **Radar Ping (Force Update)**: Instantly reveals fresh coordinates of all active runners (cooldown: 90s).
  - **Blind**: Jam runner compass needles for 20 seconds (cooldown: 120s).
  - **Decoy**: Emit a false ping location on the runner's radar/compass (cooldown: 180s).

### 1.2 The Runners
- **Objective**: Evade hunters and survive within the play zone until the match countdown clock hits 0:00.
- **Sensory Tool**: Directional Geodesic Compass with proximity danger gradient (Green: >150m, Orange: 50-150m, Red Flash: <50m). Runners do NOT have an unearned continuous map view of hunters.
- **Special Abilities**:
  - **Stealth / Ghost**: Temporarily disappear from hunter radar for 45 seconds (cooldown: 120s).
  - **Map View**: Unlocks 15 seconds of live map vision displaying hunter locations (cooldown: 180s).
  - **Sprint Boost / Decoy**: Drops a stationary false signal to divert hunters away.

### 1.3 The Referee (Supervisor / Family Mode)
- **Objective**: Non-playing moderator who maintains safety, monitors player boundaries, and resolves disputes.
- **Privileges**: Unrestricted view of all live GPS positions, speed telemetry, manual pause/resume, and player status overrides.

---

## 2. Match Phases & Timing

```
[ LOBBY ] 
   │  Host clicks "Launch Game" (Minimum 1 Hunter & 1 Runner required)
   ▼
[ COUNTDOWN / HEAD START ] (60 - 120 seconds)
   │  - Runners disperse into the play zone
   │  - Hunter screens show head start countdown; map radar is dark
   │  - Catches are disabled
   ▼
[ ACTIVE CHASE ] (Default 20 - 45 minutes)
   │  - Hunter radar updates every X seconds (e.g. 30s)
   │  - Runner compass updates continuously based on device heading & GPS
   │  - Abilities active with cooldown timers
   │  - Shrinking zone (optional): Warning at minute 10, shrinks over 5 mins
   ▼
[ MATCH RESOLUTION / FINISHED ]
   - Hunters win if: All runners reach 0 hearts.
   - Runners win if: Match timer reaches 00:00 and at least 1 runner survives.
```

---

## 3. Catch Mechanics & Validation

1. **Physical Proximity**:
   - The Hunter's client evaluates distance to the runner. When distance $< 15\text{m}$, the "TRIGGER CATCH" button becomes active.
2. **Authoritative Server Verification**:
   - Hunter sends `POST /rpc/record_catch { target_player_id, hunter_location }`.
   - The backend checks:
     - Match state is `ACTIVE` and head start has elapsed.
     - Distance between hunter's latest verified GPS and runner's latest GPS $\le 20\text{m}$ (including 5m GPS variance allowance).
     - Runner is still `ALIVE`.
3. **Catch Resolution**:
   - Runner loses 1 heart.
   - If hearts reach 0, runner role transitions to `CAUGHT` / `SPECTATOR`.
   - An audit event `PLAYER_CAUGHT` is logged and broadcast to all players in the lobby with an audio chime and haptic feedback.
