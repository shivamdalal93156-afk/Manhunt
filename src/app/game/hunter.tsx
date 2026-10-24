import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, Button, Card, ErrorFallback } from '@/components/ui';
import { AbilityPanel } from '@/components/game/AbilityPanel';
import { TacticalRadarMap } from '@/components/game/TacticalRadarMap';
import { useLocation } from '@/hooks/useLocation';
import { GameEngine } from '@/services/game/gameEngine';
import { useLobbyStore } from '@/store/lobbyStore';
import { AbilityType, ActiveEffect, RunnerSnapshot } from '@/types/game';
import { LobbyPlayer } from '@/types/lobby';
import { borderRadius, colors, spacing, typography } from '@/theme/tokens';

export default function HunterGameScreen() {
  const router = useRouter();
  const { session, lobbyState } = useLobbyStore();
  const { currentLocation, startTracking, stopTracking } = useLocation();

  const [activeEffects, setActiveEffects] = useState<ActiveEffect[]>([]);
  const [selectedRunner, setSelectedRunner] = useState<RunnerSnapshot | null>(null);
  const [catchFeedback, setCatchFeedback] = useState<string | null>(null);
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

  // Active runners from lobby state
  const allRunners = (lobbyState?.players ?? []).filter((p) => p.role === 'RUNNER');
  const livingRunners = allRunners.filter(
    (p) => p.status === 'ALIVE' && p.heartsRemaining > 0
  );

  // Generate mock/real runner locations for radar display (respecting Stealth)
  const visibleRunners: RunnerSnapshot[] = GameEngine.filterVisibleRunners(
    livingRunners.map((r, i) => ({
      player: r,
      location: {
        latitude: (currentLocation?.latitude ?? 37.7749) + 0.00015 * (i + 1),
        longitude: (currentLocation?.longitude ?? -122.4194) + 0.0001 * (i + 1),
        measuredAt: Date.now(),
      },
    })),
    activeEffects
  );

  // Check if any runner is within the 15m catch trigger threshold
  const nearestCatchable = visibleRunners.find((r) => {
    if (!currentLocation) return false;
    const res = GameEngine.processCatch(
      currentLocation,
      { latitude: r.latitude, longitude: r.longitude },
      allRunners.find((p) => p.id === r.playerId)!,
      livingRunners
    );
    return res.distanceMeters <= 20; // 15m + 5m variance
  });

  const handleCatch = () => {
    if (!currentLocation || !nearestCatchable) return;
    const target = allRunners.find((p) => p.id === nearestCatchable.playerId);
    if (!target) return;

    const result = GameEngine.processCatch(
      currentLocation,
      { latitude: nearestCatchable.latitude, longitude: nearestCatchable.longitude },
      target,
      livingRunners
    );

    if (result.success) {
      setCatchFeedback(result.message);
      target.heartsRemaining = result.heartsRemaining;
      if (result.isEliminated) {
        target.status = 'CAUGHT';
      }

      // Check win condition
      const remaining = livingRunners.filter((p) => p.id !== target.id);
      if (remaining.length === 0) {
        Alert.alert('VICTORY!', 'All runners have been eliminated! Hunters win!', [
          { text: 'View Results', onPress: () => router.replace('/game/results') },
        ]);
      }
    } else {
      Alert.alert('CATCH FAILED', result.message);
    }
  };

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

        {/* Proximity Catch Action Button */}
        {nearestCatchable ? (
          <View style={styles.catchPromptContainer}>
            <Text style={styles.catchPromptText}>
              TARGET IN PROXIMITY ({nearestCatchable.displayName})
            </Text>
            <Button
              title="CONFIRM CATCH"
              variant="danger"
              size="lg"
              fullWidth
              onPress={handleCatch}
              style={styles.catchBtn}
            />
          </View>
        ) : (
          <View style={styles.noCatchBox}>
            <Text style={styles.noCatchText}>
              GET WITHIN 15m OF A RUNNER TO INITIATE CATCH
            </Text>
          </View>
        )}

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
  catchPromptContainer: {
    marginVertical: spacing.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: colors.status.danger,
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  catchPromptText: {
    color: colors.status.danger,
    fontSize: typography.fontSize.xs,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
  },
  catchBtn: {
    marginTop: 2,
  },
  noCatchBox: {
    marginVertical: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.background.surface,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
  },
  noCatchText: {
    color: colors.text.muted,
    fontSize: 10,
    letterSpacing: 1,
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
});
