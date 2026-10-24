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
import { Button, Card, ErrorFallback } from '@/components/ui';
import { useLobbyStore } from '@/store/lobbyStore';
import { borderRadius, colors, spacing, typography } from '@/theme/tokens';

export default function CreateMatchScreen() {
  const router = useRouter();
  const { createMatch, isLoading, error, clearError } = useLobbyStore();
  const [selectedDuration, setSelectedDuration] = useState(30);
  const [selectedPing, setSelectedPing] = useState(30);
  const [selectedRadius, setSelectedRadius] = useState(500);

  const handleCreate = async () => {
    try {
      const session = await createMatch({
        durationMinutes: selectedDuration,
        pingIntervalSeconds: selectedPing,
        zoneRadiusMeters: selectedRadius,
      });
      router.push(`/lobby/${session.gameId}`);
    } catch (err: unknown) {
      Alert.alert(
        'CREATE MATCH FAILED',
        err instanceof Error ? err.message : 'Unable to initialize match room'
      );
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {error && (
        <ErrorFallback
          error={error}
          onRetry={clearError}
          title="INITIALIZATION FAILED"
        />
      )}

      {/* Match Parameters */}
      <Text style={styles.sectionTitle}>MATCH DURATION</Text>
      <View style={styles.optionRow}>
        {[15, 30, 45, 60].map((mins) => (
          <TouchableOpacity
            key={mins}
            style={[
              styles.optionPill,
              selectedDuration === mins && styles.optionPillActive,
            ]}
            onPress={() => setSelectedDuration(mins)}
          >
            <Text
              style={[
                styles.optionText,
                selectedDuration === mins && styles.optionTextActive,
              ]}
            >
              {mins} MINS
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>RADAR PING INTERVAL</Text>
      <View style={styles.optionRow}>
        {[15, 30, 60, 120].map((sec) => (
          <TouchableOpacity
            key={sec}
            style={[
              styles.optionPill,
              selectedPing === sec && styles.optionPillActive,
            ]}
            onPress={() => setSelectedPing(sec)}
          >
            <Text
              style={[
                styles.optionText,
                selectedPing === sec && styles.optionTextActive,
              ]}
            >
              {sec}s
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>PLAY ZONE RADIUS</Text>
      <View style={styles.optionRow}>
        {[300, 500, 750, 1000].map((rad) => (
          <TouchableOpacity
            key={rad}
            style={[
              styles.optionPill,
              selectedRadius === rad && styles.optionPillActive,
            ]}
            onPress={() => setSelectedRadius(rad)}
          >
            <Text
              style={[
                styles.optionText,
                selectedRadius === rad && styles.optionTextActive,
              ]}
            >
              {rad}m
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Configuration Summary */}
      <Card variant="hunter" style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>TACTICAL MATCH PARAMETERS</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Time Limit:</Text>
          <Text style={styles.summaryVal}>{selectedDuration} Minutes</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Radar Snapshot Interval:</Text>
          <Text style={styles.summaryVal}>Every {selectedPing} Seconds</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Initial Geofence Area:</Text>
          <Text style={styles.summaryVal}>{selectedRadius}m Radius</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Catch Validation Threshold:</Text>
          <Text style={styles.summaryVal}>15 Meters Proximity</Text>
        </View>
      </Card>

      <Button
        title={isLoading ? 'INITIALIZING SQUAD...' : 'INITIALIZE LOBBY'}
        variant="hunter"
        size="lg"
        fullWidth
        loading={isLoading}
        onPress={handleCreate}
        style={styles.submitBtn}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.base,
  },
  content: {
    padding: spacing.lg,
  },
  devBanner: {
    marginBottom: spacing.lg,
    borderColor: colors.status.warning,
  },
  devHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  devTag: {
    color: colors.status.warning,
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    letterSpacing: typography.letterSpacing.tactical,
  },
  devText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.xs,
    lineHeight: 18,
  },
  sectionTitle: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.xs,
    letterSpacing: typography.letterSpacing.wide,
    fontWeight: '700',
    marginTop: spacing.md,
    marginBottom: spacing.xs + 2,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  optionPill: {
    flex: 1,
    marginHorizontal: 3,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.background.surface,
    borderColor: colors.border.subtle,
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
  },
  optionPillActive: {
    backgroundColor: 'rgba(0, 240, 255, 0.15)',
    borderColor: colors.hunter.primary,
  },
  optionText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    letterSpacing: 1,
  },
  optionTextActive: {
    color: colors.hunter.primary,
  },
  summaryCard: {
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  summaryTitle: {
    color: colors.hunter.primary,
    fontWeight: '800',
    fontSize: typography.fontSize.xs,
    letterSpacing: typography.letterSpacing.tactical,
    marginBottom: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  summaryLabel: {
    color: colors.text.muted,
    fontSize: typography.fontSize.xs,
  },
  summaryVal: {
    color: colors.text.primary,
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
  },
  submitBtn: {
    marginTop: spacing.xl,
  },
});
