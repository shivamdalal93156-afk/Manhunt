/**
 * Geographic Types & Coordinate Specifications
 */

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface GPSLocation extends LatLng {
  accuracy?: number; // Accuracy in meters
  heading?: number | null; // Direction of travel in degrees (0 - 359.9)
  speed?: number | null; // Speed in meters per second
  altitude?: number | null;
  measuredAt: number; // Unix timestamp in milliseconds
}

export enum LocationFreshness {
  FRESH = 'FRESH',       // <= 15 seconds
  DELAYED = 'DELAYED',   // 15 - 45 seconds
  STALE = 'STALE',       // 45 - 90 seconds
  EXPIRED = 'EXPIRED',   // > 90 seconds
}

export interface GeofenceCircle {
  type: 'circle';
  center: LatLng;
  radiusMeters: number;
}

export interface GeofencePolygon {
  type: 'polygon';
  coordinates: LatLng[]; // Ordered vertices of boundary polygon
}

export type GeofenceZone = GeofenceCircle | GeofencePolygon;

export interface BoundaryCheckResult {
  isInside: boolean;
  distanceToBoundaryMeters: number; // Positive if inside, negative or distance to edge if outside
  accuracyMeters?: number;
  warningGraceActive: boolean;
}
