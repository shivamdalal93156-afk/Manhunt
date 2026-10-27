import { GPSFilter } from '../gpsFilter';
import { GPSLocation } from '@/types/geo';

describe('GPSFilter', () => {
  it('anchors position when stationary drift is within deadband (<3.5m)', () => {
    const filter = new GPSFilter({ stationaryDriftRadiusMeters: 3.5, stationarySpeedThresholdMps: 0.8 });

    const baseLoc: GPSLocation = {
      latitude: 28.6139,
      longitude: 77.209,
      accuracy: 5,
      speed: 0.1,
      heading: 0,
      measuredAt: 1000,
    };

    const first = filter.filterLocation(baseLoc);
    expect(first.latitude).toBeCloseTo(28.6139);
    expect(first.longitude).toBeCloseTo(77.209);

    // 2-meter simulated GPS drift while standing still
    const driftedLoc: GPSLocation = {
      latitude: 28.613915, // ~1.6m north
      longitude: 77.20901, // ~1.0m east
      accuracy: 6,
      speed: 0.2, // below threshold
      heading: 45, // noisy heading
      measuredAt: 2000,
    };

    const second = filter.filterLocation(driftedLoc);
    // Should be clamped to the initial base coordinates
    expect(second.latitude).toBeCloseTo(28.6139);
    expect(second.longitude).toBeCloseTo(77.209);
    expect(second.speed).toBe(0);
  });

  it('smooths position when genuinely moving (>3.5m and speed > 0.8 m/s)', () => {
    const filter = new GPSFilter();

    const baseLoc: GPSLocation = {
      latitude: 28.6139,
      longitude: 77.209,
      accuracy: 5,
      speed: 0,
      measuredAt: 1000,
    };
    filter.filterLocation(baseLoc);

    // 20-meter movement
    const movingLoc: GPSLocation = {
      latitude: 28.6141, // ~22m away
      longitude: 77.209,
      accuracy: 5,
      speed: 2.5,
      measuredAt: 2000,
    };

    const moved = filter.filterLocation(movingLoc);
    expect(moved.latitude).toBeGreaterThan(28.6139);
  });

  it('stabilizes distance readout so 390m -> 392m jitter does not jump', () => {
    const filter = new GPSFilter();

    const d1 = filter.smoothDistance('hunter-1', 390.4);
    expect(d1).toBe(390);

    // 2-meter jitter
    const d2 = filter.smoothDistance('hunter-1', 392.1);
    expect(d2).toBe(390); // clamped by deadband

    // Real 15-meter sprint
    const d3 = filter.smoothDistance('hunter-1', 375.0);
    expect(d3).toBeLessThan(390);
  });

  it('throttles network broadcasts when stationary and respects heartbeat', () => {
    const filter = new GPSFilter({ networkMinDisplacementMeters: 3.0, networkStationaryHeartbeatMs: 5000 });

    const loc: GPSLocation = {
      latitude: 28.6139,
      longitude: 77.209,
      measuredAt: 1000,
    };

    // First broadcast must be allowed
    expect(filter.shouldBroadcast(loc)).toBe(true);

    // Immediate second call with tiny drift should be throttled
    const tinyDrift: GPSLocation = {
      latitude: 28.613905,
      longitude: 77.209005,
      measuredAt: 2000,
    };
    expect(filter.shouldBroadcast(tinyDrift)).toBe(false);

    // Forced broadcast (e.g. ping interval timer) must be allowed
    expect(filter.shouldBroadcast(tinyDrift, true)).toBe(true);
  });
});
