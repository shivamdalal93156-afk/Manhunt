import React from 'react';
import { Platform, Switch } from 'react-native';
import { colors } from '@/theme/tokens';

interface ToggleProps {
  value: boolean;
  onValueChange: (val: boolean) => void;
  disabled?: boolean;
  activeColor?: string;
}

export const Toggle: React.FC<ToggleProps> = ({
  value,
  onValueChange,
  disabled = false,
  activeColor = colors.brand.accent,
}) => {
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{
        false: '#E5E7EB',
        true: activeColor,
      }}
      thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
      ios_backgroundColor="#E5E7EB"
    />
  );
};
