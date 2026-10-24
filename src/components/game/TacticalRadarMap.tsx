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
  const centerCoord = hunterLocation || { latitude: 37.7749, longitude: -122.4194 };
  const maxRangeMeters = Math.max(zoneRadiusMeters, 200);

  // Convert distance and bearing from center to local X,Y on radar canvas
  const getCanvasCoordinates = (targetLat: number, targetLng: number) => {
    const distMeters = haversineDistance(centerCoord, {
      latitude: targetLat,
      longitude: targetLng,
    });

    const bearing = initialBearing(centerCoord, {
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
        {/* Distance Range Concentric Rings */}
        <View style={[styles.ring, { width: MAP_SIZE * 0.3, height: MAP_SIZE * 0.3 }]} />
        <View style={[styles.ring, { width: MAP_SIZE * 0.6, height: MAP_SIZE * 0.6 }]} />
        <View style={[styles.ring, { width: MAP_SIZE * 0.9, height: MAP_SIZE * 0.9 }]} />

        {/* Crosshair Lines */}
        <View style={styles.crosshairVertical} />
        <View style={styles.crosshairHorizontal} />

        {/* Hunter Center Marker & 15m Proximity Catch Halo */}
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

          return (
            <TouchableOpacity
              key={runner.playerId}
              activeOpacity={0.8}
              style={[
                styles.runnerMarker,
                { left: x - 12, top: y - 12 },
                isSelected && styles.runnerMarkerSelected,
                isWithinCatch && styles.runnerMarkerInCatch,
              ]}
              onPress={() => onSelectRunner?.(runner)}
            >
              <View
                style={[
                  styles.runnerDot,
                  isWithinCatch && styles.runnerDotCatchReady,
                ]}
              />
              <Text style={styles.runnerLabel}>
                {runner.displayName.slice(0, 6)} ({Math.round(distMeters)}m)
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, { backgroundColor: colors.hunter.primary }]} />
          <Text style={styles.legendText}>YOUR POSITION</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, { backgroundColor: colors.runner.primary }]} />
          <Text style={styles.legendText}>RUNNER RADAR PING</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, { borderColor: colors.status.safe, borderWidth: 1 }]} />
          <Text style={styles.legendText}>15m CATCH ZONE</Text>
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
    backgroundColor: '#07090D',
    borderRadius: borderRadius.md,
    borderColor: colors.border.active,
    borderWidth: 1.5,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.12)',
    borderStyle: 'dashed',
  },
  crosshairVertical: {
    position: 'absolute',
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(0, 240, 255, 0.1)',
  },
  crosshairHorizontal: {
    position: 'absolute',
    height: 1,
    width: '100%',
    backgroundColor: 'rgba(0, 240, 255, 0.1)',
  },
  hunterCenterMarker: {
    position: 'absolute',
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  hunterDiamond: {
    width: 10,
    height: 10,
    backgroundColor: colors.hunter.primary,
    transform: [{ rotate: '45deg' }],
  },
  hunterCatchHalo: {
    position: 'absolute',
    borderRadius: 9999,
    borderColor: colors.status.safe,
    borderWidth: 1,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
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
    transform: [{ scale: 1.2 }],
  },
  runnerMarkerInCatch: {
    borderWidth: 2,
    borderColor: colors.status.danger,
    borderRadius: 12,
  },
  runnerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.runner.primary,
  },
  runnerDotCatchReady: {
    backgroundColor: colors.status.danger,
  },
  runnerLabel: {
    position: 'absolute',
    top: 22,
    color: colors.runner.primary,
    fontSize: 9,
    fontWeight: '700',
    backgroundColor: 'rgba(11, 14, 20, 0.85)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    minWidth: 50,
    textAlign: 'center',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '90%',
    marginTop: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
  },
});
