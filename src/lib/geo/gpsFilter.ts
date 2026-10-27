import { GPSLocation } from '@/types/geo';
import { haversineDistance } from './distance';

export interface FilterOptions {
  /** Speed in m/s below which the user is considered stationary (default: 0.8 m/s ~ 2.9 km/h) */
  stationarySpeedThresholdMps?: number;
  /** Radius in meters of natural stationary GPS drift to dampen (default: 3.5m) */
  stationaryDriftRadiusMeters?: number;
  /** Maximum allowable GPS accuracy in meters; readings worse than this are dampened (default: 25m) */
  maxAccuracyThresholdMeters?: number;
  /** Minimum movement distance required to trigger a network broadcast (default: 3.0m) */
  networkMinDisplacementMeters?: number;
  /** Minimum time in ms between broadcasts when stationary (heartbeat, default: 5000ms) */
  networkStationaryHeartbeatMs?: number;
}

/**
 * High-precision GPS noise filter, deadband stabilizer, and broadcast gatekeeper.
 * Prevents stationary coordinate flutter, distance jumping, and direction spinning,
 * while drastically minimizing network requests.
 */
export class GPSFilter {
  private lastAcceptedLocation: GPSLocation | null = null;
  private lastBroadcastLocation: GPSLocation | null = null;
  private lastBroadcastTimestamp = 0;
  private smoothedDistanceMap = new Map<string, number>();

  private readonly speedThreshold: number;
  private readonly driftRadius: number;
  private readonly accuracyThreshold: number;
  private readonly networkMinDisplacement: number;
  private readonly networkHeartbeatMs: number;

  constructor(options: FilterOptions = {}) {
    this.speedThreshold = options.stationarySpeedThresholdMps ?? 0.8;
    this.driftRadius = options.stationaryDriftRadiusMeters ?? 3.5;
    this.accuracyThreshold = options.maxAccuracyThresholdMeters ?? 25;
    this.networkMinDisplacement = options.networkMinDisplacementMeters ?? 3.0;
    this.networkHeartbeatMs = options.networkStationaryHeartbeatMs ?? 5000;
  }

  /**
   * Filters an incoming raw GPS location.
   * If the device is stationary (speed < 0.8 m/s and drift < 3.5m), anchors coordinate to eliminate jitter.
   * If moving, applies smooth low-pass interpolation.
   */
  filterLocation(raw: GPSLocation): GPSLocation {
    if (!this.lastAcceptedLocation) {
      this.lastAcceptedLocation = { ...raw };
      return this.lastAcceptedLocation;
    }

    // Degraded accuracy rejection: if accuracy is poor (> 25m), hold previous stable location
    if (raw.accuracy !== undefined && raw.accuracy > this.accuracyThreshold) {
      return this.lastAcceptedLocation;
    }

    const distFromLast = haversineDistance(this.lastAcceptedLocation, raw);
    const speed = raw.speed !== null && raw.speed !== undefined ? raw.speed : 0;
    const isStationary = speed < this.speedThreshold && distFromLast < this.driftRadius;

    if (isStationary) {
      // User is standing still: clamp to anchor and suppress jitter
      return {
        ...this.lastAcceptedLocation,
        measuredAt: raw.measuredAt || Date.now(),
        speed: 0,
        // Heading is invalid when stationary
        heading: this.lastAcceptedLocation.heading,
      };
    }

    // User is genuinely walking / running: smooth transition using adaptive low-pass filter
    const alpha = Math.min(0.9, Math.max(0.4, distFromLast / 8.0));
    const smoothLat =
      this.lastAcceptedLocation.latitude +
      alpha * (raw.latitude - this.lastAcceptedLocation.latitude);
    const smoothLon =
      this.lastAcceptedLocation.longitude +
      alpha * (raw.longitude - this.lastAcceptedLocation.longitude);

    this.lastAcceptedLocation = {
      ...raw,
      latitude: smoothLat,
      longitude: smoothLon,
      measuredAt: raw.measuredAt || Date.now(),
    };

    return this.lastAcceptedLocation;
  }

  /**
   * Determines whether the filtered location should be transmitted over the network.
   * Prevents spamming Supabase every second when player is not moving.
   * Broadcasts if:
   * 1. First broadcast
   * 2. Player has physically moved >= networkMinDisplacement (3.0m)
   * 3. Periodic heartbeat interval (5000ms) has elapsed
   * 4. Forced by caller (e.g. periodic ping reveal timer)
   */
  shouldBroadcast(location: GPSLocation, force = false): boolean {
    if (force) {
      this.lastBroadcastLocation = { ...location };
      this.lastBroadcastTimestamp = Date.now();
      return true;
    }

    if (!this.lastBroadcastLocation) {
      this.lastBroadcastLocation = { ...location };
      this.lastBroadcastTimestamp = Date.now();
      return true;
    }

    const now = Date.now();
    const timeSinceLast = now - this.lastBroadcastTimestamp;
    const distFromLastBroadcast = haversineDistance(this.lastBroadcastLocation, location);

    // Significant motion threshold
    if (distFromLastBroadcast >= this.networkMinDisplacement) {
      this.lastBroadcastLocation = { ...location };
      this.lastBroadcastTimestamp = now;
      return true;
    }

    // Keepalive heartbeat
    if (timeSinceLast >= this.networkHeartbeatMs) {
      this.lastBroadcastLocation = { ...location };
      this.lastBroadcastTimestamp = now;
      return true;
    }

    return false;
  }

  /**
   * Distance stabilization deadband.
   * Prevents distance readout on UI from jumping (e.g. 390m -> 392m -> 389m) when players are stationary.
   */
  smoothDistance(targetKey: string, rawDistanceMeters: number): number {
    const prev = this.smoothedDistanceMap.get(targetKey);
    if (prev === undefined) {
      this.smoothedDistanceMap.set(targetKey, rawDistanceMeters);
      return Math.round(rawDistanceMeters);
    }

    const diff = Math.abs(rawDistanceMeters - prev);
    // If change is less than 3 meters, hold previous stable reading
    if (diff < 3.0) {
      return Math.round(prev);
    }

    // Smooth step towards new distance
    const smoothed = prev + 0.3 * (rawDistanceMeters - prev);
    this.smoothedDistanceMap.set(targetKey, smoothed);
    return Math.round(smoothed);
  }

  reset(): void {
    this.lastAcceptedLocation = null;
    this.lastBroadcastLocation = null;
    this.lastBroadcastTimestamp = 0;
    this.smoothedDistanceMap.clear();
  }
}

export const defaultGPSFilter = new GPSFilter();
