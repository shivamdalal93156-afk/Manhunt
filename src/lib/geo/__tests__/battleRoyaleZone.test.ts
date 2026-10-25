import {
  evaluateDynamicZone,
  generateZonePhases,
} from '../battleRoyaleZone';
import { haversineDistance } from '../distance';

describe('Battle Royale & Dynamic Play Zone Mechanics', () => {
  const initialCenter = { latitude: 28.7499, longitude: 77.117 }; // DTU
  const initialRadius = 600;

  test('Static mode (NONE) produces static single phase with no shrink', () => {
    const phases = generateZonePhases(initialCenter, initialRadius, 'NONE', 30);
    expect(phases.length).toBe(1);
    expect(phases[0].targetRadiusMeters).toBe(600);
    expect(phases[0].shrinkDurationSec).toBe(0);

    const evaluated = evaluateDynamicZone({
      initialCenter,
      initialRadius,
      mode: 'NONE',
      totalDurationMinutes: 30,
      elapsedSeconds: 500,
      playerLocation: initialCenter,
    });
    expect(evaluated.phaseState).toBe('STATIC');
    expect(evaluated.currentCircle.radiusMeters).toBe(600);
    expect(evaluated.nextSafeCircle).toBeNull();
  });

  test('Concentric mode keeps identical center while shrinking radius', () => {
    const phases = generateZonePhases(
      initialCenter,
      initialRadius,
      'CONCENTRIC',
      30,
      'test_seed_1'
    );
    expect(phases.length).toBeGreaterThanOrEqual(3);

    for (const phase of phases) {
      expect(phase.targetCenter.latitude).toBeCloseTo(initialCenter.latitude, 4);
      expect(phase.targetCenter.longitude).toBeCloseTo(initialCenter.longitude, 4);
      expect(phase.targetRadiusMeters).toBeLessThan(initialRadius);
    }
  });

  test('Battle Royale mode generates next circles that fit 100% inside current circles', () => {
    const phases = generateZonePhases(
      initialCenter,
      initialRadius,
      'BATTLE_ROYALE',
      30,
      'pubg_match_room_xyz'
    );

    let currentCenter = initialCenter;
    let currentRadius = initialRadius;

    for (const phase of phases) {
      const distanceBetweenCenters = haversineDistance(
        currentCenter,
        phase.targetCenter
      );

      // Free Fire / PUBG mathematical constraint:
      // distance(C1, C2) <= R1 - R2
      // This guarantees Circle 2 is strictly contained inside Circle 1.
      expect(distanceBetweenCenters).toBeLessThanOrEqual(
        currentRadius - phase.targetRadiusMeters + 1
      );

      currentCenter = phase.targetCenter;
      currentRadius = phase.targetRadiusMeters;
    }
  });

  test('Deterministic seed produces identical phases across different devices', () => {
    const run1 = generateZonePhases(initialCenter, initialRadius, 'BATTLE_ROYALE', 30, 'match_abc');
    const run2 = generateZonePhases(initialCenter, initialRadius, 'BATTLE_ROYALE', 30, 'match_abc');
    expect(run1).toEqual(run2);
  });

  test('Smooth dynamic evaluation during waiting and active shrink', () => {
    // Evaluation at elapsed = 0 (waiting for phase 1 shrink)
    const evalStart = evaluateDynamicZone({
      initialCenter,
      initialRadius,
      mode: 'BATTLE_ROYALE',
      totalDurationMinutes: 30,
      elapsedSeconds: 10,
      playerLocation: initialCenter,
      seed: 'match_pubg',
    });
    expect(evalStart.phaseState).toBe('WAITING');
    expect(evalStart.nextSafeCircle).not.toBeNull();
    expect(evalStart.currentCircle.radiusMeters).toBe(initialRadius);

    // Evaluation during active shrinking
    const firstPhaseWait = generateZonePhases(
      initialCenter,
      initialRadius,
      'BATTLE_ROYALE',
      30,
      'match_pubg'
    )[0].waitDurationSec;

    const evalShrink = evaluateDynamicZone({
      initialCenter,
      initialRadius,
      mode: 'BATTLE_ROYALE',
      totalDurationMinutes: 30,
      elapsedSeconds: firstPhaseWait + 15,
      playerLocation: initialCenter,
      seed: 'match_pubg',
    });
    expect(evalShrink.phaseState).toBe('SHRINKING');
    expect(evalShrink.currentCircle.radiusMeters).toBeLessThan(initialRadius);
  });
});
