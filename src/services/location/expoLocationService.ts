import * as Location from 'expo-location';
import { GPSLocation } from '@/types/geo';
import { validateAccuracy } from '@/lib/geo/geofence';
import {
  ILocationService,
  LocationError,
  LocationPermissionStatus,
  TrackingOptions,
} from './types';

export class ExpoLocationService implements ILocationService {
  private subscription: Location.LocationSubscription | null = null;

  async getPermissionStatus(): Promise<LocationPermissionStatus> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === Location.PermissionStatus.GRANTED) return 'granted';
      if (status === Location.PermissionStatus.DENIED) return 'denied';
      return 'undetermined';
    } catch {
      return 'undetermined';
    }
  }

  async requestPermissions(): Promise<LocationPermissionStatus> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === Location.PermissionStatus.GRANTED) return 'granted';
      if (status === Location.PermissionStatus.DENIED) return 'denied';
      return 'undetermined';
    } catch {
      return 'denied';
    }
  }

  async getCurrentLocation(): Promise<GPSLocation | null> {
    const status = await this.getPermissionStatus();
    if (status !== 'granted') {
      return null;
    }

    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      return this.mapExpoLocation(location);
    } catch {
      return null;
    }
  }

  async startTracking(
    options: TrackingOptions,
    onLocation: (location: GPSLocation) => void,
    onError: (error: LocationError) => void
  ): Promise<() => void> {
    const status = await this.getPermissionStatus();
    if (status !== 'granted') {
      onError({
        code: 'PERMISSION_DENIED',
        message: 'Foreground location permission not granted',
      });
      return () => {};
    }

    // Stop existing subscription if active
    await this.stopTracking();

    const maxAccuracy = options.maxAccuracyMeters ?? 35;

    try {
      this.subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: options.timeIntervalMs ?? 1000,
          distanceInterval: options.distanceIntervalMeters ?? 2,
        },
        (loc) => {
          const mapped = this.mapExpoLocation(loc);

          // Discard inaccurate telemetry readings
          if (!validateAccuracy(mapped.accuracy, maxAccuracy)) {
            onError({
              code: 'ACCURACY_INSUFFICIENT',
              message: `GPS accuracy ${mapped.accuracy?.toFixed(1)}m exceeds allowed threshold of ${maxAccuracy}m`,
            });
            return;
          }

          onLocation(mapped);
        }
      );

      return () => {
        this.stopTracking();
      };
    } catch (err: unknown) {
      onError({
        code: 'LOCATION_UNAVAILABLE',
        message: err instanceof Error ? err.message : 'Failed to initialize location provider',
      });
      return () => {};
    }
  }

  async stopTracking(): Promise<void> {
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }
  }

  private mapExpoLocation(loc: Location.LocationObject): GPSLocation {
    return {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      accuracy: loc.coords.accuracy ?? undefined,
      heading: loc.coords.heading ?? null,
      speed: loc.coords.speed ?? null,
      altitude: loc.coords.altitude ?? null,
      measuredAt: loc.timestamp,
    };
  }
}

export const locationService = new ExpoLocationService();
