import React, { useEffect, useState } from 'react';
import {
  Alert,
  AppState,
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
import { gameService } from '@/services/game/gameService';
import { sessionManager } from '@/services/session/sessionManager';
import { useLobbyStore } from '@/store/lobbyStore';
import { AbilityType, ActiveEffect, HunterSnapshot } from '@/types/game';
import { evaluateDynamicZone } from '@/lib/geo/battleRoyaleZone';
import { borderRadius, colors, spacing, typography } from '@/theme/tokens';

export default function RunnerGameScreen() {
  const router = useRouter();
  const { session, lobbyState } = useLobbyStore();
  const { currentLocation, startTracking, stopTracking, refreshLocation } = useLocation();

  // Restore session from device storage if app was killed / reopened
  useEffect(() => {
    if (!session?.gameId) {
      sessionManager.getActiveSession().then((persisted) => {
        if (persisted) {
          useLobbyStore.getState().restoreSession(persisted);
        }
      });
    }
  }, [session?.gameId]);

  // Keep GPS and match alive when app is backgrounded or switched
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        refreshLocation();
        startTracking({ timeIntervalMs: 1000, distanceIntervalMeters: 2 });
      }
    });
    return () => sub.remove();
  }, [refreshLocation, startTracking]);

  const maxHearts = lobbyState?.settings?.runnerHearts ?? session?.settings?.runnerHearts ?? 3;
  const isSuddenDeath = maxHearts === 1;

  const [activeEffects, setActiveEffects] = useState<ActiveEffect[]>([]);
  const [heartsRemaining, setHeartsRemaining] = useState(maxHearts);

  useEffect(() => {
    if (lobbyState?.settings?.runnerHearts !== undefined) {
      setHeartsRemaining((prev) => Math.min(prev, lobbyState.settings.runnerHearts));
    }
  }, [lobbyState?.settings?.runnerHearts]);

  const [liveHunterLocations, setLiveHunterLocations] = useState<Map<string, HunterSnapshot>>(
    new Map()
  );
  const [timeRemaining, setTimeRemaining] = useState(
    (lobbyState?.settings.durationMinutes ?? 30) * 60
  );

  // My private 4-digit catch code
  const me = lobbyState?.players.find((p) => p.id === session?.myPlayerId);
  const myCatchCode = session?.catchCode || me?.catchCode || '----';

  // Join live game communications channel
  useEffect(() => {
    if (!session?.gameId) return;

    const unsubChannel = gameService.joinGameChannel(
      session.gameId,
      (broadcast) => {
        if (broadcast.role === 'HUNTER') {
          setLiveHunterLocations((prev) => {
            const next = new Map(prev);
            next.set(broadcast.playerId, {
              playerId: broadcast.playerId,
              displayName: broadcast.displayName,
              latitude: broadcast.latitude,
              longitude: broadcast.longitude,
              measuredAt: broadcast.measuredAt,
            });
            return next;
          });
        }
      },
      (newEffect) => {
        setActiveEffects((prev) => [...prev, newEffect]);
      },
      (catchPayload) => {
        if (catchPayload?.runner_id === session.myPlayerId) {
          const newHearts = catchPayload.hearts_left ?? 0;
          setHeartsRemaining(newHearts);
          if (catchPayload.eliminated) {
            Alert.alert(
              'ELIMINATED!',
              'You have been caught by a Hunter and lost all hearts.',
              [{ text: 'View Results', onPress: () => router.replace('/game/results') }]
            );
          } else {
            Alert.alert(
              'TAGGED!',
              `A Hunter confirmed a catch! You have ${newHearts} heart(s) remaining.`
            );
          }
        }
      },
      (connErr) => {
        Alert.alert('CONNECTION ISSUE', connErr.message);
      }
    );

    return () => {
      unsubChannel();
    };
  }, [session?.gameId, session?.myPlayerId, router]);

  // Start continuous location tracking and broadcast to live channel
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

  // Broadcast location when GPS updates
  useEffect(() => {
    if (!currentLocation || !session?.gameId || !session?.myPlayerId) return;

    gameService.broadcastLocation(
      session.gameId,
      session.myPlayerId,
      'RUNNER',
      me?.displayName || 'Runner',
      currentLocation
    );
  }, [currentLocation, session?.gameId, session?.myPlayerId, me?.displayName]);

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

  const rawHunterSnapshots = Array.from(liveHunterLocations.values());
  const refLat = currentLocation?.latitude ?? 37.7749;
  const refLon = currentLocation?.longitude ?? -122.4194;

  // Real match uses live broadcast locations; preview/test shows realistic multi-threat spread
  const hunterSnapshots =
    rawHunterSnapshots.length > 0
      ? rawHunterSnapshots
      : [
          {
            playerId: 'h-alex',
            displayName: 'Alex',
            latitude: refLat + 0.00018, // ~22m NNE (Danger Zone)
            longitude: refLon + 0.00008,
            measuredAt: Date.now(),
          },
          {
            playerId: 'h-dave',
            displayName: 'Dave',
            latitude: refLat + 0.00045, // ~62m NW (Warning Zone)
            longitude: refLon - 0.00040,
            measuredAt: Date.now(),
          },
          {
            playerId: 'h-sarah',
            displayName: 'Sarah',
            latitude: refLat - 0.00110, // ~145m SE (Awareness Zone)
            longitude: refLon + 0.00105,
            measuredAt: Date.now(),
          },
          {
            playerId: 'h-marcus',
            displayName: 'Marcus',
            latitude: refLat - 0.00170, // ~230m SSW (Awareness Zone)
            longitude: refLon - 0.00120,
            measuredAt: Date.now(),
          },
        ];

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

  // Dynamic Play Zone Evaluation (PUBG / Free Fire & Concentric Shrink)
  const totalMatchDurationMin =
    lobbyState?.settings?.durationMinutes ?? session?.settings?.durationMinutes ?? 30;
  const matchElapsedSec = Math.max(
    0,
    totalMatchDurationMin * 60 - timeRemaining
  );

  const dynamicZone = React.useMemo(() => {
    const shrinkMode =
      lobbyState?.settings?.zoneShrinkMode ??
      session?.settings?.zoneShrinkMode ??
      'NONE';
    const initialCenter =
      lobbyState?.playZone?.center || session?.playZone?.center
        ? {
            latitude: (lobbyState?.playZone?.center || session?.playZone?.center)![1],
            longitude: (lobbyState?.playZone?.center || session?.playZone?.center)![0],
          }
        : currentLocation
        ? { latitude: currentLocation.latitude, longitude: currentLocation.longitude }
        : { latitude: 28.6139, longitude: 77.2090 };
    const initialRadius =
      lobbyState?.playZone?.radiusMeters ?? session?.playZone?.radiusMeters ?? 500;

    return evaluateDynamicZone({
      initialCenter,
      initialRadius,
      mode: shrinkMode,
      totalDurationMinutes: totalMatchDurationMin,
      elapsedSeconds: matchElapsedSec,
      playerLocation: currentLocation,
      seed: session?.joinCode ?? 'manhunt_seed',
    });
  }, [
    lobbyState?.settings?.zoneShrinkMode,
    session?.settings?.zoneShrinkMode,
    lobbyState?.playZone,
    session?.playZone,
    currentLocation,
    totalMatchDurationMin,
    matchElapsedSec,
    session?.joinCode,
  ]);

  const boundaryCheck = {
    isInside: dynamicZone.isInsideActiveZone,
    distanceToBoundaryMeters: Math.round(dynamicZone.distanceToActiveBoundaryMeters),
    warningGraceActive: !dynamicZone.isInsideActiveZone,
  };

  const handleActivateAbility = async (ability: AbilityType) => {
    if (!me || !session?.gameId || !session?.myPlayerId) return;

    try {
      const effect = await gameService.activateAbility(
        session.gameId,
        session.myPlayerId,
        ability
      );
      setActiveEffects((prev) => [...prev, effect]);
    } catch (err: unknown) {
      Alert.alert(
        'ABILITY REJECTED',
        err instanceof Error ? err.message : 'Server rejected ability activation'
      );
    }
  };

  const formatTimer = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Top HUD: Role, Lives & Clock */}
        <View style={styles.topHud}>
          <View style={styles.roleIdentity}>
            <Badge label="EVADER" variant="runner" />
            <Text style={styles.hudTitle}>RUNNER</Text>
          </View>
          <View style={styles.clockPill}>
            <Text style={styles.clockLabel}>TIME REMAINING</Text>
            <Text style={styles.clockVal}>{formatTimer(timeRemaining)}</Text>
          </View>
        </View>

        {/* Lives: Sudden Death (1 Catch) vs Customizable Survival Hearts Gauge */}
        {isSuddenDeath ? (
          <View style={styles.suddenDeathBanner}>
            <View style={styles.suddenDeathBadge}>
              <Text style={styles.suddenDeathIcon}>⚡</Text>
              <Text style={styles.suddenDeathLabel}>SUDDEN DEATH MODE</Text>
            </View>
            <Text style={styles.suddenDeathSub}>1 Catch = Immediate Elimination</Text>
          </View>
        ) : (
          <View style={styles.heartsRow}>
            <Text style={styles.heartsLabel}>
              SURVIVAL HEARTS ({heartsRemaining}/{maxHearts})
            </Text>
            <View style={styles.heartsIcons}>
              {Array.from({ length: maxHearts }, (_, i) => i + 1).map((index) => (
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
        )}

        {/* Official Hunting Game 4-Digit Catch-Code Display */}
        <Card variant="glass" style={styles.catchCodeCard}>
          <Text style={styles.catchCodeLabel}>YOUR SECRET CATCH CODE</Text>
          <View style={styles.codeBoxesRow}>
            {(myCatchCode.padEnd(4, '-').slice(0, 4)).split('').map((char, index) => (
              <View key={index} style={styles.codeBox}>
                <Text style={styles.codeBoxDigit}>{char}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.catchCodeHelp}>
            Only reveal this 4-digit code if a Hunter physically catches and tags you!
          </Text>
        </Card>

        {/* Dynamic Zone Phase Telemetry Bar */}
        {dynamicZone.mode !== 'NONE' && (
          <View style={styles.dynamicZoneBar}>
            <View style={styles.dynamicZoneHeader}>
              <View style={styles.dynamicZoneBadge}>
                <Text style={styles.dynamicZoneBadgeText}>
                  {dynamicZone.mode === 'BATTLE_ROYALE' ? '⚡ BATTLE ROYALE' : '🎯 CONCENTRIC'}
                </Text>
              </View>
              <Text style={styles.dynamicZonePhaseText}>
                PHASE {dynamicZone.phaseNumber}/{dynamicZone.totalPhases}
              </Text>
            </View>
            <Text style={styles.dynamicZoneStatusText}>{dynamicZone.statusText}</Text>
          </View>
        )}

        {/* Boundary Grace Warning Banner */}
        {boundaryCheck.warningGraceActive && (
          <Card variant="runner" style={styles.boundaryWarning}>
            <Text style={styles.boundaryWarningTitle}>
              ⚠️ OUTSIDE ACTIVE PLAY ZONE!
            </Text>
            <Text style={styles.boundaryWarningText}>
              You have crossed the active perimeter ({Math.abs(boundaryCheck.distanceToBoundaryMeters)}m outside). Move back inside the safe circle immediately!
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

        {/* Asymmetric Sensory Tool: Multi-Hunter Concentric Radar Compass */}
        {!isMapViewActive ? (
          <DirectionalCompass
            telemetry={threat}
            deviceHeading={currentLocation?.heading}
            hunters={hunterSnapshots}
            runnerLocation={currentLocation}
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
              zoneRadiusMeters={dynamicZone.currentCircle.radiusMeters}
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
    marginBottom: spacing.sm,
  },
  roleIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  hudTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.lg,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  clockPill: {
    backgroundColor: colors.background.surfaceCard,
    borderColor: colors.border.glass,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    alignItems: 'center',
  },
  clockLabel: {
    color: colors.text.muted,
    fontSize: 9,
    letterSpacing: 1,
    fontWeight: '700',
  },
  clockVal: {
    color: colors.brand.gradientEnd,
    fontSize: typography.fontSize.base,
    fontWeight: '900',
  },
  heartsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background.surfaceCard,
    borderColor: colors.border.glass,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 4,
    borderRadius: borderRadius.full,
    marginBottom: spacing.sm,
  },
  heartsLabel: {
    color: colors.text.muted,
    fontSize: typography.fontSize.xs,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  heartsIcons: {
    flexDirection: 'row',
    gap: 8,
  },
  heartIcon: {
    fontSize: 22,
  },
  heartActive: {
    color: colors.status.danger,
    textShadowColor: 'rgba(239, 68, 68, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  heartLost: {
    color: colors.text.muted,
    opacity: 0.25,
  },
  suddenDeathBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: colors.status.danger,
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  suddenDeathBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  suddenDeathIcon: {
    fontSize: 14,
  },
  suddenDeathLabel: {
    color: colors.status.danger,
    fontSize: typography.fontSize.xs,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  suddenDeathSub: {
    color: colors.text.secondary,
    fontSize: 10,
    fontWeight: '700',
  },
  catchCodeCard: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    borderWidth: 1.5,
    backgroundColor: 'rgba(0, 229, 255, 0.04)',
  },
  catchCodeLabel: {
    color: colors.runner.primary,
    fontSize: typography.fontSize.xs,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  codeBoxesRow: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
    marginVertical: spacing.xs,
  },
  codeBox: {
    width: 52,
    height: 56,
    borderRadius: borderRadius.md,
    backgroundColor: '#161616',
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  codeBoxDigit: {
    color: colors.text.primary,
    fontSize: 28,
    fontWeight: '900',
    fontFamily: typography.fontFamily.mono,
  },
  catchCodeHelp: {
    color: colors.text.muted,
    fontSize: 11,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
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
  dynamicZoneBar: {
    width: '100%',
    backgroundColor: '#161B26',
    borderColor: colors.hunter.primary,
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    marginVertical: spacing.xs,
  },
  dynamicZoneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  dynamicZoneBadge: {
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
    borderColor: colors.hunter.primary,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  dynamicZoneBadgeText: {
    color: colors.hunter.primary,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  dynamicZonePhaseText: {
    color: colors.text.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dynamicZoneStatusText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});
