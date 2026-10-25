import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { HunterSnapshot, ThreatTelemetry } from '@/types/game';
import { GPSLocation } from '@/types/geo';
import { initialBearing, relativeBearing } from '@/lib/geo/bearing';
import { haversineDistance } from '@/lib/geo/distance';
import { borderRadius, colors, spacing, typography } from '@/theme/tokens';
import { Badge } from '@/components/ui/Badge';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DIAL_SIZE = Math.min(SCREEN_WIDTH - spacing.lg * 2, 300);
const DIAL_RADIUS = DIAL_SIZE / 2;

// Concentric ring radii
const DANGER_ZONE_RADIUS = DIAL_RADIUS * 0.36; // 0m - 35m
const WARNING_ZONE_RADIUS = DIAL_RADIUS * 0.70; // 35m - 100m
const OUTER_ZONE_RADIUS = DIAL_RADIUS * 0.94; // 100m - 300m

export interface ProcessedHunterThreat {
  playerId: string;
  displayName: string;
  distanceMeters: number;
  relativeBearingDegrees: number;
  threatLevel: 'DANGER' | 'WARNING' | 'AWARENESS';
  x: number;
  y: number;
}

interface DirectionalCompassProps {
  telemetry: ThreatTelemetry;
  deviceHeading?: number | null;
  hunters?: HunterSnapshot[];
  runnerLocation?: GPSLocation | null;
  maxRadarRangeMeters?: number;
}

