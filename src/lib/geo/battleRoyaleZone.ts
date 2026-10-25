import { LatLng } from '@/types/geo';
import { haversineDistance } from './distance';

export type ZoneShrinkMode = 'NONE' | 'CONCENTRIC' | 'BATTLE_ROYALE';

export interface BattleRoyalePhase {
  phaseIndex: number;
  waitDurationSec: number;
  shrinkDurationSec: number;
  targetRadiusMeters: number;
  targetCenter: LatLng;
}

export interface ZoneEvaluationResult {
  mode: ZoneShrinkMode;
  currentCircle: { center: LatLng; radiusMeters: number };
  nextSafeCircle: { center: LatLng; radiusMeters: number } | null;
  phaseNumber: number;
  totalPhases: number;
  phaseState: 'STATIC' | 'WAITING' | 'SHRINKING' | 'FINAL';
  statusText: string;
  secondsRemainingInState: number;
  isInsideActiveZone: boolean;
  distanceToActiveBoundaryMeters: number;
}

/**
 * Deterministic pseudo-random number generator using seed string (e.g. gameId or joinCode).
 * Ensures all connected players (host, hunter, runner) calculate the exact same safe zones.
 */
function seededRandom(seedStr: string, index: number): number {
  let h = 0x811c9dc5;
  const combined = `${seedStr}_phase_${index}`;
  for (let i = 0; i < combined.length; i++) {
    h ^= combined.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ((h >>> 0) % 1000000) / 1000000;
}

/**
 * Calculates a point at a given distance and bearing from an origin.
 */
function offsetCoordinate(
  origin: LatLng,
  distanceMeters: number,
  bearingRadians: number
): LatLng {
  const latRad = (origin.latitude * Math.PI) / 180;
  const deltaLat = (distanceMeters * Math.cos(bearingRadians)) / 111132;
  const deltaLon =
    (distanceMeters * Math.sin(bearingRadians)) /
    (111132 * Math.cos(latRad));

  return {
    latitude: origin.latitude + deltaLat,
    longitude: origin.longitude + deltaLon,
  };
}

/**
 * Pre-computes all Battle Royale / Concentric phases deterministically.
 */
export function generateZonePhases(
  initialCenter: LatLng,
  initialRadius: number,
  mode: ZoneShrinkMode,
  totalDurationMinutes: number,
  seed: string = 'manhunt_default_seed'
): BattleRoyalePhase[] {
  if (mode === 'NONE') {
    return [
      {
        phaseIndex: 1,
        waitDurationSec: totalDurationMinutes * 60,
        shrinkDurationSec: 0,
        targetRadiusMeters: initialRadius,
        targetCenter: initialCenter,
      },
    ];
  }

  const totalMatchSeconds = totalDurationMinutes * 60;
  const numPhases = initialRadius >= 800 ? 5 : initialRadius >= 500 ? 4 : 3;
  const timePerPhase = Math.floor(totalMatchSeconds / numPhases);
  const waitDurationSec = Math.max(30, Math.floor(timePerPhase * 0.55));
  const shrinkDurationSec = Math.max(20, Math.floor(timePerPhase * 0.45));

  const phases: BattleRoyalePhase[] = [];
  let currentCenter = initialCenter;
  let currentRadius = initialRadius;

  for (let i = 1; i <= numPhases; i++) {
    // Each safe zone is ~55-65% the size of the previous zone
    const targetRadiusMeters = Math.max(35, Math.round(currentRadius * 0.6));
    let targetCenter = currentCenter;

    if (mode === 'BATTLE_ROYALE') {
      // Free Fire / PUBG algorithm:
      // The next safe circle MUST fit entirely inside the current circle.
      // Maximum distance center can move is (currentRadius - targetRadius).
      const maxCenterShift = Math.max(0, (currentRadius - targetRadiusMeters) * 0.85);
      const angleRand = seededRandom(seed, i * 2);
      const distRand = seededRandom(seed, i * 2 + 1);

      const angle = angleRand * 2 * Math.PI;
      const shiftDistance = distRand * maxCenterShift;

      targetCenter = offsetCoordinate(currentCenter, shiftDistance, angle);
    } else {
      // CONCENTRIC: Center never shifts
      targetCenter = initialCenter;
    }

    phases.push({
      phaseIndex: i,
      waitDurationSec,
      shrinkDurationSec,
      targetRadiusMeters,
      targetCenter,
    });

    currentCenter = targetCenter;
    currentRadius = targetRadiusMeters;
  }

  return phases;
}

/**
 * Evaluates the live dynamic zone at any elapsed timestamp.
 */
export function evaluateDynamicZone(options: {
  initialCenter: LatLng;
  initialRadius: number;
  mode: ZoneShrinkMode;
  totalDurationMinutes: number;
  elapsedSeconds: number;
  playerLocation: LatLng | null;
  seed?: string;
}): ZoneEvaluationResult {
  const {
    initialCenter,
    initialRadius,
    mode,
    totalDurationMinutes,
    elapsedSeconds,
    playerLocation,
    seed = 'default_seed',
  } = options;

  if (mode === 'NONE') {
    const distToCenter = playerLocation
      ? haversineDistance(playerLocation, initialCenter)
      : 0;
    const isInside = distToCenter <= initialRadius;
    return {
      mode: 'NONE',
      currentCircle: { center: initialCenter, radiusMeters: initialRadius },
      nextSafeCircle: null,
      phaseNumber: 1,
      totalPhases: 1,
      phaseState: 'STATIC',
      statusText: 'ZONE STATIC (NO SHRINK)',
      secondsRemainingInState: Math.max(
        0,
        totalDurationMinutes * 60 - elapsedSeconds
      ),
      isInsideActiveZone: isInside,
      distanceToActiveBoundaryMeters: initialRadius - distToCenter,
    };
  }

  const phases = generateZonePhases(
    initialCenter,
    initialRadius,
    mode,
    totalDurationMinutes,
    seed
  );

  let accumulatedTime = 0;
  let activeCenter = initialCenter;
  let activeRadius = initialRadius;
  let nextSafeCircle: { center: LatLng; radiusMeters: number } | null = null;
  let currentPhaseIndex = 1;
  let phaseState: 'STATIC' | 'WAITING' | 'SHRINKING' | 'FINAL' = 'WAITING';
  let statusText = '';
  let secondsRemainingInState = 0;

  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
    const prevCenter = i === 0 ? initialCenter : phases[i - 1].targetCenter;
    const prevRadius = i === 0 ? initialRadius : phases[i - 1].targetRadiusMeters;

    const waitEnd = accumulatedTime + phase.waitDurationSec;
    const shrinkEnd = waitEnd + phase.shrinkDurationSec;

    if (elapsedSeconds < waitEnd) {
      // Currently waiting for shrink to begin
      currentPhaseIndex = phase.phaseIndex;
      phaseState = 'WAITING';
      activeCenter = prevCenter;
      activeRadius = prevRadius;
      nextSafeCircle = {
        center: phase.targetCenter,
        radiusMeters: phase.targetRadiusMeters,
      };
      secondsRemainingInState = Math.max(0, Math.ceil(waitEnd - elapsedSeconds));
      const mm = Math.floor(secondsRemainingInState / 60);
      const ss = secondsRemainingInState % 60;
      statusText = `PHASE ${phase.phaseIndex} • SHRINK IN ${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
      break;
    } else if (elapsedSeconds < shrinkEnd) {
      // Currently actively shrinking
      currentPhaseIndex = phase.phaseIndex;
      phaseState = 'SHRINKING';
      const progress =
        (elapsedSeconds - waitEnd) / Math.max(1, phase.shrinkDurationSec);

      // Smooth interpolation from prev to target
      activeRadius = Math.round(
        prevRadius + (phase.targetRadiusMeters - prevRadius) * progress
      );

      // Interpolate coordinates
      const lat =
        prevCenter.latitude +
        (phase.targetCenter.latitude - prevCenter.latitude) * progress;
      const lng =
        prevCenter.longitude +
        (phase.targetCenter.longitude - prevCenter.longitude) * progress;
      activeCenter = { latitude: lat, longitude: lng };

      nextSafeCircle = {
        center: phase.targetCenter,
        radiusMeters: phase.targetRadiusMeters,
      };
      secondsRemainingInState = Math.max(
        0,
        Math.ceil(shrinkEnd - elapsedSeconds)
      );
      const mm = Math.floor(secondsRemainingInState / 60);
      const ss = secondsRemainingInState % 60;
      statusText = `⚠️ ZONE CLOSING IN • ${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
      break;
    }

    accumulatedTime = shrinkEnd;
    if (i === phases.length - 1) {
      // Reached final phase
      currentPhaseIndex = phases.length;
      phaseState = 'FINAL';
      activeCenter = phase.targetCenter;
      activeRadius = phase.targetRadiusMeters;
      nextSafeCircle = null;
      secondsRemainingInState = Math.max(
        0,
        totalDurationMinutes * 60 - elapsedSeconds
      );
      statusText = `FINAL INTENSE ZONE (${activeRadius}m)`;
    }
  }

  const distToActiveCenter = playerLocation
    ? haversineDistance(playerLocation, activeCenter)
    : 0;
  const isInside = distToActiveCenter <= activeRadius;

  return {
    mode,
    currentCircle: { center: activeCenter, radiusMeters: activeRadius },
    nextSafeCircle,
    phaseNumber: currentPhaseIndex,
    totalPhases: phases.length,
    phaseState,
    statusText,
    secondsRemainingInState,
    isInsideActiveZone: isInside,
    distanceToActiveBoundaryMeters: activeRadius - distToActiveCenter,
  };
}
