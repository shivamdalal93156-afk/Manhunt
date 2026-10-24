import { lobbyService } from '../lobbyService';
import { supabase } from '@/services/supabase';

// Mock Supabase
jest.mock('@/services/supabase', () => {
  return {
    supabase: {
      rpc: jest.fn(),
      from: jest.fn(),
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

  describe('startMatch authoritativeness', () => {
    it('prevents starting match if there are no runners', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: [{ role: 'HUNTER' }], // 1 hunter, 0 runners
          error: null,
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
      });

      await expect(lobbyService.startMatch('test-game-uuid-1')).rejects.toThrow(
        'A match requires at least one Runner before starting.'
      );
    });

    it('prevents starting match if there are no hunters', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: [{ role: 'RUNNER' }], // 0 hunters, 1 runner
          error: null,
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
      });

      await expect(lobbyService.startMatch('test-game-uuid-1')).rejects.toThrow(
        'A match requires at least one Hunter before starting.'
      );
    });

    it('starts match when both roles are present', async () => {
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
        expect.objectContaining({ status: 'COUNTDOWN' })
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
