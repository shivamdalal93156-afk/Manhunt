import { lobbyService } from '@/services/lobby/lobbyService';
import { gameService, PlayerLocationBroadcast } from '@/services/game/gameService';
import { supabase } from '@/services/supabase';
import { GameEngine } from '@/services/game/gameEngine';
import { LobbyPlayer } from '@/types/lobby';

// Mock Supabase
jest.mock('@/services/supabase', () => {
  const listeners: Record<string, ((payload: any) => void)[]> = {};

  return {
    supabase: {
      rpc: jest.fn(),
      from: jest.fn(),
      auth: {
        getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
        signInAnonymously: jest.fn().mockResolvedValue({
          data: { user: { id: 'test-auth-uuid' } },
          error: null,
        }),
      },
      channel: jest.fn((channelName: string) => ({
        on: jest.fn(function (type: string, filter: any, callback: any) {
          const event = filter.event || 'broadcast';
          const key = `${channelName}:${event}`;
          listeners[key] = listeners[key] || [];
          listeners[key].push(callback);
          return this;
        }),
        subscribe: jest.fn((cb) => {
          if (cb) cb('SUBSCRIBED');
          return { unsubscribe: jest.fn() };
        }),
        unsubscribe: jest.fn(),
        send: jest.fn(async ({ type, event, payload }: any) => {
          const key = `${channelName}:${event}`;
          if (listeners[key]) {
            listeners[key].forEach((cb) => cb({ payload }));
          }
          return 'ok';
        }),
      })),
    },
  };
});

