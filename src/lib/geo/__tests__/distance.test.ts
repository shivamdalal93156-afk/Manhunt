import {
  haversineDistance,
  isValidCoordinate,
  toDegrees,
  toRadians,
} from '../distance';

describe('Geo Distance & Coordinate Validation', () => {
  describe('isValidCoordinate', () => {
    it('accepts valid coordinates', () => {
      expect(isValidCoordinate({ latitude: 37.7749, longitude: -122.4194 })).toBe(true);
      expect(isValidCoordinate({ latitude: 0, longitude: 0 })).toBe(true);
      expect(isValidCoordinate({ latitude: -90, longitude: 180 })).toBe(true);
      expect(isValidCoordinate({ latitude: 90, longitude: -180 })).toBe(true);
    });

    it('rejects coordinates with latitude out of range', () => {
      expect(isValidCoordinate({ latitude: 90.001, longitude: 0 })).toBe(false);
      expect(isValidCoordinate({ latitude: -91, longitude: 0 })).toBe(false);
    });

    it('rejects coordinates with longitude out of range', () => {
      expect(isValidCoordinate({ latitude: 0, longitude: 180.1 })).toBe(false);
      expect(isValidCoordinate({ latitude: 0, longitude: -181 })).toBe(false);
    });

    it('rejects NaN, Infinity, and non-number types', () => {
      expect(isValidCoordinate({ latitude: NaN, longitude: 0 })).toBe(false);
      expect(isValidCoordinate({ latitude: 0, longitude: Infinity })).toBe(false);
      expect(isValidCoordinate({ latitude: '37.7', longitude: '-122.4' })).toBe(false);
      expect(isValidCoordinate(null)).toBe(false);
      expect(isValidCoordinate(undefined)).toBe(false);
    });
  });

  describe('Radians / Degrees Conversion', () => {
    it('converts degrees to radians and back', () => {
      expect(toRadians(0)).toBe(0);
      expect(toRadians(180)).toBeCloseTo(Math.PI, 6);
      expect(toDegrees(Math.PI)).toBeCloseTo(180, 6);
      expect(toDegrees(Math.PI / 2)).toBeCloseTo(90, 6);
    });
  });

  describe('haversineDistance', () => {
    it('returns 0 for identical coordinates', () => {
      const point = { latitude: 51.5074, longitude: -0.1278 };
      expect(haversineDistance(point, point)).toBe(0);
    });

    it('calculates known distance between London and Paris within 0.1% tolerance', () => {
      // London (51.5074° N, 0.1278° W) to Paris (48.8566° N, 2.3522° E)
      // Standard WGS84 great-circle distance is ~343.55 km (343,556 m)
      const london = { latitude: 51.5074, longitude: -0.1278 };
      const paris = { latitude: 48.8566, longitude: 2.3522 };

      const distance = haversineDistance(london, paris);
      expect(distance).toBeGreaterThan(340000);
      expect(distance).toBeLessThan(346000);
      expect(distance).toBeCloseTo(343556, -3); // Within ~1km of standard reference
    });

    it('calculates 1 degree of longitude at Equator (~111.195 km)', () => {
      const p1 = { latitude: 0, longitude: 0 };
      const p2 = { latitude: 0, longitude: 1 };

      const distance = haversineDistance(p1, p2);
      // Expected = 2 * PI * 6371000 / 360 = 111,194.9 meters
      expect(distance).toBeCloseTo(111195, -1);
    });

    it('calculates short tactical sprint distances accurately (~15m catch distance)', () => {
      // Point A to Point B ~15m apart
      const hunter = { latitude: 37.774900, longitude: -122.419400 };
      // 0.000135 deg latitude ~ 15.01 meters
      const runner = { latitude: 37.775035, longitude: -122.419400 };

      const distance = haversineDistance(hunter, runner);
      expect(distance).toBeCloseTo(15.0, 0);
    });

    it('returns NaN for invalid coordinates', () => {
      const valid = { latitude: 37.7749, longitude: -122.4194 };
      const invalid = { latitude: 95, longitude: 0 };

      expect(haversineDistance(valid, invalid)).toBeNaN();
      expect(haversineDistance(invalid, valid)).toBeNaN();
    });
  });
});
