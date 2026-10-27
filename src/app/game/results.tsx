import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, Screen, TopBar } from '@/components/ui';
import { useLocation } from '@/hooks/useLocation';
import { progressionService } from '@/services/progression/progressionService';
import { useLobbyStore } from '@/store/lobbyStore';
import { borderRadius, colors, shadows, spacing, typography } from '@/theme/tokens';

export default function MatchResultsScreen() {
  const router = useRouter();
  const { session, lobbyState, leaveMatch } = useLobbyStore();
  const { stopTracking } = useLocation();
  const [reward, setReward] = useState<{ xp: number } | null>(null);

  // Stop location tracking immediately upon entering results screen
  useEffect(() => {
    stopTracking();

    const isRunner = session?.myRole === 'RUNNER';
    const players = lobbyState?.players ?? [];
    const runners = players.filter((p) => p.role === 'RUNNER');
    const livingRunners = runners.filter(
      (p) => p.status === 'ALIVE' && p.heartsRemaining > 0
    );
    const chasersWin = livingRunners.length === 0;
    const isVictory = isRunner ? !chasersWin : chasersWin;

    progressionService
      .recordMatchResult({
        gameId: session?.gameId || 'match-debrief',
        role: session?.myRole === 'RUNNER' ? 'RUNNER' : 'HUNTER',
        result: isVictory
          ? isRunner
            ? 'ESCAPED'
            : 'VICTORY'
          : isRunner
          ? 'CAUGHT'
          : 'DEFEAT',
        durationMinutes: lobbyState?.settings.durationMinutes ?? 30,
      })
      .then((res) => {
        setReward({ xp: res.xpEarned });
      })
      .catch(() => {});
  }, [
    stopTracking,
    session?.myRole,
    session?.gameId,
    lobbyState?.players,
    lobbyState?.settings.durationMinutes,
  ]);

  const players = lobbyState?.players ?? [];
  const chasers = players.filter((p) => p.role === 'HUNTER');
  const runners = players.filter((p) => p.role === 'RUNNER');
  const livingRunners = runners.filter(
    (p) => p.status === 'ALIVE' && p.heartsRemaining > 0
  );
  const chasersWin = livingRunners.length === 0;

  const handleReturnHome = async () => {
    await leaveMatch();
    router.replace('/');
  };

  return (
    <Screen scroll>
      <TopBar title="MISSION DEBRIEF" onBack={handleReturnHome} />

      <View style={styles.container}>
        {/* Victory / Defeat Header */}
        <Card variant="portal" style={styles.headerCard}>
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: chasersWin ? colors.hunter.primary : colors.runner.primary },
            ]}
          >
            <Ionicons
              name={chasersWin ? 'flag' : 'shield-checkmark'}
              size={36}
              color="#FFFFFF"
            />
          </View>

          <Text
            style={[
              styles.victoryTitle,
              { color: chasersWin ? colors.hunter.primary : colors.runner.primary },
            ]}
          >
            {chasersWin ? 'CHASERS TRIUMPH' : 'RUNNERS SURVIVE'}
          </Text>

          <Text style={styles.victorySub}>
            {chasersWin
              ? 'All runners were eliminated before the mission timer expired.'
              : 'At least one runner successfully evaded capture until the zero hour.'}
          </Text>

          {/* XP Reward Badge (Coins hidden per requirement) */}
          {reward && (
            <View style={styles.rewardBanner}>
              <Ionicons name="flash" size={16} color="#D97706" />
              <Text style={styles.rewardText}>+{reward.xp} OPERATIVE XP EARNED</Text>
            </View>
          )}
        </Card>

        {/* Mission Statistics Breakdown */}
        <Text style={styles.sectionTitle}>SQUAD PERFORMANCE</Text>
        <Card variant="portal" style={styles.statsCard}>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>WINNING SQUAD</Text>
            <Badge
              label={chasersWin ? 'CHASERS' : 'RUNNERS'}
              variant={chasersWin ? 'hunter' : 'runner'}
            />
          </View>

          <View style={styles.statRow}>
            <Text style={styles.statLabel}>TOTAL OPERATIVES</Text>
            <Text style={styles.statVal}>{players.length}</Text>
          </View>

          <View style={styles.statRow}>
            <Text style={styles.statLabel}>CHASERS DEPLOYED</Text>
            <Text style={styles.statVal}>{chasers.length}</Text>
          </View>

          <View style={styles.statRow}>
            <Text style={styles.statLabel}>RUNNERS TARGETED</Text>
            <Text style={styles.statVal}>{runners.length}</Text>
          </View>

          <View style={[styles.statRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.statLabel}>SURVIVING EVADERS</Text>
            <Text
              style={[
                styles.statVal,
                { color: livingRunners.length > 0 ? colors.status.safe : colors.status.danger },
              ]}
            >
              {livingRunners.length}
            </Text>
          </View>
        </Card>

        {/* Action Button */}
        <View style={styles.buttonContainer}>
          <Button
            title="RETURN TO MISSION HUB"
            variant="gradient"
            size="lg"
            fullWidth
            onPress={handleReturnHome}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  headerCard: {
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    ...shadows.md,
  },
  victoryTitle: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: typography.letterSpacing.tactical,
    textAlign: 'center',
  },
  victorySub: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    paddingHorizontal: spacing.md,
  },
  rewardBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    marginTop: spacing.lg,
  },
  rewardText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '800',
    color: '#D97706',
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
  statsCard: {
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.xl,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.default,
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: colors.text.muted,
    letterSpacing: 0.8,
  },
  statVal: {
    fontSize: typography.fontSize.base,
    fontWeight: '800',
    color: colors.text.primary,
  },
  buttonContainer: {
    marginBottom: spacing.xxl,
  },
});
