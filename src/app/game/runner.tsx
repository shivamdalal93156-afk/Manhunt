import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, Button, Card } from '@/components/ui';
import { AbilityPanel } from '@/components/game/AbilityPanel';
import { DirectionalCompass } from '@/components/game/DirectionalCompass';
import { TacticalRadarMap } from '@/components/game/TacticalRadarMap';
import { useLocation } from '@/hooks/useLocation';
import { pointInCircle } from '@/lib/geo/geofence';
import { GameEngine } from '@/services/game/gameEngine';
import { useLobbyStore } from '@/store/lobbyStore';
import { AbilityType, ActiveEffect, HunterSnapshot } from '@/types/game';
import { borderRadius, colors, spacing, typography } from '@/theme/tokens';

export default function RunnerGameScreen() {
  const router = useRouter();
  const { session, lobbyState } = useLobbyStore();
  const { currentLocation, startTracking, stopTracking } = useLocation();

  const [activeEffects, setActiveEffects] = useState<ActiveEffect[]>([]);
  const [heartsRemaining, setHeartsRemaining] = useState(3);
  const [timeRemaining, setTimeRemaining] = useState(
    (lobbyState?.settings.durationMinutes ?? 30) * 60
  );

  // Start continuous location tracking upon entering active gameplay
  useEffect(() => {
    let cleanupTracking: (() => void) | undefined;
    startTracking({ timeIntervalMs: 1000, distanceIntervalMeters: 2 }).then(
      (unsub) => {
        cleanupTracking = unsub;
      }
    );

    return () => {
      cleanupTracking?.();
      stopTracking();
    };
  }, [startTracking, stopTracking]);

  // Match countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.replace('/game/results');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  // Hunters from lobby state
  const hunters = (lobbyState?.players ?? []).filter((p) => p.role === 'HUNTER');

  // Simulated / Real hunter location observations
  const hunterSnapshots: HunterSnapshot[] = hunters.map((h, i) => ({
    playerId: h.id,
    displayName: h.displayName,
    latitude: (currentLocation?.latitude ?? 37.7749) + 0.0004 * (i + 1),
    longitude: (currentLocation?.longitude ?? -122.4194) + 0.0003 * (i + 1),
    measuredAt: Date.now(),
  }));

  // Check if Map View ability is currently deployed
  const isMapViewActive = activeEffects.some(
    (e) => e.ability === 'MAP_VIEW' && e.expiresAt > Date.now()
  );

  // Check if Blind effect is affecting runner
  const isBlinded = activeEffects.some(
    (e) => e.ability === 'BLIND' && e.expiresAt > Date.now()
  );

  // Calculate geodesic threat to nearest hunter
  const threat = currentLocation
    ? GameEngine.calculateRunnerThreat(
        currentLocation,
        hunterSnapshots,
        currentLocation.heading,
        isBlinded
      )
    : {
        nearestHunterDistanceMeters: null,
        relativeBearingDegrees: null,
        threatLevel: 'CLEAR' as const,
      };

  // Evaluate geofence boundary status
  const circleGeofence = {
    type: 'circle' as const,
    center: {
      latitude: currentLocation?.latitude ?? 37.7749,
      longitude: currentLocation?.longitude ?? -122.4194,
    },
    radiusMeters: lobbyState?.playZone.radiusMeters ?? 500,
  };

  const boundaryCheck = currentLocation
    ? pointInCircle(currentLocation, circleGeofence, 15)
    : { isInside: true, distanceToBoundaryMeters: 500, warningGraceActive: false };

  const handleActivateAbility = (ability: AbilityType) => {
    const me = lobbyState?.players.find((p) => p.id === session?.myPlayerId);
    if (!me) return;

    try {
      const effect = GameEngine.activateAbility(ability, me, activeEffects);
      setActiveEffects((prev) => [...prev, effect]);
    } catch (err: unknown) {
      Alert.alert(
        'ABILITY ERROR',
        err instanceof Error ? err.message : 'Cooldown active'
      );
    }
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Top HUD: Role, Lives & Clock */}
        <View style={styles.topHud}>
          <View>
            <Text style={styles.hudEyebrow}>EVASION NAVIGATION SYSTEM</Text>
            <Text style={styles.hudTitle}>RUNNER SQUAD</Text>
          </View>
          <View style={styles.clockBox}>
            <Text style={styles.clockLabel}>TIME LEFT</Text>
            <Text style={styles.clockVal}>{formatTimer(timeRemaining)}</Text>
          </View>
        </View>

        {/* Lives / Hearts Gauge */}
        <View style={styles.heartsRow}>
          <Text style={styles.heartsLabel}>SURVIVAL HEARTS:</Text>
          <View style={styles.heartsIcons}>
            {[1, 2, 3].map((index) => (
              <Text
                key={index}
                style={[
                  styles.heartIcon,
                  index <= heartsRemaining
                    ? styles.heartActive
                    : styles.heartLost,
                ]}
              >
                ♥
              </Text>
            ))}
          </View>
        </View>

        {/* Boundary Grace Warning Banner */}
        {boundaryCheck.warningGraceActive && (
          <Card variant="runner" style={styles.boundaryWarning}>
            <Text style={styles.boundaryWarningTitle}>
              ⚠️ BOUNDARY WARNING GRACE ACTIVE
            </Text>
            <Text style={styles.boundaryWarningText}>
              You are approaching the edge of the play zone. Return within bounds
              to avoid losing hearts!
            </Text>
          </Card>
        )}

        {/* Blinded Jammer Warning */}
        {isBlinded && (
          <Card variant="elevated" style={styles.jammedCard}>
            <Text style={styles.jammedTitle}>⚡ COMPASS SIGNAL JAMMED</Text>
            <Text style={styles.jammedText}>
              Hunter blackout active. Compass telemetry offline.
            </Text>
          </Card>
        )}

        {/* Asymmetric Sensory Tool: Directional Compass */}
        {!isMapViewActive ? (
          <DirectionalCompass
            telemetry={threat}
            deviceHeading={currentLocation?.heading}
          />
        ) : (
          <View style={styles.mapRevealContainer}>
            <Text style={styles.mapRevealTitle}>
              TACTICAL MAP REVEAL ACTIVE (15s)
            </Text>
            <TacticalRadarMap
              hunterLocation={currentLocation}
              runners={hunterSnapshots.map((h) => ({
                playerId: h.playerId,
                displayName: h.displayName,
                latitude: h.latitude,
                longitude: h.longitude,
                measuredAt: h.measuredAt,
              }))}
              zoneRadiusMeters={lobbyState?.playZone.radiusMeters ?? 500}
            />
          </View>
        )}

        {/* Tactical Ability Dock */}
        <AbilityPanel
          role="RUNNER"
          activeEffects={activeEffects}
          onActivate={handleActivateAbility}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background.base,
  },
  container: {
    padding: spacing.md,
  },
  topHud: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  hudEyebrow: {
    color: colors.runner.primary,
    fontSize: typography.fontSize.xs,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  hudTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.xl,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  clockBox: {
    backgroundColor: colors.background.surface,
    borderColor: colors.runner.primary,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
  },
  clockLabel: {
    color: colors.text.muted,
    fontSize: 9,
    letterSpacing: 1,
  },
  clockVal: {
    color: colors.runner.primary,
    fontSize: typography.fontSize.lg,
    fontWeight: '900',
  },
  heartsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.surface,
    borderColor: colors.border.subtle,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
  },
  heartsLabel: {
    color: colors.text.muted,
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    letterSpacing: 1,
    marginRight: spacing.sm,
  },
  heartsIcons: {
    flexDirection: 'row',
    gap: 4,
  },
  heartIcon: {
    fontSize: 20,
  },
  heartActive: {
    color: colors.status.danger,
  },
  heartLost: {
    color: colors.text.muted,
    opacity: 0.3,
  },
  boundaryWarning: {
    marginVertical: spacing.xs,
    borderColor: colors.status.warning,
  },
  boundaryWarningTitle: {
    color: colors.status.warning,
    fontWeight: '800',
    fontSize: typography.fontSize.xs,
    letterSpacing: 1,
  },
  boundaryWarningText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.xs,
    marginTop: 2,
  },
  jammedCard: {
    marginVertical: spacing.xs,
    borderColor: colors.referee.primary,
    alignItems: 'center',
  },
  jammedTitle: {
    color: colors.referee.primary,
    fontWeight: '800',
    fontSize: typography.fontSize.xs,
    letterSpacing: 1.5,
  },
  jammedText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.xs,
    marginTop: 2,
  },
  mapRevealContainer: {
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  mapRevealTitle: {
    color: colors.hunter.primary,
    fontWeight: '800',
    fontSize: typography.fontSize.xs,
    letterSpacing: 1.5,
    marginBottom: spacing.xs,
  },
});
