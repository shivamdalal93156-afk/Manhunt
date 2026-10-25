import { lobbyService } from '../lobbyService';
import { supabase } from '@/services/supabase';

jest.mock('@/services/supabase', () => ({
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
}));

describe('30-Player Capacity & Concurrency Enforcement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('permits up to 30 players to join a single match', async () => {
    const matchCode = 'MATCHX';

    // Mock successful join for player 1 through 30
    for (let i = 1; i <= 30; i++) {
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: {
          game_id: 'game-30-player-id',
          join_code: matchCode,
          player_id: `player-uuid-${i}`,
          role: i <= 5 ? 'HUNTER' : 'RUNNER',
          is_host: i === 1,
          catch_code: String(1000 + i),
        },
        error: null,
      });

      const session = await lobbyService.joinMatch(matchCode, i <= 5 ? 'HUNTER' : 'RUNNER', {
        id: `profile-${i}`,
        displayName: `Operator-${i}`,
        isGuest: true,
      });

      expect(session.gameId).toBe('game-30-player-id');
      expect(session.joinCode).toBe(matchCode);
      expect(session.myPlayerId).toBe(`player-uuid-${i}`);
    }

    expect(supabase.rpc).toHaveBeenCalledTimes(30);
  });

  it('strictly rejects the 31st player when lobby reaches capacity of 30', async () => {
    const matchCode = 'MATCHX';

    (supabase.rpc as jest.Mock).mockResolvedValueOnce({
      data: null,
      error: { message: 'Match lobby has reached maximum capacity of 30 players' },
    });

    await expect(
      lobbyService.joinMatch(matchCode, 'RUNNER', {
        id: 'profile-31',
        displayName: 'Operator-31',
        isGuest: true,
      })
    ).rejects.toThrow('Match lobby has reached maximum capacity of 30 players');
  });

  it('handles concurrent lobby join attempts atomically', async () => {
    const matchCode = 'CONCUR';
    let currentPlayers = 28;

    // Simulate concurrent server RPC logic: slots 29 and 30 succeed, 31 and 32 fail
    (supabase.rpc as jest.Mock).mockImplementation(async (rpcName, args) => {
      if (rpcName === 'join_match') {
        currentPlayers++;
        if (currentPlayers > 30) {
          return {
            data: null,
            error: { message: 'Match lobby has reached maximum capacity of 30 players' },
          };
        }
        return {
          data: {
            game_id: 'concurrent-game',
            join_code: matchCode,
            player_id: `player-${args.p_profile_id}`,
            role: args.p_preferred_role,
            is_host: false,
            catch_code: '9999',
          },
          error: null,
        };
      }
      return { data: null, error: null };
    });

    // 4 players attempt to join concurrently
    const joinAttempts = [1, 2, 3, 4].map((num) =>
      lobbyService
        .joinMatch(matchCode, 'RUNNER', {
          id: `profile-${num}`,
          displayName: `Op-${num}`,
          isGuest: true,
        })
        .then((s) => ({ success: true, session: s }))
        .catch((err) => ({ success: false, error: err.message }))
    );

    const results = await Promise.all(joinAttempts);

    const successfulJoins = results.filter((r) => r.success);
    const rejectedJoins = results.filter((r) => !r.success);

    // Exactly 2 succeeded (reaching 30), and exactly 2 were rejected (capacity exceeded)
    expect(successfulJoins).toHaveLength(2);
    expect(rejectedJoins).toHaveLength(2);
    const firstRejected = rejectedJoins[0] as { success: false; error: string };
    expect(firstRejected.error).toBe(
      'Match lobby has reached maximum capacity of 30 players'
    );
  });

  it('supports idempotent re-joining upon network reconnection', async () => {
    const matchCode = 'RECONN';

    // Server returns existing player session on reconnect
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({
      data: {
        game_id: 'reconnect-game',
        join_code: matchCode,
        player_id: 'existing-player-uuid',
        role: 'RUNNER',
        is_host: false,
        catch_code: '4321',
      },
      error: null,
    });

    const session = await lobbyService.joinMatch(matchCode, 'RUNNER', {
      id: 'profile-reconnecting',
      displayName: 'Op-Reconnecting',
      isGuest: true,
    });

    expect(session.gameId).toBe('reconnect-game');
    expect(session.myPlayerId).toBe('existing-player-uuid');
    expect(session.catchCode).toBe('4321');
  });
});
