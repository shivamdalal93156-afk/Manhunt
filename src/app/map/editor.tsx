import React, { useState } from 'react';
import {
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, Button, Card } from '@/components/ui';
import { useLocation } from '@/hooks/useLocation';
import { borderRadius, colors, spacing, typography } from '@/theme/tokens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAP_CANVAS_SIZE = Math.min(SCREEN_WIDTH - spacing.lg * 2, 330);

export default function PlayZoneEditorScreen() {
  const router = useRouter();
  const { currentLocation } = useLocation();
  const [zoneRadius, setZoneRadius] = useState(500);
  const [zoneType, setZoneType] = useState<'circle' | 'polygon'>('circle');

  const centerLat = currentLocation?.latitude ?? 37.7749;
  const centerLng = currentLocation?.longitude ?? -122.4194;

  const handleSave = () => {
    Alert.alert(
      'PLAY ZONE SAVED',
      `Play zone set to ${zoneRadius}m radius centered around current GPS fix.`,
      [{ text: 'Confirm', onPress: () => router.back() }]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>TACTICAL GEOFENCE CONFIGURATOR</Text>
          <Text style={styles.title}>PLAY ZONE EDITOR</Text>
        </View>

        {/* Interactive Zone Canvas Visualizer */}
        <View style={[styles.canvasContainer, { width: MAP_CANVAS_SIZE, height: MAP_CANVAS_SIZE }]}>
          {/* Radial Grid lines */}
          <View style={[styles.gridCircle, { width: MAP_CANVAS_SIZE * 0.4, height: MAP_CANVAS_SIZE * 0.4 }]} />
          <View style={[styles.gridCircle, { width: MAP_CANVAS_SIZE * 0.7, height: MAP_CANVAS_SIZE * 0.7 }]} />
          <View
            style={[
              styles.activeBoundaryRing,
              {
                width: (MAP_CANVAS_SIZE - 40) * (zoneRadius / 1500),
                height: (MAP_CANVAS_SIZE - 40) * (zoneRadius / 1500),
              },
            ]}
          />

          {/* Center GPS Pin */}
          <View style={styles.centerPin}>
            <View style={styles.pinDot} />
            <Text style={styles.pinLabel}>GEOFENCE CENTER</Text>
          </View>
        </View>

        {/* Center GPS Telemetry */}
        <Card style={styles.telemetryCard}>
          <View style={styles.telemetryRow}>
            <Text style={styles.telemetryLabel}>GEOFENCE ORIGIN:</Text>
            <Text style={styles.telemetryVal}>
              {centerLat.toFixed(5)}, {centerLng.toFixed(5)}
            </Text>
          </View>
          <View style={styles.telemetryRow}>
            <Text style={styles.telemetryLabel}>ZONE RADIUS:</Text>
            <Text style={styles.telemetryVal}>{zoneRadius} METERS</Text>
          </View>
        </Card>

        {/* Radius Preset Selectors */}
        <Text style={styles.sectionTitle}>ZONE RADIUS PRESETS</Text>
        <View style={styles.presetRow}>
          {[300, 500, 750, 1000, 1500].map((radius) => (
            <TouchableOpacity
              key={radius}
              style={[
                styles.presetPill,
                zoneRadius === radius && styles.presetPillActive,
              ]}
              onPress={() => setZoneRadius(radius)}
            >
              <Text
                style={[
                  styles.presetText,
                  zoneRadius === radius && styles.presetTextActive,
                ]}
              >
                {radius}m
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Safety & Hazard Warning */}
        <Card variant="runner" style={styles.hazardCard}>
          <Text style={styles.hazardTitle}>⚠️ SAFETY & BOUNDARY NOTICE</Text>
          <Text style={styles.hazardText}>
            Ensure the play area does not cross busy roads, railway tracks, bodies of water, or private property. Players must remain aware of their physical surroundings at all times.
          </Text>
        </Card>

        {/* Save Button */}
        <Button
          title="CONFIRM PLAY ZONE"
          variant="hunter"
          size="lg"
          fullWidth
          onPress={handleSave}
          style={styles.saveBtn}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background.base,
  },
  container: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  header: {
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
  },
  eyebrow: {
    color: colors.hunter.primary,
    fontSize: typography.fontSize.xs,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  title: {
    color: colors.text.primary,
    fontSize: typography.fontSize.xxl,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  canvasContainer: {
    backgroundColor: '#07090D',
    borderRadius: borderRadius.md,
    borderColor: colors.border.active,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.md,
    position: 'relative',
    overflow: 'hidden',
  },
  gridCircle: {
    position: 'absolute',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  activeBoundaryRing: {
    position: 'absolute',
    borderRadius: 9999,
    borderWidth: 2,
    borderColor: colors.hunter.primary,
    backgroundColor: 'rgba(0, 240, 255, 0.05)',
  },
  centerPin: {
    alignItems: 'center',
    zIndex: 10,
  },
  pinDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.hunter.primary,
  },
  pinLabel: {
    color: colors.hunter.primary,
    fontSize: 9,
    fontWeight: '800',
    marginTop: 4,
    backgroundColor: 'rgba(11, 14, 20, 0.85)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  telemetryCard: {
    width: '100%',
    marginVertical: spacing.xs,
  },
  telemetryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  telemetryLabel: {
    color: colors.text.muted,
    fontSize: typography.fontSize.xs,
  },
  telemetryVal: {
    color: colors.text.primary,
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
  },
  sectionTitle: {
    alignSelf: 'flex-start',
    color: colors.text.secondary,
    fontSize: typography.fontSize.xs,
    letterSpacing: typography.letterSpacing.wide,
    fontWeight: '700',
    marginTop: spacing.md,
    marginBottom: spacing.xs + 2,
  },
  presetRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  presetPill: {
    flex: 1,
    marginHorizontal: 2,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.surface,
    borderColor: colors.border.subtle,
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
  },
  presetPillActive: {
    borderColor: colors.hunter.primary,
    backgroundColor: 'rgba(0, 240, 255, 0.15)',
  },
  presetText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
  },
  presetTextActive: {
    color: colors.hunter.primary,
  },
  hazardCard: {
    width: '100%',
    marginVertical: spacing.sm,
    borderColor: colors.status.warning,
  },
  hazardTitle: {
    color: colors.status.warning,
    fontWeight: '800',
    fontSize: typography.fontSize.xs,
    letterSpacing: 1,
  },
  hazardText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.xs,
    lineHeight: 18,
    marginTop: 4,
  },
  saveBtn: {
    marginTop: spacing.md,
  },
});
