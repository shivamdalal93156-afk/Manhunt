import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '@/theme/tokens';

interface GradientViewProps {
  children?: React.ReactNode;
  colors?: readonly string[] | string[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  style?: ViewStyle | ViewStyle[];
  borderRadius?: number;
}

export const GradientView: React.FC<GradientViewProps> = ({
  children,
  colors: gradientColors = colors.brand.gradient,
  start = { x: 0, y: 0 },
  end = { x: 1, y: 0 },
  style,
  borderRadius = 0,
}) => {
  const gradientId = React.useId ? React.useId() : `grad-${Math.random()}`;

  return (
    <View style={[styles.container, { borderRadius }, style]}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius, overflow: 'hidden' }]}>
        <Svg
          width="100%"
          height="100%"
          preserveAspectRatio="none"
        >
          <Defs>
            <SvgGradient
              id={gradientId}
              x1={`${start.x * 100}%`}
              y1={`${start.y * 100}%`}
              x2={`${end.x * 100}%`}
              y2={`${end.y * 100}%`}
            >
              {gradientColors.map((color, index) => {
                const offset =
                  gradientColors.length > 1
                    ? `${(index / (gradientColors.length - 1)) * 100}%`
                    : '0%';
                return <Stop key={index} offset={offset} stopColor={color} />;
              })}
            </SvgGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${gradientId})`} rx={borderRadius} ry={borderRadius} />
        </Svg>
      </View>
      <View style={styles.contentWrapper}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    zIndex: 1,
  },
});
