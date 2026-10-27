import React from 'react';
import { Image, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '@/theme/tokens';

interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  style?: ViewStyle;
  borderRole?: 'chaser' | 'runner' | 'referee';
}

const SIZES = {
  xs: 28,
  sm: 36,
  md: 48,
  lg: 64,
  xl: 88,
};

export const Avatar: React.FC<AvatarProps> = ({
  uri,
  name,
  size = 'md',
  style,
  borderRole,
}) => {
  const pixelSize = SIZES[size] || 48;
  const borderRadius = pixelSize / 2;

  const getInitials = (str?: string) => {
    if (!str) return '';
    const parts = str.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return str.slice(0, 2).toUpperCase();
  };

  const getBorderColor = () => {
    if (borderRole === 'chaser') return colors.hunter.primary;
    if (borderRole === 'runner') return colors.runner.primary;
    if (borderRole === 'referee') return colors.referee.primary;
    return colors.border.default;
  };

  const containerStyle: ViewStyle = {
    width: pixelSize,
    height: pixelSize,
    borderRadius,
    borderWidth: borderRole ? 2.5 : 1,
    borderColor: getBorderColor(),
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  };

  if (uri) {
    return (
      <View style={[containerStyle, style]}>
        <Image
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      </View>
    );
  }

  const initials = getInitials(name);

  return (
    <View style={[containerStyle, style]}>
      {initials ? (
        <Text
          style={[
            styles.initials,
            {
              fontSize: pixelSize * 0.38,
            },
          ]}
        >
          {initials}
        </Text>
      ) : (
        <Ionicons
          name="person"
          size={pixelSize * 0.5}
          color={colors.text.muted}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  initials: {
    fontWeight: '700',
    color: colors.text.secondary,
    fontFamily: typography.fontFamily.semiBold,
  },
});
