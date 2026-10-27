import React from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/theme/tokens';

interface SettingRowProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
  showChevron?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  destructive?: boolean;
  borderBottom?: boolean;
}

export const SettingRow: React.FC<SettingRowProps> = ({
  title,
  description,
  icon,
  rightElement,
  showChevron = false,
  onPress,
  style,
  destructive = false,
  borderBottom = true,
}) => {
  const content = (
    <View
      style={[
        styles.row,
        borderBottom && styles.borderBottom,
        style,
      ]}
    >
      {icon ? <View style={styles.iconContainer}>{icon}</View> : null}
      <View style={styles.textContainer}>
        <Text
          style={[
            styles.title,
            destructive && styles.destructiveTitle,
          ]}
        >
          {title}
        </Text>
        {description ? (
          <Text style={styles.description}>{description}</Text>
        ) : null}
      </View>
      <View style={styles.rightContainer}>
        {rightElement}
        {showChevron && (
          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.text.muted}
            style={styles.chevron}
          />
        )}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
        style={styles.pressable}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  pressable: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background.surface,
  },
  borderBottom: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.default,
  },
  iconContainer: {
    marginRight: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: typography.fontSize.base,
    fontWeight: '600',
    color: colors.text.primary,
  },
  destructiveTitle: {
    color: colors.status.danger,
  },
  description: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    marginTop: 2,
    lineHeight: 16,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  chevron: {
    marginLeft: 6,
  },
});
