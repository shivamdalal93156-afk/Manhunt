import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, Screen, TopBar } from '@/components/ui';
import { borderRadius, colors, spacing, typography } from '@/theme/tokens';

export default function RulesAndSafetyScreen() {
  const router = useRouter();

  return (
    <Screen scroll>
      <TopBar title="RULES & SAFETY" onBack={() => router.back()} />

      <View style={styles.container}>
        {/* 1. Core Objectives */}
        <Card variant="portal" style={styles.card}>
          <View style={styles.titleRow}>
            <Ionicons name="flag-outline" size={20} color={colors.brand.accent} />
            <Text style={styles.cardTitle}>1. CORE OBJECTIVES</Text>
          </View>
          <Text style={styles.bodyText}>
            GPS Manhunt transforms outdoor environments into a live tactical chase:
          </Text>
          <Text style={styles.bulletText}>
            • <Text style={styles.bold}>Chasers:</Text> Locate and catch all runners within the physical play zone before time expires.
          </Text>
          <Text style={styles.bulletText}>
            • <Text style={styles.bold}>Runners:</Text> Use the directional compass and tactical stealth to evade chasers until time runs out.
          </Text>
          <Text style={styles.bulletText}>
            • <Text style={styles.bold}>Referees:</Text> Supervise boundaries, pause/resume matches, and monitor safety in God-mode.
          </Text>
        </Card>

        {/* 2. Asymmetric Tracking */}
        <Card variant="portal" style={styles.card}>
          <View style={styles.titleRow}>
            <Ionicons name="radio-outline" size={20} color={colors.hunter.primary} />
            <Text style={styles.cardTitle}>2. ASYMMETRIC TRACKING</Text>
          </View>
          <Text style={styles.bodyText}>
            Chasers receive periodic radar pings showing runner positions on a high-definition satellite map (every 30 or 60 seconds).
          </Text>
          <Text style={styles.bodyText}>
            Runners do not have a live radar map. Instead, runners track chasers using a precision <Text style={styles.bold}>Directional Compass</Text> pointing toward the nearest threat, with color-coded distance threat tiers (Green &gt;150m, Yellow 50–150m, Red &lt;50m).
          </Text>
        </Card>

        {/* 3. Catch Mechanics */}
        <Card variant="portal" style={styles.card}>
          <View style={styles.titleRow}>
            <Ionicons name="shield-outline" size={20} color={colors.runner.primary} />
            <Text style={styles.cardTitle}>3. PROXIMITY CATCH MECHANIC</Text>
          </View>
          <Text style={styles.bodyText}>
            A catch can only be attempted when a Chaser closes physical distance to within <Text style={styles.bold}>15 meters</Text> of a Runner.
          </Text>
          <Text style={styles.bodyText}>
            Each Runner holds a secret 4-digit catch code. The Chaser verifies the catch by entering the code. Each catch forfeits a heart. At 0 hearts, the runner is eliminated.
          </Text>
        </Card>

        {/* 4. Play Zone & Perimeter */}
        <Card variant="portal" style={styles.card}>
          <View style={styles.titleRow}>
            <Ionicons name="map-outline" size={20} color={colors.referee.primary} />
            <Text style={styles.cardTitle}>4. PLAY ZONE BOUNDARY</Text>
          </View>
          <Text style={styles.bodyText}>
            All players must remain inside the host-configured play zone. Stepping out of bounds triggers a 15-meter grace warning. Failure to re-enter damages hearts.
          </Text>
        </Card>

        {/* 5. Physical Safety Mandate */}
        <Card variant="portal" style={[styles.card, styles.safetyCard]}>
          <View style={styles.titleRow}>
            <Ionicons name="warning" size={20} color={colors.status.danger} />
            <Text style={[styles.cardTitle, { color: colors.status.danger }]}>
              PHYSICAL SAFETY MANDATE
            </Text>
          </View>
          <Text style={styles.safetyBullet}>
            • <Text style={styles.bold}>Never play near roads</Text> or active vehicular traffic.
          </Text>
          <Text style={styles.safetyBullet}>
            • <Text style={styles.bold}>No trespassing</Text> on private property or restricted areas.
          </Text>
          <Text style={styles.safetyBullet}>
            • <Text style={styles.bold}>No vehicles:</Text> Playing while driving or cycling is strictly prohibited.
          </Text>
          <Text style={styles.safetyBullet}>
            • <Text style={styles.bold}>Zero physical tackling:</Text> Tagging is contactless via proximity catch-codes.
          </Text>
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  card: {
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.md,
  },
  safetyCard: {
    borderColor: 'rgba(239, 68, 68, 0.3)',
    backgroundColor: '#FEF2F2',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: '800',
    color: colors.text.primary,
    letterSpacing: typography.letterSpacing.tactical,
  },
  bodyText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: 6,
  },
  bulletText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
    marginVertical: 2,
  },
  safetyBullet: {
    fontSize: typography.fontSize.sm,
    color: '#991B1B',
    lineHeight: 20,
    marginVertical: 2,
  },
  bold: {
    color: colors.text.primary,
    fontWeight: '700',
  },
});
