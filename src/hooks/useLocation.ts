import { useCallback, useEffect, useState } from 'react';
import { GPSLocation } from '@/types/geo';
import { locationService } from '@/services/location/expoLocationService';
import {
  LocationError,
  LocationPermissionStatus,
  TrackingOptions,
} from '@/services/location/types';

export function useLocation() {
  const [permissionStatus, setPermissionStatus] =
    useState<LocationPermissionStatus>('undetermined');
  const [currentLocation, setCurrentLocation] = useState<GPSLocation | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<LocationError | null>(null);

  // Check initial permission status and auto-acquire location on mount
  useEffect(() => {
    let mounted = true;
    locationService.getPermissionStatus().then(async (status) => {
      if (!mounted) return;
      setPermissionStatus(status);
      if (status === 'granted') {
        const loc = await locationService.getCurrentLocation();
        if (mounted && loc) {
          setCurrentLocation(loc);
        }
      }
    });
    return () => {
      mounted = false;
    };
  }, []);


  const requestPermission = useCallback(async () => {
    const status = await locationService.requestPermissions();
    setPermissionStatus(status);
    if (status === 'granted') {
      const loc = await locationService.getCurrentLocation();
      setCurrentLocation(loc);
    }
    return status;
  }, []);

  const refreshLocation = useCallback(async () => {
    const loc = await locationService.getCurrentLocation();
    if (loc) {
      setCurrentLocation(loc);
    }
    return loc;
  }, []);

  const startTracking = useCallback(
    async (options: TrackingOptions = {}) => {
      setError(null);
      setIsTracking(true);

      const unsubscribe = await locationService.startTracking(
        options,
        (loc) => {
          setCurrentLocation(loc);
        },
        (err) => {
          setError(err);
        }
      );

      return () => {
        setIsTracking(false);
        unsubscribe();
      };
    },
    []
  );

  const stopTracking = useCallback(async () => {
    await locationService.stopTracking();
    setIsTracking(false);
  }, []);

  return {
    permissionStatus,
    currentLocation,
    isTracking,
    error,
    requestPermission,
    refreshLocation,
    startTracking,
    stopTracking,
  };
}
