import { GameEngine } from '../gameEngine';
import { haversineDistance } from '@/lib/geo/distance';
import { LobbyPlayer } from '@/types/lobby';

describe('Catch Mechanics & Verification (Hunting Game Reference)', () => {
  const runnerPlayer: LobbyPlayer = {
    id: 'runner-001',
    profileId: 'profile-001',
    displayName: 'Ghost-Target',
    role: 'RUNNER',
    status: 'ALIVE',
    isReady: true,
    isHost: false,
    heartsRemaining: 3,
    catchCode: '4821',
    lastSeenAt: Date.now(),
  };

  const hunterLoc = { latitude: 37.7749, longitude: -122.4194 };

  describe('Geodesic Proximity Verification', () => {
    it('verifies catch when hunter is within 15m catch radius', () => {
      // 10m away
      const runnerLoc = { latitude: 37.77499, longitude: -122.4194 };
      const dist = haversineDistance(hunterLoc, runnerLoc);
      expect(dist).toBeLessThanOrEqual(15);

      const result = GameEngine.processCatch(
        hunterLoc,
        runnerLoc,
        runnerPlayer,
        [runnerPlayer],
        15,
        5
      );

      expect(result.success).toBe(true);
      expect(result.heartsRemaining).toBe(2);
      expect(result.isEliminated).toBe(false);
    });

    it('allows catch within 15m radius + 5m GPS variance allowance', () => {
      // ~18m away
      const runnerLoc = { latitude: 37.77506, longitude: -122.4194 };
      const dist = haversineDistance(hunterLoc, runnerLoc);
      expect(dist).toBeGreaterThan(15);
      expect(dist).toBeLessThanOrEqual(20);

      const result = GameEngine.processCatch(
        hunterLoc,
        runnerLoc,
        runnerPlayer,
        [runnerPlayer],
        15,
        5
      );

      expect(result.success).toBe(true);
      expect(result.heartsRemaining).toBe(2);
    });

    it('rejects catch attempt when distance exceeds allowable threshold', () => {
      // 50m away
      const runnerLoc = { latitude: 37.77535, longitude: -122.4194 };
      const dist = haversineDistance(hunterLoc, runnerLoc);
      expect(dist).toBeGreaterThan(20);

      const result = GameEngine.processCatch(
        hunterLoc,
        runnerLoc,
        runnerPlayer,
        [runnerPlayer],
        15,
        5
      );

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/Too far!/);
      expect(result.heartsRemaining).toBe(3);
    });
  });

  describe('Multi-Heart Decrement and Elimination Lifecycle', () => {
    it('progressively decrements hearts until elimination at 0 hearts', () => {
      const runnerLoc = { latitude: 37.77492, longitude: -122.4194 };

      // Catch 1 (3 -> 2)
      let p: LobbyPlayer = { ...runnerPlayer, heartsRemaining: 3 };
      let res = GameEngine.processCatch(hunterLoc, runnerLoc, p, [p], 15, 5);
      expect(res.success).toBe(true);
      expect(res.heartsRemaining).toBe(2);
      expect(res.isEliminated).toBe(false);

      // Catch 2 (2 -> 1)
      p = { ...p, heartsRemaining: res.heartsRemaining };
      res = GameEngine.processCatch(hunterLoc, runnerLoc, p, [p], 15, 5);
      expect(res.success).toBe(true);
      expect(res.heartsRemaining).toBe(1);
      expect(res.isEliminated).toBe(false);

      // Catch 3 (1 -> 0: ELIMINATED)
      p = { ...p, heartsRemaining: res.heartsRemaining };
      res = GameEngine.processCatch(hunterLoc, runnerLoc, p, [p], 15, 5);
      expect(res.success).toBe(true);
      expect(res.heartsRemaining).toBe(0);
      expect(res.isEliminated).toBe(true);
      expect(res.message).toMatch(/RUNNER ELIMINATED/);

      // Catch 4 on already eliminated player
      p = { ...p, heartsRemaining: 0, status: 'CAUGHT' };
      res = GameEngine.processCatch(hunterLoc, runnerLoc, p, [p], 15, 5);
      expect(res.success).toBe(false);
      expect(res.message).toBe('Runner is already eliminated.');
    });
  });

  describe('Stealth Radar Suppression', () => {
    it('suppresses runner location completely from radar when Stealth is active', () => {
      const now = Date.now();
      const runners = [
        {
          player: { ...runnerPlayer, id: 'runner-stealth' },
          location: { latitude: 37.7749, longitude: -122.4194, measuredAt: now },
        },
        {
          player: { ...runnerPlayer, id: 'runner-visible', displayName: 'VisibleRunner' },
          location: { latitude: 37.7755, longitude: -122.4194, measuredAt: now },
        },
      ];

      const activeEffects = [
        {
          id: 'effect-1',
          ability: 'STEALTH' as const,
          actorPlayerId: 'runner-stealth',
          startedAt: now,
          expiresAt: now + 45000,
          cooldownUntil: now + 90000,
        },
      ];

      const visible = GameEngine.filterVisibleRunners(runners, activeEffects);

      expect(visible).toHaveLength(1);
      expect(visible[0].playerId).toBe('runner-visible');
    });
  });
});
