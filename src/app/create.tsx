import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button, Card, Screen, TopBar } from '@/components/ui';
import {
  PlusIcon,
  MinusIcon,
  UndoIcon,
  TrashIcon,
  TargetIcon,
  ShapesIcon,
  PowerIcon,
  TimerIcon,
  FlashIcon,
  CompassIcon,
  ShieldIcon,
  RadarIcon,
  LocateIcon,
  SettingsIcon,
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

const DURATION_PRESETS = [
  { label: '15 minutes', minutes: 15, subtitle: 'Fast sprint skirmish' },
  { label: '30 minutes', minutes: 30, subtitle: 'Recommended standard match' },
  { label: '45 minutes', minutes: 45, subtitle: 'Tactical squad operation' },
  { label: '1 hour', minutes: 60, subtitle: 'Full endurance pursuit' },
  { label: '1 hour 30 minutes', minutes: 90, subtitle: 'Extended urban manhunt' },
  { label: '2 hours', minutes: 120, subtitle: 'Marathon survival challenge' },
];

const INTERVAL_PRESETS = [
  { label: '30 seconds', seconds: 30, subtitle: 'High-frequency radar sweeps' },
  { label: '1 minute', seconds: 60, subtitle: 'Balanced tactical tracking' },
  { label: '2 minutes', seconds: 120, subtitle: 'Stealth runner advantage' },
  { label: '3 minutes', seconds: 180, subtitle: 'Long delay predator hunt' },
  { label: '5 minutes', seconds: 300, subtitle: 'Ghost evasion protocol' },
];

const renderDurationIcon = (minutes: number, isSelected: boolean) => {
  const color = isSelected ? colors.brand.accent : colors.text.secondary;
  switch (minutes) {
    case 15:
      return <FlashIcon size={18} color={color} />;
    case 30:
    case 45:
      return <TimerIcon size={18} color={color} />;
    case 60:
      return <CompassIcon size={18} color={color} />;
    case 90:
      return <ShieldIcon size={18} color={color} />;
    case 120:
      return <RadarIcon size={18} color={color} />;
    default:
      return <SettingsIcon size={18} color={color} />;
  }
};

const renderIntervalIcon = (seconds: number, isSelected: boolean) => {
  const color = isSelected ? colors.brand.accent : colors.text.secondary;
  switch (seconds) {
    case 30:
      return <RadarIcon size={18} color={color} />;
    case 60:
      return <LocateIcon size={18} color={color} />;
    case 120:
      return <TargetIcon size={18} color={color} />;
    case 180:
      return <CompassIcon size={18} color={color} />;
    case 300:
      return <ShieldIcon size={18} color={color} />;
    default:
      return <SettingsIcon size={18} color={color} />;
  }
};

// Presets (25km removed per user request)
const RADIUS_PRESETS = [
  { label: '300m', meters: 300 },
  { label: '500m', meters: 500 },
  { label: '1km', meters: 1000 },
  { label: '2.5km', meters: 2500 },
  { label: '5km', meters: 5000 },
];

export default function CreateMatchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ step?: string; gameId?: string }>();
  const { currentLocation, refreshLocation } = useLocation();
  const { createMatch, lobbyState, isLoading } = useLobbyStore();

  const isEditingFromLobby = Boolean(params.gameId);
  const initialStep = params.step === '3' ? 3 : params.step === '2' ? 2 : 1;
  const [step, setStep] = useState<1 | 2 | 3>(initialStep);

  // Step 1: Duration
  const [selectedDuration, setSelectedDuration] = useState(30);
  const [isCustomDuration, setIsCustomDuration] = useState(false);
  const [customDurationText, setCustomDurationText] = useState('30');

  // Step 2: Location Interval
  const [selectedInterval, setSelectedInterval] = useState(30);
  const [isCustomInterval, setIsCustomInterval] = useState(false);
  const [customIntervalText, setCustomIntervalText] = useState('30');

  // Step 3: Play Zone (Circle vs Polygon Area vs None)
  const [zoneMode, setZoneMode] = useState<'CIRCLE' | 'POLYGON' | 'NONE'>('CIRCLE');
  const [circleRadius, setCircleRadius] = useState(500);
  const [isCustomRadius, setIsCustomRadius] = useState(false);
  const [customRadiusText, setCustomRadiusText] = useState('500');
  const [customRadiusUnit, setCustomRadiusUnit] = useState<'m' | 'km'>('m');

  const [circleCenter, setCircleCenter] = useState<{ latitude: number; longitude: number } | null>(null);
  const [polygonPoints, setPolygonPoints] = useState<{ latitude: number; longitude: number }[]>([]);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    refreshLocation();
    loadDefaultZone();
  }, []);

  const loadDefaultZone = async () => {
    try {
      if (lobbyState?.playZone && isEditingFromLobby) {
        const pz = lobbyState.playZone;
        if (pz.mode === 'NONE') {
          setZoneMode('NONE');
        } else if (pz.type === 'polygon' && pz.coordinates) {
          setZoneMode('POLYGON');
          setPolygonPoints(pz.coordinates);
        } else {
          setZoneMode('CIRCLE');
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
        }
        return;
      }

      const stored = await AsyncStorage.getItem('@manhunt/configured_playzone');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.mode === 'NONE') {
          setZoneMode('NONE');
        } else if (parsed.type === 'polygon' && parsed.coordinates) {
          setZoneMode('POLYGON');
          setPolygonPoints(parsed.coordinates);
        } else if (parsed.radiusMeters || parsed.zoneRadius) {
          setZoneMode('CIRCLE');
          const r = parsed.radiusMeters || parsed.zoneRadius;
          setCircleRadius(r);
          if (r >= 1000) {
            setCustomRadiusText((r / 1000).toString());
            setCustomRadiusUnit('km');
          } else {
            setCustomRadiusText(r.toString());
            setCustomRadiusUnit('m');
          }
          if (parsed.customCenter) setCircleCenter(parsed.customCenter);
        }
      }
    } catch {
      // ignore
    }
  };

  const effectiveCenter =
    circleCenter || {
      latitude: currentLocation?.latitude ?? 28.6139,
      longitude: currentLocation?.longitude ?? 77.2090,
    };

  const isIntersecting =
    zoneMode === 'POLYGON' && isPolygonSelfIntersecting(polygonPoints);
  const polygonArea =
    zoneMode === 'POLYGON' ? calculatePolygonArea(polygonPoints) : 0;

  const formatArea = (sqMeters: number) => {
    if (sqMeters >= 1000000) {
      return `${(sqMeters / 1000000).toFixed(2)} km²`;
    }
    return `${Math.round(sqMeters)} m²`;
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

  const handleNextStep1 = () => {
    setErrorMessage(null);
    let finalDuration = selectedDuration;

    if (isCustomDuration) {
      const parsed = parseInt(customDurationText, 10);
      if (isNaN(parsed) || parsed < 5 || parsed > 720) {
        setErrorMessage('Custom duration must be between 5 and 720 minutes.');
        return;
      }
      finalDuration = parsed;
      setSelectedDuration(parsed);
    }

    setStep(2);
  };

  const handleNextStep2 = () => {
    setErrorMessage(null);
    let finalInterval = selectedInterval;

    if (isCustomInterval) {
      const parsed = parseInt(customIntervalText, 10);
      if (isNaN(parsed) || parsed < 10 || parsed > 3600) {
        setErrorMessage('Custom interval must be between 10 and 3600 seconds.');
        return;
      }
      finalInterval = parsed;
      setSelectedInterval(parsed);
    }

    setStep(3);
  };

  // Floating Polygon Helpers
  const handleAddPolygonPoint = () => {
    if (polygonPoints.length >= 12) {
      Alert.alert('Maximum Limit', 'A custom polygon can have up to 12 points.');
      return;
    }
    const base =
      polygonPoints.length > 0
        ? polygonPoints[polygonPoints.length - 1]
        : effectiveCenter;
    const angle = (polygonPoints.length * 60 * Math.PI) / 180;
    const offsetLat = Math.sin(angle) * 0.003;
    const offsetLng = Math.cos(angle) * 0.003;

    setPolygonPoints([
      ...polygonPoints,
      { latitude: base.latitude + offsetLat, longitude: base.longitude + offsetLng },
    ]);
  };

  const handleUndoPolygonPoint = () => {
    if (polygonPoints.length > 0) {
      setPolygonPoints(polygonPoints.slice(0, -1));
    }
  };

  const handleClearPolygonPoints = () => {
    setPolygonPoints([]);
  };

  const buildPlayZonePayload = (): PlayZoneSettings => {
    if (zoneMode === 'NONE') {
      return {
        type: 'circle',
        radiusMeters: 9999999,
        mode: 'NONE',
      };
    }
    if (zoneMode === 'POLYGON') {
      return {
        type: 'polygon',
        coordinates: polygonPoints,
        mode: 'POLYGON',
      };
    }
    return {
      type: 'circle',
      center: effectiveCenter,
      radiusMeters: circleRadius,
      mode: 'CIRCLE',
    };
  };

  const handleSaveOrLaunchMatch = async () => {
    setErrorMessage(null);

    // Validate polygon
    if (zoneMode === 'POLYGON') {
      if (polygonPoints.length < 3) {
        setErrorMessage('A custom polygon zone requires at least 3 points on the map.');
        return;
      }
      if (isIntersecting) {
        setErrorMessage('Polygon boundary edges cannot cross each other.');
        return;
      }
    }

    // Validate circle custom radius
    if (zoneMode === 'CIRCLE' && isCustomRadius) {
      const num = parseFloat(customRadiusText);
      const meters = customRadiusUnit === 'km' ? num * 1000 : num;
      if (isNaN(num) || meters < 5 || meters > 400000) {
        setErrorMessage('Custom radius must be between 5m and 400km.');
        return;
      }
    }

    const playZonePayload = buildPlayZonePayload();

    // 1. Save configured playzone locally for future quick matches
    try {
      await AsyncStorage.setItem(
        '@manhunt/configured_playzone',
        JSON.stringify({
          ...playZonePayload,
          zoneRadius: circleRadius,
          customCenter: effectiveCenter,
        })
      );
    } catch {
      // non-fatal
    }

    // 2. If editing existing lobby
    if (isEditingFromLobby && params.gameId) {
      setIsSaving(true);
      try {
        await lobbyService.updateGameSettings(params.gameId, {}, playZonePayload);
        router.back();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to update play zone.';
        setErrorMessage(msg);
      } finally {
        setIsSaving(false);
      }
      return;
    }

    // 3. Creating brand new match
    setIsSaving(true);
    try {
      const session = await createMatch({
        durationMinutes: selectedDuration,
        pingIntervalSeconds: selectedInterval,
        zoneRadiusMeters: circleRadius,
        playZone: playZonePayload,
      });

      if (session?.gameId) {
        router.replace(`/lobby/${session.gameId}` as any);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create match.';
      setErrorMessage(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Screen scroll={step !== 3}>
      <TopBar
        title={
          isEditingFromLobby
            ? 'PLAY ZONE & AREA'
            : step === 1
            ? 'GAME DURATION'
            : step === 2
            ? 'UPDATE INTERVAL'
            : 'PLAY ZONE & AREA'
        }
        subtitle={
          isEditingFromLobby
            ? 'MATCH SETTINGS'
            : `STEP ${step} OF 3`
        }
        onBack={() => {
          if (isEditingFromLobby) {
            router.back();
          } else if (step === 3) {
            setStep(2);
          } else if (step === 2) {
            setStep(1);
          } else {
            router.back();
          }
        }}
      />

      <View style={step === 3 ? styles.containerStep3 : styles.container}>
        {/* ================= STEP 1: DURATION ================= */}
        {step === 1 && (
          <>
            <Text style={styles.sectionHeader}>HOW LONG SHOULD THE MATCH LAST?</Text>
            <Text style={styles.sectionSubtitle}>
              Runners must survive until this timer reaches zero.
            </Text>

            <View style={styles.optionsList}>
              {DURATION_PRESETS.map((preset) => {
                const isSelected = !isCustomDuration && selectedDuration === preset.minutes;
                return (
                  <TouchableOpacity
                    key={preset.minutes}
                    activeOpacity={0.8}
                    onPress={() => {
                      setSelectedDuration(preset.minutes);
                      setIsCustomDuration(false);
                      setErrorMessage(null);
                    }}
                    style={[
                      styles.optionCard,
                      isSelected && styles.optionCardSelected,
                    ]}
                  >
                    <View style={styles.optionLeft}>
                      <View style={[styles.iconCircle, isSelected && styles.iconCircleSelected]}>
                        {renderDurationIcon(preset.minutes, isSelected)}
                      </View>
                      <View style={styles.optionTextColumn}>
                        <Text
                          style={[
                            styles.optionLabel,
                            isSelected && styles.optionLabelSelected,
                          ]}
                        >
                          {preset.label}
                        </Text>
                        <Text style={styles.optionSub}>{preset.subtitle}</Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.radioOuter,
                        isSelected && styles.radioOuterSelected,
                      ]}
                    >
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* Custom Duration Row */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  setIsCustomDuration(true);
                  setErrorMessage(null);
                }}
                style={[
                  styles.optionCard,
                  isCustomDuration && styles.optionCardSelected,
                ]}
              >
                <View style={styles.optionLeft}>
                  <View style={[styles.iconCircle, isCustomDuration && styles.iconCircleSelected]}>
                    <SettingsIcon
                      size={18}
                      color={isCustomDuration ? colors.brand.accent : colors.text.secondary}
                    />
                  </View>
                  <View style={styles.customRow}>
                    <Text
                      style={[
                        styles.optionLabel,
                        isCustomDuration && styles.optionLabelSelected,
                      ]}
                    >
                      Custom Duration
                    </Text>
                    {isCustomDuration && (
                      <View style={styles.customInputWrapper}>
                        <TextInput
                          style={styles.customInput}
                          keyboardType="number-pad"
                          value={customDurationText}
                          onChangeText={setCustomDurationText}
                          maxLength={4}
                        />
                        <Text style={styles.unitText}>min</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View
                  style={[
                    styles.radioOuter,
                    isCustomDuration && styles.radioOuterSelected,
                  ]}
                >
                  {isCustomDuration && <View style={styles.radioInner} />}
                </View>
              </TouchableOpacity>
            </View>

            {errorMessage && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={colors.status.danger} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            <View style={styles.bottomBar}>
              <Button
                title="CONTINUE"
                variant="gradient"
                size="lg"
                fullWidth
                onPress={handleNextStep1}
              />
            </View>
          </>
        )}

        {/* ================= STEP 2: LOCATION INTERVAL ================= */}
        {step === 2 && (
          <>
            <Text style={styles.sectionHeader}>LOCATION UPDATE INTERVAL</Text>
            <Text style={styles.sectionSubtitle}>
              How often runners' GPS positions update for chasers on the tactical radar.
            </Text>

            <View style={styles.optionsList}>
              {INTERVAL_PRESETS.map((preset) => {
                const isSelected = !isCustomInterval && selectedInterval === preset.seconds;
                return (
                  <TouchableOpacity
                    key={preset.seconds}
                    activeOpacity={0.8}
                    onPress={() => {
                      setSelectedInterval(preset.seconds);
                      setIsCustomInterval(false);
                      setErrorMessage(null);
                    }}
                    style={[
                      styles.optionCard,
                      isSelected && styles.optionCardSelected,
                    ]}
                  >
                    <View style={styles.optionLeft}>
                      <View style={[styles.iconCircle, isSelected && styles.iconCircleSelected]}>
                        {renderIntervalIcon(preset.seconds, isSelected)}
                      </View>
                      <View style={styles.optionTextColumn}>
                        <Text
                          style={[
                            styles.optionLabel,
                            isSelected && styles.optionLabelSelected,
                          ]}
                        >
                          {preset.label}
                        </Text>
                        <Text style={styles.optionSub}>{preset.subtitle}</Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.radioOuter,
                        isSelected && styles.radioOuterSelected,
                      ]}
                    >
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* Custom Interval Row */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  setIsCustomInterval(true);
                  setErrorMessage(null);
                }}
                style={[
                  styles.optionCard,
                  isCustomInterval && styles.optionCardSelected,
                ]}
              >
                <View style={styles.optionLeft}>
                  <View style={[styles.iconCircle, isCustomInterval && styles.iconCircleSelected]}>
                    <SettingsIcon
                      size={18}
                      color={isCustomInterval ? colors.brand.accent : colors.text.secondary}
                    />
                  </View>
                  <View style={styles.customRow}>
                    <Text
                      style={[
                        styles.optionLabel,
                        isCustomInterval && styles.optionLabelSelected,
                      ]}
                    >
                      Custom Interval
                    </Text>
                    {isCustomInterval && (
                      <View style={styles.customInputWrapper}>
                        <TextInput
                          style={styles.customInput}
                          keyboardType="number-pad"
                          value={customIntervalText}
                          onChangeText={setCustomIntervalText}
                          maxLength={4}
                        />
                        <Text style={styles.unitText}>sec</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View
                  style={[
                    styles.radioOuter,
                    isCustomInterval && styles.radioOuterSelected,
                  ]}
                >
                  {isCustomInterval && <View style={styles.radioInner} />}
                </View>
              </TouchableOpacity>
            </View>

            {errorMessage && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={colors.status.danger} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            <View style={styles.bottomBar}>
              <Button
                title="CONTINUE TO PLAY ZONE"
                variant="gradient"
                size="lg"
                fullWidth
                onPress={handleNextStep2}
              />
            </View>
          </>
        )}

        {/* ================= STEP 3: PLAY ZONE & POLYGON AREA ================= */}
        {step === 3 && (
          <View style={styles.step3Wrapper}>
            {/* Top Selector: Circle Zone vs Draw Polygon Area vs No Boundary */}
            <View style={styles.zoneTypeTabs}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  setZoneMode('NONE');
                  setErrorMessage(null);
                }}
                style={[
                  styles.zoneTypeTab,
                  zoneMode === 'NONE' && styles.zoneTypeTabActive,
                ]}
              >
                <Ionicons
                  name="power"
                  size={15}
                  color={zoneMode === 'NONE' ? '#FFFFFF' : colors.text.primary}
                />
                <Text
                  style={[
                    styles.zoneTypeTabText,
                    zoneMode === 'NONE' && styles.zoneTypeTabTextActive,
                  ]}
                >
                  Off
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  setZoneMode('CIRCLE');
                  setErrorMessage(null);
                }}
                style={[
                  styles.zoneTypeTab,
                  zoneMode === 'CIRCLE' && styles.zoneTypeTabActive,
                ]}
              >
                <TargetIcon
                  size={15}
                  color={zoneMode === 'CIRCLE' ? colors.brand.accent : colors.text.primary}
                />
                <Text
                  style={[
                    styles.zoneTypeTabText,
                    zoneMode === 'CIRCLE' && styles.zoneTypeTabTextActive,
                  ]}
                >
                  Circle
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  setZoneMode('POLYGON');
                  setErrorMessage(null);
                }}
                style={[
                  styles.zoneTypeTab,
                  zoneMode === 'POLYGON' && styles.zoneTypeTabActive,
                ]}
              >
                <ShapesIcon
                  size={15}
                  color={zoneMode === 'POLYGON' ? colors.brand.accent : colors.text.primary}
                />
                <Text
                  style={[
                    styles.zoneTypeTabText,
                    zoneMode === 'POLYGON' && styles.zoneTypeTabTextActive,
                  ]}
                >
                  Custom
                </Text>
              </TouchableOpacity>
            </View>

            {/* Sub-header instructions / live stats */}
            {zoneMode === 'NONE' && (
              <View style={styles.offNotice}>
                <Ionicons name="information-circle" size={18} color="#2563EB" />
                <Text style={styles.offNoticeText}>
                  Boundless play zone: Players can roam anywhere without out-of-bounds penalties.
                </Text>
              </View>
            )}

            {/* Interactive Live Map */}
            <View style={styles.mapContainer}>
              <LivePlayZoneMap
                currentLocation={currentLocation}
                zoneRadius={circleRadius}
                fullScreen
                customCenter={effectiveCenter}
                onSelectCenter={(coords) => {
                  if (zoneMode === 'CIRCLE') {
                    setCircleCenter(coords);
                  } else if (zoneMode === 'POLYGON' && polygonPoints.length < 12) {
                    setPolygonPoints([...polygonPoints, coords]);
                  }
                }}
                allowTapToSelectCenter={zoneMode !== 'NONE'}
                zoneMode={zoneMode}
                polygonVertices={polygonPoints}
              />

              {/* Floating polygon tools matching Reference Screenshot 5 */}
              {zoneMode === 'POLYGON' && (
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
                    onPress={handleUndoPolygonPoint}
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
                    onPress={handleClearPolygonPoints}
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

            {/* Bottom Card Area matching Reference Screenshot 5 */}
            <View style={styles.bottomCardArea}>
              {/* Circle Mode: Presets + Custom Radius with 5m - 400km limit */}
              {zoneMode === 'CIRCLE' && (
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
              {zoneMode === 'POLYGON' && (
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
                <View style={styles.errorBoxStep3}>
                  <Ionicons name="alert-circle" size={16} color={colors.status.danger} />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              )}

              {/* Gradient Action Button (Exact match to Screenshot 5) */}
              <View style={styles.applyBtnWrapper}>
                <Button
                  title={
                    isSaving || isLoading
                      ? isEditingFromLobby
                        ? 'SAVING PLAY ZONE...'
                        : 'CREATING MATCH...'
                      : isEditingFromLobby
                      ? 'Apply'
                      : 'CREATE MATCH'
                  }
                  variant="gradient"
                  size="lg"
                  fullWidth
                  loading={isSaving || isLoading}
                  disabled={isSaving || isLoading}
                  onPress={handleSaveOrLaunchMatch}
                />
              </View>
            </View>
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    flex: 1,
    justifyContent: 'space-between',
  },
  containerStep3: {
    flex: 1,
    backgroundColor: colors.background.base,
  },
  step3Wrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  sectionHeader: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text.primary,
    marginTop: spacing.sm,
    letterSpacing: typography.letterSpacing.tactical,
  },
  sectionSubtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    marginTop: 4,
    marginBottom: spacing.lg,
  },
  optionsList: {
    gap: spacing.sm,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background.surface,
    borderWidth: 1.5,
    borderColor: colors.border.default,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    ...shadows.sm,
  },
  optionCardSelected: {
    borderColor: colors.brand.accent,
    backgroundColor: '#FFF7F5',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleSelected: {
    backgroundColor: '#FEE2E2',
  },
  optionTextColumn: {
    flex: 1,
  },
  optionLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: '700',
    color: colors.text.primary,
  },
  optionLabelSelected: {
    color: colors.brand.accent,
  },
  optionSub: {
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 2,
    fontWeight: '500',
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: colors.brand.accent,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.brand.accent,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  customInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  customInput: {
    fontSize: typography.fontSize.base,
    fontWeight: '700',
    color: colors.text.primary,
    minWidth: 40,
    textAlign: 'center',
  },
  unitText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    marginLeft: 2,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginTop: spacing.md,
    gap: 6,
  },
  errorBoxStep3: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: borderRadius.md,
    padding: spacing.xs,
    marginBottom: spacing.xs,
    gap: 6,
  },
  errorText: {
    flex: 1,
    fontSize: typography.fontSize.xs,
    color: colors.status.danger,
    fontWeight: '600',
  },
  bottomBar: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },

  // Step 3 specific styles
  zoneTypeTabs: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    padding: 4,
    borderRadius: borderRadius.lg,
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs + 2,
    gap: 4,
  },
  zoneTypeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: borderRadius.md,
    gap: 6,
  },
  zoneTypeTabActive: {
    backgroundColor: '#FFFFFF',
    ...shadows.sm,
  },
  zoneTypeTabText: {
    fontSize: typography.fontSize.xs + 1,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  zoneTypeTabTextActive: {
    color: colors.brand.accent,
  },
  offNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    padding: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: 6,
    borderRadius: borderRadius.md,
    gap: 6,
  },
  offNoticeText: {
    flex: 1,
    fontSize: typography.fontSize.xs,
    color: '#1E40AF',
    fontWeight: '500',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
    minHeight: 280,
  },
  // Floating Tool Column matching Screenshot 5 (Centered on right edge away from map controls)
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
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    ...shadows.lg,
    borderTopWidth: 1,
    borderColor: '#E5E7EB',
  },
  // Metric Cards (POINTS & AREA) matching Screenshot 5
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: spacing.md,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: borderRadius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  metricHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.text.muted,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.text.primary,
  },
  applyBtnWrapper: {
    marginTop: 2,
  },

  // Circle radius styling
  radiusControlContainer: {
    marginBottom: spacing.md,
  },
  radiusScroll: {
    gap: 8,
  },
  radiusPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
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
    color: colors.text.primary,
  },
  radiusPillTextSelected: {
    color: '#FFFFFF',
  },
  customRadiusRow: {
    marginTop: 10,
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  customRadiusPrompt: {
    fontSize: 11,
    color: colors.text.muted,
    fontWeight: '600',
    marginBottom: 6,
  },
  customRadiusInputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customRadiusNumberInput: {
    flex: 1,
    height: 38,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 10,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
  },
  unitToggleGroup: {
    flexDirection: 'row',
    borderRadius: borderRadius.sm,
    backgroundColor: '#E5E7EB',
    padding: 2,
  },
  unitBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
  },
  unitBtnActive: {
    backgroundColor: colors.brand.accent,
  },
  unitBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.primary,
  },
  unitBtnTextActive: {
    color: '#FFFFFF',
  },
});
