import { gameService } from '../gameService';
import { supabase } from '@/services/supabase';

jest.mock('@/services/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn((cb) => {
        if (cb) cb('SUBSCRIBED');
        return { unsubscribe: jest.fn() };
      }),
      send: jest.fn().mockResolvedValue('ok'),
      unsubscribe: jest.fn(),
    })),
    from: jest.fn(() => ({
      insert: jest.fn().mockResolvedValue({ error: null }),
    })),
  },
}));

describe('gameService Server-Authoritative Capabilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('activateAbility', () => {
    it('authoritatively activates an ability via Supabase RPC and broadcasts to channel', async () => {
      const now = Date.now();
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: {
          success: true,
          effect_id: 'server-effect-uuid-1',
          ability: 'STEALTH',
          started_at: now,
          expires_at: now + 45000,
          cooldown_until: now + 90000,
        },
        error: null,
      });

      // Join channel so broadcast sends
      gameService.joinGameChannel('game-123', jest.fn(), jest.fn(), jest.fn());

      const effect = await gameService.activateAbility('game-123', 'runner-456', 'STEALTH');

      expect(supabase.rpc).toHaveBeenCalledWith('activate_ability', {
        p_game_id: 'game-123',
        p_player_id: 'runner-456',
        p_ability: 'STEALTH',
      });

      expect(effect.id).toBe('server-effect-uuid-1');
      expect(effect.ability).toBe('STEALTH');
      expect(effect.actorPlayerId).toBe('runner-456');
      expect(effect.expiresAt).toBe(now + 45000);
      expect(effect.cooldownUntil).toBe(now + 90000);
    });

    it('throws server error when ability is on cooldown', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: {
          success: false,
          message: 'STEALTH is on cooldown for another 32 seconds',
        },
        error: null,
      });

      await expect(
        gameService.activateAbility('game-123', 'runner-456', 'STEALTH')
      ).rejects.toThrow('STEALTH is on cooldown for another 32 seconds');
    });

    it('throws a descriptive error when server function is not deployed', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: {
          code: 'PGRST202',
          message: 'Could not find function public.activate_ability',
        },
      });

      await expect(
        gameService.activateAbility('game-123', 'runner-456', 'STEALTH')
      ).rejects.toThrow(
        /Server function 'activate_ability' not found on backend. Please apply the latest Supabase migration./
      );
    });
  });

  describe('broadcastLocation', () => {
    it('broadcasts real GPS location without generating fake coordinates', async () => {
      gameService.joinGameChannel('game-123', jest.fn(), jest.fn(), jest.fn());

      const location = {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 4.2,
        heading: 180,
        speed: 2.1,
        measuredAt: Date.now(),
      };

      await expect(
        gameService.broadcastLocation('game-123', 'player-1', 'HUNTER', 'Ghost-101', location)
      ).resolves.not.toThrow();
    });
  });
});
