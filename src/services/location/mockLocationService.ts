import { GPSLocation } from '@/types/geo';
import {
  ILocationService,
  LocationError,
  LocationPermissionStatus,
  TrackingOptions,
} from './types';

export class MockLocationService implements ILocationService {
  private permissionStatus: LocationPermissionStatus = 'granted';
  private currentLocation: GPSLocation = {
    latitude: 37.7749,
    longitude: -122.4194,
    accuracy: 5.0,
    heading: 90,
    speed: 1.5,
    measuredAt: Date.now(),
  };
  private intervalId: NodeJS.Timeout | null = null;

  setPermissionStatus(status: LocationPermissionStatus) {
    this.permissionStatus = status;
  }

  setMockLocation(location: Partial<GPSLocation>) {
    this.currentLocation = {
      ...this.currentLocation,
      ...location,
      measuredAt: Date.now(),
    };
  }

  async getPermissionStatus(): Promise<LocationPermissionStatus> {
    return this.permissionStatus;
  }

  async requestPermissions(): Promise<LocationPermissionStatus> {
    return this.permissionStatus;
  }

  async getCurrentLocation(): Promise<GPSLocation | null> {
    if (this.permissionStatus !== 'granted') return null;
    return { ...this.currentLocation, measuredAt: Date.now() };
  }

  async startTracking(
    options: TrackingOptions,
    onLocation: (location: GPSLocation) => void,
    onError: (error: LocationError) => void
  ): Promise<() => void> {
    if (this.permissionStatus !== 'granted') {
      onError({
        code: 'PERMISSION_DENIED',
        message: 'Mock permission denied',
      });
      return () => {};
    }

    const interval = options.timeIntervalMs ?? 1000;
    this.intervalId = setInterval(() => {
      onLocation({ ...this.currentLocation, measuredAt: Date.now() });
    }, interval);

    return () => {
      this.stopTracking();
    };
  }

  async stopTracking(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
