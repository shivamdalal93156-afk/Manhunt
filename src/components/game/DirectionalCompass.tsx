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

import { ZoneEvaluationResult } from '@/lib/geo/battleRoyaleZone';
import { defaultGPSFilter } from '@/lib/geo/gpsFilter';

export interface ProcessedHunterThreat {
  playerId: string;
  displayName: string;
  distanceMeters: number;
  relativeBearingDegrees: number;
  threatLevel: 'DANGER' | 'WARNING' | 'AWARENESS' | 'FRIENDLY';
  targetType: 'HUNTER' | 'RUNNER';
  clusterCount?: number;
  x: number;
  y: number;
}

interface DirectionalCompassProps {
  telemetry: ThreatTelemetry;
  deviceHeading?: number | null;
  hunters?: HunterSnapshot[];
  friendlyRunners?: HunterSnapshot[];
  runnerLocation?: GPSLocation | null;
  maxRadarRangeMeters?: number;
  dynamicZone?: ZoneEvaluationResult | null;
  isNightStealth?: boolean;
}

export const DirectionalCompass: React.FC<DirectionalCompassProps> = ({
  telemetry,
  deviceHeading,
  hunters = [],
  friendlyRunners = [],
  runnerLocation,
  maxRadarRangeMeters = 300,
  dynamicZone,
  isNightStealth = false,
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

  // Map Hunters and Friendly Runners to true polar 2D radar coordinates with anti-overlap positioning
  const processedOperatives = useMemo<ProcessedHunterThreat[]>(() => {
    if (hunters.length === 0 && friendlyRunners.length === 0) return [];

    const effectiveLoc = runnerLocation ?? { latitude: 37.7749, longitude: -122.4194 };
    const effectiveHeading = deviceHeading ?? 0;

    const list: Array<{
      playerId: string;
      displayName: string;
      distanceMeters: number;
      relativeBearingDegrees: number;
      threatLevel: 'DANGER' | 'WARNING' | 'AWARENESS' | 'FRIENDLY';
      targetType: 'HUNTER' | 'RUNNER';
      r: number;
      rawX: number;
      rawY: number;
    }> = [];

    // Process Hunters
    for (const h of hunters) {
      const rawDist = haversineDistance(effectiveLoc, {
        latitude: h.latitude,
        longitude: h.longitude,
      });
      const bearing = initialBearing(effectiveLoc, {
        latitude: h.latitude,
        longitude: h.longitude,
      });
      // Stabilize distance readout so stationary GPS drift (<3m) does not jump
      const dist = defaultGPSFilter.smoothDistance(h.playerId, rawDist);

      let threatLevel: 'DANGER' | 'WARNING' | 'AWARENESS' = 'AWARENESS';
      let r = 0;
      if (dist <= 35) {
        threatLevel = 'DANGER';
        r = 18 + (dist / 35) * (DANGER_ZONE_RADIUS - 18);
      } else if (dist <= 100) {
        threatLevel = 'WARNING';
        const frac = (dist - 35) / (100 - 35);
        r = DANGER_ZONE_RADIUS + 4 + frac * (WARNING_ZONE_RADIUS - DANGER_ZONE_RADIUS - 4);
      } else {
        threatLevel = 'AWARENESS';
        const frac = Math.min(1, (dist - 100) / (maxRadarRangeMeters - 100));
        r = WARNING_ZONE_RADIUS + 4 + frac * (OUTER_ZONE_RADIUS - WARNING_ZONE_RADIUS - 6);
      }

      // North-Up Dial: 0° is North (top), 90° is East (right), 180° is South (bottom), 270° is West (left)
      const rad = ((bearing - 90) * Math.PI) / 180;
      const rawX = DIAL_RADIUS + r * Math.cos(rad);
      const rawY = DIAL_RADIUS + r * Math.sin(rad);

      list.push({
        playerId: h.playerId,
        displayName: h.displayName || 'Hunter',
        distanceMeters: dist,
        relativeBearingDegrees: bearing,
        threatLevel,
        targetType: 'HUNTER',
        r,
        rawX,
        rawY,
      });
    }

    // Process Friendly Runners (allies)
    for (const fr of friendlyRunners) {
      const rawDist = haversineDistance(effectiveLoc, {
        latitude: fr.latitude,
        longitude: fr.longitude,
      });
      const bearing = initialBearing(effectiveLoc, {
        latitude: fr.latitude,
        longitude: fr.longitude,
      });
      const dist = defaultGPSFilter.smoothDistance(fr.playerId, rawDist);

      let r = 0;
      if (dist <= 35) {
        r = 18 + (dist / 35) * (DANGER_ZONE_RADIUS - 18);
      } else if (dist <= 100) {
        const frac = (dist - 35) / (100 - 35);
        r = DANGER_ZONE_RADIUS + 4 + frac * (WARNING_ZONE_RADIUS - DANGER_ZONE_RADIUS - 4);
      } else {
        const frac = Math.min(1, (dist - 100) / (maxRadarRangeMeters - 100));
        r = WARNING_ZONE_RADIUS + 4 + frac * (OUTER_ZONE_RADIUS - WARNING_ZONE_RADIUS - 6);
      }

      const rad = ((bearing - 90) * Math.PI) / 180;
      const rawX = DIAL_RADIUS + r * Math.cos(rad);
      const rawY = DIAL_RADIUS + r * Math.sin(rad);

      list.push({
        playerId: fr.playerId,
        displayName: fr.displayName || 'Ally',
        distanceMeters: dist,
        relativeBearingDegrees: bearing,
        threatLevel: 'FRIENDLY',
        targetType: 'RUNNER',
        r,
        rawX,
        rawY,
      });
    }

    // Sort by proximity
    list.sort((a, b) => a.distanceMeters - b.distanceMeters);

    // Anti-Overlap & Same Distance Separation Pass
    const positioned: ProcessedHunterThreat[] = list.map((item) => ({
      playerId: item.playerId,
      displayName: item.displayName,
      distanceMeters: item.distanceMeters,
      relativeBearingDegrees: item.relativeBearingDegrees,
      threatLevel: item.threatLevel,
      targetType: item.targetType,
      clusterCount: 1,
      x: item.rawX,
      y: item.rawY,
    }));

    for (let i = 0; i < positioned.length; i++) {
      for (let j = i + 1; j < positioned.length; j++) {
        const dx = positioned[j].x - positioned[i].x;
        const dy = positioned[j].y - positioned[i].y;
        const distPx = Math.sqrt(dx * dx + dy * dy);
        const MIN_SEP = 26;

        if (distPx <= 0.001 || (distPx < MIN_SEP && Math.abs(positioned[i].distanceMeters - positioned[j].distanceMeters) < 4)) {
          // Multiple operatives clustered at identical/very close distance & bearing
          positioned[i].clusterCount = (positioned[i].clusterCount || 1) + 1;
          positioned[j].clusterCount = (positioned[j].clusterCount || 1) + 1;

          // Tangential spread along the distance circle arc
          const rad = ((positioned[i].relativeBearingDegrees - 90) * Math.PI) / 180;
          const tx = -Math.sin(rad) * (MIN_SEP / 2);
          const ty = Math.cos(rad) * (MIN_SEP / 2);

          positioned[i].x -= tx;
          positioned[i].y -= ty;
          positioned[j].x += tx;
          positioned[j].y += ty;
        } else if (distPx < MIN_SEP) {
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
  }, [runnerLocation, hunters, friendlyRunners, deviceHeading, maxRadarRangeMeters]);

  const processedHunters = useMemo(
    () => processedOperatives.filter((op) => op.targetType === 'HUNTER'),
    [processedOperatives]
  );

  const processedAllies = useMemo(
    () => processedOperatives.filter((op) => op.targetType === 'RUNNER'),
    [processedOperatives]
  );

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

  // Dynamic Safe Zone Shrink Vector: indicates direction and proximity of shrinking safe zone
  const safeZoneVector = useMemo<{
    angle: number;
    cardinal: string;
    distanceMeters: number;
    isOutside: boolean;
    phaseState: string;
    phaseText: string;
  } | null>(() => {
    if (!dynamicZone || dynamicZone.mode === 'NONE') return null;

    const effectiveLoc = runnerLocation ?? { latitude: 37.7749, longitude: -122.4194 };
    const effectiveHeading = deviceHeading ?? 0;
    const target = dynamicZone.nextSafeCircle ?? dynamicZone.currentCircle;
    if (!target) return null;

    const dist = haversineDistance(effectiveLoc, target.center);
    const bearing = initialBearing(effectiveLoc, target.center);

    return {
      angle: bearing,
      cardinal: getCardinal(bearing),
      distanceMeters: Math.round(dist),
      isOutside: !dynamicZone.isInsideActiveZone,
      phaseState: dynamicZone.phaseState,
      phaseText: `PHASE ${dynamicZone.phaseNumber}/${dynamicZone.totalPhases}`,
    };
  }, [dynamicZone, runnerLocation]);

  const nearestHunter = processedHunters[0];

  return (
    <View style={styles.container}>
      {/* Outer Tactical Sonar Dial with Danger Pulse */}
      <Animated.View
        style={[
          styles.outerDial,
          !isNightStealth && styles.outerDialLight,
          {
            borderColor: isAnyHunterDangerous
              ? colors.status.danger
              : isNightStealth
              ? 'rgba(255, 255, 255, 0.14)'
              : '#CBD5E1',
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        {/* Cardinal Directions */}
        <View style={styles.tickRing} pointerEvents="none">
          <Text style={styles.dialNorth}>N</Text>
          <Text style={[styles.dialEast, !isNightStealth && styles.dialTextLight]}>E</Text>
          <Text style={[styles.dialSouth, !isNightStealth && styles.dialTextLight]}>S</Text>
          <Text style={[styles.dialWest, !isNightStealth && styles.dialTextLight]}>W</Text>
        </View>

        {/* Concentric Zone 3: Outer Awareness Range (100m - 300m) */}
        <View
          style={[
            styles.rangeRing,
            {
              width: WARNING_ZONE_RADIUS * 2,
              height: WARNING_ZONE_RADIUS * 2,
              borderRadius: WARNING_ZONE_RADIUS,
              borderColor: isNightStealth ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
            },
          ]}
          pointerEvents="none"
        >
          <Text style={[styles.rangeLabel, !isNightStealth && styles.rangeLabelLight]}>100m</Text>
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
          <Text style={[styles.rangeLabel, { color: colors.status.warning }, !isNightStealth && styles.rangeLabelLight]}>35m</Text>
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

        {/* Dynamic Shrinking Safe Zone Indicator */}
        {safeZoneVector && (
          <View
            style={[
              styles.safeZoneVectorWrapper,
              { transform: [{ rotate: `${safeZoneVector.angle}deg` }] },
            ]}
            pointerEvents="none"
          >
            <View
              style={[
                styles.safeZoneArrow,
                safeZoneVector.isOutside && styles.safeZoneArrowOutside,
              ]}
            />
            <View
              style={[
                styles.safeZoneTagBadge,
                safeZoneVector.isOutside && styles.safeZoneTagBadgeOutside,
              ]}
            >
              <Text
                style={[
                  styles.safeZoneTagText,
                  safeZoneVector.isOutside && styles.safeZoneTagTextOutside,
                ]}
              >
                {safeZoneVector.isOutside ? 'RETREAT' : 'SAFE'}
              </Text>
            </View>
          </View>
        )}

        {/* Center Runner Hub (YOU) */}
        <View style={styles.centerRunnerHub} pointerEvents="none">
          <View style={styles.runnerIconPill}>
            <View style={styles.runnerDot} />
            <Text style={styles.runnerTag}>YOU</Text>
          </View>
        </View>

        {/* Render ALL Operatives (Hunters & Friendly Runners) simultaneously with depth-coded blips */}
        {processedOperatives.map((op, idx) => {
          const isNearestHunter = op.targetType === 'HUNTER' && processedHunters[0]?.playerId === op.playerId;
          const isSelected = selectedHunterId === op.playerId;
          const isDanger = op.threatLevel === 'DANGER';
          const isWarning = op.threatLevel === 'WARNING';
          const isAlly = op.targetType === 'RUNNER';

          const blipBg = isAlly
            ? '#0284C7'
            : isDanger
            ? colors.status.danger
            : isWarning
            ? colors.status.warning
            : colors.runner.primary;

          return (
            <TouchableOpacity
              key={op.playerId}
              onPress={() => setSelectedHunterId(op.playerId)}
              activeOpacity={0.8}
              style={[
                styles.hunterBlipContainer,
                {
                  left: op.x - (isNearestHunter ? 14 : 11),
                  top: op.y - (isNearestHunter ? 14 : 11),
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
                    width: isNearestHunter ? 18 : 14,
                    height: isNearestHunter ? 18 : 14,
                    borderRadius: isNearestHunter ? 9 : 7,
                    borderColor: '#0B0E14',
                    borderWidth: 2,
                  },
                ]}
              >
                <Text style={styles.blipInitial}>
                  {isAlly ? '🏃' : op.displayName.charAt(0).toUpperCase()}
                </Text>
              </View>

              {/* Clustered Operatives Count Badge (when >1 target at same distance/location) */}
              {op.clusterCount && op.clusterCount > 1 ? (
                <View style={styles.clusterBadge}>
                  <Text style={styles.clusterBadgeText}>×{op.clusterCount}</Text>
                </View>
              ) : null}

              {/* Compact Distance Badge */}
              <View
                style={[
                  styles.distanceTag,
                  {
                    backgroundColor: isAlly
                      ? 'rgba(2, 132, 199, 0.92)'
                      : isDanger
                      ? 'rgba(239, 68, 68, 0.92)'
                      : isWarning
                      ? 'rgba(245, 158, 11, 0.90)'
                      : 'rgba(15, 23, 42, 0.85)',
                    borderColor: blipBg,
                  },
                ]}
              >
                <Text style={styles.distanceTagText}>
                  {Math.round(op.distanceMeters)}m
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* If no operatives detected yet */}
        {processedOperatives.length === 0 && (
          <View style={styles.radarClearHub} pointerEvents="none">
            <Text style={styles.clearText}>RADAR</Text>
            <Text style={styles.clearSub}>SCANNING</Text>
            <Badge label="ALL CLEAR" variant="safe" />
          </View>
        )}
      </Animated.View>

      {/* Primary Action Guidance Banner */}
      <View style={[styles.guidanceBanner, isNightStealth ? styles.guidanceBannerNight : styles.guidanceBannerLight]}>
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
              <Text style={[styles.guidanceTitle, isNightStealth ? styles.guidanceTitleNight : styles.guidanceTitleLight]}>
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
            <Text style={[styles.guidanceTitle, isNightStealth ? styles.guidanceTitleNight : styles.guidanceTitleLight]}>No Hunters in radar range (300m)</Text>
            <Badge label="SAFE" variant="safe" />
          </View>
        )}
      </View>

      {/* Dynamic Zone Shrink Telemetry Strip */}
      {safeZoneVector && (
        <View
          style={[
            styles.zoneStatusCard,
            safeZoneVector.isOutside ? styles.zoneStatusCardOutside : styles.zoneStatusCardInside,
            !isNightStealth && !safeZoneVector.isOutside && styles.zoneStatusCardInsideLight,
          ]}
        >
          <View style={styles.zoneStatusLeft}>
            <View style={styles.zoneStatusBadge}>
              <Text style={[styles.zoneStatusBadgeText, !isNightStealth && styles.zoneStatusBadgeTextLight]}>{safeZoneVector.phaseText}</Text>
            </View>
            <Text style={[styles.zoneStatusMainText, !isNightStealth && styles.zoneStatusMainTextLight]}>
              {safeZoneVector.isOutside
                ? `⚠️ OUTSIDE SAFE ZONE (${safeZoneVector.distanceMeters}m to center)`
                : `Safe Zone active (${safeZoneVector.distanceMeters}m to center)`}
            </Text>
          </View>
          <View
            style={[
              styles.zoneDirPill,
              safeZoneVector.isOutside ? styles.zoneDirPillOutside : styles.zoneDirPillInside,
            ]}
          >
            <Text style={styles.zoneDirPillSub}>ZONE</Text>
            <Text style={styles.zoneDirPillText}>{safeZoneVector.cardinal}</Text>
          </View>
        </View>
      )}

      {/* Ranked Multi-Hunter Proximity Strip (All Hunters at All Times) */}
      {processedHunters.length > 0 && (
        <View style={[styles.rosterCard, !isNightStealth && styles.rosterCardLight]}>
          <View style={styles.rosterHeader}>
            <Text style={[styles.rosterTitle, !isNightStealth && styles.rosterTitleLight]}>
              ACTIVE PURSUIT ROSTER ({processedHunters.length})
            </Text>
            <Text style={[styles.rosterSub, !isNightStealth && styles.rosterSubLight]}>Sorted by Proximity</Text>
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
                    !isNightStealth && styles.hunterPillLight,
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
                  <Text style={[styles.pillName, !isNightStealth && styles.pillNameLight]} numberOfLines={1}>
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
                          : isNightStealth
                          ? colors.text.primary
                          : '#0F172A',
                      },
                    ]}
                  >
                    {Math.round(h.distanceMeters)}m
                  </Text>
                  <Text style={[styles.pillBearing, !isNightStealth && styles.pillBearingLight]}>
                    {getCardinal(h.relativeBearingDegrees)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Friendly Runners Strip */}
      {processedAllies.length > 0 && (
        <View style={[styles.rosterCard, !isNightStealth && styles.rosterCardLight, { marginTop: spacing.xs }]}>
          <View style={styles.rosterHeader}>
            <Text style={[styles.rosterTitle, { color: '#0284C7' }]}>
              ALLIED RUNNERS ({processedAllies.length})
            </Text>
            <Text style={[styles.rosterSub, !isNightStealth && styles.rosterSubLight]}>Teammates</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rosterScroll}
          >
            {processedAllies.map((a) => (
              <TouchableOpacity
                key={a.playerId}
                style={[
                  styles.hunterPill,
                  !isNightStealth && styles.hunterPillLight,
                  { borderColor: 'rgba(2, 132, 199, 0.4)' },
                ]}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 10 }}>🏃</Text>
                <Text style={[styles.pillName, !isNightStealth && styles.pillNameLight]} numberOfLines={1}>
                  {a.displayName}
                </Text>
                <Text style={[styles.pillDist, { color: '#0284C7' }]}>
                  {Math.round(a.distanceMeters)}m
                </Text>
              </TouchableOpacity>
            ))}
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
  outerDialLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 6,
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
  dialTextLight: {
    color: '#334155',
    fontWeight: '800',
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
  rangeLabelLight: {
    backgroundColor: '#FFFFFF',
    color: '#64748B',
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
  safeZoneVectorWrapper: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
    zIndex: 14,
  },
  safeZoneArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#00E5FF',
    marginTop: 3,
  },
  safeZoneArrowOutside: {
    borderBottomColor: '#EF4444',
  },
  safeZoneTagBadge: {
    backgroundColor: 'rgba(0, 229, 255, 0.18)',
    borderColor: '#00E5FF',
    borderWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    marginTop: 2,
  },
  safeZoneTagBadgeOutside: {
    backgroundColor: 'rgba(239, 68, 68, 0.28)',
    borderColor: '#EF4444',
  },
  safeZoneTagText: {
    color: '#00E5FF',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  safeZoneTagTextOutside: {
    color: '#EF4444',
  },
  zoneStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 3,
    marginTop: spacing.xs,
    borderWidth: 1,
  },
  zoneStatusCardInside: {
    backgroundColor: 'rgba(0, 229, 255, 0.06)',
    borderColor: 'rgba(0, 229, 255, 0.3)',
  },
  zoneStatusCardOutside: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: colors.status.danger,
  },
  zoneStatusLeft: {
    flex: 1,
  },
  zoneStatusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginBottom: 2,
  },
  zoneStatusBadgeText: {
    color: colors.text.muted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  zoneStatusMainText: {
    color: colors.text.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  zoneDirPill: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    minWidth: 50,
  },
  zoneDirPillInside: {
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    borderColor: '#00E5FF',
    borderWidth: 1,
  },
  zoneDirPillOutside: {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    borderColor: '#EF4444',
    borderWidth: 1,
  },
  zoneDirPillSub: {
    fontSize: 8,
    fontWeight: '800',
    color: colors.text.muted,
    letterSpacing: 0.5,
  },
  zoneDirPillText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
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
  guidanceBannerLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  guidanceBannerNight: {
    backgroundColor: '#0A0F1D',
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  guidanceTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.xs,
    fontWeight: '800',
  },
  guidanceTitleLight: {
    color: '#0F172A',
  },
  guidanceTitleNight: {
    color: '#E2E8F0',
  },
  zoneStatusCardInsideLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#0284C7',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  zoneStatusBadgeTextLight: {
    color: '#0284C7',
  },
  zoneStatusMainTextLight: {
    color: '#0F172A',
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
  rosterCardLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
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
  rosterTitleLight: {
    color: '#0F172A',
  },
  rosterSub: {
    color: colors.text.muted,
    fontSize: 8,
    fontWeight: '600',
  },
  rosterSubLight: {
    color: '#64748B',
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
  hunterPillLight: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
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
  pillNameLight: {
    color: '#0F172A',
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
  pillBearingLight: {
    color: '#64748B',
  },
  clusterBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#DE3B7E',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    zIndex: 10,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  clusterBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
});
