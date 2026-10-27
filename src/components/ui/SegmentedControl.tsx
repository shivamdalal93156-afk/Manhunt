import React from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { borderRadius, colors, spacing, typography } from '@/theme/tokens';

export interface SegmentOption<T extends string = string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

interface SegmentedControlProps<T extends string = string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
  activeBgColor?: string;
  activeTextColor?: string;
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  style,
  activeBgColor = colors.background.surface,
  activeTextColor = colors.text.primary,
}: SegmentedControlProps<T>) {
  return (
    <View style={[styles.container, style]}>
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            activeOpacity={0.8}
            onPress={() => onChange(option.value)}
            style={[
              styles.segment,
              isSelected && [
                styles.selectedSegment,
                { backgroundColor: activeBgColor },
              ],
            ]}
          >
            {option.icon ? (
              <View style={styles.iconWrapper}>{option.icon}</View>
            ) : null}
            <Text
              style={[
                styles.label,
                isSelected
                  ? [styles.selectedLabel, { color: activeTextColor }]
                  : styles.unselectedLabel,
              ]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#EBECEF',
    borderRadius: borderRadius.full,
    padding: 3,
    alignItems: 'center',
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: borderRadius.full,
  },
  selectedSegment: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  iconWrapper: {
    marginRight: 6,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
  },
  selectedLabel: {
    fontWeight: '700',
  },
  unselectedLabel: {
    color: colors.text.muted,
  },
});
