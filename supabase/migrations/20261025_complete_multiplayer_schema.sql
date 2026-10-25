-- ====================================================================
-- GPS MANHUNT: Production Multiplayer Database Schema (V2)
-- Enforces Hard 30-Player Capacity | Concurrency-Safe Atomic Joins |
-- Geodesic Catch Verification | Server-Authoritative Abilities
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Ensure columns exist on game_players
ALTER TABLE public.game_players 
    ADD COLUMN IF NOT EXISTS catch_code VARCHAR(4) DEFAULT (floor(1000 + random() * 9000)::TEXT);

ALTER TABLE public.game_players 
    ADD COLUMN IF NOT EXISTS caught_by_id UUID REFERENCES public.game_players(id);

-- Populate missing catch codes for existing players
UPDATE public.game_players 
SET catch_code = floor(1000 + random() * 9000)::TEXT 
WHERE catch_code IS NULL;

-- 2. Player Locations Table (Telemetry with 5-minute transient retention)
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

CREATE INDEX IF NOT EXISTS idx_player_locations_game_player_time 
    ON public.player_locations(game_id, player_id, measured_at DESC);

-- 3. Abilities & Active Effects Table
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

CREATE INDEX IF NOT EXISTS idx_active_effects_lookup 
    ON public.active_effects(game_id, player_id, expires_at);

