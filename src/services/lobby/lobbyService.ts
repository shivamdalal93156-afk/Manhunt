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

// In-memory synchronized room store for local and fallback multi-client testing
const localRooms = new Map<string, LobbyState>();
const subscribers = new Map<string, Set<(state: LobbyState) => void>>();

function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function broadcastLobbyState(gameId: string, state: LobbyState) {
  localRooms.set(gameId, state);
  const subs = subscribers.get(gameId);
  if (subs) {
    subs.forEach((cb) => {
      try {
        cb(state);
      } catch {
        // Callback error safe guard
      }
    });
  }
}

class LobbyService {
  async createMatch(options: CreateMatchOptions = {}): Promise<MatchSession> {
    const profile = await guestAuth.getGuestProfile();
    const durationMinutes = options.durationMinutes ?? 30;
    const pingIntervalSeconds = options.pingIntervalSeconds ?? 30;
    const zoneRadiusMeters = options.zoneRadiusMeters ?? 500;

    // 1. Try remote Supabase RPC
    try {
      const { data, error } = await supabase.rpc('create_match', {
        p_host_profile_id: profile.id,
        p_duration_minutes: durationMinutes,
        p_ping_interval_seconds: pingIntervalSeconds,
        p_zone_radius_meters: zoneRadiusMeters,
      });

      if (!error && data?.game_id && data?.join_code) {
        return {
          gameId: data.game_id,
          joinCode: data.join_code,
          hostProfileId: profile.id,
          status: 'LOBBY',
          settings: {
            durationMinutes,
            headStartSeconds: 60,
            locationPingIntervalSeconds: pingIntervalSeconds,
            maxPlayers: 12,
            runnerHearts: 3,
            catchRadiusMeters: 15,
          },
          playZone: {
            type: 'circle',
            radiusMeters: zoneRadiusMeters,
          },
          myPlayerId: data.player_id,
          myRole: 'HUNTER',
          isHost: true,
        };
      }
    } catch {
      // Fallback to local room engine
    }

    // 2. Resilient In-Memory / Simulated Match Engine (for local dev & testing)
    const gameId = `local-${Date.now()}`;
    const joinCode = generateJoinCode();
    const playerId = `player-${profile.id}`;

    const settings: MatchSettings = {
      durationMinutes,
      headStartSeconds: 60,
      locationPingIntervalSeconds: pingIntervalSeconds,
      maxPlayers: 12,
      runnerHearts: 3,
      catchRadiusMeters: 15,
    };

    const playZone: PlayZoneSettings = {
      type: 'circle',
      radiusMeters: zoneRadiusMeters,
    };

    const hostPlayer: LobbyPlayer = {
      id: playerId,
      profileId: profile.id,
      displayName: profile.displayName,
      role: 'HUNTER',
      status: 'ALIVE',
      isReady: true,
      isHost: true,
      heartsRemaining: 3,
      lastSeenAt: Date.now(),
    };

    const state: LobbyState = {
      gameId,
      joinCode,
      status: 'LOBBY',
      settings,
      playZone,
      hostProfileId: profile.id,
      players: [hostPlayer],
    };

    localRooms.set(gameId, state);
    localRooms.set(joinCode, state); // Key by both gameId and joinCode for fast lookup

    return {
      gameId,
      joinCode,
      hostProfileId: profile.id,
      status: 'LOBBY',
      settings,
      playZone,
      myPlayerId: playerId,
      myRole: 'HUNTER',
      isHost: true,
    };
  }

  async joinMatch(
    joinCode: string,
    preferredRole: PlayerRole = 'RUNNER',
    guestProfile?: PlayerProfile
  ): Promise<MatchSession> {
    const profile = guestProfile || (await guestAuth.getGuestProfile());
    const cleanCode = joinCode.trim().toUpperCase();

    // 1. Try remote Supabase RPC
    try {
      const { data, error } = await supabase.rpc('join_match', {
        p_join_code: cleanCode,
        p_profile_id: profile.id,
        p_preferred_role: preferredRole,
      });

      if (!error && data?.game_id) {
        return {
          gameId: data.game_id,
          joinCode: data.join_code,
          hostProfileId: '',
          status: 'LOBBY',
          settings: {
            durationMinutes: 30,
            headStartSeconds: 60,
            locationPingIntervalSeconds: 30,
            maxPlayers: 12,
            runnerHearts: 3,
            catchRadiusMeters: 15,
          },
          playZone: { type: 'circle', radiusMeters: 500 },
          myPlayerId: data.player_id,
          myRole: data.role || preferredRole,
          isHost: !!data.is_host,
        };
      }
    } catch {
      // Fallback to local room engine
    }

    // 2. Lookup in local room store
    const state = localRooms.get(cleanCode);
    if (!state) {
      throw new Error(`Match with code "${cleanCode}" was not found or has expired.`);
    }

    if (state.status !== 'LOBBY') {
      throw new Error('This match has already started.');
    }

    if (state.players.length >= state.settings.maxPlayers) {
      throw new Error('This match lobby is currently full.');
    }

    // Check if player already in room
    let player = state.players.find((p) => p.profileId === profile.id);
    if (!player) {
      player = {
        id: `player-${profile.id}`,
        profileId: profile.id,
        displayName: profile.displayName,
        role: preferredRole,
        status: 'ALIVE',
        isReady: false,
        isHost: false,
        heartsRemaining: 3,
        lastSeenAt: Date.now(),
      };
      state.players.push(player);
      broadcastLobbyState(state.gameId, { ...state });
    }

    return {
      gameId: state.gameId,
      joinCode: state.joinCode,
      hostProfileId: state.hostProfileId,
      status: state.status,
      settings: state.settings,
      playZone: state.playZone,
      myPlayerId: player.id,
      myRole: player.role,
      isHost: player.isHost,
    };
  }

