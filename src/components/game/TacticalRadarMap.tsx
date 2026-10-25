import React from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GPSLocation } from '@/types/geo';
import { RunnerSnapshot } from '@/types/game';
import { haversineDistance } from '@/lib/geo/distance';
import { initialBearing } from '@/lib/geo/bearing';
import { borderRadius, colors, spacing, typography } from '@/theme/tokens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAP_SIZE = Math.min(SCREEN_WIDTH - spacing.lg * 2, 340);

interface TacticalRadarMapProps {
  hunterLocation: GPSLocation | null;
  runners: RunnerSnapshot[];
  zoneRadiusMeters?: number;
  catchRadiusMeters?: number;
  selectedRunnerId?: string | null;
  onSelectRunner?: (runner: RunnerSnapshot) => void;
}

export const TacticalRadarMap: React.FC<TacticalRadarMapProps> = ({
  hunterLocation,
  runners,
  zoneRadiusMeters = 500,
  catchRadiusMeters = 15,
  selectedRunnerId,
  onSelectRunner,
}) => {
  const maxRangeMeters = Math.max(zoneRadiusMeters, 200);
  const now = Date.now();

  // Convert distance and bearing from center to local X,Y on radar canvas
  const getCanvasCoordinates = (targetLat: number, targetLng: number) => {
    if (!hunterLocation) {
      return { x: MAP_SIZE / 2, y: MAP_SIZE / 2, distMeters: 0 };
    }

    const distMeters = haversineDistance(hunterLocation, {
      latitude: targetLat,
      longitude: targetLng,
    });

    const bearing = initialBearing(hunterLocation, {
      latitude: targetLat,
      longitude: targetLng,
    });

    // Map distance to radial pixel radius (half map size)
    const scale = (MAP_SIZE / 2 - 20) / maxRangeMeters;
    const r = Math.min(distMeters * scale, MAP_SIZE / 2 - 15);
    const rad = ((bearing - 90) * Math.PI) / 180; // 0 deg North -> -90 deg on 2D plane

    const x = MAP_SIZE / 2 + r * Math.cos(rad);
    const y = MAP_SIZE / 2 + r * Math.sin(rad);

    return { x, y, distMeters };
  };

  const catchRadiusPixels = Math.max(
    8,
    (catchRadiusMeters * (MAP_SIZE / 2 - 20)) / maxRangeMeters
  );

  return (
    <View style={styles.container}>
      <View style={[styles.radarSurface, { width: MAP_SIZE, height: MAP_SIZE }]}>
        {/* Distance Range Concentric Rings with Range Labels */}
        <View style={[styles.ring, { width: MAP_SIZE * 0.35, height: MAP_SIZE * 0.35 }]} />
        <View style={[styles.ring, { width: MAP_SIZE * 0.65, height: MAP_SIZE * 0.65 }]} />
        <View style={[styles.ring, { width: MAP_SIZE * 0.92, height: MAP_SIZE * 0.92 }]} />

        {/* Range Ring Labels */}
        <Text style={[styles.rangeLabel, { top: MAP_SIZE * 0.04 }]}>{maxRangeMeters}m</Text>
        <Text style={[styles.rangeLabel, { top: MAP_SIZE * 0.17 }]}>{Math.round(maxRangeMeters * 0.65)}m</Text>
        <Text style={[styles.rangeLabel, { top: MAP_SIZE * 0.32 }]}>{Math.round(maxRangeMeters * 0.35)}m</Text>

        {/* Crosshair Lines */}
        <View style={styles.crosshairVertical} />
        <View style={styles.crosshairHorizontal} />

        {/* Hunter Center Marker & 15m Proximity Catch Halo */}
        {hunterLocation ? (
          <>
            <View style={[styles.hunterCatchHalo, { width: catchRadiusPixels * 2, height: catchRadiusPixels * 2 }]} />
            <View style={styles.hunterCenterMarker}>
              <View style={styles.hunterDiamond} />
            </View>

            {/* Runner Markers */}
            {runners.map((runner) => {
              const { x, y, distMeters } = getCanvasCoordinates(
                runner.latitude,
                runner.longitude
              );
              const isSelected = runner.playerId === selectedRunnerId;
              const isWithinCatch = distMeters <= catchRadiusMeters;
              const isStale = runner.measuredAt ? now - runner.measuredAt > 60000 : false;

              return (
                <TouchableOpacity
                  key={runner.playerId}
                  activeOpacity={0.8}
                  style={[
                    styles.runnerMarker,
                    { left: x - 12, top: y - 12 },
                    isSelected && styles.runnerMarkerSelected,
                    isWithinCatch && styles.runnerMarkerInCatch,
                    isStale && { opacity: 0.45 },
                  ]}
                  onPress={() => onSelectRunner?.(runner)}
                >
                  <View
                    style={[
                      styles.runnerDot,
                      isWithinCatch && styles.runnerDotCatchReady,
                      isStale && { backgroundColor: colors.text.muted },
                    ]}
                  />
                  <Text style={[styles.runnerLabel, isWithinCatch && styles.runnerLabelCatch]}>
                    {runner.displayName.slice(0, 6)} ({Math.round(distMeters)}m{isStale ? ' • STALE' : ''})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </>
        ) : (
          <View style={styles.gpsAcquiringOverlay}>
            <Text style={styles.gpsAcquiringText}>🛰️ ACQUIRING GPS LOCK...</Text>
            <Text style={styles.gpsAcquiringSub}>Waiting for live device coordinates</Text>
          </View>
        )}
      </View>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, { backgroundColor: colors.hunter.primary }]} />
          <Text style={styles.legendText}>YOU (CHASER)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, { backgroundColor: colors.runner.primary }]} />
          <Text style={styles.legendText}>RUNNER</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, { borderColor: colors.status.safe, borderWidth: 1 }]} />
          <Text style={styles.legendText}>15m CATCH</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  radarSurface: {
    backgroundColor: '#0D0E12',
    borderRadius: borderRadius.lg,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1.5,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  ring: {
    position: 'absolute',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    borderStyle: 'dashed',
  },
  rangeLabel: {
    position: 'absolute',
    color: colors.text.muted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  crosshairVertical: {
    position: 'absolute',
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  crosshairHorizontal: {
    position: 'absolute',
    height: 1,
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  hunterCenterMarker: {
    position: 'absolute',
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  hunterDiamond: {
    width: 12,
    height: 12,
    backgroundColor: colors.hunter.primary,
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
    shadowColor: colors.hunter.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  hunterCatchHalo: {
    position: 'absolute',
    borderRadius: 9999,
    borderColor: 'rgba(16, 185, 129, 0.6)',
    borderWidth: 1.5,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    zIndex: 5,
  },
  runnerMarker: {
    position: 'absolute',
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  runnerMarkerSelected: {
    transform: [{ scale: 1.25 }],
  },
  runnerMarkerInCatch: {
    borderWidth: 2,
    borderColor: colors.status.danger,
    borderRadius: 12,
  },
  runnerDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.runner.primary,
    shadowColor: colors.runner.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  runnerDotCatchReady: {
    backgroundColor: colors.status.danger,
    shadowColor: colors.status.danger,
  },
  runnerLabel: {
    position: 'absolute',
    top: 22,
    color: colors.runner.primary,
    fontSize: 9,
    fontWeight: '800',
    backgroundColor: 'rgba(10, 10, 10, 0.92)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    minWidth: 50,
    textAlign: 'center',
  },
  runnerLabelCatch: {
    color: colors.status.danger,
    borderColor: colors.status.danger,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '90%',
    marginTop: spacing.sm,
    backgroundColor: colors.background.surfaceCard,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    borderColor: colors.border.glass,
    borderWidth: 1,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendBox: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  legendText: {
    color: colors.text.muted,
    fontSize: 9,
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  gpsAcquiringOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: 'rgba(10, 10, 10, 0.9)',
    borderRadius: borderRadius.md,
  },
  gpsAcquiringText: {
    color: colors.hunter.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  gpsAcquiringSub: {
    color: colors.text.muted,
    fontSize: 10,
  },
});

