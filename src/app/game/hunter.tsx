import React, { useEffect, useState } from 'react';
import {
  Alert,
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
import { TacticalRadarMap } from '@/components/game/TacticalRadarMap';
import { useLocation } from '@/hooks/useLocation';
import { GameEngine } from '@/services/game/gameEngine';
import { gameService } from '@/services/game/gameService';
import { lobbyService } from '@/services/lobby/lobbyService';
import { useLobbyStore } from '@/store/lobbyStore';
import { AbilityType, ActiveEffect, RunnerSnapshot } from '@/types/game';
import { borderRadius, colors, spacing, typography } from '@/theme/tokens';

export default function HunterGameScreen() {
  const router = useRouter();
  const { session, lobbyState } = useLobbyStore();
  const { currentLocation, startTracking, stopTracking } = useLocation();

  const [activeEffects, setActiveEffects] = useState<ActiveEffect[]>([]);
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
    if (!me) return;

    try {
      const effect = GameEngine.activateAbility(ability, me, activeEffects);
      setActiveEffects((prev) => [...prev, effect]);
      await gameService.broadcastAbility(effect);
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
        {/* Top HUD: Role & Clock */}
        <View style={styles.topHud}>
          <View>
            <Text style={styles.hudEyebrow}>CHASER RADAR SYSTEM</Text>
            <Text style={styles.hudTitle}>HUNTER SQUAD</Text>
          </View>
          <View style={styles.clockBox}>
            <Text style={styles.clockLabel}>TIME LEFT</Text>
            <Text style={styles.clockVal}>{formatTimer(timeRemaining)}</Text>
          </View>
        </View>

        {/* Telemetry Stats Banner */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>TARGETS ALIVE</Text>
            <Text style={styles.statVal}>
              {livingRunners.length} / {allRunners.length}
            </Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>RADAR REFRESH</Text>
            <Text style={styles.statVal}>
              {lobbyState?.settings.locationPingIntervalSeconds ?? 30}s
            </Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>ZONE RADIUS</Text>
            <Text style={styles.statVal}>
              {lobbyState?.playZone.radiusMeters ?? 500}m
            </Text>
          </View>
        </View>

        {/* Tactical Radar Map */}
        <TacticalRadarMap
          hunterLocation={currentLocation}
          runners={visibleRunners}
          zoneRadiusMeters={lobbyState?.playZone.radiusMeters ?? 500}
          catchRadiusMeters={15}
          selectedRunnerId={selectedRunner?.playerId}
          onSelectRunner={setSelectedRunner}
        />

        {/* Primary Hunting Game Catch-Code Verification Trigger */}
        <View style={styles.catchActionCard}>
          <Text style={styles.catchActionTitle}>PHYSICAL CATCH CONFIRMATION</Text>
          <Text style={styles.catchActionSubtitle}>
            When you physically catch/tag a runner, obtain their secret 4-digit code to confirm elimination.
          </Text>
          <Button
            title="VERIFY RUNNER CATCH CODE"
            variant="danger"
            size="lg"
            fullWidth
            onPress={handleOpenCatchModal}
            style={styles.catchBtn}
          />
        </View>

        {/* Catch Confirmation Banner */}
        {catchFeedback && (
          <Card variant="hunter" style={styles.feedbackCard}>
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
              Ask the captured runner for their 4-digit code:
            </Text>

            <TextInput
              style={styles.codeInput}
              placeholder="4-digit code"
              placeholderTextColor={colors.text.muted}
              keyboardType="number-pad"
              maxLength={4}
              value={enteredCatchCode}
              onChangeText={setEnteredCatchCode}
              autoFocus
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowCatchModal(false)}
              >
                <Text style={styles.modalCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <Button
                title={isSubmittingCatch ? 'VERIFYING...' : 'CONFIRM CATCH'}
                variant="danger"
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
  hudEyebrow: {
    color: colors.hunter.primary,
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
    borderColor: colors.hunter.primary,
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
    color: colors.hunter.primary,
    fontSize: typography.fontSize.lg,
    fontWeight: '900',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.background.surface,
    borderColor: colors.border.subtle,
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    padding: spacing.xs + 2,
    marginHorizontal: 2,
    alignItems: 'center',
  },
  statLabel: {
    color: colors.text.muted,
    fontSize: 9,
    letterSpacing: 1,
  },
  statVal: {
    color: colors.text.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    marginTop: 2,
  },
  catchActionCard: {
    marginVertical: spacing.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: colors.status.danger,
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  catchActionTitle: {
    color: colors.status.danger,
    fontSize: typography.fontSize.xs,
    fontWeight: '800',
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
    borderColor: colors.hunter.primary,
  },
  feedbackText: {
    color: colors.hunter.primary,
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.background.surface,
    borderColor: colors.hunter.primary,
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  modalTitle: {
    color: colors.hunter.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: spacing.xs,
  },
  modalSubtitle: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  codeInput: {
    backgroundColor: colors.background.base,
    borderColor: colors.border.active,
    borderWidth: 1.5,
    borderRadius: borderRadius.sm,
    color: colors.text.primary,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 8,
    textAlign: 'center',
    width: 200,
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
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
