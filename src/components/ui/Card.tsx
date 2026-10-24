import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { borderRadius, colors, spacing } from '@/theme/tokens';

interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'hunter' | 'runner' | 'referee' | 'elevated';
  style?: ViewStyle;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  style,
}) => {
  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'hunter':
        return styles.hunter;
      case 'runner':
        return styles.runner;
      case 'referee':
        return styles.referee;
      case 'elevated':
        return styles.elevated;
      default:
        return styles.default;
    }
  };

  return <View style={[styles.base, getVariantStyle(), style]}>{children}</View>;
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.background.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  default: {},
  elevated: {
    backgroundColor: colors.background.elevated,
    borderColor: colors.border.active,
  },
  hunter: {
    borderColor: colors.hunter.primary,
    backgroundColor: 'rgba(0, 240, 255, 0.05)',
  },
  runner: {
    borderColor: colors.runner.primary,
    backgroundColor: 'rgba(255, 158, 0, 0.05)',
  },
  referee: {
    borderColor: colors.referee.primary,
    backgroundColor: 'rgba(168, 85, 247, 0.05)',
  },
});
