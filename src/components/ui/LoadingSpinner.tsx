import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme/tokens';

interface LoadingSpinnerProps {
  message?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = 'CONNECTING TO SATELLITE RADAR...',
}) => {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.hunter.primary} />
      {message ? <Text style={styles.text}>{message}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.xs,
    letterSpacing: typography.letterSpacing.tactical,
    color: colors.text.secondary,
    fontWeight: '600',
    textAlign: 'center',
  },
});
