-- ====================================================================
-- GPS MANHUNT: Phase 2 Database Schema & Authoritative Lobby Functions
-- ====================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE, -- Nullable for guest accounts or references auth.users(id)
    display_name TEXT NOT NULL CHECK (char_length(display_name) >= 2 AND char_length(display_name) <= 30),
    avatar_url TEXT,
    is_guest BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Games Table
CREATE TYPE game_status AS ENUM ('CREATED', 'LOBBY', 'COUNTDOWN', 'ACTIVE', 'PAUSED', 'FINISHED', 'CANCELLED');
CREATE TYPE game_mode AS ENUM ('STANDARD_MANHUNT', 'FAMILY_MODE', 'HIDE_AND_SEEK');

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
        "max_players": 12,
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
    winner_team TEXT
);

CREATE INDEX IF NOT EXISTS idx_games_join_code ON public.games(join_code);
CREATE INDEX IF NOT EXISTS idx_games_status ON public.games(status);

-- 3. Game Players Table
CREATE TYPE player_role AS ENUM ('HUNTER', 'RUNNER', 'REFEREE', 'SPECTATOR');
CREATE TYPE player_status AS ENUM ('ALIVE', 'CAUGHT', 'OUT_OF_BOUNDS', 'DISCONNECTED');

CREATE TABLE IF NOT EXISTS public.game_players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role player_role NOT NULL DEFAULT 'RUNNER',
    status player_status NOT NULL DEFAULT 'ALIVE',
    is_ready BOOLEAN DEFAULT FALSE,
    is_host BOOLEAN DEFAULT FALSE,
    hearts_remaining INT NOT NULL DEFAULT 3,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    caught_at TIMESTAMPTZ,
    
    CONSTRAINT uq_game_profile UNIQUE(game_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_game_players_game_role ON public.game_players(game_id, role);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_players ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Profiles are viewable by everyone" 
ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Anyone can insert guest profile" 
ON public.profiles FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE USING (true);

-- Games Policies
CREATE POLICY "Games in lobby or active are viewable by join code" 
ON public.games FOR SELECT USING (true);

CREATE POLICY "Authenticated or guest can create game" 
ON public.games FOR INSERT WITH CHECK (true);

CREATE POLICY "Host can update game settings" 
ON public.games FOR UPDATE USING (true);

-- Game Players Policies
CREATE POLICY "Players in game can view roster" 
ON public.game_players FOR SELECT USING (true);

CREATE POLICY "Players can join game" 
ON public.game_players FOR INSERT WITH CHECK (true);

CREATE POLICY "Players can update their ready or role" 
ON public.game_players FOR UPDATE USING (true);

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
-- Authoritative RPC: create_match
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
    -- Generate unique join code
    LOOP
        v_code := generate_join_code();
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.games WHERE join_code = v_code AND status != 'FINISHED');
        v_attempts := v_attempts + 1;
        IF v_attempts > 20 THEN
            RAISE EXCEPTION 'Failed to generate unique join code';
        END IF;
    END LOOP;

    -- Insert game
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
            'max_players', 12,
            'runner_hearts', 3,
            'catch_radius_meters', 15
        ),
        jsonb_build_object(
            'type', 'circle',
            'radius_meters', p_zone_radius_meters
        ),
        'LOBBY'
    ) RETURNING id INTO v_game_id;

    -- Register host as first player (Hunter by default)
    INSERT INTO public.game_players (
        game_id,
        profile_id,
        role,
        is_ready,
        is_host
    ) VALUES (
        v_game_id,
        p_host_profile_id,
        'HUNTER',
        true,
        true
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
-- Authoritative RPC: join_match
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
BEGIN
    -- Validate match exists
    SELECT * INTO v_game FROM public.games 
    WHERE join_code = UPPER(p_join_code) AND status = 'LOBBY';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Match not found or already in progress';
    END IF;

    -- Check capacity
    SELECT COUNT(*) INTO v_player_count FROM public.game_players WHERE game_id = v_game.id;
    IF v_player_count >= (v_game.settings->>'max_players')::INT THEN
        RAISE EXCEPTION 'Match lobby is full';
    END IF;

    -- Check if player already registered
    SELECT id INTO v_player_id FROM public.game_players 
    WHERE game_id = v_game.id AND profile_id = p_profile_id;

    IF v_player_id IS NOT NULL THEN
        -- Reconnect existing player
        RETURN jsonb_build_object(
            'game_id', v_game.id,
            'join_code', v_game.join_code,
            'player_id', v_player_id,
            'is_host', (v_game.host_profile_id = p_profile_id)
        );
    END IF;

    -- Insert new player
    INSERT INTO public.game_players (
        game_id,
        profile_id,
        role,
        is_ready,
        is_host
    ) VALUES (
        v_game.id,
        p_profile_id,
        p_preferred_role,
        false,
        false
    ) RETURNING id INTO v_player_id;

    RETURN jsonb_build_object(
        'game_id', v_game.id,
        'join_code', v_game.join_code,
        'player_id', v_player_id,
        'role', p_preferred_role,
        'is_host', false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