describe('Full Multiplayer Integration & Game Lifecycle Simulation', () => {
  const GAME_ID = 'test-multiplayer-game-123';
  const JOIN_CODE = 'TACT30';

  let currentGameState: any;
  let playersList: LobbyPlayer[] = [];

  beforeEach(() => {
    jest.clearAllMocks();

    playersList = [];
    currentGameState = {
      id: GAME_ID,
      join_code: JOIN_CODE,
      status: 'LOBBY',
      host_profile_id: 'host-profile-uuid',
      settings: {
        durationMinutes: 30,
        headStartSeconds: 60,
        locationPingIntervalSeconds: 30,
        maxPlayers: 30,
        runnerHearts: 3,
        catchRadiusMeters: 15,
      },
      play_zone: { type: 'circle', radiusMeters: 500 },
    };
  });

  it('executes full 5-player match lifecycle: create -> joins -> start -> GPS sync -> catch -> victory', async () => {
    // 1. Host creates match
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({
      data: {
        game_id: GAME_ID,
        join_code: JOIN_CODE,
        player_id: 'host-player-id',
        role: 'HUNTER',
        is_host: true,
        catch_code: '1111',
      },
      error: null,
    });

    const hostSession = await lobbyService.createMatch({
      durationMinutes: 30,
      pingIntervalSeconds: 30,
      zoneRadiusMeters: 500,
    });

    expect(hostSession.gameId).toBe(GAME_ID);
    expect(hostSession.joinCode).toBe(JOIN_CODE);
    expect(hostSession.isHost).toBe(true);
    expect(hostSession.myRole).toBe('HUNTER');

    playersList.push({
      id: 'host-player-id',
      profileId: 'host-profile-uuid',
      displayName: 'Host-Alpha',
      role: 'HUNTER',
      status: 'ALIVE',
      isReady: true,
      isHost: true,
      heartsRemaining: 3,
      catchCode: '1111',
      lastSeenAt: Date.now(),
    });

    // 2. 4 other players join via match code
    const guestProfiles = [
      { id: 'p2', name: 'Hunter-Bravo', role: 'HUNTER' as const, code: '2222' },
      { id: 'p3', name: 'Runner-Charlie', role: 'RUNNER' as const, code: '3333' },
      { id: 'p4', name: 'Runner-Delta', role: 'RUNNER' as const, code: '4444' },
      { id: 'p5', name: 'Runner-Echo', role: 'RUNNER' as const, code: '5555' },
    ];

    for (const g of guestProfiles) {
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: {
          game_id: GAME_ID,
          join_code: JOIN_CODE,
          player_id: `player-${g.id}`,
          role: g.role,
          is_host: false,
          catch_code: g.code,
        },
        error: null,
      });

      const guestSession = await lobbyService.joinMatch(JOIN_CODE, g.role, {
        id: g.id,
        displayName: g.name,
        isGuest: true,
      });

      expect(guestSession.gameId).toBe(GAME_ID);
      expect(guestSession.myRole).toBe(g.role);
      expect(guestSession.catchCode).toBe(g.code);

      playersList.push({
        id: `player-${g.id}`,
        profileId: g.id,
        displayName: g.name,
        role: g.role,
        status: 'ALIVE',
        isReady: true,
        isHost: false,
        heartsRemaining: 3,
        catchCode: g.code,
        lastSeenAt: Date.now(),
      });
    }

    expect(playersList).toHaveLength(5);
    const hunters = playersList.filter((p) => p.role === 'HUNTER');
    const runners = playersList.filter((p) => p.role === 'RUNNER');
    expect(hunters).toHaveLength(2);
    expect(runners).toHaveLength(3);

    // 3. Host authoritatively starts the match
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({
      data: { success: true, game_id: GAME_ID, status: 'COUNTDOWN' },
      error: null,
    });

    await lobbyService.startMatch(GAME_ID);
    expect(supabase.rpc).toHaveBeenCalledWith('start_match_authoritative', {
      p_game_id: GAME_ID,
      p_host_profile_id: expect.any(String),
    });

    currentGameState.status = 'ACTIVE';

    // 4. Test GPS Location Broadcast & Channel Propagation
    const receivedLocations: PlayerLocationBroadcast[] = [];

    const unsubChannel = gameService.joinGameChannel(
      GAME_ID,
      (loc) => receivedLocations.push(loc),
      () => {},
      () => {}
    );

    const runnerCharlieLoc = {
      latitude: 37.77492,
      longitude: -122.41941,
      accuracy: 4.5,
      heading: 90,
      speed: 1.2,
      measuredAt: Date.now(),
    };

    await gameService.broadcastLocation(
      GAME_ID,
      'player-p3',
      'RUNNER',
      'Runner-Charlie',
      runnerCharlieLoc
    );

    expect(receivedLocations).toHaveLength(1);
    expect(receivedLocations[0].playerId).toBe('player-p3');
    expect(receivedLocations[0].displayName).toBe('Runner-Charlie');
    expect(receivedLocations[0].latitude).toBe(37.77492);

    // 5. Catch Attempt 1: Hunter submits invalid catch code -> server rejects
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({
      data: {
        success: false,
        message: 'Invalid catch code or runner already eliminated',
      },
      error: null,
    });

    const failedCatch = await lobbyService.submitCatchCode(
      GAME_ID,
      'host-player-id',
      '9999',
      37.7749,
      -122.4194
    );

    expect(failedCatch.success).toBe(false);
    expect(failedCatch.message).toMatch(/Invalid catch code/);

    // 6. Catch Attempt 2: Hunter submits valid catch code for Runner-Charlie
    // Server confirms catch, decrements hearts from 3 to 2, and rotates code
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({
      data: {
        success: true,
        runner_id: 'player-p3',
        hearts_remaining: 2,
        is_eliminated: false,
        all_runners_eliminated: false,
        message: 'CATCH CONFIRMED! Runner has 2 heart(s) left.',
      },
      error: null,
    });

    const confirmedCatch = await lobbyService.submitCatchCode(
      GAME_ID,
      'host-player-id',
      '3333',
      37.7749,
      -122.4194
    );

    expect(confirmedCatch.success).toBe(true);
    expect(confirmedCatch.runnerId).toBe('player-p3');
    expect(confirmedCatch.heartsRemaining).toBe(2);
    expect(confirmedCatch.isEliminated).toBe(false);

    // 7. Final Catch: Eliminates last runner -> Win condition met
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({
      data: {
        success: true,
        runner_id: 'player-p5',
        hearts_remaining: 0,
        is_eliminated: true,
        all_runners_eliminated: true,
        message: 'TARGET ELIMINATED! Runner has lost all hearts.',
      },
      error: null,
    });

    const finalCatch = await lobbyService.submitCatchCode(
      GAME_ID,
      'host-player-id',
      '5555',
      37.7749,
      -122.4194
    );

    expect(finalCatch.success).toBe(true);
    expect(finalCatch.isEliminated).toBe(true);
    expect(finalCatch.allRunnersEliminated).toBe(true);

    unsubChannel();
  });
});
