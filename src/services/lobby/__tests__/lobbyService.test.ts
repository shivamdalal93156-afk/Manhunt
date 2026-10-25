import { lobbyService } from '../lobbyService';
import { supabase } from '@/services/supabase';

// Mock Supabase
jest.mock('@/services/supabase', () => {
  return {
    supabase: {
      rpc: jest.fn(),
      from: jest.fn(),
      auth: {
        getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
        signInAnonymously: jest.fn().mockResolvedValue({
          data: { user: { id: 'test-auth-user-id' } },
          error: null,
        }),
      },
      channel: jest.fn(() => ({
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn((cb) => {
          if (cb) cb('SUBSCRIBED');
          return { unsubscribe: jest.fn() };
        }),
        unsubscribe: jest.fn(),
      })),
    },
  };
});

describe('Server-Authoritative Multiplayer Lobby Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createMatch', () => {
    it('creates a match via Supabase RPC with 30-player capacity', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: {
          game_id: 'test-game-uuid-1',
          join_code: 'ALPHA1',
          player_id: 'host-player-uuid',
          catch_code: '4589',
        },
        error: null,
      });

      const session = await lobbyService.createMatch({
        durationMinutes: 45,
        pingIntervalSeconds: 60,
        zoneRadiusMeters: 750,
      });

      expect(supabase.rpc).toHaveBeenCalledWith('create_match', {
        p_host_profile_id: expect.any(String),
        p_duration_minutes: 45,
        p_ping_interval_seconds: 60,
        p_zone_radius_meters: 750,
      });

      expect(session.gameId).toBe('test-game-uuid-1');
      expect(session.joinCode).toBe('ALPHA1');
      expect(session.status).toBe('LOBBY');
      expect(session.isHost).toBe(true);
      expect(session.myRole).toBe('HUNTER');
      expect(session.settings.maxPlayers).toBe(30);
      expect(session.settings.durationMinutes).toBe(45);
    });

    it('throws a descriptive server error when backend is offline or fails', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { message: 'Network connection error' },
      });

      await expect(lobbyService.createMatch()).rejects.toThrow(
        /Failed to create match on server: Network connection error/
      );
    });
  });

  describe('joinMatch & 30-Player Capacity', () => {
    it('joins match via Supabase RPC when valid code is provided', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: {
          game_id: 'test-game-uuid-1',
          join_code: 'ALPHA1',
          player_id: 'guest-player-uuid',
          role: 'RUNNER',
          is_host: false,
          catch_code: '7721',
        },
        error: null,
      });

      const session = await lobbyService.joinMatch('ALPHA1', 'RUNNER');

      expect(supabase.rpc).toHaveBeenCalledWith('join_match', {
        p_join_code: 'ALPHA1',
        p_profile_id: expect.any(String),
        p_preferred_role: 'RUNNER',
      });

      expect(session.gameId).toBe('test-game-uuid-1');
      expect(session.joinCode).toBe('ALPHA1');
      expect(session.myRole).toBe('RUNNER');
      expect(session.catchCode).toBe('7721');
      expect(session.settings.maxPlayers).toBe(30);
    });

    it('strictly enforces the 30-player limit when 31st player attempts to join', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { message: 'Match lobby has reached maximum capacity of 30 players' },
      });

      await expect(lobbyService.joinMatch('ALPHA1', 'RUNNER')).rejects.toThrow(
        'Match lobby has reached maximum capacity of 30 players'
      );
    });

    it('rejects invalid join code format before querying backend', async () => {
      await expect(lobbyService.joinMatch('ABC')).rejects.toThrow(
        'Join code must be 6 alphanumeric characters.'
      );
    });
  });

  describe('startMatch authoritativeness & security', () => {
    it('authoritatively starts match via start_match_authoritative RPC', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: { success: true, game_id: 'test-game-uuid-1', status: 'COUNTDOWN' },
        error: null,
      });

      await lobbyService.startMatch('test-game-uuid-1');

      expect(supabase.rpc).toHaveBeenCalledWith('start_match_authoritative', {
        p_game_id: 'test-game-uuid-1',
        p_host_profile_id: expect.any(String),
      });
    });

    it('rejects match start if unauthorized non-host attempts to start match', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { message: 'Only the match host can start the game' },
      });

      await expect(lobbyService.startMatch('test-game-uuid-1')).rejects.toThrow(
        'Only the match host can start the game'
      );
    });

    it('rejects match start if server reports missing runners', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { message: 'Match requires at least one Runner before starting' },
      });

      await expect(lobbyService.startMatch('test-game-uuid-1')).rejects.toThrow(
        'Match requires at least one Runner before starting'
      );
    });

    it('falls back to client validation when RPC is not present (PGRST202)', async () => {
      // 1. RPC returns PGRST202 (not found on legacy schema)
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST202', message: 'Function not found' },
      });

      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'game_players') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [{ role: 'HUNTER' }, { role: 'RUNNER' }],
                error: null,
              }),
            }),
          };
        }
        if (table === 'games') {
          return {
            update: mockUpdate,
          };
        }
        return {};
      });

      await lobbyService.startMatch('test-game-uuid-1');

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ACTIVE' })
      );
    });
  });

  describe('submitCatchCode (Catch-Code Verification Model)', () => {
    it('submits 4-digit catch code to server RPC atomically', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: {
          success: true,
          runner_id: 'runner-uuid-9',
          hearts_remaining: 2,
          is_eliminated: false,
          all_runners_eliminated: false,
          message: 'Catch confirmed!',
        },
        error: null,
      });

      const result = await lobbyService.submitCatchCode(
        'test-game-uuid-1',
        'hunter-player-uuid',
        '8842',
        37.7749,
        -122.4194
      );

      expect(supabase.rpc).toHaveBeenCalledWith('submit_catch_code', {
        p_game_id: 'test-game-uuid-1',
        p_hunter_player_id: 'hunter-player-uuid',
        p_catch_code: '8842',
        p_hunter_lat: 37.7749,
        p_hunter_lng: -122.4194,
      });

      expect(result.success).toBe(true);
      expect(result.heartsRemaining).toBe(2);
      expect(result.isEliminated).toBe(false);
    });

    it('rejects invalid code length client-side', async () => {
      const result = await lobbyService.submitCatchCode(
        'test-game-uuid-1',
        'hunter-player-uuid',
        '12'
      );
      expect(result.success).toBe(false);
      expect(result.message).toBe('Catch code must be exactly 4 digits.');
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    it('handles invalid code rejection from server RPC gracefully', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: {
          success: false,
          message: 'Invalid catch code or runner already eliminated',
        },
        error: null,
      });

      const result = await lobbyService.submitCatchCode(
        'test-game-uuid-1',
        'hunter-player-uuid',
        '9999'
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid catch code or runner already eliminated');
    });
  });
});
