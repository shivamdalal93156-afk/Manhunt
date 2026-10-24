import { GPSLocation } from '@/types/geo';

export type LocationPermissionStatus = 'undetermined' | 'granted' | 'denied';

export type LocationErrorCode =
  | 'PERMISSION_DENIED'
  | 'LOCATION_UNAVAILABLE'
  | 'ACCURACY_INSUFFICIENT'
  | 'TIMEOUT'
  | 'UNKNOWN';

export interface LocationError {
  code: LocationErrorCode;
  message: string;
}

export interface TrackingOptions {
  timeIntervalMs?: number;       // Sampling interval in ms (default: 1000ms)
  distanceIntervalMeters?: number; // Distance filter in meters (default: 2m)
  maxAccuracyMeters?: number;    // Filter out readings with accuracy worse than this (default: 35m)
}

export interface ILocationService {
  /**
   * Checks the current permission status without prompting the user.
   */
  getPermissionStatus(): Promise<LocationPermissionStatus>;

  /**
   * Requests foreground location permissions from the user.
   */
  requestPermissions(): Promise<LocationPermissionStatus>;

  /**
   * Retrieves a single current GPS fix.
   * Returns null if permissions are denied or GPS is unavailable.
   */
  getCurrentLocation(): Promise<GPSLocation | null>;

  /**
   * Starts continuous location tracking.
   * Returns a cleanup unsubscribe function.
   */
  startTracking(
    options: TrackingOptions,
    onLocation: (location: GPSLocation) => void,
    onError: (error: LocationError) => void
  ): Promise<() => void>;

  /**
   * Stops active location tracking and releases native subscriptions.
   */
  stopTracking(): Promise<void>;
}
