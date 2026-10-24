# Database Schema & Migrations: GPS Manhunt

## 1. Schema Overview

The database leverages PostgreSQL with the PostGIS extension for spatial computations, JSONB for flexible match settings, and Row-Level Security (RLS) for data privacy.

---

## 2. SQL DDL Specification

```sql
-- Enable PostGIS extension for geographic spatial calculations
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL CHECK (char_length(display_name) >= 2 AND char_length(display_name) <= 30),
    avatar_url TEXT,
    is_guest BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Games Table
CREATE TYPE game_status AS ENUM ('CREATED', 'LOBBY', 'COUNTDOWN', 'ACTIVE', 'PAUSED', 'FINISHED', 'CANCELLED');
CREATE TYPE game_mode AS ENUM ('STANDARD_MANHUNT', 'FAMILY_MODE', 'HIDE_AND_SEEK');

CREATE TABLE IF NOT EXISTS public.games (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    join_code VARCHAR(6) UNIQUE NOT NULL,
    host_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    mode game_mode DEFAULT 'STANDARD_MANHUNT',
    status game_status DEFAULT 'LOBBY',
    
    -- Game rules & configuration (JSONB)
    settings JSONB NOT NULL DEFAULT '{
        "duration_minutes": 30,
        "head_start_seconds": 60,
        "location_ping_interval_seconds": 30,
        "max_players": 12,
        "runner_hearts": 3,
        "catch_radius_meters": 15,
        "shrinking_zone_enabled": false,
        "shrink_delay_minutes": 10,
        "shrink_duration_minutes": 10,
        "abilities_enabled": true
    }'::jsonb,
    
    -- Play zone geography (PostGIS Polygon or Circle definition)
    -- play_zone stores: { "type": "circle", "center": [lng, lat], "radius_meters": 500 }
    -- or GeoJSON geometry polygon
    play_zone JSONB NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    head_start_ends_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    winner_team TEXT CHECK (winner_team IN ('HUNTERS', 'RUNNERS', 'DRAW', NULL))
);

CREATE INDEX idx_games_join_code ON public.games(join_code);
CREATE INDEX idx_games_status ON public.games(status);

-- 3. Game Players Table
CREATE TYPE player_role AS ENUM ('HUNTER', 'RUNNER', 'REFEREE', 'SPECTATOR');
CREATE TYPE player_status AS ENUM ('ALIVE', 'CAUGHT', 'OUT_OF_BOUNDS', 'DISCONNECTED');

CREATE TABLE IF NOT EXISTS public.game_players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role player_role NOT NULL DEFAULT 'RUNNER',
    status player_status NOT NULL DEFAULT 'ALIVE',
    is_ready BOOLEAN DEFAULT FALSE,
    hearts_remaining INT NOT NULL DEFAULT 3,
    catch_code VARCHAR(4), -- Private code runner gives when caught or verified
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    caught_at TIMESTAMPTZ,
    caught_by_id UUID REFERENCES public.game_players(id),
    
    CONSTRAINT uq_game_user UNIQUE(game_id, user_id)
);

CREATE INDEX idx_game_players_game_role ON public.game_players(game_id, role);

-- 4. Player Raw Locations (Strictly Authorized / Never Exposed to Opponents)
CREATE TABLE IF NOT EXISTS public.player_locations (
    id BIGSERIAL PRIMARY KEY,
    game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES public.game_players(id) ON DELETE CASCADE,
    geom GEOMETRY(Point, 4326) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    accuracy DOUBLE PRECISION,
    heading DOUBLE PRECISION,
    speed DOUBLE PRECISION,
    measured_at TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_player_locations_game_player ON public.player_locations(game_id, player_id, measured_at DESC);
CREATE INDEX idx_player_locations_geom ON public.player_locations USING GIST(geom);

-- 5. Location Visibility Snapshots (Authoritative Opponent View)
CREATE TABLE IF NOT EXISTS public.location_visibility_snapshots (
    id BIGSERIAL PRIMARY KEY,
    game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    target_player_id UUID NOT NULL REFERENCES public.game_players(id) ON DELETE CASCADE,
    audience player_role NOT NULL, -- Which team can see this snapshot ('HUNTER' or 'RUNNER')
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    is_decoy BOOLEAN DEFAULT FALSE,
    visible_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_visibility_game_audience ON public.location_visibility_snapshots(game_id, audience, expires_at);

-- 6. Active Abilities & Effects
CREATE TYPE ability_type AS ENUM ('STEALTH', 'PING', 'BLIND', 'MAP_VIEW', 'DECOY');

CREATE TABLE IF NOT EXISTS public.active_effects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES public.game_players(id) ON DELETE CASCADE,
    ability ability_type NOT NULL,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    cooldown_until TIMESTAMPTZ NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_active_effects_game_player ON public.active_effects(game_id, player_id, expires_at);

-- 7. Game Events / Audit Log
CREATE TABLE IF NOT EXISTS public.game_events (
    id BIGSERIAL PRIMARY KEY,
    game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES public.game_players(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Match Chat Messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id BIGSERIAL PRIMARY KEY,
    game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.game_players(id) ON DELETE CASCADE,
    audience player_role, -- NULL = ALL, or 'HUNTER', 'RUNNER'
    content TEXT NOT NULL CHECK (char_length(content) >= 1 AND char_length(content) <= 300),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 3. Row-Level Security (RLS) Policies

1. **Profiles**:
   - `SELECT`: Publicly viewable for players in mutual games.
   - `UPDATE`: `auth.uid() = id`.
2. **Games**:
   - `SELECT`: Any player can look up an active/lobby game by `join_code`.
   - `UPDATE`: Only `host_id = auth.uid()`.
3. **Player Locations (`player_locations`)**:
   - `INSERT`: Player can only insert their own `player_id`.
   - `SELECT`: **STRICT RULE**: Only the player himself (`user_id = auth.uid()`) OR a verified `REFEREE` can select from `player_locations`. Opponents CANNOT select from this table.
4. **Location Visibility Snapshots (`location_visibility_snapshots`)**:
   - `SELECT`: Player can select if their role matches `audience` OR if user is `REFEREE`.
5. **Chat Messages**:
   - Player can select messages where `audience IS NULL` OR `audience = my_role`.
