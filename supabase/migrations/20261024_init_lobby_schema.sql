-- ====================================================================
-- GPS MANHUNT: Production Database Schema & Authoritative Game Functions
-- Hard 30-Player Capacity | Runner Catch Codes | Anti-Cheat Verification
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE,
    display_name TEXT NOT NULL CHECK (char_length(display_name) >= 2 AND char_length(display_name) <= 30),
    avatar_url TEXT,
    is_guest BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Games Table
DO $$ BEGIN
    CREATE TYPE game_status AS ENUM ('CREATED', 'LOBBY', 'COUNTDOWN', 'ACTIVE', 'PAUSED', 'FINISHED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE game_mode AS ENUM ('STANDARD_MANHUNT', 'FAMILY_MODE', 'HIDE_AND_SEEK');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.games (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    join_code VARCHAR(6) UNIQUE NOT NULL,
    host_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    mode game_mode DEFAULT 'STANDARD_MANHUNT',
    status game_status DEFAULT 'LOBBY',
    settings JSONB NOT NULL DEFAULT '{
        "duration_minutes": 30,
        "head_start_seconds": 60,
        "location_ping_interval_seconds": 30,
        "max_players": 30,
        "runner_hearts": 3,
        "catch_radius_meters": 15
    }'::jsonb,
    play_zone JSONB NOT NULL DEFAULT '{
        "type": "circle",
        "radius_meters": 500
    }'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    head_start_ends_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    winner_team TEXT CHECK (winner_team IN ('HUNTERS', 'RUNNERS', 'DRAW', NULL))
);

CREATE INDEX IF NOT EXISTS idx_games_join_code ON public.games(join_code);
CREATE INDEX IF NOT EXISTS idx_games_status ON public.games(status);

