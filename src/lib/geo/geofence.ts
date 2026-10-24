import {
  BoundaryCheckResult,
  GeofenceCircle,
  GeofencePolygon,
  LatLng,
  LocationFreshness,
} from '@/types/geo';
import { haversineDistance, isValidCoordinate } from './distance';

/**
 * Evaluates whether a point is inside a circular geofence, with optional grace distance.
 *
 * @param point Player coordinates
 * @param circle Geofence circle { center, radiusMeters }
 * @param graceMeters Allowable distance beyond boundary before marking out-of-bounds (default: 15m)
 */
export function pointInCircle(
  point: LatLng,
  circle: GeofenceCircle,
  graceMeters = 15
): BoundaryCheckResult {
  if (!isValidCoordinate(point) || !isValidCoordinate(circle.center)) {
    return {
      isInside: false,
      distanceToBoundaryMeters: -Infinity,
      warningGraceActive: false,
    };
  }

  const distanceToCenter = haversineDistance(point, circle.center);
  const distanceToBoundary = circle.radiusMeters - distanceToCenter;
  const isStrictlyInside = distanceToCenter <= circle.radiusMeters;
  const isWithinGrace = distanceToCenter <= circle.radiusMeters + graceMeters;

  return {
    isInside: isWithinGrace,
    distanceToBoundaryMeters: distanceToBoundary,
    warningGraceActive: !isStrictlyInside && isWithinGrace,
  };
}

/**
 * Tests if a point is inside an arbitrary polygon using the standard Ray-Casting algorithm.
 *
 * @param point Player coordinates { latitude, longitude }
 * @param polygon Geofence polygon with ordered vertices
 * @param graceMeters Optional distance buffer (simplifies boundary buffer checks)
 */
export function pointInPolygon(
  point: LatLng,
  polygon: GeofencePolygon,
  graceMeters = 15
): BoundaryCheckResult {
  if (!isValidCoordinate(point) || !polygon?.coordinates || polygon.coordinates.length < 3) {
    return {
      isInside: false,
      distanceToBoundaryMeters: -Infinity,
      warningGraceActive: false,
    };
  }

  const vertices = polygon.coordinates;
  const x = point.longitude;
  const y = point.latitude;
  let isInside = false;

  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i].longitude;
    const yi = vertices[i].latitude;
    const xj = vertices[j].longitude;
    const yj = vertices[j].latitude;

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) {
      isInside = !isInside;
    }
  }

  // Calculate distance to nearest edge
  let minDistanceToEdge = Infinity;
  for (let i = 0; i < vertices.length; i++) {
    const d = haversineDistance(point, vertices[i]);
    if (d < minDistanceToEdge) {
      minDistanceToEdge = d;
    }
  }

  // Grace buffer handling for polygon boundary
  const warningGrace = !isInside && minDistanceToEdge <= graceMeters;

  return {
    isInside: isInside || warningGrace,
    distanceToBoundaryMeters: isInside ? minDistanceToEdge : -minDistanceToEdge,
    warningGraceActive: warningGrace,
  };
}

/**
 * Evaluates the freshness tier of a location measurement based on elapsed time.
 *
 * @param measuredAt Unix timestamp (ms) of the GPS measurement
 * @param referenceTime Unix timestamp (ms) to compare against (defaults to Date.now())
 */
export function evaluateLocationFreshness(
  measuredAt: number,
  referenceTime = Date.now()
): LocationFreshness {
  if (!measuredAt || !Number.isFinite(measuredAt) || measuredAt > referenceTime + 5000) {
    // Future timestamps or invalid data treated as expired
    return LocationFreshness.EXPIRED;
  }

  const elapsedSeconds = Math.max(0, (referenceTime - measuredAt) / 1000);

  if (elapsedSeconds <= 15) {
    return LocationFreshness.FRESH;
  }
  if (elapsedSeconds <= 45) {
    return LocationFreshness.DELAYED;
  }
  if (elapsedSeconds <= 90) {
    return LocationFreshness.STALE;
  }
  return LocationFreshness.EXPIRED;
}

/**
 * Validates GPS accuracy against an allowable operational threshold.
 * Prevents erratic readings (e.g. 100m cellular tower triangulation) from corrupting game state.
 *
 * @param accuracyMeters Reported GPS accuracy radius in meters
 * @param thresholdMeters Maximum acceptable radius (default: 35 meters)
 */
export function validateAccuracy(
  accuracyMeters: number | undefined | null,
  thresholdMeters = 35
): boolean {
  if (accuracyMeters === undefined || accuracyMeters === null || !Number.isFinite(accuracyMeters)) {
    return false;
  }
  return accuracyMeters >= 0 && accuracyMeters <= thresholdMeters;
}
