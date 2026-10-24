import {
  GameStatus,
  LobbyPlayer,
  LobbyState,
  MatchSession,
  MatchSettings,
  PlayerProfile,
  PlayerRole,
  PlayZoneSettings,
} from '@/types/lobby';
import { guestAuth } from '@/services/auth/guestAuth';
import { supabase } from '@/services/supabase';

export interface CreateMatchOptions {
  durationMinutes?: number;
  pingIntervalSeconds?: number;
  zoneRadiusMeters?: number;
}

export interface CatchSubmissionResult {
  success: boolean;
  message: string;
  runnerId?: string;
  heartsRemaining?: number;
  isEliminated?: boolean;
  allRunnersEliminated?: boolean;
}

class LobbyService {
  /**
   * Authoritatively creates a match in Supabase.
   * Hard 30-player limit, 6-char join code generated on server.
   * No local room fallback in production.
   */
  async createMatch(options: CreateMatchOptions = {}): Promise<MatchSession> {
    const profile = await guestAuth.getGuestProfile();
    const durationMinutes = options.durationMinutes ?? 30;
    const pingIntervalSeconds = options.pingIntervalSeconds ?? 30;
    const zoneRadiusMeters = options.zoneRadiusMeters ?? 500;

    const { data, error } = await supabase.rpc('create_match', {
      p_host_profile_id: profile.id,
      p_duration_minutes: durationMinutes,
      p_ping_interval_seconds: pingIntervalSeconds,
      p_zone_radius_meters: zoneRadiusMeters,
    });

    if (error || !data?.game_id || !data?.join_code) {
      throw new Error(
        `Failed to create match on server: ${error?.message || 'Server returned invalid response. Check network connection.'}`
      );
    }

    const settings: MatchSettings = {
      durationMinutes,
      headStartSeconds: 60,
      locationPingIntervalSeconds: pingIntervalSeconds,
      maxPlayers: 30, // Hard 30-player limit
      runnerHearts: 3,
      catchRadiusMeters: 15,
    };

    const playZone: PlayZoneSettings = {
      type: 'circle',
      radiusMeters: zoneRadiusMeters,
    };

    return {
      gameId: data.game_id,
      joinCode: data.join_code,
      hostProfileId: profile.id,
      status: 'LOBBY',
      settings,
      playZone,
      myPlayerId: data.player_id,
      myRole: 'HUNTER',
      isHost: true,
      catchCode: data.catch_code,
    };
  }

  /**
   * Authoritatively joins an existing match via Supabase RPC.
   * Enforces 30-player limit on server with atomic row locking.
   */
  async joinMatch(
    joinCode: string,
    preferredRole: PlayerRole = 'RUNNER',
    guestProfile?: PlayerProfile
  ): Promise<MatchSession> {
    const profile = guestProfile || (await guestAuth.getGuestProfile());
    const cleanCode = joinCode.trim().toUpperCase();

    if (!cleanCode || cleanCode.length !== 6) {
      throw new Error('Join code must be 6 alphanumeric characters.');
    }

    const { data, error } = await supabase.rpc('join_match', {
      p_join_code: cleanCode,
      p_profile_id: profile.id,
      p_preferred_role: preferredRole,
    });

    if (error || !data?.game_id) {
      throw new Error(
        error?.message || `Match with code "${cleanCode}" was not found or has expired.`
      );
    }

    return {
      gameId: data.game_id,
      joinCode: data.join_code,
      hostProfileId: '',
      status: 'LOBBY',
      settings: {
        durationMinutes: 30,
        headStartSeconds: 60,
        locationPingIntervalSeconds: 30,
        maxPlayers: 30,
        runnerHearts: 3,
        catchRadiusMeters: 15,
      },
      playZone: { type: 'circle', radiusMeters: 500 },
      myPlayerId: data.player_id,
      myRole: data.role || preferredRole,
      isHost: !!data.is_host,
      catchCode: data.catch_code,
    };
  }