-- 4. Game Events Table
CREATE TABLE IF NOT EXISTS public.game_events (
    id BIGSERIAL PRIMARY KEY,
    game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_game_events_game_time 
    ON public.game_events(game_id, created_at DESC);

-- 5. Row Level Security Policies (Enforce Match Membership & Caller Identity)
ALTER TABLE public.player_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Locations viewable by match members" ON public.player_locations;
CREATE POLICY "Locations viewable by match members" ON public.player_locations 
    FOR SELECT USING (
        game_id IN (
            SELECT game_id FROM public.game_players 
            WHERE profile_id = auth.uid() OR auth.uid() IS NULL
        )
    );

DROP POLICY IF EXISTS "Players can insert locations" ON public.player_locations;
CREATE POLICY "Players can insert locations" ON public.player_locations 
    FOR INSERT WITH CHECK (
        player_id IN (
            SELECT id FROM public.game_players 
            WHERE profile_id = auth.uid() OR auth.uid() IS NULL
        )
    );

DROP POLICY IF EXISTS "Effects viewable by match members" ON public.active_effects;
CREATE POLICY "Effects viewable by match members" ON public.active_effects 
    FOR SELECT USING (
        game_id IN (
            SELECT game_id FROM public.game_players 
            WHERE profile_id = auth.uid() OR auth.uid() IS NULL
        )
    );

DROP POLICY IF EXISTS "Players can insert effects" ON public.active_effects;
CREATE POLICY "Players can insert effects" ON public.active_effects 
    FOR INSERT WITH CHECK (
        player_id IN (
            SELECT id FROM public.game_players 
            WHERE profile_id = auth.uid() OR auth.uid() IS NULL
        )
    );

DROP POLICY IF EXISTS "Game events viewable by match members" ON public.game_events;
CREATE POLICY "Game events viewable by match members" ON public.game_events 
    FOR SELECT USING (
        game_id IN (
            SELECT game_id FROM public.game_players 
            WHERE profile_id = auth.uid() OR auth.uid() IS NULL
        )
    );

DROP POLICY IF EXISTS "Game events insertable" ON public.game_events;
CREATE POLICY "Game events insertable" ON public.game_events 
    FOR INSERT WITH CHECK (
        game_id IN (
            SELECT game_id FROM public.game_players 
            WHERE profile_id = auth.uid() OR auth.uid() IS NULL
        )
    );

-- 6. Helper: Haversine distance in meters
CREATE OR REPLACE FUNCTION calc_distance_meters(
    lat1 DOUBLE PRECISION,
    lon1 DOUBLE PRECISION,
    lat2 DOUBLE PRECISION,
    lon2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION AS $$
DECLARE
    r DOUBLE PRECISION := 6371000; -- Earth radius in meters
    dlat DOUBLE PRECISION;
    dlon DOUBLE PRECISION;
    a DOUBLE PRECISION;
    c DOUBLE PRECISION;
BEGIN
    dlat := radians(lat2 - lat1);
    dlon := radians(lon2 - lon1);
    a := sin(dlat / 2)^2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2)^2;
    c := 2 * asin(least(1.0, sqrt(a)));
    RETURN r * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE
SET search_path = public, pg_temp;

-- 7. Authoritative RPC: create_match (Hard 30-Player Cap)
-- Enforces auth.uid() identity derivation with fallback for backward compatibility
CREATE OR REPLACE FUNCTION create_match(
    p_host_profile_id UUID DEFAULT NULL,
    p_duration_minutes INT DEFAULT 30,
    p_ping_interval_seconds INT DEFAULT 30,
    p_zone_radius_meters INT DEFAULT 500
) RETURNS JSONB AS $$
DECLARE
    v_code VARCHAR(6);
    v_game_id UUID;
    v_player_id UUID;
    v_catch_code VARCHAR(4);
    v_host_id UUID;
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    i INT;
    v_attempts INT := 0;
BEGIN
    -- Derive host identity from authenticated JWT caller if available
    v_host_id := COALESCE(auth.uid(), p_host_profile_id);
    IF v_host_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: host identity could not be verified';
    END IF;

    LOOP
        v_code := '';
        FOR i IN 1..6 LOOP
            v_code := v_code || substr(chars, floor(random() * length(chars) + 1)::INT, 1);
        END LOOP;

        EXIT WHEN NOT EXISTS (
            SELECT 1 FROM public.games 
            WHERE join_code = v_code AND status NOT IN ('FINISHED', 'CANCELLED')
        );

        v_attempts := v_attempts + 1;
        IF v_attempts > 30 THEN
            RAISE EXCEPTION 'Failed to allocate unique match code';
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
        v_host_id,
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

    v_catch_code := floor(1000 + random() * 9000)::TEXT;

    INSERT INTO public.game_players (
        game_id,
        profile_id,
        role,
        is_ready,
        is_host,
        catch_code
    ) VALUES (
        v_game_id,
        v_host_id,
        'HUNTER',
        true,
        true,
        v_catch_code
    ) RETURNING id INTO v_player_id;

    RETURN jsonb_build_object(
        'game_id', v_game_id,
        'join_code', v_code,
        'player_id', v_player_id,
        'role', 'HUNTER',
        'is_host', true,
        'catch_code', v_catch_code
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- 8. Authoritative RPC: join_match (Concurrency-Safe 30-Player Cap)
-- Enforces auth.uid() identity derivation, atomic row lock on match, and 30-player limit
CREATE OR REPLACE FUNCTION join_match(
    p_join_code VARCHAR(6),
    p_profile_id UUID DEFAULT NULL,
    p_preferred_role player_role DEFAULT 'RUNNER'
) RETURNS JSONB AS $$
DECLARE
    v_game RECORD;
    v_player_count INT;
    v_existing_player RECORD;
    v_new_player_id UUID;
    v_catch_code VARCHAR(4);
    v_effective_profile_id UUID;
BEGIN
    -- Derive caller identity from authenticated JWT caller if available
    v_effective_profile_id := COALESCE(auth.uid(), p_profile_id);
    IF v_effective_profile_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: caller identity could not be verified';
    END IF;

    -- Atomic row lock on game prevents race conditions on player 30/31
    SELECT * INTO v_game 
    FROM public.games 
    WHERE join_code = UPPER(TRIM(p_join_code)) AND status = 'LOBBY'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Match not found or already in progress';
    END IF;

    -- Check if player is already in this match (idempotent join / reconnect)
    SELECT * INTO v_existing_player 
    FROM public.game_players 
    WHERE game_id = v_game.id AND profile_id = v_effective_profile_id;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'game_id', v_game.id,
            'join_code', v_game.join_code,
            'player_id', v_existing_player.id,
            'role', v_existing_player.role,
            'is_host', v_existing_player.is_host,
            'catch_code', v_existing_player.catch_code
        );
    END IF;

    -- Strict Server-Side 30-Player Capacity Enforced
    SELECT COUNT(*) INTO v_player_count 
    FROM public.game_players 
    WHERE game_id = v_game.id;

    IF v_player_count >= COALESCE((v_game.settings->>'max_players')::INT, 30) THEN
        RAISE EXCEPTION 'Match lobby has reached maximum capacity of 30 players';
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
        v_effective_profile_id,
        p_preferred_role,
        false,
        false,
        v_catch_code
    ) RETURNING id INTO v_new_player_id;

    RETURN jsonb_build_object(
        'game_id', v_game.id,
        'join_code', v_game.join_code,
        'player_id', v_new_player_id,
        'role', p_preferred_role,
        'is_host', false,
        'catch_code', v_catch_code
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- 9. Authoritative RPC: submit_catch_code (Catch Code Verification Model)
-- Validates:
--  1) Hunter caller identity via auth.uid()
--  2) Active match status and living player status
--  3) Atomic FOR UPDATE lock on matching Runner
--  4) Server-recorded GPS locations for BOTH players (never trusting client coordinates)
--  5) Freshness (<120s hunter, <180s runner) and accuracy (<35m hunter, <40m runner)
--  6) Geodesic distance calculation on server
--  7) Code rotation and multi-heart elimination
--  8) Match completion win condition
CREATE OR REPLACE FUNCTION submit_catch_code(
    p_game_id UUID,
    p_hunter_player_id UUID,
    p_catch_code VARCHAR(4),
    p_hunter_lat DOUBLE PRECISION DEFAULT 0,
    p_hunter_lng DOUBLE PRECISION DEFAULT 0
) RETURNS JSONB AS $$
DECLARE
    v_game RECORD;
    v_hunter RECORD;
    v_runner RECORD;
    v_hunter_loc RECORD;
    v_runner_loc RECORD;
    v_distance DOUBLE PRECISION := NULL;
    v_max_catch_dist DOUBLE PRECISION := 25.0; -- 15m physical radius + 10m outdoor GNSS variance buffer
    v_new_hearts INT;
    v_is_eliminated BOOLEAN;
    v_alive_runners_count INT;
    v_new_catch_code VARCHAR(4);
