import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { borderRadius, colors, spacing } from '@/theme/tokens';

interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'hunter' | 'runner' | 'referee' | 'elevated' | 'glass';
  style?: ViewStyle | ViewStyle[];
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
      case 'glass':
        return styles.glass;
      default:
        return styles.default;
    }
  };

  return <View style={[styles.base, getVariantStyle(), style]}>{children}</View>;
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.background.surfaceCard,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.glass,
  },
  default: {},
  glass: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.10)',
  },
  elevated: {
    backgroundColor: colors.background.elevated,
    borderColor: colors.border.active,
  },
  hunter: {
    borderColor: 'rgba(232, 93, 59, 0.4)',
    backgroundColor: 'rgba(232, 93, 59, 0.08)',
  },
  runner: {
    borderColor: 'rgba(0, 229, 255, 0.4)',
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
  },
  referee: {
    borderColor: 'rgba(168, 85, 247, 0.4)',
    backgroundColor: 'rgba(168, 85, 247, 0.08)',
  },
});

