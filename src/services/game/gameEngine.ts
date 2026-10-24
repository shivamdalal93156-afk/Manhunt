import { GPSLocation, LatLng } from '@/types/geo';
import { initialBearing, relativeBearing } from '@/lib/geo/bearing';
import { haversineDistance } from '@/lib/geo/distance';
import {
  AbilityType,
  ActiveEffect,
  CatchAttemptResult,
  HunterSnapshot,
  MatchResults,
  RunnerSnapshot,
  ThreatTelemetry,
} from '@/types/game';
import { LobbyPlayer, MatchSettings, PlayZoneSettings } from '@/types/lobby';

export class GameEngine {
  /**
   * Authoritatively verifies and processes a catch attempt by a Hunter on a Runner.
   */
  static processCatch(
    hunterLocation: LatLng,
    runnerLocation: LatLng,
    targetRunner: LobbyPlayer,
    activeRunners: LobbyPlayer[],
    catchRadiusMeters = 15,
    gpsVarianceAllowanceMeters = 5
  ): CatchAttemptResult {
    if (targetRunner.role !== 'RUNNER') {
      return {
        success: false,
        message: 'Target is not an active runner.',
        targetRunnerId: targetRunner.id,
        heartsRemaining: targetRunner.heartsRemaining,
        isEliminated: false,
        distanceMeters: Infinity,
      };
    }

    if (targetRunner.status === 'CAUGHT' || targetRunner.heartsRemaining <= 0) {
      return {
        success: false,
        message: 'Runner is already eliminated.',
        targetRunnerId: targetRunner.id,
        heartsRemaining: 0,
        isEliminated: true,
        distanceMeters: 0,
      };
    }

    const distance = haversineDistance(hunterLocation, runnerLocation);
    const maxAllowedDistance = catchRadiusMeters + gpsVarianceAllowanceMeters;

    if (distance > maxAllowedDistance) {
      return {
        success: false,
        message: `Too far! Distance is ${distance.toFixed(1)}m (must be within ${maxAllowedDistance}m).`,
        targetRunnerId: targetRunner.id,
        heartsRemaining: targetRunner.heartsRemaining,
        isEliminated: false,
        distanceMeters: distance,
      };
    }

    // Catch verified! Decrement heart
    const newHearts = Math.max(0, targetRunner.heartsRemaining - 1);
    const isEliminated = newHearts === 0;

    return {
      success: true,
      message: isEliminated
        ? `RUNNER ELIMINATED! ${targetRunner.displayName} is out of hearts!`
        : `CATCH CONFIRMED! ${targetRunner.displayName} has ${newHearts} heart(s) left.`,
      targetRunnerId: targetRunner.id,
      heartsRemaining: newHearts,
      isEliminated,
      distanceMeters: distance,
    };
  }

  /**
   * Calculates nearest hunter threat and relative compass bearing for a Runner.
   */
  static calculateRunnerThreat(
    runnerLocation: GPSLocation,
    hunterLocations: HunterSnapshot[],
    deviceHeading: number | null | undefined,
    isBlinded = false
  ): ThreatTelemetry {
    if (isBlinded || hunterLocations.length === 0) {
      return {
        nearestHunterDistanceMeters: null,
        relativeBearingDegrees: null,
        threatLevel: isBlinded ? 'WARNING' : 'CLEAR',
      };
    }

    let minDistance = Infinity;
    let closestHunter: HunterSnapshot | null = null;

    for (const hunter of hunterLocations) {
      const d = haversineDistance(runnerLocation, {
        latitude: hunter.latitude,
        longitude: hunter.longitude,
      });
      if (d < minDistance) {
        minDistance = d;
        closestHunter = hunter;
      }
    }

    if (!closestHunter || minDistance === Infinity) {
      return {
        nearestHunterDistanceMeters: null,
        relativeBearingDegrees: null,
        threatLevel: 'CLEAR',
      };
    }

    const absoluteBearing = initialBearing(runnerLocation, {
      latitude: closestHunter.latitude,
      longitude: closestHunter.longitude,
    });

    const relBearing = relativeBearing(deviceHeading, absoluteBearing);

    let threatLevel: 'SAFE' | 'WARNING' | 'DANGER' = 'SAFE';
    if (minDistance < 50) {
      threatLevel = 'DANGER';
    } else if (minDistance < 150) {
      threatLevel = 'WARNING';
    }

    return {
      nearestHunterDistanceMeters: minDistance,
      relativeBearingDegrees: relBearing,
      threatLevel,
      nearestHunterName: closestHunter.displayName,
    };
  }

