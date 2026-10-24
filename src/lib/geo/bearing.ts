import { LatLng } from '@/types/geo';
import { isValidCoordinate, toDegrees, toRadians } from './distance';

/**
 * Normalizes an angle in degrees to the range [0, 360).
 * Handles negative degrees and multi-revolution values.
 */
export function normalizeHeading(degrees: number): number {
  if (typeof degrees !== 'number' || !Number.isFinite(degrees)) {
    return NaN;
  }
  const mod = degrees % 360;
  const result = mod < 0 ? mod + 360 : mod;
  return result === 0 ? 0 : result;
}

/**
 * Calculates the initial great-circle bearing (forward azimuth) from coordinate `from` to coordinate `to`.
 *
 * @param from Starting coordinate
 * @param to Target coordinate
 * @returns Initial bearing in degrees in the range [0, 360) clockwise from true North.
 *          Returns NaN if either coordinate is invalid.
 */
export function initialBearing(from: LatLng, to: LatLng): number {
  if (!isValidCoordinate(from) || !isValidCoordinate(to)) {
    return NaN;
  }

  // Same coordinates have no defined bearing
  if (from.latitude === to.latitude && from.longitude === to.longitude) {
    return 0;
  }

  const phi1 = toRadians(from.latitude);
  const phi2 = toRadians(to.latitude);
  const deltaLambda = toRadians(to.longitude - from.longitude);

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  const radians = Math.atan2(y, x);
  const degrees = toDegrees(radians);

  return normalizeHeading(degrees);
}

/**
 * Calculates the relative bearing of a target coordinate relative to the user's current device heading.
 * This determines which way the HUD compass arrow should point on screen.
 *
 * Example:
 * If device is facing East (90°) and target is South (180°), relative bearing is 90° (turn right 90°).
 *
 * @param deviceHeading Current device heading in degrees [0, 360) (0 = North)
 * @param targetBearing Absolute bearing to the target in degrees [0, 360)
 * @returns Relative angle [0, 360) clockwise, or null if device heading is unavailable/invalid.
 */
export function relativeBearing(
  deviceHeading: number | null | undefined,
  targetBearing: number
): number | null {
  if (
    deviceHeading === null ||
    deviceHeading === undefined ||
    typeof deviceHeading !== 'number' ||
    !Number.isFinite(deviceHeading) ||
    !Number.isFinite(targetBearing)
  ) {
    return null;
  }

  const normalizedDev = normalizeHeading(deviceHeading);
  const normalizedTarget = normalizeHeading(targetBearing);

  return normalizeHeading(normalizedTarget - normalizedDev);
}

/**
 * Calculates the shortest acute angular difference between two angles across the 0°/360° boundary.
 *
 * @param angleA First angle in degrees
 * @param angleB Second angle in degrees
 * @returns Shortest difference in degrees in the range [0, 180]. Returns NaN if input invalid.
 */
export function angularDifference(angleA: number, angleB: number): number {
  if (!Number.isFinite(angleA) || !Number.isFinite(angleB)) {
    return NaN;
  }
  const normA = normalizeHeading(angleA);
  const normB = normalizeHeading(angleB);
  const diff = Math.abs(normA - normB);
  return diff > 180 ? 360 - diff : diff;
}