  /**
   * Authoritative realtime subscription using Supabase postgres_changes channel.
   */
  subscribeLobby(
    gameId: string,
    onUpdate: (state: LobbyState) => void,
    onError?: (error: Error) => void
  ): () => void {
    // Initial fetch
    this.refreshRemoteLobby(gameId, onUpdate).catch((err) => {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    });

    // Supabase Realtime channel
    const channel = supabase.channel(`game:${gameId}`);
    channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${gameId}` },
        () => {
          this.refreshRemoteLobby(gameId, onUpdate).catch(() => {});
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
        () => {
          this.refreshRemoteLobby(gameId, onUpdate).catch(() => {});
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          onError?.(new Error('Connection to match server lost. Reconnecting...'));
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }

  /**
   * Updates player role on the server.
   */
  async updatePlayerRole(
    gameId: string,
    targetPlayerId: string,
    newRole: PlayerRole
  ): Promise<void> {
    const { error } = await supabase
      .from('game_players')
      .update({ role: newRole })
      .eq('id', targetPlayerId)
      .eq('game_id', gameId);

    if (error) {
      throw new Error(`Failed to update role: ${error.message}`);
    }
  }

  /**
   * Toggles ready status on the server.
   */
  async toggleReadyStatus(
    gameId: string,
    playerId: string,
    isReady: boolean
  ): Promise<void> {
    const { error } = await supabase
      .from('game_players')
      .update({ is_ready: isReady })
      .eq('id', playerId)
      .eq('game_id', gameId);

    if (error) {
      throw new Error(`Failed to update readiness: ${error.message}`);
    }
  }

  /**
   * Authoritatively starts the match.
   * Requires at least 1 Hunter and 1 Runner.
   */
  async startMatch(gameId: string): Promise<void> {
    // 1. Fetch current players from server to validate composition
    const { data: players, error: fetchErr } = await supabase
      .from('game_players')
      .select('role')
      .eq('game_id', gameId);

    if (fetchErr || !players) {
      throw new Error('Failed to verify match roster before starting.');
    }

    const hunters = players.filter((p) => p.role === 'HUNTER');
    const runners = players.filter((p) => p.role === 'RUNNER');

    if (hunters.length < 1) {
      throw new Error('A match requires at least one Hunter before starting.');
    }
    if (runners.length < 1) {
      throw new Error('A match requires at least one Runner before starting.');
    }

    // 2. Authoritatively transition game to COUNTDOWN
    const { error } = await supabase
      .from('games')
      .update({ status: 'COUNTDOWN', started_at: new Date().toISOString() })
      .eq('id', gameId);

    if (error) {
      throw new Error(`Failed to start match: ${error.message}`);
    }
  }

  /**
   * Leaves the match and removes player from game_players table.
   */
  async leaveMatch(gameId: string, playerId: string): Promise<void> {
    const { error } = await supabase
      .from('game_players')
      .delete()
      .eq('id', playerId)
      .eq('game_id', gameId);

    if (error) {
      throw new Error(`Failed to leave match: ${error.message}`);
    }
  }

  /**
   * Authoritatively submits and verifies a 4-digit runner catch code.
   * Uses atomic row locking (FOR UPDATE) in submit_catch_code RPC.
   */
  async submitCatchCode(
    gameId: string,
    hunterPlayerId: string,
    catchCode: string,
    hunterLat = 0,
    hunterLng = 0
  ): Promise<CatchSubmissionResult> {
    const cleanCode = catchCode.trim();
    if (cleanCode.length !== 4) {
      return {
        success: false,
        message: 'Catch code must be exactly 4 digits.',
      };
    }

    const { data, error } = await supabase.rpc('submit_catch_code', {
      p_game_id: gameId,
      p_hunter_player_id: hunterPlayerId,
      p_catch_code: cleanCode,
      p_hunter_lat: hunterLat,
      p_hunter_lng: hunterLng,
    });

    if (error) {
      return {
        success: false,
        message: error.message || 'Catch verification failed on server.',
      };
    }

    return {
      success: !!data?.success,
      message: data?.message || (data?.success ? 'Catch confirmed by server!' : 'Invalid catch code.'),
      runnerId: data?.runner_id,
      heartsRemaining: data?.hearts_remaining,
      isEliminated: data?.is_eliminated,
      allRunnersEliminated: data?.all_runners_eliminated,
    };
  }

  /**
   * Refreshes lobby state from Supabase.
   */
  async refreshRemoteLobby(
    gameId: string,
    onUpdate: (state: LobbyState) => void
  ): Promise<void> {
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (gameError || !game) {
      throw new Error(gameError?.message || 'Game match not found on server.');
    }

    const { data: players, error: playersError } = await supabase
      .from('game_players')
      .select('*, profiles(display_name)')
      .eq('game_id', gameId);

    if (playersError || !players) {
      throw new Error(playersError?.message || 'Failed to fetch match players.');
    }

    const mappedPlayers: LobbyPlayer[] = players.map((p) => ({
      id: p.id,
      profileId: p.profile_id,
      displayName: p.profiles?.display_name || 'Anonymous Operative',
      role: p.role,
      status: p.status,
      isReady: p.is_ready,
      isHost: p.is_host,
      heartsRemaining: p.hearts_remaining,
      catchCode: p.catch_code,
      lastSeenAt: Date.now(),
    }));

    const state: LobbyState = {
      gameId: game.id,
      joinCode: game.join_code,
      status: game.status as GameStatus,
      settings: game.settings || {
        durationMinutes: 30,
        headStartSeconds: 60,
        locationPingIntervalSeconds: 30,
        maxPlayers: 30,
        runnerHearts: 3,
        catchRadiusMeters: 15,
      },
      playZone: game.play_zone || { type: 'circle', radiusMeters: 500 },
      hostProfileId: game.host_profile_id,
      players: mappedPlayers,
    };

    onUpdate(state);
  }
}

export const lobbyService = new LobbyService();