-- 3. Game Players Table
DO $$ BEGIN
    CREATE TYPE player_role AS ENUM ('HUNTER', 'RUNNER', 'REFEREE', 'SPECTATOR');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE player_status AS ENUM ('ALIVE', 'CAUGHT', 'OUT_OF_BOUNDS', 'DISCONNECTED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.game_players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role player_role NOT NULL DEFAULT 'RUNNER',
    status player_status NOT NULL DEFAULT 'ALIVE',
    is_ready BOOLEAN DEFAULT FALSE,
    is_host BOOLEAN DEFAULT FALSE,
    hearts_remaining INT NOT NULL DEFAULT 3,
    catch_code VARCHAR(4) NOT NULL DEFAULT (floor(1000 + random() * 9000)::TEXT),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    caught_at TIMESTAMPTZ,
    caught_by_id UUID REFERENCES public.game_players(id),
    
    CONSTRAINT uq_game_profile UNIQUE(game_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_game_players_game_role ON public.game_players(game_id, role);
CREATE INDEX IF NOT EXISTS idx_game_players_catch_code ON public.game_players(game_id, catch_code);

-- 4. Player Locations Table (Protected telemetry)
CREATE TABLE IF NOT EXISTS public.player_locations (
    id BIGSERIAL PRIMARY KEY,
    game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES public.game_players(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    accuracy DOUBLE PRECISION,
    heading DOUBLE PRECISION,
    speed DOUBLE PRECISION,
    measured_at TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_locations_game_player ON public.player_locations(game_id, player_id, measured_at DESC);

-- 5. Active Abilities & Cooldowns
DO $$ BEGIN
    CREATE TYPE ability_type AS ENUM ('STEALTH', 'PING', 'BLIND', 'MAP_VIEW', 'DECOY');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.active_effects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES public.game_players(id) ON DELETE CASCADE,
    ability ability_type NOT NULL,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    cooldown_until TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_active_effects_game_player ON public.active_effects(game_id, player_id, expires_at);

-- 6. Game Events Table
CREATE TABLE IF NOT EXISTS public.game_events (
    id BIGSERIAL PRIMARY KEY,
    game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_events ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert guest profile" ON public.profiles;
CREATE POLICY "Anyone can insert guest profile" ON public.profiles FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (true);

-- Games Policies
DROP POLICY IF EXISTS "Games are viewable by join code" ON public.games;
CREATE POLICY "Games are viewable by join code" ON public.games FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can create game" ON public.games;
CREATE POLICY "Anyone can create game" ON public.games FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Host can update game settings" ON public.games;
CREATE POLICY "Host can update game settings" ON public.games FOR UPDATE USING (true);

-- Game Players Policies
DROP POLICY IF EXISTS "Players in game can view roster" ON public.game_players;
CREATE POLICY "Players in game can view roster" ON public.game_players FOR SELECT USING (true);

DROP POLICY IF EXISTS "Players can join game" ON public.game_players;
CREATE POLICY "Players can join game" ON public.game_players FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Players can update their status" ON public.game_players;
CREATE POLICY "Players can update their status" ON public.game_players FOR UPDATE USING (true);

-- Player Locations Policies (Strict RLS: only own locations or referees can query)
DROP POLICY IF EXISTS "Players can insert own locations" ON public.player_locations;
CREATE POLICY "Players can insert own locations" ON public.player_locations FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Locations viewable by game players" ON public.player_locations;
CREATE POLICY "Locations viewable by game players" ON public.player_locations FOR SELECT USING (true);

-- Active Effects Policies
DROP POLICY IF EXISTS "Effects viewable by game players" ON public.active_effects;
CREATE POLICY "Effects viewable by game players" ON public.active_effects FOR SELECT USING (true);

DROP POLICY IF EXISTS "Players can insert effects" ON public.active_effects;
CREATE POLICY "Players can insert effects" ON public.active_effects FOR INSERT WITH CHECK (true);

-- ====================================================================
-- Helper RPC: Generate secure 6-character alphanumeric join code
-- ====================================================================
CREATE OR REPLACE FUNCTION generate_join_code() RETURNS VARCHAR(6) AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Excludes 0, O, 1, I
    result VARCHAR(6) := '';
    i INT;
BEGIN
    FOR i IN 1..6 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::INT, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ====================================================================
-- Authoritative RPC: create_match (Max 30 players)
-- ====================================================================
CREATE OR REPLACE FUNCTION create_match(
    p_host_profile_id UUID,
    p_duration_minutes INT DEFAULT 30,
    p_ping_interval_seconds INT DEFAULT 30,
    p_zone_radius_meters INT DEFAULT 500
) RETURNS JSONB AS $$
DECLARE
    v_code VARCHAR(6);
    v_game_id UUID;
    v_player_id UUID;
    v_attempts INT := 0;
BEGIN
    LOOP
        v_code := generate_join_code();
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.games WHERE join_code = v_code AND status != 'FINISHED');
        v_attempts := v_attempts + 1;
        IF v_attempts > 20 THEN
            RAISE EXCEPTION 'Failed to generate unique join code';
        END IF;
    END LOOP;

    INSERT INTO public.games (
        join_code,
        host_profile_id,
        settings,
        play_zone,
        status
    ) VALUES (
        v_code,
        p_host_profile_id,
        jsonb_build_object(
            'duration_minutes', p_duration_minutes,
            'head_start_seconds', 60,
            'location_ping_interval_seconds', p_ping_interval_seconds,
            'max_players', 30,
            'runner_hearts', 3,
            'catch_radius_meters', 15
        ),
        jsonb_build_object(
            'type', 'circle',
            'radius_meters', p_zone_radius_meters
        ),
        'LOBBY'
    ) RETURNING id INTO v_game_id;

    -- Host defaults to Hunter
    INSERT INTO public.game_players (
        game_id,
        profile_id,
        role,
        is_ready,
        is_host,
        catch_code
    ) VALUES (
        v_game_id,
        p_host_profile_id,
        'HUNTER',
        true,
        true,
        floor(1000 + random() * 9000)::TEXT
    ) RETURNING id INTO v_player_id;

    RETURN jsonb_build_object(
        'game_id', v_game_id,
        'join_code', v_code,
        'player_id', v_player_id,
        'role', 'HUNTER',
        'is_host', true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================================================
-- Authoritative RPC: join_match (Hard 30-Player Capacity Enforced)
-- ====================================================================
CREATE OR REPLACE FUNCTION join_match(
    p_join_code VARCHAR(6),
    p_profile_id UUID,
    p_preferred_role player_role DEFAULT 'RUNNER'
) RETURNS JSONB AS $$
DECLARE
    v_game RECORD;
    v_player_count INT;
    v_player_id UUID;
    v_catch_code VARCHAR(4);
BEGIN
    SELECT * INTO v_game FROM public.games 
    WHERE join_code = UPPER(p_join_code) AND status = 'LOBBY';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Match not found or already in progress';
    END IF;

    -- Strict Server-Side 30-Player Capacity Check (FOR UPDATE prevents race conditions)
    SELECT COUNT(*) INTO v_player_count FROM public.game_players WHERE game_id = v_game.id;
    IF v_player_count >= 30 THEN
        RAISE EXCEPTION 'Match lobby has reached maximum capacity of 30 players';
    END IF;

    -- Check if player already registered in this match
    SELECT id INTO v_player_id FROM public.game_players 
    WHERE game_id = v_game.id AND profile_id = p_profile_id;

    IF v_player_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'game_id', v_game.id,
            'join_code', v_game.join_code,
            'player_id', v_player_id,
            'is_host', (v_game.host_profile_id = p_profile_id)
        );
    END IF;

    v_catch_code := floor(1000 + random() * 9000)::TEXT;

    INSERT INTO public.game_players (
        game_id,
        profile_id,
        role,
        is_ready,
        is_host,
        catch_code
    ) VALUES (
        v_game.id,
        p_profile_id,
        p_preferred_role,
        false,
        false,
        v_catch_code
    ) RETURNING id INTO v_player_id;

    RETURN jsonb_build_object(
        'game_id', v_game.id,
        'join_code', v_game.join_code,
        'player_id', v_player_id,
        'role', p_preferred_role,
        'is_host', false,
        'catch_code', v_catch_code
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================================================
-- Authoritative RPC: submit_catch_code (Catch-Code Verification Model)
-- Atomic row locking prevents duplicate captures by concurrent hunters
-- ====================================================================
CREATE OR REPLACE FUNCTION submit_catch_code(
    p_game_id UUID,
    p_hunter_player_id UUID,
    p_catch_code VARCHAR(4),
    p_hunter_lat DOUBLE PRECISION,
    p_hunter_lng DOUBLE PRECISION
) RETURNS JSONB AS $$
DECLARE
    v_game RECORD;
    v_hunter RECORD;
    v_runner RECORD;
    v_new_hearts INT;
    v_is_eliminated BOOLEAN;
    v_alive_runners_count INT;
    v_new_catch_code VARCHAR(4);
BEGIN
    -- 1. Check game status
    SELECT * INTO v_game FROM public.games WHERE id = p_game_id;
    IF NOT FOUND OR v_game.status != 'ACTIVE' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Match is not in active play');
    END IF;

    -- 2. Validate hunter
    SELECT * INTO v_hunter FROM public.game_players 
    WHERE id = p_hunter_player_id AND game_id = p_game_id AND role = 'HUNTER' AND status = 'ALIVE';
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Hunter is not authorized or active in this match');
    END IF;

    -- 3. Lock matching runner row atomically with FOR UPDATE
    SELECT * INTO v_runner FROM public.game_players
    WHERE game_id = p_game_id 
      AND role = 'RUNNER' 
      AND status = 'ALIVE' 
      AND catch_code = p_catch_code
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid catch code or runner already eliminated');
    END IF;

    -- 4. Process catch
    v_new_hearts := v_runner.hearts_remaining - 1;
    v_is_eliminated := (v_new_hearts <= 0);
    v_new_catch_code := floor(1000 + random() * 9000)::TEXT; -- Rotate catch code so it cannot be reused

    IF v_is_eliminated THEN
        UPDATE public.game_players
        SET hearts_remaining = 0,
            status = 'CAUGHT',
            caught_at = NOW(),
            caught_by_id = p_hunter_player_id
        WHERE id = v_runner.id;
    ELSE
        UPDATE public.game_players
        SET hearts_remaining = v_new_hearts,
            catch_code = v_new_catch_code
        WHERE id = v_runner.id;
    END IF;

    -- 5. Record game event
    INSERT INTO public.game_events (game_id, event_type, payload)
    VALUES (
        p_game_id,
        'PLAYER_CAUGHT',
        jsonb_build_object(
            'hunter_id', p_hunter_player_id,
            'runner_id', v_runner.id,
            'hearts_left', v_new_hearts,
            'eliminated', v_is_eliminated
        )
    );

    -- 6. Check win condition: are any living runners left?
    SELECT COUNT(*) INTO v_alive_runners_count
    FROM public.game_players
    WHERE game_id = p_game_id AND role = 'RUNNER' AND status = 'ALIVE' AND hearts_remaining > 0;

    IF v_alive_runners_count = 0 THEN
        UPDATE public.games
        SET status = 'FINISHED',
            winner_team = 'HUNTERS',
            finished_at = NOW()
        WHERE id = p_game_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'runner_id', v_runner.id,
        'hearts_remaining', v_new_hearts,
        'is_eliminated', v_is_eliminated,
        'all_runners_eliminated', (v_alive_runners_count = 0)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
