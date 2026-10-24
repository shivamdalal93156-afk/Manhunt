import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, Button, Card } from '@/components/ui';
import { borderRadius, colors, spacing, typography } from '@/theme/tokens';

export default function RulesAndSafetyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>TACTICAL HANDBOOK & SAFETY</Text>
          <Text style={styles.title}>RULES OF ENGAGEMENT</Text>
        </View>

        {/* 1. Core Objectives */}
        <Card variant="elevated" style={styles.card}>
          <Text style={styles.cardTitle}>1. CORE OBJECTIVE</Text>
          <Text style={styles.bodyText}>
            GPS Manhunt transforms outdoor environments (parks, campuses, quiet neighborhoods) into a live multiplayer game.
          </Text>
          <Text style={styles.bodyText}>
            • <Text style={styles.bold}>Hunters (Chasers):</Text> Locate and eliminate all runners by closing distance to within 15 meters before match time expires.
          </Text>
          <Text style={styles.bodyText}>
            • <Text style={styles.bold}>Runners (Evaders):</Text> Use your directional compass and tactical stealth to survive within the play area until the timer hits 0:00.
          </Text>
        </Card>

        {/* 2. Asymmetric Tracking */}
        <Card variant="hunter" style={styles.card}>
          <Text style={styles.cardTitle}>2. ASYMMETRIC TRACKING</Text>
          <Text style={styles.bodyText}>
            Hunters receive periodic satellite radar pings of runner positions (every 30 or 60 seconds).
          </Text>
          <Text style={styles.bodyText}>
            Runners do NOT see a live map of hunters. Instead, runners use a high-precision <Text style={styles.bold}>Geodesic Compass</Text> pointing toward the nearest hunter, with visual distance threat levels (Green: Safe &gt;150m, Amber: Warning 50-150m, Red: Danger &lt;50m).
          </Text>
        </Card>

        {/* 3. Catch Mechanics */}
        <Card variant="runner" style={styles.card}>
          <Text style={styles.cardTitle}>3. PROXIMITY CATCH MECHANIC</Text>
          <Text style={styles.bodyText}>
            A catch can only be triggered when a Hunter closes physical distance to within <Text style={styles.bold}>15 meters</Text> of a Runner.
          </Text>
          <Text style={styles.bodyText}>
            Each runner starts with 3 survival hearts. When caught, a heart is forfeited. At 0 hearts, the runner is eliminated and becomes a spectator. Physical contact or tackling is strictly prohibited.
          </Text>
        </Card>

        {/* 4. Geofence & Play Zone */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>4. PLAY ZONE BOUNDARY</Text>
          <Text style={styles.bodyText}>
            All players must remain inside the host-configured play zone. Crossing the boundary triggers a 15-meter warning grace zone. Failure to return inside the boundary drains hearts.
          </Text>
        </Card>

        {/* 5. Physical Safety Doctrine */}
        <Card style={[styles.card, { borderColor: colors.status.danger }]}>
          <Text style={[styles.cardTitle, { color: colors.status.danger }]}>
            ⚠️ PHYSICAL SAFETY MANDATE
          </Text>
          <Text style={styles.bodyText}>
            • <Text style={styles.bold}>Never play on active roadways</Text> or near vehicle traffic.
          </Text>
          <Text style={styles.bodyText}>
            • <Text style={styles.bold}>Do not trespass</Text> on private property, construction sites, or railway tracks.
          </Text>
          <Text style={styles.bodyText}>
            • <Text style={styles.bold}>No vehicles:</Text> Playing while driving a car or riding a bicycle is strictly forbidden.
          </Text>
          <Text style={styles.bodyText}>
            • Players must be at least 13 years old or supervised by a designated adult Referee (Family Mode).
          </Text>
        </Card>

        {/* Back Button */}
        <Button
          title="RETURN"
          variant="secondary"
          size="lg"
          fullWidth
          onPress={() => router.back()}
          style={styles.backBtn}
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
  },
  header: {
    marginBottom: spacing.lg,
  },
  eyebrow: {
    color: colors.hunter.primary,
    fontSize: typography.fontSize.xs,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  title: {
    color: colors.text.primary,
    fontSize: typography.fontSize.xxl,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  card: {
    marginBottom: spacing.md,
  },
  cardTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: spacing.xs,
  },
  bodyText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.xs,
    lineHeight: 18,
    marginVertical: 3,
  },
  bold: {
    color: colors.text.primary,
    fontWeight: '700',
  },
  backBtn: {
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
});