export const DirectionalCompass: React.FC<DirectionalCompassProps> = ({
  telemetry,
  deviceHeading,
  hunters = [],
  runnerLocation,
  maxRadarRangeMeters = 300,
}) => {
  const [selectedHunterId, setSelectedHunterId] = useState<string | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation when at least one hunter is in lethal range (<35m)
  const isAnyHunterDangerous = telemetry.threatLevel === 'DANGER';

  useEffect(() => {
    if (isAnyHunterDangerous) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 550,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 550,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isAnyHunterDangerous, pulseAnim]);

  // Map each Hunter to true polar 2D radar coordinates with anti-overlap positioning
  const processedHunters = useMemo<ProcessedHunterThreat[]>(() => {
    if (hunters.length === 0) return [];

    const effectiveLoc = runnerLocation ?? { latitude: 37.7749, longitude: -122.4194 };
    const effectiveHeading = deviceHeading ?? 0;

    // 1. Calculate raw distance and relative bearing for all hunters
    const list: Array<{
      playerId: string;
      displayName: string;
      distanceMeters: number;
      relativeBearingDegrees: number;
      threatLevel: 'DANGER' | 'WARNING' | 'AWARENESS';
      r: number;
      rawX: number;
      rawY: number;
    }> = [];

    for (const h of hunters) {
      const dist = haversineDistance(effectiveLoc, {
        latitude: h.latitude,
        longitude: h.longitude,
      });

      const bearing = initialBearing(effectiveLoc, {
        latitude: h.latitude,
        longitude: h.longitude,
      });

      const relBearing = relativeBearing(effectiveHeading, bearing) ?? 0;

      let threatLevel: 'DANGER' | 'WARNING' | 'AWARENESS' = 'AWARENESS';
      let r = 0;

      // Non-linear concentric zone mapping so near hunters have maximum spacing
      if (dist <= 35) {
        threatLevel = 'DANGER';
        // Map 0-35m to range [18, DANGER_ZONE_RADIUS]
        r = 18 + (dist / 35) * (DANGER_ZONE_RADIUS - 18);
      } else if (dist <= 100) {
        threatLevel = 'WARNING';
        // Map 35-100m to range [DANGER_ZONE_RADIUS + 4, WARNING_ZONE_RADIUS]
        const frac = (dist - 35) / (100 - 35);
        r = DANGER_ZONE_RADIUS + 4 + frac * (WARNING_ZONE_RADIUS - DANGER_ZONE_RADIUS - 4);
      } else {
        threatLevel = 'AWARENESS';
        // Map 100-300m to range [WARNING_ZONE_RADIUS + 4, OUTER_ZONE_RADIUS]
        const frac = Math.min(1, (dist - 100) / (maxRadarRangeMeters - 100));
        r = WARNING_ZONE_RADIUS + 4 + frac * (OUTER_ZONE_RADIUS - WARNING_ZONE_RADIUS - 6);
      }

      // Convert polar (r, theta) to canvas Cartesian (x, y) relative to center
      // 0 deg is North (Up), 90 deg is East (Right), 180 deg is South (Down)
      const rad = ((relBearing - 90) * Math.PI) / 180;
      const rawX = DIAL_RADIUS + r * Math.cos(rad);
      const rawY = DIAL_RADIUS + r * Math.sin(rad);

      list.push({
        playerId: h.playerId,
        displayName: h.displayName || 'Hunter',
        distanceMeters: dist,
        relativeBearingDegrees: relBearing,
        threatLevel,
        r,
        rawX,
        rawY,
      });
    }

    // Sort by proximity (closest first)
    list.sort((a, b) => a.distanceMeters - b.distanceMeters);

    // 2. Anti-Overlap Separation Pass:
    // If two hunter blips are visually closer than 26 pixels, nudge them apart along their line
    const positioned: ProcessedHunterThreat[] = list.map((item) => ({
      playerId: item.playerId,
      displayName: item.displayName,
      distanceMeters: item.distanceMeters,
      relativeBearingDegrees: item.relativeBearingDegrees,
      threatLevel: item.threatLevel,
      x: item.rawX,
      y: item.rawY,
    }));

    for (let i = 0; i < positioned.length; i++) {
      for (let j = i + 1; j < positioned.length; j++) {
        const dx = positioned[j].x - positioned[i].x;
        const dy = positioned[j].y - positioned[i].y;
        const distPx = Math.sqrt(dx * dx + dy * dy);
        const MIN_SEP = 26; // minimum pixel separation between blip centers

        if (distPx < MIN_SEP && distPx > 0.001) {
          const overlap = (MIN_SEP - distPx) / 2;
          const nx = (dx / distPx) * overlap;
          const ny = (dy / distPx) * overlap;

          positioned[i].x -= nx;
          positioned[i].y -= ny;
          positioned[j].x += nx;
          positioned[j].y += ny;
        }
      }
    }

    return positioned;
  }, [runnerLocation, hunters, deviceHeading, maxRadarRangeMeters]);

  // Calculate Safest Escape Arc: find the largest angular gap between approaching hunters
  const escapeDirection = useMemo<{ angle: number; cardinal: string } | null>(() => {
    if (processedHunters.length === 0) return null;

    // Filter hunters within active threat range (under 200m)
    const activeThreats = processedHunters.filter((h) => h.distanceMeters <= 200);
    if (activeThreats.length === 0) return null;

    if (activeThreats.length === 1) {
      // Direct opposite of the single hunter
      const opposite = (activeThreats[0].relativeBearingDegrees + 180) % 360;
      return { angle: opposite, cardinal: getCardinal(opposite) };
    }

    // Sort angles
    const sortedAngles = activeThreats
      .map((h) => h.relativeBearingDegrees)
      .sort((a, b) => a - b);

    let maxGap = 0;
    let escapeAngle = 180;

    for (let i = 0; i < sortedAngles.length; i++) {
      const a1 = sortedAngles[i];
      const a2 = i === sortedAngles.length - 1 ? sortedAngles[0] + 360 : sortedAngles[i + 1];
      const gap = a2 - a1;
      if (gap > maxGap) {
        maxGap = gap;
        escapeAngle = (a1 + gap / 2) % 360;
      }
    }

    return { angle: escapeAngle, cardinal: getCardinal(escapeAngle) };
  }, [processedHunters]);

  const nearestHunter = processedHunters[0];

  return (
    <View style={styles.container}>
      {/* Outer Tactical Sonar Dial with Danger Pulse */}
      <Animated.View
        style={[
          styles.outerDial,
          {
            borderColor: isAnyHunterDangerous
              ? colors.status.danger
              : 'rgba(255, 255, 255, 0.14)',
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        {/* Cardinal Directions */}
        <View style={styles.tickRing} pointerEvents="none">
          <Text style={styles.dialNorth}>N</Text>
          <Text style={styles.dialEast}>E</Text>
          <Text style={styles.dialSouth}>S</Text>
          <Text style={styles.dialWest}>W</Text>
        </View>

        {/* Concentric Zone 3: Outer Awareness Range (100m - 300m) */}
        <View
          style={[
            styles.rangeRing,
            {
              width: WARNING_ZONE_RADIUS * 2,
              height: WARNING_ZONE_RADIUS * 2,
              borderRadius: WARNING_ZONE_RADIUS,
              borderColor: 'rgba(255, 255, 255, 0.08)',
            },
          ]}
          pointerEvents="none"
        >
          <Text style={styles.rangeLabel}>100m</Text>
        </View>

        {/* Concentric Zone 2: Warning Range (35m - 100m) */}
        <View
          style={[
            styles.rangeRing,
            {
              width: DANGER_ZONE_RADIUS * 2,
              height: DANGER_ZONE_RADIUS * 2,
              borderRadius: DANGER_ZONE_RADIUS,
              borderColor: 'rgba(245, 158, 11, 0.22)',
            },
          ]}
          pointerEvents="none"
        >
          <Text style={[styles.rangeLabel, { color: colors.status.warning }]}>35m</Text>
        </View>

        {/* Safest Escape Vector Indicator */}
        {escapeDirection && (
          <View
            style={[
              styles.escapeVectorWrapper,
              { transform: [{ rotate: `${escapeDirection.angle}deg` }] },
            ]}
            pointerEvents="none"
          >
            <View style={styles.escapeArrow} />
            <Text style={styles.escapeTag}>RUN</Text>
          </View>
        )}

        {/* Center Runner Hub (YOU) */}
        <View style={styles.centerRunnerHub} pointerEvents="none">
          <View style={styles.runnerIconPill}>
            <View style={styles.runnerDot} />
            <Text style={styles.runnerTag}>YOU</Text>
          </View>
        </View>

        {/* Render ALL Hunters simultaneously with depth-coded blips */}
        {processedHunters.map((h, idx) => {
          const isNearest = idx === 0;
          const isSelected = selectedHunterId === h.playerId;
          const isDanger = h.threatLevel === 'DANGER';
          const isWarning = h.threatLevel === 'WARNING';

          const blipBg = isDanger
            ? colors.status.danger
            : isWarning
            ? colors.status.warning
            : colors.runner.primary;

          return (
            <TouchableOpacity
              key={h.playerId}
              onPress={() => setSelectedHunterId(h.playerId)}
              activeOpacity={0.8}
              style={[
                styles.hunterBlipContainer,
                {
                  left: h.x - (isNearest ? 14 : 11),
                  top: h.y - (isNearest ? 14 : 11),
                },
              ]}
            >
              {/* Outer pulsing glow for closest or danger hunter */}
              {isDanger && (
                <View
                  style={[
                    styles.dangerHalo,
                    {
                      borderColor: blipBg,
                    },
                  ]}
                />
              )}

              {/* Blip Core */}
              <View
                style={[
                  styles.hunterBlipCore,
                  {
                    backgroundColor: blipBg,
                    width: isNearest ? 18 : 14,
                    height: isNearest ? 18 : 14,
                    borderRadius: isNearest ? 9 : 7,
                    borderColor: '#0B0E14',
                    borderWidth: 2,
                  },
                ]}
              >
                <Text style={styles.blipInitial}>
                  {h.displayName.charAt(0).toUpperCase()}
                </Text>
              </View>

              {/* Compact Distance Badge */}
              <View
                style={[
                  styles.distanceTag,
                  {
                    backgroundColor: isDanger
                      ? 'rgba(239, 68, 68, 0.92)'
                      : isWarning
                      ? 'rgba(245, 158, 11, 0.90)'
                      : 'rgba(15, 23, 42, 0.85)',
                    borderColor: blipBg,
                  },
                ]}
              >
                <Text style={styles.distanceTagText}>
                  {Math.round(h.distanceMeters)}m
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* If no hunters detected yet */}
        {processedHunters.length === 0 && (
          <View style={styles.radarClearHub} pointerEvents="none">
            <Text style={styles.clearText}>RADAR</Text>
            <Text style={styles.clearSub}>SCANNING</Text>
            <Badge label="ALL CLEAR" variant="safe" />
          </View>
        )}
      </Animated.View>

      {/* Primary Action Guidance Banner */}
      <View style={styles.guidanceBanner}>
        {nearestHunter ? (
          <View style={styles.guidanceRow}>
            <View style={styles.guidanceLeft}>
              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor:
                      nearestHunter.threatLevel === 'DANGER'
                        ? 'rgba(239, 68, 68, 0.18)'
                        : 'rgba(245, 158, 11, 0.18)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusPillText,
                    {
                      color:
                        nearestHunter.threatLevel === 'DANGER'
                          ? colors.status.danger
                          : colors.status.warning,
                    },
                  ]}
                >
                  {nearestHunter.threatLevel === 'DANGER' ? 'LETHAL THREAT' : 'APPROACHING'}
                </Text>
              </View>
              <Text style={styles.guidanceTitle}>
                {nearestHunter.displayName} is {Math.round(nearestHunter.distanceMeters)}m away
              </Text>
            </View>

            {escapeDirection && (
              <View style={styles.escapePill}>
                <Text style={styles.escapePillSub}>ESCAPE</Text>
                <Text style={styles.escapePillDir}>{escapeDirection.cardinal}</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.guidanceRow}>
            <Text style={styles.guidanceTitle}>No Hunters in radar range (300m)</Text>
            <Badge label="SAFE" variant="safe" />
          </View>
        )}
      </View>

      {/* Ranked Multi-Hunter Proximity Strip (All Hunters at All Times) */}
      {processedHunters.length > 0 && (
        <View style={styles.rosterCard}>
          <View style={styles.rosterHeader}>
            <Text style={styles.rosterTitle}>
              ACTIVE PURSUIT ROSTER ({processedHunters.length})
            </Text>
            <Text style={styles.rosterSub}>Sorted by Proximity</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rosterScroll}
          >
            {processedHunters.map((h, i) => {
              const isDanger = h.threatLevel === 'DANGER';
              const isWarning = h.threatLevel === 'WARNING';
              const isSelected = selectedHunterId === h.playerId;

              return (
                <TouchableOpacity
                  key={h.playerId}
                  onPress={() => setSelectedHunterId(h.playerId)}
                  style={[
                    styles.hunterPill,
                    isDanger && styles.hunterPillDanger,
                    isWarning && styles.hunterPillWarning,
                    isSelected && styles.hunterPillSelected,
                  ]}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.pillStatusDot,
                      {
                        backgroundColor: isDanger
                          ? colors.status.danger
                          : isWarning
                          ? colors.status.warning
                          : colors.runner.primary,
                      },
                    ]}
                  />
                  <Text style={styles.pillName} numberOfLines={1}>
                    #{i + 1} {h.displayName}
                  </Text>
                  <Text
                    style={[
                      styles.pillDist,
                      {
                        color: isDanger
                          ? colors.status.danger
                          : isWarning
                          ? colors.status.warning
                          : colors.text.primary,
                      },
                    ]}
                  >
                    {Math.round(h.distanceMeters)}m
                  </Text>
                  <Text style={styles.pillBearing}>
                    {getCardinal(h.relativeBearingDegrees)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

function getCardinal(deg: number): string {
  const normalized = (deg + 360) % 360;
  if (normalized >= 337.5 || normalized < 22.5) return 'N';
  if (normalized >= 22.5 && normalized < 67.5) return 'NE';
  if (normalized >= 67.5 && normalized < 112.5) return 'E';
  if (normalized >= 112.5 && normalized < 157.5) return 'SE';
  if (normalized >= 157.5 && normalized < 202.5) return 'S';
  if (normalized >= 202.5 && normalized < 247.5) return 'SW';
  if (normalized >= 247.5 && normalized < 292.5) return 'W';
  return 'NW';
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.xs,
  },
  outerDial: {
    width: DIAL_SIZE,
    height: DIAL_SIZE,
    borderRadius: DIAL_RADIUS,
    borderWidth: 2,
    backgroundColor: '#0D1117',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 8,
  },
  tickRing: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialNorth: {
    position: 'absolute',
    top: 8,
    color: colors.hunter.primary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  dialEast: {
    position: 'absolute',
    right: 10,
    color: colors.text.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  dialSouth: {
    position: 'absolute',
    bottom: 8,
    color: colors.text.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  dialWest: {
    position: 'absolute',
    left: 10,
    color: colors.text.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  rangeRing: {
    position: 'absolute',
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  rangeLabel: {
    color: colors.text.muted,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 2,
    backgroundColor: '#0D1117',
    paddingHorizontal: 3,
  },
  centerRunnerHub: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  runnerIconPill: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  runnerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.runner.primary,
    borderColor: '#FFFFFF',
    borderWidth: 2,
    shadowColor: colors.runner.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  runnerTag: {
    fontSize: 8,
    color: colors.runner.primary,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 2,
  },
  escapeVectorWrapper: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  escapeArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 14,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#10B981',
    marginTop: 4,
  },
  escapeTag: {
    fontSize: 8,
    fontWeight: '900',
    color: '#10B981',
    letterSpacing: 1,
    marginTop: 1,
  },
  hunterBlipContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  dangerHalo: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
  },
  hunterBlipCore: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
    elevation: 3,
  },
  blipInitial: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
  },
  distanceTag: {
    borderRadius: 4,
    borderWidth: 0.5,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginTop: 2,
  },
  distanceTagText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  radarClearHub: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: {
    color: colors.status.safe,
    fontSize: typography.fontSize.sm,
    fontWeight: '900',
    letterSpacing: 2,
  },
  clearSub: {
    color: colors.text.muted,
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: '700',
    marginBottom: 4,
  },
  guidanceBanner: {
    width: '100%',
    backgroundColor: colors.background.surfaceCard,
    borderColor: colors.border.glass,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  guidanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  guidanceLeft: {
    flex: 1,
  },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    marginBottom: 3,
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  guidanceTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.xs,
    fontWeight: '800',
  },
  escapePill: {
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10B981',
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  escapePillSub: {
    color: '#10B981',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },
  escapePillDir: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.xs,
    fontWeight: '900',
  },
  rosterCard: {
    width: '100%',
    backgroundColor: '#0F172A',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  rosterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  rosterTitle: {
    color: colors.text.muted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  rosterSub: {
    color: colors.text.muted,
    fontSize: 8,
    fontWeight: '600',
  },
  rosterScroll: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  hunterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.10)',
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    gap: 5,
  },
  hunterPillDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: colors.status.danger,
  },
  hunterPillWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: colors.status.warning,
  },
  hunterPillSelected: {
    borderColor: colors.runner.primary,
    borderWidth: 1.5,
  },
  pillStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pillName: {
    color: colors.text.primary,
    fontSize: 11,
    fontWeight: '700',
    maxWidth: 75,
  },
  pillDist: {
    fontSize: 11,
    fontWeight: '900',
  },
  pillBearing: {
    color: colors.text.muted,
    fontSize: 9,
    fontWeight: '800',
  },
});
