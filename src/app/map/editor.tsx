import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button, Card, Screen, SegmentedControl, TopBar } from '@/components/ui';
import {
  PlusIcon,
  UndoIcon,
  TrashIcon,
  TargetIcon,
  ShapesIcon,
  PowerIcon,
} from '@/components/ui/Icons';
import { LivePlayZoneMap } from '@/components/game/LivePlayZoneMap';
import { useLocation } from '@/hooks/useLocation';
import {
  calculatePolygonArea,
  isPolygonSelfIntersecting,
} from '@/lib/geo/geofence';
import { lobbyService } from '@/services/lobby/lobbyService';
import { useLobbyStore } from '@/store/lobbyStore';
import { PlayZoneSettings } from '@/types/lobby';
import { borderRadius, colors, shadows, spacing, typography } from '@/theme/tokens';

// Presets (25km removed per user request)
const RADIUS_PRESETS = [
  { label: '300m', meters: 300 },
  { label: '500m', meters: 500 },
  { label: '1km', meters: 1000 },
  { label: '2.5km', meters: 2500 },
  { label: '5km', meters: 5000 },
];

export default function PlayZoneEditorScreen() {
  const router = useRouter();
  const { currentLocation, refreshLocation } = useLocation();
  const { lobbyState } = useLobbyStore();

  // Mode: OFF | CIRCLE | CUSTOM (Polygon)
  const [editorMode, setEditorMode] = useState<'NONE' | 'CIRCLE' | 'POLYGON'>('CIRCLE');

  // Circle state
  const [circleRadius, setCircleRadius] = useState(500);
  const [isCustomRadius, setIsCustomRadius] = useState(false);
  const [customRadiusText, setCustomRadiusText] = useState('500');
  const [customRadiusUnit, setCustomRadiusUnit] = useState<'m' | 'km'>('m');
  const [circleCenter, setCircleCenter] = useState<{ latitude: number; longitude: number } | null>(null);

  // Polygon state
  const [polygonPoints, setPolygonPoints] = useState<{ latitude: number; longitude: number }[]>([]);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    refreshLocation();
    loadExistingPlayZone();
  }, []);

  const loadExistingPlayZone = async () => {
    // 1. Check if active lobby has playZone
    if (lobbyState?.playZone) {
      const pz = lobbyState.playZone;
      if (pz.mode === 'NONE') {
        setEditorMode('NONE');
        return;
      }
      if (pz.type === 'polygon' && pz.coordinates) {
        setEditorMode('POLYGON');
        setPolygonPoints(pz.coordinates);
        return;
      }
      if (pz.type === 'circle') {
        setEditorMode('CIRCLE');
        if (pz.radiusMeters) {
          setCircleRadius(pz.radiusMeters);
          if (pz.radiusMeters >= 1000) {
            setCustomRadiusText((pz.radiusMeters / 1000).toString());
            setCustomRadiusUnit('km');
          } else {
            setCustomRadiusText(pz.radiusMeters.toString());
            setCustomRadiusUnit('m');
          }
        }
        if (pz.center) {
          setCircleCenter(
            Array.isArray(pz.center)
              ? { latitude: pz.center[1], longitude: pz.center[0] }
              : pz.center
          );
        }
        return;
      }
    }

    // 2. Check AsyncStorage
    try {
      const stored = await AsyncStorage.getItem('@manhunt/configured_playzone');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.mode === 'NONE') {
          setEditorMode('NONE');
        } else if (parsed.type === 'polygon' && parsed.coordinates) {
          setEditorMode('POLYGON');
          setPolygonPoints(parsed.coordinates);
        } else {
          setEditorMode('CIRCLE');
          const r = parsed.zoneRadius || parsed.radiusMeters;
          if (r) {
            setCircleRadius(r);
            if (r >= 1000) {
              setCustomRadiusText((r / 1000).toString());
              setCustomRadiusUnit('km');
            } else {
              setCustomRadiusText(r.toString());
              setCustomRadiusUnit('m');
            }
          }
          if (parsed.customCenter) setCircleCenter(parsed.customCenter);
        }
      }
    } catch {
      // non-fatal
    }
  };

  const handleCustomRadiusChange = (text: string, unit: 'm' | 'km' = customRadiusUnit) => {
    setCustomRadiusText(text);
    const num = parseFloat(text);
    if (!isNaN(num) && num > 0) {
      const meters = unit === 'km' ? num * 1000 : num;
      if (meters >= 5 && meters <= 400000) {
        setCircleRadius(meters);
        setErrorMessage(null);
      } else {
        setErrorMessage('Custom radius must be between 5m and 400km.');
      }
    }
  };

  const handleToggleUnit = (unit: 'm' | 'km') => {
    setCustomRadiusUnit(unit);
    handleCustomRadiusChange(customRadiusText, unit);
  };

  const effectiveCenter =
    circleCenter || {
      latitude: currentLocation?.latitude ?? 28.6139,
      longitude: currentLocation?.longitude ?? 77.2090,
    };

  // Add Point for Polygon
  const handleAddPolygonPoint = () => {
    if (polygonPoints.length >= 12) {
      Alert.alert('Maximum Limit', 'A custom play zone can have up to 12 vertices.');
      return;
    }

    // Offset new vertex slightly from center or last vertex
    const base =
      polygonPoints.length > 0
        ? polygonPoints[polygonPoints.length - 1]
        : effectiveCenter;

    const angle = (polygonPoints.length * 60 * Math.PI) / 180;
    const offsetLat = Math.sin(angle) * 0.003;
    const offsetLng = Math.cos(angle) * 0.003;

    const newPt = {
      latitude: base.latitude + offsetLat,
      longitude: base.longitude + offsetLng,
    };

    setPolygonPoints([...polygonPoints, newPt]);
  };

  const handleUndoPoint = () => {
    if (polygonPoints.length > 0) {
      setPolygonPoints(polygonPoints.slice(0, -1));
    }
  };

  const handleClearPoints = () => {
    setPolygonPoints([]);
  };

  const isIntersecting =
    editorMode === 'POLYGON' && isPolygonSelfIntersecting(polygonPoints);
  const polygonArea =
    editorMode === 'POLYGON' ? calculatePolygonArea(polygonPoints) : 0;

  const formatArea = (sqMeters: number) => {
    if (sqMeters >= 1000000) {
      return `${(sqMeters / 1000000).toFixed(2)} km²`;
    }
    return `${Math.round(sqMeters)} m²`;
  };

  const handleSavePlayZone = async () => {
    if (editorMode === 'POLYGON') {
      if (polygonPoints.length < 3) {
        Alert.alert('Incomplete Polygon', 'A custom play zone requires at least 3 vertices.');
        return;
      }
      if (isIntersecting) {
        Alert.alert('Invalid Boundary', 'Polygon edges cannot cross each other.');
        return;
      }
    }

    setIsSaving(true);
    try {
      let playZonePayload: PlayZoneSettings;

      if (editorMode === 'NONE') {
        playZonePayload = {
          type: 'circle',
          radiusMeters: 9999999,
          mode: 'NONE',
        };
      } else if (editorMode === 'POLYGON') {
        playZonePayload = {
          type: 'polygon',
          coordinates: polygonPoints,
          mode: 'POLYGON',
        };
      } else {
        playZonePayload = {
          type: 'circle',
          center: effectiveCenter,
          radiusMeters: circleRadius,
          mode: 'CIRCLE',
        };
      }

      // 1. Save locally
      await AsyncStorage.setItem(
        '@manhunt/configured_playzone',
        JSON.stringify({
          ...playZonePayload,
          zoneRadius: circleRadius,
          customCenter: effectiveCenter,
        })
      );

      // 2. Update active game if in lobby
      if (lobbyState?.gameId) {
        await lobbyService.updateGameSettings(lobbyState.gameId, {}, playZonePayload);
      }

      router.back();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save play zone.';
      Alert.alert('Error', msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Screen edges={['top', 'left', 'right']}>
      {/* Top Header */}
      <TopBar
        title="PLAY ZONE EDITOR"
        onBack={() => router.back()}
        rightSlot={
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleSavePlayZone}
            disabled={isSaving}
            style={styles.saveBtn}
          >
            <Text style={styles.saveBtnText}>
              {isSaving ? 'SAVING...' : 'SAVE'}
            </Text>
          </TouchableOpacity>
        }
      />

      <View style={styles.container}>
        {/* Top Badges / Feedback */}
        {editorMode === 'POLYGON' && (
          <View style={styles.topBadgesRow}>
            <View style={styles.badgePill}>
              <Ionicons name="shapes-outline" size={14} color={colors.text.primary} />
              <Text style={styles.badgePillText}>{polygonPoints.length} / 12 Points</Text>
            </View>

            {polygonPoints.length >= 3 && (
              <View style={styles.badgePill}>
                <Ionicons name="expand-outline" size={14} color={colors.text.primary} />
                <Text style={styles.badgePillText}>{formatArea(polygonArea)}</Text>
              </View>
            )}

            {isIntersecting && (
              <View style={[styles.badgePill, styles.errorPill]}>
                <Ionicons name="warning" size={14} color="#DC2626" />
                <Text style={styles.errorPillText}>Edges Cross</Text>
              </View>
            )}
          </View>
        )}

        {editorMode === 'NONE' && (
          <View style={styles.offBanner}>
            <Ionicons name="globe-outline" size={18} color={colors.text.primary} />
            <Text style={styles.offBannerText}>
              Perimeter is OFF. Operatives have boundless play area.
            </Text>
          </View>
        )}

        {/* Map Area */}
        <View style={styles.mapWrapper}>
          <LivePlayZoneMap
            currentLocation={currentLocation}
            zoneRadius={circleRadius}
            fullScreen
            customCenter={effectiveCenter}
            onSelectCenter={(coords) => {
              if (editorMode === 'CIRCLE') {
                setCircleCenter(coords);
              } else if (editorMode === 'POLYGON' && polygonPoints.length < 12) {
                setPolygonPoints([...polygonPoints, coords]);
              }
            }}
            allowTapToSelectCenter={editorMode !== 'NONE'}
            zoneMode={editorMode}
            polygonVertices={polygonPoints}
          />

          {/* Floating Polygon Tools matching Screenshot 5 */}
          {editorMode === 'POLYGON' && (
            <View style={styles.floatingToolsCard}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleAddPolygonPoint}
                style={styles.floatingActionIconBtn}
              >
                <View style={styles.addIconCircle}>
                  <PlusIcon size={18} color="#FFFFFF" />
                </View>
                <Text style={styles.floatingToolLabel}>Add</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleUndoPoint}
                disabled={polygonPoints.length === 0}
                style={[
                  styles.floatingActionIconBtn,
                  polygonPoints.length === 0 && styles.floatingBtnDisabled,
                ]}
              >
                <View style={styles.actionIconCircle}>
                  <UndoIcon size={16} color={polygonPoints.length === 0 ? '#9CA3AF' : '#1F2937'} />
                </View>
                <Text style={[styles.floatingToolLabel, polygonPoints.length === 0 && styles.labelDisabled]}>Undo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleClearPoints}
                disabled={polygonPoints.length === 0}
                style={[
                  styles.floatingActionIconBtn,
                  polygonPoints.length === 0 && styles.floatingBtnDisabled,
                ]}
              >
                <View style={styles.actionIconCircle}>
                  <TrashIcon size={16} color={polygonPoints.length === 0 ? '#9CA3AF' : colors.status.danger} />
                </View>
                <Text style={[styles.floatingToolLabel, { color: polygonPoints.length === 0 ? '#9CA3AF' : colors.status.danger }]}>Clear</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Bottom Card Area matching Screenshot 5 */}
        <View style={styles.bottomCardArea}>
          {/* Segmented Mode Selector: Off | Circle | Custom */}
          <View style={styles.zoneTypeTabs}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                setEditorMode('NONE');
                setErrorMessage(null);
              }}
              style={[
                styles.zoneTypeTab,
                editorMode === 'NONE' && styles.zoneTypeTabActive,
              ]}
            >
              <PowerIcon
                size={16}
                color={editorMode === 'NONE' ? colors.brand.accent : colors.text.muted}
              />
              <Text
                style={[
                  styles.zoneTypeTabText,
                  editorMode === 'NONE' && styles.zoneTypeTabTextActive,
                ]}
              >
                Off
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                setEditorMode('CIRCLE');
                setErrorMessage(null);
              }}
              style={[
                styles.zoneTypeTab,
                editorMode === 'CIRCLE' && styles.zoneTypeTabActive,
              ]}
            >
              <TargetIcon
                size={16}
                color={editorMode === 'CIRCLE' ? colors.brand.accent : colors.text.muted}
              />
              <Text
                style={[
                  styles.zoneTypeTabText,
                  editorMode === 'CIRCLE' && styles.zoneTypeTabTextActive,
                ]}
              >
                Circle
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                setEditorMode('POLYGON');
                setErrorMessage(null);
              }}
              style={[
                styles.zoneTypeTab,
                editorMode === 'POLYGON' && styles.zoneTypeTabActive,
              ]}
            >
              <ShapesIcon
                size={16}
                color={editorMode === 'POLYGON' ? colors.brand.accent : colors.text.muted}
              />
              <Text
                style={[
                  styles.zoneTypeTabText,
                  editorMode === 'POLYGON' && styles.zoneTypeTabTextActive,
                ]}
              >
                Custom
              </Text>
            </TouchableOpacity>
          </View>

          {/* Circle Mode: Presets + Custom Radius with 5m - 400km limit */}
          {editorMode === 'CIRCLE' && (
            <View style={styles.radiusControlContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.radiusScroll}
              >
                {RADIUS_PRESETS.map((preset) => {
                  const isSelected = !isCustomRadius && circleRadius === preset.meters;
                  return (
                    <TouchableOpacity
                      key={preset.meters}
                      activeOpacity={0.8}
                      onPress={() => {
                        setCircleRadius(preset.meters);
                        setIsCustomRadius(false);
                        setErrorMessage(null);
                      }}
                      style={[
                        styles.radiusPill,
                        isSelected && styles.radiusPillSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.radiusPillText,
                          isSelected && styles.radiusPillTextSelected,
                        ]}
                      >
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    setIsCustomRadius(true);
                    handleCustomRadiusChange(customRadiusText, customRadiusUnit);
                  }}
                  style={[
                    styles.radiusPill,
                    isCustomRadius && styles.radiusPillSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.radiusPillText,
                      isCustomRadius && styles.radiusPillTextSelected,
                    ]}
                  >
                    Custom Radius
                  </Text>
                </TouchableOpacity>
              </ScrollView>

              {/* Custom Radius Input Row (5m to 400km) */}
              {isCustomRadius && (
                <View style={styles.customRadiusRow}>
                  <Text style={styles.customRadiusPrompt}>Limit: 5m to 400km</Text>
                  <View style={styles.customRadiusInputGroup}>
                    <TextInput
                      style={styles.customRadiusNumberInput}
                      keyboardType="decimal-pad"
                      value={customRadiusText}
                      onChangeText={(t) => handleCustomRadiusChange(t, customRadiusUnit)}
                      placeholder="e.g. 500"
                    />
                    <View style={styles.unitToggleGroup}>
                      <TouchableOpacity
                        style={[styles.unitBtn, customRadiusUnit === 'm' && styles.unitBtnActive]}
                        onPress={() => handleToggleUnit('m')}
                      >
                        <Text style={[styles.unitBtnText, customRadiusUnit === 'm' && styles.unitBtnTextActive]}>
                          m
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.unitBtn, customRadiusUnit === 'km' && styles.unitBtnActive]}
                        onPress={() => handleToggleUnit('km')}
                      >
                        <Text style={[styles.unitBtnText, customRadiusUnit === 'km' && styles.unitBtnTextActive]}>
                          km
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Polygon Mode Metrics: POINTS & AREA Cards (Exact match to Screenshot 5) */}
          {editorMode === 'POLYGON' && (
            <View style={styles.metricsRow}>
              <View style={styles.metricCard}>
                <Text style={styles.metricHeader}>POINTS</Text>
                <Text style={styles.metricValue}>{polygonPoints.length}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricHeader}>AREA</Text>
                <Text style={styles.metricValue}>{formatArea(polygonArea)}</Text>
              </View>
            </View>
          )}

          {errorMessage && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={colors.status.danger} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Gradient Action Button (Exact match to Screenshot 5) */}
          <View style={styles.applyBtnWrapper}>
            <Button
              title={isSaving ? 'SAVING...' : 'Apply'}
              variant="gradient"
              size="lg"
              fullWidth
              loading={isSaving}
              disabled={isSaving}
              onPress={handleSavePlayZone}
            />
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    backgroundColor: colors.background.base,
  },
  saveBtn: {
    backgroundColor: colors.brand.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
  },
  saveBtnText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  topBadgesRow: {
    position: 'absolute',
    top: 12,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    gap: 8,
    zIndex: 20,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
    ...shadows.sm,
  },
  badgePillText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: colors.text.primary,
  },
  errorPill: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  errorPillText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: '#DC2626',
  },
  offBanner: {
    position: 'absolute',
    top: 12,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: 8,
    zIndex: 20,
    ...shadows.sm,
  },
  offBannerText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: colors.text.primary,
    flex: 1,
  },
  mapWrapper: {
    flex: 1,
    position: 'relative',
  },
  floatingToolsCard: {
    position: 'absolute',
    top: '34%',
    right: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 6,
    gap: 8,
    alignItems: 'center',
    zIndex: 30,
    ...shadows.lg,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  floatingActionIconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  addIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.brand.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.brand.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  actionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingToolLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#374151',
    marginTop: 2,
  },
  labelDisabled: {
    color: '#9CA3AF',
  },
  floatingBtnDisabled: {
    opacity: 0.35,
  },
  bottomCardArea: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    ...shadows.lg,
  },
  zoneTypeTabs: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    padding: 4,
    marginBottom: spacing.md,
  },
  zoneTypeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  zoneTypeTabActive: {
    backgroundColor: '#FFFFFF',
    ...shadows.sm,
  },
  zoneTypeTabText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  zoneTypeTabTextActive: {
    color: colors.brand.accent,
    fontWeight: '800',
  },
  radiusControlContainer: {
    marginBottom: spacing.md,
  },
  radiusScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  radiusPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  radiusPillSelected: {
    backgroundColor: colors.brand.accent,
    borderColor: colors.brand.accent,
  },
  radiusPillText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  radiusPillTextSelected: {
    color: '#FFFFFF',
  },
  customRadiusRow: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  customRadiusPrompt: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    marginBottom: 6,
    fontWeight: '600',
  },
  customRadiusInputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customRadiusNumberInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    color: colors.text.primary,
  },
  unitToggleGroup: {
    flexDirection: 'row',
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
    padding: 2,
  },
  unitBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  unitBtnActive: {
    backgroundColor: '#FFFFFF',
    ...shadows.sm,
  },
  unitBtnText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: colors.text.muted,
  },
  unitBtnTextActive: {
    color: colors.brand.accent,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  metricHeader: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: colors.text.muted,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.brand.accent,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    marginBottom: spacing.sm,
  },
  errorText: {
    fontSize: typography.fontSize.xs,
    color: colors.status.danger,
    fontWeight: '600',
  },
  applyBtnWrapper: {
    marginTop: 4,
  },
});
