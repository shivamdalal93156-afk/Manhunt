import {
  angularDifference,
  initialBearing,
  normalizeHeading,
  relativeBearing,
} from '../bearing';

describe('Geo Bearing & Compass Direction Calculations', () => {
  describe('normalizeHeading', () => {
    it('keeps values in [0, 360) unchanged', () => {
      expect(normalizeHeading(0)).toBe(0);
      expect(normalizeHeading(90)).toBe(90);
      expect(normalizeHeading(180)).toBe(180);
      expect(normalizeHeading(359.9)).toBe(359.9);
    });

    it('normalizes 360 to 0', () => {
      expect(normalizeHeading(360)).toBe(0);
      expect(normalizeHeading(720)).toBe(0);
    });

    it('normalizes negative angles correctly', () => {
      expect(normalizeHeading(-90)).toBe(270);
      expect(normalizeHeading(-180)).toBe(180);
      expect(normalizeHeading(-1)).toBe(359);
      expect(normalizeHeading(-360)).toBe(0);
    });

    it('returns NaN for non-finite values', () => {
      expect(normalizeHeading(NaN)).toBeNaN();
      expect(normalizeHeading(Infinity)).toBeNaN();
    });
  });

  describe('initialBearing (Cardinal & Intercardinal)', () => {
    it('returns 0 for due North', () => {
      const from = { latitude: 0, longitude: 0 };
      const to = { latitude: 10, longitude: 0 };
      expect(initialBearing(from, to)).toBeCloseTo(0, 4);
    });

    it('returns 90 for due East at the Equator', () => {
      const from = { latitude: 0, longitude: 0 };
      const to = { latitude: 0, longitude: 10 };
      expect(initialBearing(from, to)).toBeCloseTo(90, 4);
    });

    it('returns 180 for due South', () => {
      const from = { latitude: 10, longitude: 0 };
      const to = { latitude: 0, longitude: 0 };
      expect(initialBearing(from, to)).toBeCloseTo(180, 4);
    });

    it('returns 270 for due West at the Equator', () => {
      const from = { latitude: 0, longitude: 10 };
      const to = { latitude: 0, longitude: 0 };
      expect(initialBearing(from, to)).toBeCloseTo(270, 4);
    });

    it('calculates initial bearing across the antimeridian (+179 to -179 Eastbound)', () => {
      const from = { latitude: 0, longitude: 179 };
      const to = { latitude: 0, longitude: -179 };
      // Going from +179° to -179° heading East across the antimeridian is bearing 90° (due East)
      expect(initialBearing(from, to)).toBeCloseTo(90, 4);
    });

    it('returns 0 for identical points', () => {
      const pt = { latitude: 37.7749, longitude: -122.4194 };
      expect(initialBearing(pt, pt)).toBe(0);
    });

    it('returns NaN for invalid coordinates', () => {
      const valid = { latitude: 37.7749, longitude: -122.4194 };
      const invalid = { latitude: 91, longitude: 0 };
      expect(initialBearing(valid, invalid)).toBeNaN();
    });
  });

  describe('relativeBearing', () => {
    it('returns target bearing when device faces true North (0°)', () => {
      expect(relativeBearing(0, 90)).toBe(90);
      expect(relativeBearing(0, 270)).toBe(270);
    });

    it('calculates clockwise relative angle when device is rotated', () => {
      // Device facing East (90°), target is South (180°) -> turn right 90°
      expect(relativeBearing(90, 180)).toBe(90);

      // Device facing East (90°), target is North (0°) -> turn 270° clockwise (or 90° left)
      expect(relativeBearing(90, 0)).toBe(270);

      // Device facing West (270°), target is North (0°) -> turn 90° clockwise
      expect(relativeBearing(270, 0)).toBe(90);
    });

    it('handles negative or unnormalized device headings', () => {
      expect(relativeBearing(-90, 0)).toBe(90); // -90 is 270; target 0 -> 90°
    });

    it('returns null when device heading is missing, null, or invalid', () => {
      expect(relativeBearing(null, 180)).toBeNull();
      expect(relativeBearing(undefined, 180)).toBeNull();
      expect(relativeBearing(NaN, 180)).toBeNull();
    });
  });

  describe('angularDifference across 0°/360° boundary', () => {
    it('calculates small acute differences across boundary', () => {
      // 5° and 355° are 10° apart across North (0°)
      expect(angularDifference(5, 355)).toBe(10);
      expect(angularDifference(355, 5)).toBe(10);
      expect(angularDifference(0, 360)).toBe(0);
      expect(angularDifference(10, 20)).toBe(10);
    });

    it('returns maximum 180 for diametrically opposite angles', () => {
      expect(angularDifference(0, 180)).toBe(180);
      expect(angularDifference(90, 270)).toBe(180);
    });

    it('handles unnormalized and negative inputs', () => {
      expect(angularDifference(-10, 10)).toBe(20);
      expect(angularDifference(370, 10)).toBe(0); // 370° == 10°
    });
  });
});
