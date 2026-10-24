import { GeofenceCircle, GeofencePolygon, LocationFreshness } from '@/types/geo';
import {
  evaluateLocationFreshness,
  pointInCircle,
  pointInPolygon,
  validateAccuracy,
} from '../geofence';

describe('Geofence & Location Validation', () => {
  describe('pointInCircle', () => {
    const center = { latitude: 37.7749, longitude: -122.4194 };
    const circle: GeofenceCircle = {
      type: 'circle',
      center,
      radiusMeters: 500,
    };

    it('identifies points strictly inside the circle', () => {
      // Center point
      const result = pointInCircle(center, circle, 15);
      expect(result.isInside).toBe(true);
      expect(result.warningGraceActive).toBe(false);
      expect(result.distanceToBoundaryMeters).toBeCloseTo(500, 0);

      // Point ~200m away (0.0018 deg lat ~ 200m)
      const insidePoint = { latitude: 37.7767, longitude: -122.4194 };
      const resInside = pointInCircle(insidePoint, circle, 15);
      expect(resInside.isInside).toBe(true);
      expect(resInside.warningGraceActive).toBe(false);
    });

    it('identifies points within the 15m warning grace zone outside boundary', () => {
      // ~508 meters away (0.00457 deg lat ~ 508m)
      const gracePoint = { latitude: 37.77947, longitude: -122.4194 };
      const resGrace = pointInCircle(gracePoint, circle, 15);
      expect(resGrace.isInside).toBe(true); // Still considered inside during grace
      expect(resGrace.warningGraceActive).toBe(true); // But warning active!
    });

    it('identifies points completely outside circle and grace zone', () => {
      // Point 1000m away
      const outsidePoint = { latitude: 37.7839, longitude: -122.4194 };
      const resOutside = pointInCircle(outsidePoint, circle, 15);
      expect(resOutside.isInside).toBe(false);
      expect(resOutside.warningGraceActive).toBe(false);
      expect(resOutside.distanceToBoundaryMeters).toBeLessThan(0);
    });

    it('handles invalid coordinate gracefully', () => {
      const invalid = { latitude: 999, longitude: 0 };
      const result = pointInCircle(invalid, circle);
      expect(result.isInside).toBe(false);
    });
  });

  describe('pointInPolygon', () => {
    // Quadrilateral around San Francisco Civic Center
    const polygon: GeofencePolygon = {
      type: 'polygon',
      coordinates: [
        { latitude: 37.780, longitude: -122.425 },
        { latitude: 37.780, longitude: -122.415 },
        { latitude: 37.770, longitude: -122.415 },
        { latitude: 37.770, longitude: -122.425 },
      ],
    };

    it('detects point clearly inside polygon', () => {
      const insidePt = { latitude: 37.775, longitude: -122.420 };
      const res = pointInPolygon(insidePt, polygon);
      expect(res.isInside).toBe(true);
      expect(res.warningGraceActive).toBe(false);
    });

    it('detects point clearly outside polygon', () => {
      const outsidePt = { latitude: 37.790, longitude: -122.420 };
      const res = pointInPolygon(outsidePt, polygon, 0);
      expect(res.isInside).toBe(false);
    });
  });

  describe('evaluateLocationFreshness', () => {
    const now = 1700000000000;

    it('marks updates <= 15s old as FRESH', () => {
      expect(evaluateLocationFreshness(now - 5000, now)).toBe(LocationFreshness.FRESH);
      expect(evaluateLocationFreshness(now - 15000, now)).toBe(LocationFreshness.FRESH);
    });

    it('marks updates 16s - 45s old as DELAYED', () => {
      expect(evaluateLocationFreshness(now - 25000, now)).toBe(LocationFreshness.DELAYED);
      expect(evaluateLocationFreshness(now - 45000, now)).toBe(LocationFreshness.DELAYED);
    });

    it('marks updates 46s - 90s old as STALE', () => {
      expect(evaluateLocationFreshness(now - 60000, now)).toBe(LocationFreshness.STALE);
      expect(evaluateLocationFreshness(now - 90000, now)).toBe(LocationFreshness.STALE);
    });

    it('marks updates > 90s old as EXPIRED', () => {
      expect(evaluateLocationFreshness(now - 120000, now)).toBe(LocationFreshness.EXPIRED);
    });

    it('marks anomalous future timestamps or invalid numbers as EXPIRED', () => {
      expect(evaluateLocationFreshness(now + 60000, now)).toBe(LocationFreshness.EXPIRED);
      expect(evaluateLocationFreshness(NaN, now)).toBe(LocationFreshness.EXPIRED);
      expect(evaluateLocationFreshness(0, now)).toBe(LocationFreshness.EXPIRED);
    });
  });

  describe('validateAccuracy', () => {
    it('accepts high and moderate accuracy within threshold', () => {
      expect(validateAccuracy(5, 35)).toBe(true);
      expect(validateAccuracy(20, 35)).toBe(true);
      expect(validateAccuracy(35, 35)).toBe(true);
    });

    it('rejects poor accuracy exceeding threshold', () => {
      expect(validateAccuracy(40, 35)).toBe(false);
      expect(validateAccuracy(100, 35)).toBe(false);
    });

    it('rejects negative, missing, or NaN accuracy values', () => {
      expect(validateAccuracy(-5, 35)).toBe(false);
      expect(validateAccuracy(undefined, 35)).toBe(false);
      expect(validateAccuracy(null, 35)).toBe(false);
      expect(validateAccuracy(NaN, 35)).toBe(false);
    });
  });
});
