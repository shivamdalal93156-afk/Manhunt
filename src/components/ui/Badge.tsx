import React from 'react';
import { StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { borderRadius, colors, spacing, typography } from '@/theme/tokens';

export type BadgeVariant =
  | 'hunter'
  | 'runner'
  | 'referee'
  | 'safe'
  | 'warning'
  | 'danger'
  | 'fresh'
  | 'stale'
  | 'neutral';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'neutral',
  style,
  textStyle,
}) => {
  const getBadgeStyle = (): { container: ViewStyle; text: TextStyle } => {
    switch (variant) {
      case 'hunter':
        return {
          container: { backgroundColor: 'rgba(0, 240, 255, 0.15)', borderColor: colors.hunter.primary },
          text: { color: colors.hunter.primary },
        };
      case 'runner':
        return {
          container: { backgroundColor: 'rgba(255, 158, 0, 0.15)', borderColor: colors.runner.primary },
          text: { color: colors.runner.primary },
        };
      case 'referee':
        return {
          container: { backgroundColor: 'rgba(168, 85, 247, 0.15)', borderColor: colors.referee.primary },
          text: { color: colors.referee.primary },
        };
      case 'safe':
      case 'fresh':
        return {
          container: { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: colors.status.safe },
          text: { color: colors.status.safe },
        };
      case 'warning':
        return {
          container: { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: colors.status.warning },
          text: { color: colors.status.warning },
        };
      case 'danger':
        return {
          container: { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: colors.status.danger },
          text: { color: colors.status.danger },
        };
      case 'stale':
        return {
          container: { backgroundColor: 'rgba(100, 116, 139, 0.2)', borderColor: colors.status.neutral },
          text: { color: colors.text.muted },
        };
      default:
        return {
          container: { backgroundColor: 'rgba(100, 116, 139, 0.15)', borderColor: colors.border.subtle },
          text: { color: colors.text.secondary },
        };
    }
  };

  const current = getBadgeStyle();

  return (
    <View style={[styles.base, current.container, style]}>
      <Text style={[styles.text, current.text, textStyle]}>{label.toUpperCase()}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    letterSpacing: typography.letterSpacing.tactical,
  },
});
