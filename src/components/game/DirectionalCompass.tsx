import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ThreatTelemetry } from '@/types/game';
import { borderRadius, colors, spacing, typography } from '@/theme/tokens';

interface DirectionalCompassProps {
  telemetry: ThreatTelemetry;
  deviceHeading?: number | null;
}

export const DirectionalCompass: React.FC<DirectionalCompassProps> = ({
  telemetry,
  deviceHeading,
}) => {
  const { nearestHunterDistanceMeters, relativeBearingDegrees, threatLevel } = telemetry;

  const getThreatColor = () => {
    switch (threatLevel) {
      case 'DANGER':
        return colors.status.danger;
      case 'WARNING':
        return colors.status.warning;
      case 'SAFE':
        return colors.status.safe;
      default:
        return colors.hunter.primary;
    }
  };

  const threatColor = getThreatColor();
  const rotationAngle = relativeBearingDegrees ?? 0;

  return (
    <View style={styles.container}>
      {/* Outer Tactical Dial */}
      <View style={[styles.outerDial, { borderColor: threatColor }]}>
        <Text style={styles.dialNorth}>N</Text>
        <Text style={styles.dialEast}>E</Text>
        <Text style={styles.dialSouth}>S</Text>
        <Text style={styles.dialWest}>W</Text>

        {/* Directional Target Arrow Needle */}
        {relativeBearingDegrees !== null && (
          <View
            style={[
              styles.needleContainer,
              { transform: [{ rotate: `${rotationAngle}deg` }] },
            ]}
          >
            <View style={[styles.arrowHead, { borderBottomColor: threatColor }]} />
            <View style={[styles.needleLine, { backgroundColor: threatColor }]} />
          </View>
        )}

        {/* Center Threat Display */}
        <View style={styles.centerHub}>
          {nearestHunterDistanceMeters !== null ? (
            <>
              <Text style={[styles.distanceVal, { color: threatColor }]}>
                {Math.round(nearestHunterDistanceMeters)}
              </Text>
              <Text style={styles.distanceUnit}>METERS</Text>
              <Text style={[styles.threatBadge, { color: threatColor }]}>
                {threatLevel}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.clearText}>RADAR</Text>
              <Text style={styles.clearSub}>CLEAR</Text>
            </>
          )}
        </View>
      </View>

      {/* Sensor Diagnostic Info */}
      <View style={styles.sensorRow}>
        <Text style={styles.sensorText}>
          HEADING: {deviceHeading !== null && deviceHeading !== undefined ? `${Math.round(deviceHeading)}°` : 'UNCALIBRATED'}
        </Text>
        <Text style={styles.sensorText}>
          TARGET BEARING: {relativeBearingDegrees !== null ? `${Math.round(relativeBearingDegrees)}° REL` : 'NONE'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.lg,
  },
  outerDial: {
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 2,
    backgroundColor: 'rgba(20, 26, 35, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  dialNorth: {
    position: 'absolute',
    top: 8,
    color: colors.hunter.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  dialEast: {
    position: 'absolute',
    right: 12,
    color: colors.text.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  dialSouth: {
    position: 'absolute',
    bottom: 8,
    color: colors.text.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  dialWest: {
    position: 'absolute',
    left: 12,
    color: colors.text.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  needleContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  arrowHead: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 24,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: 20,
  },
  needleLine: {
    width: 3,
    height: 35,
    borderRadius: 2,
  },
  centerHub: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.background.base,
    borderColor: colors.border.subtle,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  distanceVal: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 1,
  },
  distanceUnit: {
    fontSize: 9,
    color: colors.text.muted,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  threatBadge: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  clearText: {
    color: colors.status.safe,
    fontSize: typography.fontSize.base,
    fontWeight: '800',
    letterSpacing: 2,
  },
  clearSub: {
    color: colors.text.muted,
    fontSize: 10,
    letterSpacing: 1,
  },
  sensorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '80%',
    marginTop: spacing.md,
  },
  sensorText: {
    color: colors.text.muted,
    fontSize: 10,
    letterSpacing: 1,
  },
});
