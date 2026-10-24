import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, Button, Card } from '@/components/ui';
import { useLocation } from '@/hooks/useLocation';
import { useLobbyStore } from '@/store/lobbyStore';
import { borderRadius, colors, spacing, typography } from '@/theme/tokens';

export default function MatchResultsScreen() {
  const router = useRouter();
  const { session, lobbyState, leaveMatch } = useLobbyStore();
  const { stopTracking } = useLocation();

  // Stop location tracking immediately upon entering results screen
  useEffect(() => {
    stopTracking();
  }, [stopTracking]);

  const players = lobbyState?.players ?? [];
  const runners = players.filter((p) => p.role === 'RUNNER');
  const livingRunners = runners.filter((p) => p.status === 'ALIVE' && p.heartsRemaining > 0);
  const huntersWin = livingRunners.length === 0;

  const handleReturnHome = async () => {
    await leaveMatch();
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Victory Header */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>OPERATION CONCLUDED</Text>
          <Text
            style={[
              styles.victoryTitle,
              { color: huntersWin ? colors.hunter.primary : colors.runner.primary },
            ]}
          >
            {huntersWin ? 'HUNTERS TRIUMPH' : 'RUNNERS SURVIVE'}
          </Text>
          <Text style={styles.victorySub}>
            {huntersWin
              ? 'All runners were eliminated before the timer expired.'
              : 'At least one runner successfully evaded capture until zero hour.'}
          </Text>
        </View>

        {/* Match Statistics */}
        <Card variant={huntersWin ? 'hunter' : 'runner'} style={styles.statsCard}>
          <Text style={styles.statsTitle}>MISSION DEBRIEF</Text>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>WINNING SQUAD:</Text>
            <Badge
              label={huntersWin ? 'HUNTERS' : 'RUNNERS'}
              variant={huntersWin ? 'hunter' : 'runner'}
            />
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>TOTAL RUNNERS:</Text>
            <Text style={styles.statVal}>{runners.length}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>RUNNERS ELIMINATED:</Text>
            <Text style={styles.statVal}>
              {runners.length - livingRunners.length}
            </Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>RUNNERS SURVIVED:</Text>
            <Text style={styles.statVal}>{livingRunners.length}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>MATCH DURATION:</Text>
            <Text style={styles.statVal}>
              {lobbyState?.settings.durationMinutes ?? 30} Minutes
            </Text>
          </View>
        </Card>

        {/* Privacy Termination Notice */}
        <Card style={styles.privacyCard}>
          <Text style={styles.privacyHeading}>🔒 Location Tracking Terminated</Text>
          <Text style={styles.privacyText}>
            GPS collection has been stopped. Location breadcrumbs and transient
            game logs will be purged from memory in accordance with our 5-minute
            retention doctrine.
          </Text>
        </Card>

        {/* Return Button */}
        <Button
          title="RETURN TO HEADQUARTERS"
          variant="primary"
          size="lg"
          fullWidth
          onPress={handleReturnHome}
          style={styles.returnBtn}
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
    padding: spacing.lg,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  eyebrow: {
    color: colors.text.muted,
    fontSize: typography.fontSize.xs,
    letterSpacing: 2,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  victoryTitle: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
  },
  victorySub: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 20,
    maxWidth: 280,
  },
  statsCard: {
    marginBottom: spacing.md,
  },
  statsTitle: {
    color: colors.text.primary,
    fontWeight: '800',
    fontSize: typography.fontSize.sm,
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: spacing.xs,
  },
  statLabel: {
    color: colors.text.muted,
    fontSize: typography.fontSize.xs,
  },
  statVal: {
    color: colors.text.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
  },
  privacyCard: {
    marginVertical: spacing.sm,
    borderColor: colors.status.safe,
  },
  privacyHeading: {
    color: colors.status.safe,
    fontSize: typography.fontSize.xs,
    fontWeight: '800',
    marginBottom: 4,
  },
  privacyText: {
    color: colors.text.secondary,
    fontSize: 11,
    lineHeight: 16,
  },
  returnBtn: {
    marginTop: spacing.lg,
  },
});
