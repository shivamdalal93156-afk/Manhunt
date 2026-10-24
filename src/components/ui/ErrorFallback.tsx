import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme/tokens';
import { Button } from './Button';

interface ErrorFallbackProps {
  error?: Error | string;
  onRetry?: () => void;
  title?: string;
}

export const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  onRetry,
  title = 'SYSTEM MALFUNCTION',
}) => {
  const errorMessage =
    typeof error === 'string'
      ? error
      : error?.message || 'An unexpected operational failure occurred.';

  return (
    <View style={styles.container}>
      <Text style={styles.badge}>CRITICAL ALERT</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{errorMessage}</Text>
      {onRetry ? (
        <Button
          title="RETRY OPERATION"
          onPress={onRetry}
          variant="danger"
          style={styles.button}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    backgroundColor: colors.background.surface,
    borderColor: colors.status.danger,
    borderWidth: 1,
    borderRadius: 8,
    margin: spacing.md,
  },
  badge: {
    color: colors.status.danger,
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    letterSpacing: typography.letterSpacing.tactical,
    marginBottom: spacing.xs,
  },
  title: {
    color: colors.text.primary,
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  message: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  button: {
    marginTop: spacing.xs,
  },
});
