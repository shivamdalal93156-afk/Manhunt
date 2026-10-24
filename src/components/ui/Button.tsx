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

export type ButtonVariant = 'hunter' | 'runner' | 'primary' | 'secondary' | 'danger' | 'ghost';
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
  variant = 'primary',
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

    if (variant === 'hunter') list.push(styles.textHunter);
    if (variant === 'runner') list.push(styles.textRunner);
    if (variant === 'secondary') list.push(styles.textSecondary);
    if (variant === 'ghost') list.push(styles.textGhost);
    if (variant === 'danger') list.push(styles.textDanger);

    if (textStyle) list.push(textStyle);
    return list;
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
      style={getContainerStyles()}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'hunter' || variant === 'runner' ? '#000' : '#FFF'}
        />
      ) : (
        <>
          {icon}
          <Text style={getTextStyle()}>{title.toUpperCase()}</Text>
        </>
      )}
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
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  // Sizes
  sizeSm: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
  },
  sizeMd: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  sizeLg: {
    paddingVertical: spacing.lg - 2,
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
    backgroundColor: 'transparent',
    borderColor: colors.border.subtle,
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
    fontWeight: '700',
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
  textHunter: {
    color: colors.hunter.contrastText,
  },
  textRunner: {
    color: colors.runner.contrastText,
  },
  textSecondary: {
    color: colors.text.secondary,
  },
  textGhost: {
    color: colors.text.muted,
  },
  textDanger: {
    color: '#FFF',
  },
});
