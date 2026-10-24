import { lobbyService } from '../lobbyService';

describe('Multiplayer Lobby Engine (Phase 2)', () => {
  it('creates a match with host assigned as Hunter in LOBBY state', async () => {
    const session = await lobbyService.createMatch({
      durationMinutes: 45,
      pingIntervalSeconds: 60,
      zoneRadiusMeters: 750,
    });

    expect(session.gameId).toBeDefined();
    expect(session.joinCode).toMatch(/^[A-Z0-9]{6}$/);
    expect(session.status).toBe('LOBBY');
    expect(session.isHost).toBe(true);
    expect(session.myRole).toBe('HUNTER');
    expect(session.settings.durationMinutes).toBe(45);
    expect(session.settings.locationPingIntervalSeconds).toBe(60);
    expect(session.playZone.radiusMeters).toBe(750);
  });

  it('allows joining with valid join code and prevents duplicate entries', async () => {
    const hostSession = await lobbyService.createMatch();
    const guestSession = await lobbyService.joinMatch(
      hostSession.joinCode,
      'RUNNER',
      {
        id: 'guest-profile-2',
        displayName: 'Ghost-2',
        isGuest: true,
      }
    );

    expect(guestSession.gameId).toBe(hostSession.gameId);
    expect(guestSession.joinCode).toBe(hostSession.joinCode);
    expect(guestSession.status).toBe('LOBBY');
    expect(guestSession.isHost).toBe(false);

    // Duplicate join by same player returns existing session
    const dupSession = await lobbyService.joinMatch(hostSession.joinCode, 'RUNNER');
    expect(dupSession.gameId).toBe(hostSession.gameId);
  });

  it('rejects join attempts with non-existent or invalid codes', async () => {
    await expect(lobbyService.joinMatch('ZZZZ99')).rejects.toThrow(
      /Match with code "ZZZZ99" was not found or has expired/
    );
  });

  it('authoritatively validates start rules: requires at least 1 Hunter and 1 Runner', async () => {
    // 1. Create match with host only (1 Hunter, 0 Runners)
    const session = await lobbyService.createMatch();

    // Attempting start without runners must fail
    await expect(lobbyService.startMatch(session.gameId)).rejects.toThrow(
      /A match requires at least one Runner before starting/
    );

    // 2. Add runner to match
    let latestState: any = null;
    const unsub = lobbyService.subscribeLobby(session.gameId, (state) => {
      latestState = state;
    });

    // Manually add runner to simulate second player join
    latestState.players.push({
      id: 'runner-mock',
      profileId: 'prof-runner',
      displayName: 'Ghost-Runner',
      role: 'RUNNER',
      status: 'ALIVE',
      isReady: true,
      isHost: false,
      heartsRemaining: 3,
      lastSeenAt: Date.now(),
    });

    // Start match now succeeds
    await lobbyService.startMatch(session.gameId);
    expect(latestState.status).toBe('COUNTDOWN');
    unsub();
  });

  it('allows changing player roles and ready statuses', async () => {
    const session = await lobbyService.createMatch();
    let currentLobby: any = null;

    const unsub = lobbyService.subscribeLobby(session.gameId, (state) => {
      currentLobby = state;
    });

    // Change host role to RUNNER
    await lobbyService.updatePlayerRole(session.gameId, session.myPlayerId, 'RUNNER');
    expect(currentLobby.players[0].role).toBe('RUNNER');

    // Toggle ready
    await lobbyService.toggleReadyStatus(session.gameId, session.myPlayerId, true);
    expect(currentLobby.players[0].isReady).toBe(true);

    unsub();
  });

  it('handles player leaving and elects new host if host leaves', async () => {
    const hostSession = await lobbyService.createMatch();
    let currentLobby: any = null;

    const unsub = lobbyService.subscribeLobby(hostSession.gameId, (state) => {
      currentLobby = state;
    });

    // Add a second player
    currentLobby.players.push({
      id: 'player-2',
      profileId: 'prof-2',
      displayName: 'Operator-2',
      role: 'RUNNER',
      status: 'ALIVE',
      isReady: true,
      isHost: false,
      heartsRemaining: 3,
      lastSeenAt: Date.now(),
    });

    // Host leaves
    await lobbyService.leaveMatch(hostSession.gameId, hostSession.myPlayerId);

    // Remaining player becomes host
    expect(currentLobby.players.length).toBe(1);
    expect(currentLobby.players[0].isHost).toBe(true);
    expect(currentLobby.players[0].id).toBe('player-2');

    unsub();
  });
});
