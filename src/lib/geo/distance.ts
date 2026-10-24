import { LatLng } from '@/types/geo';

export const EARTH_RADIUS_METERS = 6371000; // Mean Earth radius in meters (WGS84 spherical approximation)

/**
 * Validates that a coordinate has valid finite latitude [-90, 90] and longitude [-180, 180].
 */
export function isValidCoordinate(coord: unknown): coord is LatLng {
  if (!coord || typeof coord !== 'object') {
    return false;
  }
  const { latitude, longitude } = coord as Record<string, unknown>;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return false;
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return false;
  }
  if (latitude < -90 || latitude > 90) {
    return false;
  }
  if (longitude < -180 || longitude > 180) {
    return false;
  }
  return true;
}

/**
 * Converts degrees to radians.
 */
export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Converts radians to degrees.
 */
export function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * Calculates the great-circle distance between two points on the Earth using the Haversine formula.
 *
 * @param from Starting coordinate {latitude, longitude}
 * @param to Target coordinate {latitude, longitude}
 * @returns Distance in meters. Returns NaN if either coordinate is invalid.
 */
export function haversineDistance(from: LatLng, to: LatLng): number {
  if (!isValidCoordinate(from) || !isValidCoordinate(to)) {
    return NaN;
  }

  // Fast path for identical points
  if (from.latitude === to.latitude && from.longitude === to.longitude) {
    return 0;
  }

  const phi1 = toRadians(from.latitude);
  const phi2 = toRadians(to.latitude);
  const deltaPhi = toRadians(to.latitude - from.latitude);
  const deltaLambda = toRadians(to.longitude - from.longitude);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  // Clamp 'a' to [0, 1] to prevent floating point inaccuracies causing NaN in sqrt / asin
  const clampedA = Math.max(0, Math.min(1, a));
  const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));

  return EARTH_RADIUS_METERS * c;
}