  /**
   * Filters runner locations visible to hunters, strictly respecting Stealth power-ups.
   */
  static filterVisibleRunners(
    runners: Array<{ player: LobbyPlayer; location: GPSLocation }>,
    activeEffects: ActiveEffect[]
  ): RunnerSnapshot[] {
    const now = Date.now();
    const visible: RunnerSnapshot[] = [];

    for (const { player, location } of runners) {
      if (player.status !== 'ALIVE') continue;

      // Check if runner has an active Stealth effect
      const hasStealth = activeEffects.some(
        (e) =>
          e.actorPlayerId === player.id &&
          e.ability === 'STEALTH' &&
          e.expiresAt > now
      );

      // Stealth suppresses location completely from hunter radar!
      if (hasStealth) {
        continue;
      }

      visible.push({
        playerId: player.id,
        displayName: player.displayName,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        measuredAt: location.measuredAt,
      });
    }

    return visible;
  }

  /**
   * Validates and activates an ability.
   */
  static activateAbility(
    ability: AbilityType,
    player: LobbyPlayer,
    existingEffects: ActiveEffect[]
  ): ActiveEffect {
    const now = Date.now();

    // Check cooldown
    const activeCooldown = existingEffects.find(
      (e) =>
        e.actorPlayerId === player.id &&
        e.ability === ability &&
        e.cooldownUntil > now
    );

    if (activeCooldown) {
      const waitSec = Math.ceil((activeCooldown.cooldownUntil - now) / 1000);
      throw new Error(`${ability} is on cooldown for another ${waitSec}s.`);
    }

    // Role restrictions
    if (ability === 'STEALTH' && player.role !== 'RUNNER') {
      throw new Error('Stealth can only be deployed by Runners.');
    }
    if (ability === 'MAP_VIEW' && player.role !== 'RUNNER') {
      throw new Error('Map View can only be deployed by Runners.');
    }
    if (ability === 'PING' && player.role !== 'HUNTER') {
      throw new Error('Radar Ping can only be deployed by Hunters.');
    }

    let durationMs = 0;
    let cooldownMs = 0;

    switch (ability) {
      case 'STEALTH':
        durationMs = 45 * 1000;
        cooldownMs = 90 * 1000;
        break;
      case 'MAP_VIEW':
        durationMs = 15 * 1000;
        cooldownMs = 120 * 1000;
        break;
      case 'PING':
        durationMs = 5 * 1000;
        cooldownMs = 60 * 1000;
        break;
      case 'BLIND':
        durationMs = 20 * 1000;
        cooldownMs = 120 * 1000;
        break;
      case 'DECOY':
        durationMs = 60 * 1000;
        cooldownMs = 180 * 1000;
        break;
    }

    return {
      id: `effect-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      ability,
      actorPlayerId: player.id,
      startedAt: now,
      expiresAt: now + durationMs,
      cooldownUntil: now + cooldownMs,
    };
  }

  /**
   * Evaluates match completion conditions.
   */
  static evaluateWinCondition(
    players: LobbyPlayer[],
    timeRemainingSeconds: number
  ): MatchResults | null {
    const runners = players.filter((p) => p.role === 'RUNNER');
    const aliveRunners = runners.filter(
      (p) => p.status === 'ALIVE' && p.heartsRemaining > 0
    );

    // 1. All runners caught -> Hunters win
    if (runners.length > 0 && aliveRunners.length === 0) {
      return {
        gameId: '',
        winningTeam: 'HUNTERS',
        durationSeconds: 0,
        totalRunners: runners.length,
        runnersCaught: runners.length,
        finishedAt: Date.now(),
      };
    }

    // 2. Timer expired with at least 1 alive runner -> Runners win
    if (timeRemainingSeconds <= 0) {
      return {
        gameId: '',
        winningTeam: aliveRunners.length > 0 ? 'RUNNERS' : 'HUNTERS',
        durationSeconds: 0,
        totalRunners: runners.length,
        runnersCaught: runners.length - aliveRunners.length,
        finishedAt: Date.now(),
      };
    }

    return null;
  }
}
