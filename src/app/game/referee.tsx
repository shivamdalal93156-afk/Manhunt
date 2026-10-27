import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, Screen, TopBar } from '@/components/ui';
import { LivePlayZoneMap } from '@/components/game/LivePlayZoneMap';
import { useLocation } from '@/hooks/useLocation';
import { useLobbyStore } from '@/store/lobbyStore';
import { borderRadius, colors, shadows, spacing, typography } from '@/theme/tokens';

export default function RefereeDashboardScreen() {
  const router = useRouter();
  const { lobbyState } = useLobbyStore();
  const { currentLocation } = useLocation();
  const [isPaused, setIsPaused] = useState(false);

  const players = lobbyState?.players ?? [];
  const chasers = players.filter((p) => p.role === 'HUNTER');
  const runners = players.filter((p) => p.role === 'RUNNER');

  const handleTogglePause = () => {
    setIsPaused((prev) => {
      const next = !prev;
      Alert.alert(
        next ? 'MATCH PAUSED' : 'MATCH RESUMED',
        next
          ? 'Match is paused. Countdown timers and catches are frozen.'
          : 'Match play has resumed.'
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
    <Screen scroll>
      <TopBar
        title="REFEREE OVERWATCH"
        subtitle={isPaused ? 'MATCH SUSPENDED' : 'LIVE SURVEILLANCE'}
        onBack={() => router.back()}
        rightSlot={
          <Badge
            label={isPaused ? 'PAUSED' : 'LIVE'}
            variant={isPaused ? 'warning' : 'safe'}
          />
        }
      />

      <View style={styles.container}>
        {/* Full Radar Overwatch Map */}
        <View style={styles.mapCard}>
          <LivePlayZoneMap
            currentLocation={currentLocation}
            zoneRadius={lobbyState?.playZone?.radiusMeters ?? 500}
            fullScreen={false}
            height={280}
            players={players.map((p, idx) => ({
              id: p.id,
              name: p.displayName,
              role: (p.role === 'SPECTATOR' ? 'RUNNER' : p.role) as 'HUNTER' | 'RUNNER' | 'REFEREE',
              latitude: (currentLocation?.latitude ?? 28.6139) + 0.0003 * (idx % 3),
              longitude: (currentLocation?.longitude ?? 77.2090) + 0.0003 * Math.floor(idx / 3),
            }))}
          />
        </View>

        {/* Referee Command Controls */}
        <View style={styles.controlsRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleTogglePause}
            style={[
              styles.controlBtn,
              isPaused ? styles.controlBtnResume : styles.controlBtnPause,
            ]}
          >
            <Ionicons
              name={isPaused ? 'play' : 'pause'}
              size={20}
              color="#FFFFFF"
            />
            <Text style={styles.controlBtnText}>
              {isPaused ? 'RESUME PLAY' : 'PAUSE MATCH'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleEndGame}
            style={[styles.controlBtn, styles.controlBtnEnd]}
          >
            <Ionicons name="stop" size={20} color="#FFFFFF" />
            <Text style={styles.controlBtnText}>END MATCH</Text>
          </TouchableOpacity>
        </View>

        {/* Squad Status Telemetry */}
        <Text style={styles.sectionTitle}>SQUAD ROSTER OVERWATCH</Text>
        <Card variant="portal" style={styles.card}>
          <View style={styles.statLine}>
            <View style={styles.roleHeader}>
              <View style={[styles.dot, { backgroundColor: colors.hunter.primary }]} />
              <Text style={styles.roleName}>CHASERS ({chasers.length})</Text>
            </View>
            <Text style={styles.roleDetail}>All Units Active</Text>
          </View>
          {chasers.map((c) => (
            <View key={c.id} style={styles.playerSubRow}>
              <Text style={styles.playerSubName}>{c.displayName}</Text>
              <Text style={styles.playerSubStatus}>{c.isReady ? 'Ready' : 'Standby'}</Text>
            </View>
          ))}

          <View style={[styles.statLine, { marginTop: spacing.md }]}>
            <View style={styles.roleHeader}>
              <View style={[styles.dot, { backgroundColor: colors.runner.primary }]} />
              <Text style={styles.roleName}>RUNNERS ({runners.length})</Text>
            </View>
            <Text style={styles.roleDetail}>
              {runners.filter((r) => r.heartsRemaining > 0).length} Surviving
            </Text>
          </View>
          {runners.map((r) => (
            <View key={r.id} style={styles.playerSubRow}>
              <Text style={styles.playerSubName}>{r.displayName}</Text>
              <Text style={styles.playerSubStatus}>
                {r.heartsRemaining} {r.heartsRemaining === 1 ? 'Heart' : 'Hearts'}
              </Text>
            </View>
          ))}
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  mapCard: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border.default,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  controlBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: borderRadius.lg,
    gap: 8,
  },
  controlBtnPause: {
    backgroundColor: '#F59E0B',
  },
  controlBtnResume: {
    backgroundColor: colors.status.safe,
  },
  controlBtnEnd: {
    backgroundColor: colors.status.danger,
  },
  controlBtnText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  sectionTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    letterSpacing: typography.letterSpacing.tactical,
    color: colors.text.muted,
    marginBottom: spacing.xs,
    marginLeft: 4,
  },
  card: {
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.xl,
  },
  statLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.default,
  },
  roleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  roleName: {
    fontSize: typography.fontSize.xs,
    fontWeight: '800',
    color: colors.text.primary,
    letterSpacing: 0.8,
  },
  roleDetail: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
    color: colors.text.muted,
  },
  playerSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  playerSubName: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  playerSubStatus: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
  },
});
