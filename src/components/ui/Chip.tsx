import React from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { borderRadius, colors, spacing, typography } from '@/theme/tokens';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: React.ReactNode;
  activeColor?: string;
  variant?: 'default' | 'chaser' | 'runner' | 'referee';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  disabled?: boolean;
}

export const Chip: React.FC<ChipProps> = ({
  label,
  selected = false,
  onPress,
  icon,
  activeColor,
  variant = 'default',
  style,
  textStyle,
  disabled = false,
}) => {
  const getColors = () => {
    if (activeColor && selected) {
      return {
        bg: activeColor,
        border: activeColor,
        text: '#FFFFFF',
      };
    }

    if (variant === 'chaser') {
      return selected
        ? { bg: colors.hunter.primary, border: colors.hunter.primary, text: '#FFFFFF' }
        : { bg: colors.background.surface, border: colors.border.default, text: colors.text.secondary };
    }

    if (variant === 'runner') {
      return selected
        ? { bg: colors.runner.primary, border: colors.runner.primary, text: '#FFFFFF' }
        : { bg: colors.background.surface, border: colors.border.default, text: colors.text.secondary };
    }

    if (variant === 'referee') {
      return selected
        ? { bg: colors.referee.primary, border: colors.referee.primary, text: '#FFFFFF' }
        : { bg: colors.background.surface, border: colors.border.default, text: colors.text.secondary };
    }

    return selected
      ? { bg: colors.text.primary, border: colors.text.primary, text: '#FFFFFF' }
      : { bg: colors.background.surface, border: colors.border.default, text: colors.text.secondary };
  };

  const scheme = getColors();

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      disabled={disabled || !onPress}
      style={[
        styles.base,
        {
          backgroundColor: scheme.bg,
          borderColor: scheme.border,
        },
        disabled && styles.disabled,
        style,
      ]}
    >
      {icon}
      <Text
        style={[
          styles.text,
          {
            color: scheme.text,
            marginLeft: icon ? 6 : 0,
          },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  text: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
});
