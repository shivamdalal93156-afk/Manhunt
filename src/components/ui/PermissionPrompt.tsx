import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme/tokens';
import { Button } from './Button';
import { Card } from './Card';

interface PermissionPromptProps {
  onGrant: () => void;
  loading?: boolean;
}

export const PermissionPrompt: React.FC<PermissionPromptProps> = ({
  onGrant,
  loading = false,
}) => {
  return (
    <Card variant="hunter" style={styles.card}>
      <Text style={styles.eyebrow}>TACTICAL SENSOR ACCESS REQUIRED</Text>
      <Text style={styles.title}>GPS & Motion Authorization</Text>
      <Text style={styles.description}>
        GPS Manhunt transforms your physical surroundings into a live multiplayer game.
        High-precision location is needed to:
      </Text>
      <View style={styles.list}>
        <Text style={styles.bullet}>• Enforce boundary geofences in real-time</Text>
        <Text style={styles.bullet}>• Calculate directional bearings to opponents</Text>
        <Text style={styles.bullet}>• Authorize tactical ~15m proximity catches</Text>
      </View>
      <Text style={styles.privacyNotice}>
        🔒 PRIVACY GUARANTEE: Location tracking is only active during live matches.
        Location history is deleted 5 minutes after game completion.
      </Text>
      <Button
        title="GRANT LOCATION PERMISSION"
        variant="hunter"
        size="md"
        onPress={onGrant}
        loading={loading}
        style={styles.button}
      />
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    marginVertical: spacing.md,
  },
  eyebrow: {
    color: colors.hunter.primary,
    fontSize: typography.fontSize.xs,
    letterSpacing: typography.letterSpacing.tactical,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  title: {
    color: colors.text.primary,
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  description: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  list: {
    marginBottom: spacing.md,
  },
  bullet: {
    color: colors.text.primary,
    fontSize: typography.fontSize.sm,
    marginVertical: 2,
  },
  privacyNotice: {
    color: colors.status.safe,
    fontSize: typography.fontSize.xs,
    lineHeight: 16,
    marginBottom: spacing.md,
  },
  button: {
    marginTop: spacing.xs,
  },
});