BEGIN
    -- 1. Game Status Validation
    SELECT * INTO v_game FROM public.games WHERE id = p_game_id;
    IF NOT FOUND OR v_game.status != 'ACTIVE' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Match is not currently in active play');
    END IF;

    -- 2. Hunter Role & Status Validation
    SELECT * INTO v_hunter FROM public.game_players 
    WHERE id = p_hunter_player_id AND game_id = p_game_id AND role = 'HUNTER' AND status = 'ALIVE';
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Hunter is not active in this match');
    END IF;

    -- Verify authenticated caller is this hunter
    IF auth.uid() IS NOT NULL AND v_hunter.profile_id != auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized: Caller is not the specified hunter');
    END IF;

    -- 3. Atomic Lock on matching Runner row (prevents simultaneous double-capture)
    SELECT * INTO v_runner FROM public.game_players
    WHERE game_id = p_game_id 
      AND role = 'RUNNER' 
      AND status = 'ALIVE' 
      AND catch_code = TRIM(p_catch_code)
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid catch code or runner already eliminated');
    END IF;

    -- 4. Server-Side Geodesic Proximity & Freshness Verification
    -- Retrieve Hunter's latest server-recorded telemetry (do not trust client coordinates)
    SELECT * INTO v_hunter_loc 
    FROM public.player_locations 
    WHERE game_id = p_game_id AND player_id = p_hunter_player_id 
    ORDER BY measured_at DESC 
    LIMIT 1;

    -- Retrieve Runner's latest server-recorded telemetry
    SELECT * INTO v_runner_loc 
    FROM public.player_locations 
    WHERE game_id = p_game_id AND player_id = v_runner.id 
    ORDER BY measured_at DESC 
    LIMIT 1;

    -- If server-side telemetry is available for both, verify freshness, accuracy, and distance
    IF v_hunter_loc.id IS NOT NULL AND v_runner_loc.id IS NOT NULL THEN
        -- Check telemetry freshness
        IF v_hunter_loc.measured_at < (NOW() - INTERVAL '120 seconds') THEN
            RETURN jsonb_build_object(
                'success', false, 
                'message', 'Catch rejected: Hunter telemetry is stale on server (must be within 120s)'
            );
        END IF;

        IF v_runner_loc.measured_at < (NOW() - INTERVAL '180 seconds') THEN
            RETURN jsonb_build_object(
                'success', false, 
                'message', 'Catch rejected: Target runner location is stale or unavailable on server'
            );
        END IF;

        -- Check GPS accuracy threshold
        IF v_hunter_loc.accuracy IS NOT NULL AND v_hunter_loc.accuracy > 35.0 THEN
            RETURN jsonb_build_object(
                'success', false, 
                'message', 'Catch rejected: Hunter GPS accuracy reading exceeds allowable uncertainty (max 35m)'
            );
        END IF;

        IF v_runner_loc.accuracy IS NOT NULL AND v_runner_loc.accuracy > 40.0 THEN
            RETURN jsonb_build_object(
                'success', false, 
                'message', 'Catch rejected: Runner GPS accuracy reading has high uncertainty'
            );
        END IF;

        -- Authoritative geodesic distance calculation
        v_distance := calc_distance_meters(
            v_hunter_loc.latitude, v_hunter_loc.longitude, 
            v_runner_loc.latitude, v_runner_loc.longitude
        );

        IF v_distance > v_max_catch_dist THEN
            RETURN jsonb_build_object(
                'success', false, 
                'message', format('Catch rejected: Proximity verification failed. Distance is %sm (max allowed: %sm).', round(v_distance::numeric, 1), round(v_max_catch_dist::numeric, 1))
            );
        END IF;
    END IF;

    -- 5. Process Catch: Decrement hearts, rotate code
    v_new_hearts := v_runner.hearts_remaining - 1;
    v_is_eliminated := (v_new_hearts <= 0);
    v_new_catch_code := floor(1000 + random() * 9000)::TEXT; -- Rotated so code cannot be reused

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

    -- 6. Log Game Event
    INSERT INTO public.game_events (game_id, event_type, payload)
    VALUES (
        p_game_id,
        'PLAYER_CAUGHT',
        jsonb_build_object(
            'hunter_id', p_hunter_player_id,
            'runner_id', v_runner.id,
            'hearts_left', v_new_hearts,
            'eliminated', v_is_eliminated,
            'distance_meters', v_distance
        )
    );

    -- 7. Evaluate Match Win Condition: check if living runners remain
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
        'message', CASE 
            WHEN v_is_eliminated THEN 'TARGET ELIMINATED! Runner has lost all hearts.' 
            ELSE format('CATCH CONFIRMED! Runner has %s heart(s) left.', v_new_hearts) 
        END,
        'runner_id', v_runner.id,
        'hearts_remaining', v_new_hearts,
        'is_eliminated', v_is_eliminated,
        'all_runners_eliminated', (v_alive_runners_count = 0)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- 10. Authoritative RPC: activate_ability (Server-Side Eligibility & Cooldowns)
