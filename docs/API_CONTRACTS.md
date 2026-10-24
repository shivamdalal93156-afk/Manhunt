# API & Realtime Contracts: GPS Manhunt

## 1. Remote Procedure Calls (RPC)

All game operations are executed via PostgreSQL functions or Supabase Edge Functions with authenticated JWTs (`auth.uid()`).

### 1.1 `create_game`
- **Method**: `POST /rpc/create_game`
- **Payload**:
  ```json
  {
    "mode": "STANDARD_MANHUNT",
    "settings": {
      "duration_minutes": 30,
      "head_start_seconds": 60,
      "location_ping_interval_seconds": 30,
      "max_players": 12,
      "runner_hearts": 3,
      "catch_radius_meters": 15,
      "shrinking_zone_enabled": false
    },
    "play_zone": {
      "type": "circle",
      "center": [-122.4194, 37.7749],
      "radius_meters": 600
    }
  }
  ```
- **Returns**: `{ "game_id": "...", "join_code": "HX89K2" }`

### 1.2 `join_game`
- **Method**: `POST /rpc/join_game`
- **Payload**: `{ "join_code": "HX89K2", "preferred_role": "RUNNER" }`
- **Returns**: `{ "game_id": "...", "player_id": "...", "role": "RUNNER", "status": "LOBBY" }`

### 1.3 `submit_player_location`
- **Method**: `POST /rpc/submit_player_location`
- **Payload**:
  ```json
  {
    "game_id": "uuid",
    "latitude": 37.774929,
    "longitude": -122.419416,
    "accuracy": 4.5,
    "heading": 182.4,
    "speed": 2.1,
    "measured_at": "2026-10-24T16:30:00.000Z"
  }
  ```
- **Validation**:
  - Rejects if accuracy > 50 meters (poor GPS).
  - Evaluates distance to play zone border.
  - Updates player's `last_seen_at`.
- **Returns**: `{ "accepted": true, "in_bounds": true, "distance_to_boundary_m": 120 }`

### 1.4 `record_catch`
- **Method**: `POST /rpc/record_catch`
- **Payload**:
  ```json
  {
    "game_id": "uuid",
    "target_player_id": "uuid",
    "hunter_latitude": 37.774900,
    "hunter_longitude": -122.419400
  }
  ```
- **Returns**: `{ "success": true, "runner_hearts_remaining": 0, "eliminated": true }`

### 1.5 `activate_ability`
- **Method**: `POST /rpc/activate_ability`
- **Payload**:
  ```json
  {
    "game_id": "uuid",
    "ability": "STEALTH",
    "target_player_id": null
  }
  ```
- **Returns**: `{ "success": true, "duration_seconds": 45, "cooldown_until": "..." }`

---

## 2. Realtime Channels & Subscriptions

### 2.1 Game Channel: `game:{game_id}`
- **Subscribed by**: All players in the match
- **Broadcast Events**:
  - `MATCH_STATE_CHANGED`: `{ "status": "ACTIVE", "started_at": "...", "ends_at": "..." }`
  - `PLAYER_JOINED`: `{ "player_id": "...", "display_name": "...", "role": "HUNTER" }`
  - `PLAYER_ROLE_CHANGED`: `{ "player_id": "...", "new_role": "RUNNER" }`
  - `PLAYER_CAUGHT`: `{ "runner_id": "...", "hunter_id": "...", "hearts_left": 2 }`
  - `ABILITY_ACTIVATED`: `{ "player_id": "...", "ability": "PING", "expires_at": "..." }`
  - `ZONE_SHRINKING`: `{ "new_radius_meters": 400, "duration_seconds": 300 }`

### 2.2 Hunter Radar Channel: `game:{game_id}:radar`
- **Subscribed by**: Hunters and Referees only
- **Broadcast Events**:
  - `RUNNER_PING_SNAPSHOT`:
    ```json
    {
      "runners": [
        {
          "player_id": "...",
          "display_name": "Runner 1",
          "latitude": 37.7751,
          "longitude": -122.4190,
          "freshness": "FRESH",
          "timestamp": "..."
        }
      ]
    }
    ```
