import { GameEngine } from '../gameEngine';
import { LobbyPlayer } from '@/types/lobby';
import { ActiveEffect, HunterSnapshot } from '@/types/game';

describe('Authoritative Game Engine & Catch Rules', () => {
  const hunterLoc = { latitude: 37.774900, longitude: -122.419400 };

  const mockRunner: LobbyPlayer = {
    id: 'runner-1',
    profileId: 'p-1',
    displayName: 'Flash',
    role: 'RUNNER',
    status: 'ALIVE',
    isReady: true,
    isHost: false,
    heartsRemaining: 3,
    lastSeenAt: Date.now(),
  };

  describe('processCatch', () => {
    it('confirms catch within 15m radius and decrements runner heart', () => {
      // 0.0001 deg lat ~ 11.1 meters away
      const closeRunnerLoc = { latitude: 37.775000, longitude: -122.419400 };

      const result = GameEngine.processCatch(
        hunterLoc,
        closeRunnerLoc,
        mockRunner,
        [mockRunner]
      );

      expect(result.success).toBe(true);
      expect(result.heartsRemaining).toBe(2);
      expect(result.isEliminated).toBe(false);
      expect(result.distanceMeters).toBeLessThan(15);
    });

    it('rejects catch if runner is too far (> 20m)', () => {
      // 0.0005 deg lat ~ 55 meters away
      const distantLoc = { latitude: 37.775400, longitude: -122.419400 };

      const result = GameEngine.processCatch(
        hunterLoc,
        distantLoc,
        mockRunner,
        [mockRunner]
      );

      expect(result.success).toBe(false);
      expect(result.heartsRemaining).toBe(3);
      expect(result.message).toMatch(/Too far/);
    });

    it('eliminates runner when last heart is lost', () => {
      const lowHealthRunner: LobbyPlayer = { ...mockRunner, heartsRemaining: 1 };
      const closeRunnerLoc = { latitude: 37.774950, longitude: -122.419400 };

      const result = GameEngine.processCatch(
        hunterLoc,
        closeRunnerLoc,
        lowHealthRunner,
        [lowHealthRunner]
      );

      expect(result.success).toBe(true);
      expect(result.heartsRemaining).toBe(0);
      expect(result.isEliminated).toBe(true);
      expect(result.message).toMatch(/RUNNER ELIMINATED/);
    });

    it('rejects catch if runner is already eliminated', () => {
      const eliminatedRunner: LobbyPlayer = {
        ...mockRunner,
        status: 'CAUGHT',
        heartsRemaining: 0,
      };

      const result = GameEngine.processCatch(
        hunterLoc,
        hunterLoc,
        eliminatedRunner,
        [eliminatedRunner]
      );

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/already eliminated/);
    });
  });

  describe('calculateRunnerThreat & Directional Compass', () => {
    const runnerGPS = {
      latitude: 37.774900,
      longitude: -122.419400,
      measuredAt: Date.now(),
    };

    const hunters: HunterSnapshot[] = [
      {
        playerId: 'h-1',
        displayName: 'Predator',
        // 0.0003 deg lat North ~ 33m away
        latitude: 37.775200,
        longitude: -122.419400,
        measuredAt: Date.now(),
      },
    ];

    it('calculates DANGER threat (< 50m) and straight-ahead bearing when facing North', () => {
      // Device facing North (0°), Hunter is due North -> relative bearing should be 0°
      const threat = GameEngine.calculateRunnerThreat(runnerGPS, hunters, 0);

      expect(threat.threatLevel).toBe('DANGER');
      expect(threat.nearestHunterDistanceMeters).toBeCloseTo(33.3, 0);
      expect(threat.relativeBearingDegrees).toBeCloseTo(0, 0);
      expect(threat.nearestHunterName).toBe('Predator');
    });

    it('adjusts relative bearing when device turns East (90°)', () => {
      // Device facing East (90°), Hunter is North (0°) -> relative angle is 270° (turn left 90°)
      const threat = GameEngine.calculateRunnerThreat(runnerGPS, hunters, 90);
      expect(threat.relativeBearingDegrees).toBe(270);
    });

    it('returns WARNING threat for distance 50m - 150m', () => {
      const distantHunters: HunterSnapshot[] = [
        {
          playerId: 'h-2',
          displayName: 'Stalker',
          // ~100m away
          latitude: 37.775800,
          longitude: -122.419400,
          measuredAt: Date.now(),
        },
      ];

      const threat = GameEngine.calculateRunnerThreat(runnerGPS, distantHunters, 0);
      expect(threat.threatLevel).toBe('WARNING');
    });
  });

  describe('filterVisibleRunners & Stealth Suppression', () => {
    const runner1GPS = {
      latitude: 37.7749,
      longitude: -122.4194,
      measuredAt: Date.now(),
    };

    it('reveals active runner to hunters when no Stealth is active', () => {
      const visible = GameEngine.filterVisibleRunners(
        [{ player: mockRunner, location: runner1GPS }],
        []
      );

      expect(visible.length).toBe(1);
      expect(visible[0].playerId).toBe('runner-1');
    });

    it('strictly omits runner location from hunter snapshot when Stealth is active', () => {
      const activeEffects: ActiveEffect[] = [
        {
          id: 'eff-1',
          ability: 'STEALTH',
          actorPlayerId: 'runner-1',
          startedAt: Date.now() - 5000,
          expiresAt: Date.now() + 40000, // Still active
          cooldownUntil: Date.now() + 85000,
        },
      ];

      const visible = GameEngine.filterVisibleRunners(
        [{ player: mockRunner, location: runner1GPS }],
        activeEffects
      );

      // Stealth suppresses location: 0 runners visible!
      expect(visible.length).toBe(0);
    });
  });

  describe('activateAbility', () => {
    it('activates Stealth for Runner with 45s duration and 90s cooldown', () => {
      const effect = GameEngine.activateAbility('STEALTH', mockRunner, []);
      expect(effect.ability).toBe('STEALTH');
      expect(effect.actorPlayerId).toBe('runner-1');
      expect(effect.expiresAt - effect.startedAt).toBe(45000);
      expect(effect.cooldownUntil - effect.startedAt).toBe(90000);
    });

    it('rejects Stealth activation by a Hunter', () => {
      const hunterPlayer: LobbyPlayer = { ...mockRunner, role: 'HUNTER' };
      expect(() => GameEngine.activateAbility('STEALTH', hunterPlayer, [])).toThrow(
        /Stealth can only be deployed by Runners/
      );
    });

    it('prevents activating an ability that is still on cooldown', () => {
      const activeCooldown: ActiveEffect = {
        id: 'cd-1',
        ability: 'STEALTH',
        actorPlayerId: 'runner-1',
        startedAt: Date.now() - 50000,
        expiresAt: Date.now() - 5000,
        cooldownUntil: Date.now() + 40000, // 40s remaining
      };

      expect(() =>
        GameEngine.activateAbility('STEALTH', mockRunner, [activeCooldown])
      ).toThrow(/is on cooldown/);
    });
  });

  describe('evaluateWinCondition', () => {
    it('awards victory to Hunters when all runners are caught', () => {
      const eliminatedRunners: LobbyPlayer[] = [
        { ...mockRunner, status: 'CAUGHT', heartsRemaining: 0 },
      ];

      const result = GameEngine.evaluateWinCondition(eliminatedRunners, 600);
      expect(result).not.toBeNull();
      expect(result?.winningTeam).toBe('HUNTERS');
    });

    it('awards victory to Runners when timer reaches 0:00 with at least 1 runner alive', () => {
      const aliveRunners: LobbyPlayer[] = [mockRunner];

      const result = GameEngine.evaluateWinCondition(aliveRunners, 0); // 0s left
      expect(result).not.toBeNull();
      expect(result?.winningTeam).toBe('RUNNERS');
    });
  });
});