  subscribeLobby(
    gameId: string,
    onUpdate: (state: LobbyState) => void
  ): () => void {
    // 1. Local room subscription
    if (!subscribers.has(gameId)) {
      subscribers.set(gameId, new Set());
    }
    const subs = subscribers.get(gameId)!;
    subs.add(onUpdate);

    const initial = localRooms.get(gameId);
    if (initial) {
      onUpdate(initial);
    }

    // 2. Supabase Realtime channel subscription (when online)
    const channel = supabase.channel(`game:${gameId}`);
    channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${gameId}` },
        () => {
          this.refreshRemoteLobby(gameId, onUpdate);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
        () => {
          this.refreshRemoteLobby(gameId, onUpdate);
        }
      )
      .subscribe();

    return () => {
      subs.delete(onUpdate);
      if (subs.size === 0) {
        subscribers.delete(gameId);
      }
      channel.unsubscribe();
    };
  }

  async updatePlayerRole(
    gameId: string,
    targetPlayerId: string,
    newRole: PlayerRole
  ): Promise<void> {
    const state = localRooms.get(gameId);
    if (state) {
      const p = state.players.find((pl) => pl.id === targetPlayerId);
      if (p) {
        p.role = newRole;
        broadcastLobbyState(gameId, { ...state });
      }
    }

    try {
      await supabase
        .from('game_players')
        .update({ role: newRole })
        .eq('id', targetPlayerId)
        .eq('game_id', gameId);
    } catch {
      // Handled
    }
  }

  async toggleReadyStatus(
    gameId: string,
    playerId: string,
    isReady: boolean
  ): Promise<void> {
    const state = localRooms.get(gameId);
    if (state) {
      const p = state.players.find((pl) => pl.id === playerId);
      if (p) {
        p.isReady = isReady;
        broadcastLobbyState(gameId, { ...state });
      }
    }

    try {
      await supabase
        .from('game_players')
        .update({ is_ready: isReady })
        .eq('id', playerId)
        .eq('game_id', gameId);
    } catch {
      // Handled
    }
  }

  async startMatch(gameId: string): Promise<void> {
    const state = localRooms.get(gameId);
    if (!state) {
      throw new Error('Match not found');
    }

    // Authoritative rule validation: At least 1 Hunter and 1 Runner
    const hunters = state.players.filter((p) => p.role === 'HUNTER');
    const runners = state.players.filter((p) => p.role === 'RUNNER');

    if (hunters.length < 1) {
      throw new Error('A match requires at least one Hunter before starting.');
    }
    if (runners.length < 1) {
      throw new Error('A match requires at least one Runner before starting.');
    }

    state.status = 'COUNTDOWN';
    broadcastLobbyState(gameId, { ...state });

    try {
      await supabase
        .from('games')
        .update({ status: 'COUNTDOWN', started_at: new Date().toISOString() })
        .eq('id', gameId);
    } catch {
      // Handled
    }
  }

  async leaveMatch(gameId: string, playerId: string): Promise<void> {
    const state = localRooms.get(gameId);
    if (state) {
      state.players = state.players.filter((p) => p.id !== playerId);
      if (state.players.length === 0) {
        localRooms.delete(gameId);
        localRooms.delete(state.joinCode);
      } else {
        // If host left, elect new host
        if (!state.players.some((p) => p.isHost)) {
          state.players[0].isHost = true;
          state.hostProfileId = state.players[0].profileId;
        }
        broadcastLobbyState(gameId, { ...state });
      }
    }

    try {
      await supabase
        .from('game_players')
        .delete()
        .eq('id', playerId)
        .eq('game_id', gameId);
    } catch {
      // Handled
    }
  }

  private async refreshRemoteLobby(
    gameId: string,
    onUpdate: (state: LobbyState) => void
  ): Promise<void> {
    try {
      const { data: game } = await supabase.from('games').select('*').eq('id', gameId).single();
      const { data: players } = await supabase
        .from('game_players')
        .select('*, profiles(display_name)')
        .eq('game_id', gameId);

      if (game && players) {
        const mappedPlayers: LobbyPlayer[] = players.map((p) => ({
          id: p.id,
          profileId: p.profile_id,
          displayName: p.profiles?.display_name || 'Anonymous',
          role: p.role,
          status: p.status,
          isReady: p.is_ready,
          isHost: p.is_host,
          heartsRemaining: p.hearts_remaining,
          lastSeenAt: Date.now(),
        }));

        const state: LobbyState = {
          gameId: game.id,
          joinCode: game.join_code,
          status: game.status as GameStatus,
          settings: game.settings,
          playZone: game.play_zone,
          hostProfileId: game.host_profile_id,
          players: mappedPlayers,
        };

        broadcastLobbyState(gameId, state);
        onUpdate(state);
      }
    } catch {
      // Handled
    }
  }
}

export const lobbyService = new LobbyService();
