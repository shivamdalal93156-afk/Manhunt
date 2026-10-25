import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { borderRadius, colors, spacing, typography } from '@/theme/tokens';
import { GradientView } from './GradientView';

export type ButtonVariant =
  | 'gradient'
  | 'hunter'
  | 'runner'
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'gradient',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
  textStyle,
  icon,
}) => {
  const getContainerStyles = (): ViewStyle[] => {
    const list: ViewStyle[] = [styles.base];

    // Size
    if (size === 'sm') list.push(styles.sizeSm);
    if (size === 'md') list.push(styles.sizeMd);
    if (size === 'lg') list.push(styles.sizeLg);

    // Variant
    if (variant === 'hunter') list.push(styles.variantHunter);
    if (variant === 'runner') list.push(styles.variantRunner);
    if (variant === 'primary') list.push(styles.variantPrimary);
    if (variant === 'secondary') list.push(styles.variantSecondary);
    if (variant === 'danger') list.push(styles.variantDanger);
    if (variant === 'ghost') list.push(styles.variantGhost);

    if (fullWidth) list.push(styles.fullWidth);
    if (disabled || loading) list.push(styles.disabled);
    if (style) list.push(style);

    return list;
  };

  const getTextStyle = (): TextStyle[] => {
    const list: TextStyle[] = [styles.baseText];
    if (size === 'sm') list.push(styles.textSm);
    if (size === 'md') list.push(styles.textMd);
    if (size === 'lg') list.push(styles.textLg);

    if (variant === 'runner') list.push(styles.textRunner);
    if (variant === 'secondary') list.push(styles.textSecondary);
    if (variant === 'ghost') list.push(styles.textGhost);
    if (variant === 'gradient' || variant === 'hunter' || variant === 'danger') {
      list.push(styles.textWhite);
    }

    if (textStyle) list.push(textStyle);
    return list;
  };

  const content = loading ? (
    <ActivityIndicator
      size="small"
      color={variant === 'runner' ? '#000' : '#FFF'}
    />
  ) : (
    <>
      {icon}
      <Text style={getTextStyle()}>{title.toUpperCase()}</Text>
    </>
  );

  if (variant === 'gradient') {
    const sizeStyle =
      size === 'sm' ? styles.sizeSm : size === 'lg' ? styles.sizeLg : styles.sizeMd;
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        disabled={disabled || loading}
        style={[styles.gradientWrapper, fullWidth && styles.fullWidth, (disabled || loading) && styles.disabled, style]}
      >
        <GradientView
          colors={colors.brand.gradient}
          borderRadius={borderRadius.md}
          style={[styles.gradientInner, sizeStyle]}
        >
          {content}
        </GradientView>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
      style={getContainerStyles()}
    >
      {content}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  gradientWrapper: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  gradientInner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  // Sizes
  sizeSm: {
    paddingVertical: spacing.xs + 3,
    paddingHorizontal: spacing.md,
  },
  sizeMd: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  sizeLg: {
    paddingVertical: spacing.md + 4,
    paddingHorizontal: spacing.xl,
  },
  // Variants
  variantHunter: {
    backgroundColor: colors.hunter.primary,
    borderColor: colors.hunter.primary,
  },
  variantRunner: {
    backgroundColor: colors.runner.primary,
    borderColor: colors.runner.primary,
  },
  variantPrimary: {
    backgroundColor: colors.background.elevated,
    borderColor: colors.border.active,
  },
  variantSecondary: {
    backgroundColor: colors.background.surfaceCard,
    borderColor: colors.border.glass,
  },
  variantDanger: {
    backgroundColor: colors.status.danger,
    borderColor: colors.status.danger,
  },
  variantGhost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  // Texts
  baseText: {
    fontWeight: '800',
    letterSpacing: typography.letterSpacing.tactical,
    textAlign: 'center',
    color: colors.text.primary,
  },
  textSm: {
    fontSize: typography.fontSize.xs,
  },
  textMd: {
    fontSize: typography.fontSize.base,
  },
  textLg: {
    fontSize: typography.fontSize.lg,
  },
  textWhite: {
    color: '#FFFFFF',
  },
  textRunner: {
    color: colors.runner.contrastText,
  },
  textSecondary: {
    color: colors.text.primary,
  },
  textGhost: {
    color: colors.text.muted,
  },
});

