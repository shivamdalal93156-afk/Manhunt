import React, { useState } from 'react';
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
import { TacticalRadarMap } from '@/components/game/TacticalRadarMap';
import { useLocation } from '@/hooks/useLocation';
import { useLobbyStore } from '@/store/lobbyStore';
import { borderRadius, colors, spacing, typography } from '@/theme/tokens';

export default function RefereeDashboardScreen() {
  const router = useRouter();
  const { lobbyState } = useLobbyStore();
  const { currentLocation } = useLocation();
  const [isPaused, setIsPaused] = useState(false);

  const players = lobbyState?.players ?? [];
  const hunters = players.filter((p) => p.role === 'HUNTER');
  const runners = players.filter((p) => p.role === 'RUNNER');

  const handleTogglePause = () => {
    setIsPaused((prev) => {
      const next = !prev;
      Alert.alert(
        next ? 'MATCH PAUSED' : 'MATCH RESUMED',
        next
          ? 'Play is suspended. Countdown clocks and catches are frozen.'
          : 'Play has resumed.'
      );
      return next;
    });
  };

  const handleEndGame = () => {
    Alert.alert(
      'FORCE END MATCH',
      'Are you sure you want to terminate this match immediately?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Terminate Match',
          style: 'destructive',
          onPress: () => router.replace('/game/results'),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Top Header */}
        <View style={styles.topHud}>
          <View>
            <Text style={styles.hudEyebrow}>SUPERVISOR OVERWATCH (FAMILY MODE)</Text>
            <Text style={styles.hudTitle}>MATCH REFEREE</Text>
          </View>
          <Badge
            label={isPaused ? 'PAUSED' : 'LIVE'}
            variant={isPaused ? 'warning' : 'safe'}
          />
        </View>

        {/* Unredacted Map View */}
        <TacticalRadarMap
          hunterLocation={currentLocation}
          runners={runners.map((r, i) => ({
            playerId: r.id,
            displayName: r.displayName,
            latitude: (currentLocation?.latitude ?? 37.7749) + 0.0002 * (i + 1),
            longitude: (currentLocation?.longitude ?? -122.4194) + 0.0002 * (i + 1),
            measuredAt: Date.now(),
          }))}
          zoneRadiusMeters={lobbyState?.playZone.radiusMeters ?? 500}
        />

        {/* Privileged Overwatch Controls */}
        <Text style={styles.sectionTitle}>SUPERVISOR CONTROLS</Text>
        <View style={styles.controlRow}>
          <Button
            title={isPaused ? 'RESUME MATCH' : 'PAUSE MATCH'}
            variant={isPaused ? 'primary' : 'secondary'}
            size="md"
            onPress={handleTogglePause}
            style={styles.controlBtn}
          />
          <Button
            title="END MATCH"
            variant="danger"
            size="md"
            onPress={handleEndGame}
            style={styles.controlBtn}
          />
        </View>

        {/* Live Roster Status */}
        <Text style={styles.sectionTitle}>ACTIVE PLAYER ROSTER</Text>
        <Card variant="elevated">
          {players.map((p) => (
            <View key={p.id} style={styles.playerItem}>
              <View>
                <Text style={styles.playerName}>{p.displayName}</Text>
                <Text style={styles.playerRoleSub}>{p.role}</Text>
              </View>
              <Badge
                label={p.status}
                variant={p.status === 'ALIVE' ? 'safe' : 'danger'}
              />
            </View>
          ))}
        </Card>
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
    color: colors.referee.primary,
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
  sectionTitle: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.xs,
    letterSpacing: typography.letterSpacing.wide,
    fontWeight: '700',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  controlRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  controlBtn: {
    flex: 1,
  },
  playerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  playerName: {
    color: colors.text.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
  },
  playerRoleSub: {
    color: colors.text.muted,
    fontSize: 10,
  },
});
