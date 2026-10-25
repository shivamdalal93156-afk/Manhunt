import React, { useEffect, useState } from 'react';
import {
  Alert,
  AppState,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, Button, Card } from '@/components/ui';
import { AbilityPanel } from '@/components/game/AbilityPanel';
import { LivePlayZoneMap, MapPlayerMarker } from '@/components/game/LivePlayZoneMap';
import { TacticalRadarMap } from '@/components/game/TacticalRadarMap';
import { useLocation } from '@/hooks/useLocation';
import { haversineDistance } from '@/lib/geo/distance';
import { GameEngine } from '@/services/game/gameEngine';
import { gameService } from '@/services/game/gameService';
import { lobbyService } from '@/services/lobby/lobbyService';
import { sessionManager } from '@/services/session/sessionManager';
import { useLobbyStore } from '@/store/lobbyStore';
import { AbilityType, ActiveEffect, RunnerSnapshot } from '@/types/game';
import { evaluateDynamicZone } from '@/lib/geo/battleRoyaleZone';
import { borderRadius, colors, spacing, typography } from '@/theme/tokens';

export default function HunterGameScreen() {
  const router = useRouter();
  const { session, lobbyState } = useLobbyStore();
  const { currentLocation, startTracking, stopTracking, refreshLocation } = useLocation();

  // Restore session from device storage if app was closed or reopened
  useEffect(() => {
    if (!session?.gameId) {
      sessionManager.getActiveSession().then((persisted) => {
        if (persisted) {
          useLobbyStore.getState().restoreSession(persisted);
        }
      });
    }
  }, [session?.gameId]);

  // AppState listener ensures GPS and channels remain live when returning from another app
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        refreshLocation();
        startTracking({ timeIntervalMs: 1000, distanceIntervalMeters: 2 });
      }
    });
    return () => sub.remove();
  }, [refreshLocation, startTracking]);

  const [activeEffects, setActiveEffects] = useState<ActiveEffect[]>([]);
  const [tacticalMapMode, setTacticalMapMode] = useState<'satellite' | 'radar'>('satellite');
  const [selectedRunner, setSelectedRunner] = useState<RunnerSnapshot | null>(null);
  const [catchFeedback, setCatchFeedback] = useState<string | null>(null);
  const [liveRunnerLocations, setLiveRunnerLocations] = useState<Map<string, RunnerSnapshot>>(
    new Map()
  );
  const [timeRemaining, setTimeRemaining] = useState(
    (lobbyState?.settings.durationMinutes ?? 30) * 60
  );

  // Catch Code Verification Modal State
  const [showCatchModal, setShowCatchModal] = useState(false);
  const [enteredCatchCode, setEnteredCatchCode] = useState('');
  const [isSubmittingCatch, setIsSubmittingCatch] = useState(false);

  const me = lobbyState?.players.find((p) => p.id === session?.myPlayerId);

  // Join live game communications channel
  useEffect(() => {
    if (!session?.gameId) return;

    const unsubChannel = gameService.joinGameChannel(
      session.gameId,
      (broadcast) => {
        if (broadcast.role === 'RUNNER') {
          setLiveRunnerLocations((prev) => {
            const next = new Map(prev);
            next.set(broadcast.playerId, {
              playerId: broadcast.playerId,
              displayName: broadcast.displayName,
              latitude: broadcast.latitude,
              longitude: broadcast.longitude,
              accuracy: broadcast.accuracy,
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
        setCatchFeedback(
          catchPayload.eliminated
            ? `RUNNER ELIMINATED! A runner lost their final heart!`
            : `TAG CONFIRMED! Target runner lost 1 heart.`
        );
        if (catchPayload.all_runners_eliminated) {
          Alert.alert('VICTORY!', 'All runners eliminated! Hunters win!', [
            { text: 'View Results', onPress: () => router.replace('/game/results') },
          ]);
        }
      },
      (connErr) => {
        setCatchFeedback(`⚠️ ${connErr.message}`);
      }
    );

    return () => {
      unsubChannel();
    };
  }, [session?.gameId, router]);

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
      'HUNTER',
      me?.displayName || 'Hunter',
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

  // Active runners from lobby state
  const allRunners = (lobbyState?.players ?? []).filter((p) => p.role === 'RUNNER');
  const livingRunners = allRunners.filter(
    (p) => p.status === 'ALIVE' && p.heartsRemaining > 0
  );

  // Filter real runner telemetry according to stealth and radar visibility
  const rawRunnerSnapshots = Array.from(liveRunnerLocations.values());
  const visibleRunners: RunnerSnapshot[] = rawRunnerSnapshots.filter((runner) => {
    const now = Date.now();
    const hasStealth = activeEffects.some(
      (e) => e.actorPlayerId === runner.playerId && e.ability === 'STEALTH' && e.expiresAt > now
    );
    return !hasStealth;
  });

  // Dynamic Zone (PUBG / Free Fire Battle Royale & Concentric Shrink)
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

  const handleOpenCatchModal = () => {
    setEnteredCatchCode('');
    setShowCatchModal(true);
  };

  const handleSubmitCatchCode = async () => {
    if (!session?.gameId || !session?.myPlayerId) return;

    const code = enteredCatchCode.trim();
    if (code.length !== 4) {
      Alert.alert('INVALID CODE', 'Please enter a valid 4-digit catch code.');
      return;
    }

    setIsSubmittingCatch(true);
    try {
      const result = await lobbyService.submitCatchCode(
        session.gameId,
        session.myPlayerId,
        code,
        currentLocation?.latitude ?? 0,
        currentLocation?.longitude ?? 0
      );

      setIsSubmittingCatch(false);

      if (result.success) {
        setShowCatchModal(false);
        setCatchFeedback(result.message);

        // Broadcast catch event across Realtime channel
        await gameService.broadcastCatchEvent({
          hunter_id: session.myPlayerId,
          runner_id: result.runnerId,
          hearts_left: result.heartsRemaining,
          eliminated: result.isEliminated,
          all_runners_eliminated: result.allRunnersEliminated,
        });

        if (result.allRunnersEliminated) {
          Alert.alert('VICTORY!', 'All runners eliminated! Hunters win!', [
            { text: 'View Results', onPress: () => router.replace('/game/results') },
          ]);
        } else {
          Alert.alert(
            result.isEliminated ? 'TARGET ELIMINATED!' : 'CATCH CONFIRMED!',
            result.message
          );
        }
      } else {
        Alert.alert('VERIFICATION FAILED', result.message);
      }
    } catch (err: unknown) {
      setIsSubmittingCatch(false);
      Alert.alert(
        'SERVER ERROR',
        err instanceof Error ? err.message : 'Failed to reach game server.'
      );
    }
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
        {/* Top HUD: Role & Clock */}
        <View style={styles.topHud}>
          <View style={styles.roleIdentity}>
            <Badge label="CHASER" variant="hunter" />
            <Text style={styles.hudTitle}>HUNTER</Text>
          </View>
          <View style={styles.clockPill}>
            <Text style={styles.clockLabel}>TIME REMAINING</Text>
            <Text style={styles.clockVal}>{formatTimer(timeRemaining)}</Text>
          </View>
        </View>

        {/* Telemetry Stats Banner */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>TARGETS</Text>
            <Text style={styles.statVal}>
              {livingRunners.length} / {allRunners.length}
            </Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>GPS REVEAL</Text>
            <Text style={styles.statVal}>
              {lobbyState?.settings.locationPingIntervalSeconds ?? 30}s
            </Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>ZONE</Text>
            <Text style={styles.statVal}>
              {lobbyState?.playZone.radiusMeters ?? 500}m
            </Text>
          </View>
        </View>

        {/* Map View Switcher: Satellite vs Radar */}
        <View style={styles.mapSwitchRow}>
          <TouchableOpacity
            style={[
              styles.mapSwitchBtn,
              tacticalMapMode === 'satellite' && styles.mapSwitchBtnActive,
            ]}
            onPress={() => setTacticalMapMode('satellite')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.mapSwitchText,
                tacticalMapMode === 'satellite' && styles.mapSwitchTextActive,
              ]}
            >
              🛰️ SATELLITE MAP
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.mapSwitchBtn,
              tacticalMapMode === 'radar' && styles.mapSwitchBtnActive,
            ]}
            onPress={() => setTacticalMapMode('radar')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.mapSwitchText,
                tacticalMapMode === 'radar' && styles.mapSwitchTextActive,
              ]}
            >
              🎯 RADAR VIEW
            </Text>
          </TouchableOpacity>
        </View>

        {tacticalMapMode === 'satellite' ? (
          <LivePlayZoneMap
            currentLocation={currentLocation}
            zoneRadius={dynamicZone.currentCircle.radiusMeters}
            customCenter={dynamicZone.currentCircle.center}
            dynamicNextSafeCircle={dynamicZone.nextSafeCircle}
            dynamicPhaseText={dynamicZone.mode !== 'NONE' ? dynamicZone.statusText : null}
            players={visibleRunners.map((r) => ({
              id: r.playerId,
              name: r.displayName,
              role: 'RUNNER' as const,
              latitude: r.latitude,
              longitude: r.longitude,
              distanceMeters: currentLocation
                ? haversineDistance(currentLocation, {
                    latitude: r.latitude,
                    longitude: r.longitude,
                  })
                : undefined,
            }))}
          />
        ) : (
          <TacticalRadarMap
            hunterLocation={currentLocation}
            runners={visibleRunners}
            zoneRadiusMeters={dynamicZone.currentCircle.radiusMeters}
            catchRadiusMeters={15}
            selectedRunnerId={selectedRunner?.playerId}
            onSelectRunner={setSelectedRunner}
          />
        )}

        {/* Primary Hunting Game Catch-Code Verification Trigger */}
        <Card variant="hunter" style={styles.catchActionCard}>
          <Text style={styles.catchActionTitle}>PHYSICAL CATCH CONFIRMATION</Text>
          <Text style={styles.catchActionSubtitle}>
            When you physically catch/tag a runner, obtain their secret 4-digit code to confirm elimination.
          </Text>
          <Button
            title="VERIFY RUNNER CATCH CODE"
            variant="gradient"
            size="lg"
            fullWidth
            onPress={handleOpenCatchModal}
            style={styles.catchBtn}
          />
        </Card>

        {/* Catch Confirmation Banner */}
        {catchFeedback && (
          <Card variant="glass" style={styles.feedbackCard}>
            <Text style={styles.feedbackText}>{catchFeedback}</Text>
          </Card>
        )}

        {/* Tactical Ability Dock */}
        <AbilityPanel
          role="HUNTER"
          activeEffects={activeEffects}
          onActivate={handleActivateAbility}
        />
      </ScrollView>

      {/* Catch Code Verification Modal */}
      <Modal
        visible={showCatchModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCatchModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>ENTER RUNNER CATCH CODE</Text>
            <Text style={styles.modalSubtitle}>
              Ask the captured runner for their 4-digit secret code:
            </Text>

            {/* Discrete 4-PIN Box Display */}
            <View style={styles.pinWrapper}>
              <View style={styles.pinBoxesRow}>
                {[0, 1, 2, 3].map((index) => {
                  const digit = enteredCatchCode[index] || '';
                  const isCurrent = enteredCatchCode.length === index;
                  return (
                    <View
                      key={index}
                      style={[
                        styles.pinBox,
                        isCurrent && styles.pinBoxActive,
                        digit ? styles.pinBoxFilled : null,
                      ]}
                    >
                      <Text style={styles.pinDigit}>{digit || '•'}</Text>
                    </View>
                  );
                })}
              </View>

              {/* Direct Hidden Input */}
              <TextInput
                style={styles.hiddenInput}
                keyboardType="number-pad"
                maxLength={4}
                value={enteredCatchCode}
                onChangeText={setEnteredCatchCode}
                autoFocus
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowCatchModal(false)}
              >
                <Text style={styles.modalCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <Button
                title={isSubmittingCatch ? 'VERIFYING...' : 'CONFIRM CATCH'}
                variant="gradient"
                size="md"
                onPress={handleSubmitCatchCode}
                disabled={isSubmittingCatch || enteredCatchCode.trim().length !== 4}
              />
            </View>
          </View>
        </View>
      </Modal>
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
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
    gap: spacing.xs,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.background.surfaceCard,
    borderColor: colors.border.glass,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.xs + 4,
    alignItems: 'center',
  },
  statLabel: {
    color: colors.text.muted,
    fontSize: 9,
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  statVal: {
    color: colors.text.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: '800',
    marginTop: 2,
  },
  mapSwitchRow: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: '#0F131A',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: 3,
    marginBottom: spacing.xs,
    gap: 4,
  },
  mapSwitchBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.sm,
  },
  mapSwitchBtnActive: {
    backgroundColor: 'rgba(0, 229, 255, 0.2)',
    borderColor: colors.runner.primary,
    borderWidth: 1,
  },
  mapSwitchText: {
    color: colors.text.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  mapSwitchTextActive: {
    color: '#FFFFFF',
  },
  catchActionCard: {
    marginVertical: spacing.sm,
  },
  catchActionTitle: {
    color: colors.hunter.primary,
    fontSize: typography.fontSize.xs,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 4,
    textAlign: 'center',
  },
  catchActionSubtitle: {
    color: colors.text.secondary,
    fontSize: 11,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  catchBtn: {
    marginTop: 2,
  },
  feedbackCard: {
    marginVertical: spacing.xs,
    padding: spacing.sm,
  },
  feedbackText: {
    color: colors.hunter.primary,
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: '#141414',
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1.5,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 12,
  },
  modalTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: spacing.xs,
  },
  modalSubtitle: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  pinWrapper: {
    width: '100%',
    alignItems: 'center',
    position: 'relative',
    marginBottom: spacing.xl,
  },
  pinBoxesRow: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
    justifyContent: 'center',
  },
  pinBox: {
    width: 52,
    height: 58,
    borderRadius: borderRadius.md,
    backgroundColor: '#1E1E1E',
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinBoxActive: {
    borderColor: colors.brand.gradientMid,
    backgroundColor: 'rgba(232, 93, 59, 0.1)',
  },
  pinBoxFilled: {
    borderColor: colors.brand.gradientEnd,
  },
  pinDigit: {
    color: colors.text.primary,
    fontSize: 26,
    fontWeight: '900',
    fontFamily: typography.fontFamily.mono,
  },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.01,
    color: 'transparent',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    alignItems: 'center',
  },
  modalCancelBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },

  modalCancelText: {
    color: colors.text.muted,
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