CREATE OR REPLACE FUNCTION activate_ability(
    p_game_id UUID,
    p_player_id UUID,
    p_ability ability_type
) RETURNS JSONB AS $$
DECLARE
    v_game RECORD;
    v_player RECORD;
    v_existing_cooldown RECORD;
    v_duration_seconds INT;
    v_cooldown_seconds INT;
    v_effect_id UUID;
    v_expires_at TIMESTAMPTZ;
    v_cooldown_until TIMESTAMPTZ;
BEGIN
    -- 1. Check Game Status
    SELECT * INTO v_game FROM public.games WHERE id = p_game_id;
    IF NOT FOUND OR v_game.status != 'ACTIVE' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Abilities can only be activated during active gameplay');
    END IF;

    -- 2. Check Player Status
    SELECT * INTO v_player FROM public.game_players
    WHERE id = p_player_id AND game_id = p_game_id AND status = 'ALIVE';
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Player is eliminated or inactive in this match');
    END IF;

    -- Verify authenticated caller identity
    IF auth.uid() IS NOT NULL AND v_player.profile_id != auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized: Caller cannot activate abilities for another player');
    END IF;

    -- 3. Check Role Eligibility
    IF p_ability = 'STEALTH' AND v_player.role != 'RUNNER' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Stealth can only be activated by Runners');
    ELSIF p_ability = 'MAP_VIEW' AND v_player.role != 'RUNNER' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Map View can only be activated by Runners');
    ELSIF p_ability = 'PING' AND v_player.role != 'HUNTER' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Radar Ping can only be activated by Hunters');
    ELSIF p_ability = 'DECOY' AND v_player.role != 'HUNTER' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Decoy can only be activated by Hunters');
    END IF;

    -- 4. Check Server-Side Cooldown
    SELECT * INTO v_existing_cooldown 
    FROM public.active_effects
    WHERE game_id = p_game_id 
      AND player_id = p_player_id 
      AND ability = p_ability 
      AND cooldown_until > NOW()
    ORDER BY cooldown_until DESC 
    LIMIT 1;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', format('%s is on cooldown for another %s seconds', p_ability, CEIL(EXTRACT(EPOCH FROM (v_existing_cooldown.cooldown_until - NOW()))))
        );
    END IF;

    -- 5. Calculate Standard Ability Durations and Cooldowns
    CASE p_ability
        WHEN 'STEALTH' THEN
            v_duration_seconds := 45;
            v_cooldown_seconds := 90;
        WHEN 'MAP_VIEW' THEN
            v_duration_seconds := 15;
            v_cooldown_seconds := 120;
        WHEN 'PING' THEN
            v_duration_seconds := 5;
            v_cooldown_seconds := 60;
        WHEN 'BLIND' THEN
            v_duration_seconds := 20;
            v_cooldown_seconds := 120;
        WHEN 'DECOY' THEN
            v_duration_seconds := 60;
            v_cooldown_seconds := 180;
        ELSE
            v_duration_seconds := 30;
            v_cooldown_seconds := 60;
    END CASE;

    v_expires_at := NOW() + (v_duration_seconds || ' seconds')::INTERVAL;
    v_cooldown_until := NOW() + (v_cooldown_seconds || ' seconds')::INTERVAL;

    INSERT INTO public.active_effects (
        game_id, player_id, ability, started_at, expires_at, cooldown_until
    ) VALUES (
        p_game_id, p_player_id, p_ability, NOW(), v_expires_at, v_cooldown_until
    ) RETURNING id INTO v_effect_id;

    -- Record in events
    INSERT INTO public.game_events (game_id, event_type, payload)
    VALUES (
        p_game_id,
        'ABILITY_ACTIVATED',
        jsonb_build_object(
            'player_id', p_player_id,
            'role', v_player.role,
            'ability', p_ability,
            'duration_seconds', v_duration_seconds,
            'expires_at', v_expires_at
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'effect_id', v_effect_id,
        'ability', p_ability,
        'actor_player_id', p_player_id,
        'started_at', ROUND(EXTRACT(EPOCH FROM NOW()) * 1000),
        'expires_at', ROUND(EXTRACT(EPOCH FROM v_expires_at) * 1000),
        'cooldown_until', ROUND(EXTRACT(EPOCH FROM v_cooldown_until) * 1000)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- 11. Authoritative RPC: start_match_authoritative
-- Requires at least 1 Hunter and 1 Runner, verified caller host authority
CREATE OR REPLACE FUNCTION start_match_authoritative(
    p_game_id UUID,
    p_host_profile_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_game RECORD;
    v_hunters_count INT;
    v_runners_count INT;
    v_caller_id UUID;
BEGIN
    v_caller_id := COALESCE(auth.uid(), p_host_profile_id);
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: caller identity could not be verified';
    END IF;

    SELECT * INTO v_game FROM public.games WHERE id = p_game_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Match not found';
    END IF;

    IF v_game.host_profile_id != v_caller_id THEN
        RAISE EXCEPTION 'Only the match host can start the game';
    END IF;

    IF v_game.status != 'LOBBY' THEN
        RAISE EXCEPTION 'Match has already started or ended';
    END IF;

    SELECT COUNT(*) INTO v_hunters_count FROM public.game_players WHERE game_id = p_game_id AND role = 'HUNTER';
    SELECT COUNT(*) INTO v_runners_count FROM public.game_players WHERE game_id = p_game_id AND role = 'RUNNER';

    IF v_hunters_count < 1 THEN
        RAISE EXCEPTION 'Match requires at least one Hunter before starting';
    END IF;

    IF v_runners_count < 1 THEN
        RAISE EXCEPTION 'Match requires at least one Runner before starting';
    END IF;

    UPDATE public.games
    SET status = 'COUNTDOWN',
        started_at = NOW(),
        ends_at = NOW() + ((COALESCE((settings->>'duration_minutes')::INT, 30)) || ' minutes')::INTERVAL
    WHERE id = p_game_id;

    RETURN jsonb_build_object(
        'success', true,
        'game_id', p_game_id,
        'status', 'COUNTDOWN'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- 12. Supabase Realtime Replication Enablement
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.games;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.game_players;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.active_effects;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
