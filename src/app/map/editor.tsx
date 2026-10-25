import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Badge, Button, Card } from '@/components/ui';
import { LivePlayZoneMap } from '@/components/game/LivePlayZoneMap';
import { useLocation } from '@/hooks/useLocation';
import { haversineDistance } from '@/lib/geo/distance';
import { borderRadius, colors, spacing, typography } from '@/theme/tokens';

interface PlaceSearchResult {
  id: string;
  name: string;
  fullName: string;
  lat: number;
  lng: number;
  radius: number;
}

const QUICK_LANDMARKS = [
  { name: '🏛️ DTU Delhi', lat: 28.7499, lng: 77.1170, radius: 550 },
  { name: '🏙️ Connaught Place', lat: 28.6315, lng: 77.2167, radius: 650 },
  { name: '🇮🇳 India Gate', lat: 28.6129, lng: 77.2295, radius: 450 },
  { name: '🌳 Lodhi Garden', lat: 28.5933, lng: 77.2217, radius: 500 },
];

export default function PlayZoneEditorScreen() {
  const router = useRouter();
  const { currentLocation, startTracking, stopTracking, refreshLocation } = useLocation();
  const [zoneRadius, setZoneRadius] = useState(500);
  const [originMode, setOriginMode] = useState<'GPS' | 'CUSTOM'>('GPS');
  const [customCenter, setCustomCenter] = useState<{ lat: number; lng: number } | null>(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlaceSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Load any previously saved playzone configuration
  useEffect(() => {
    AsyncStorage.getItem('@manhunt/configured_playzone').then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed.customCenter) {
            setCustomCenter(parsed.customCenter);
            setOriginMode('CUSTOM');
          }
          if (parsed.zoneRadius) {
            setZoneRadius(parsed.zoneRadius);
          }
        } catch {
          // ignore
        }
      }
    });
  }, []);

  // Automatically start high-precision continuous GPS tracking on mount
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    refreshLocation();
    startTracking({
      timeIntervalMs: 1000,
      distanceIntervalMeters: 1,
      maxAccuracyMeters: 60,
    }).then((unsub) => {
      cleanup = unsub;
    });

    return () => {
      cleanup?.();
      stopTracking();
    };
  }, [startTracking, stopTracking, refreshLocation]);

  const effectiveCustomCenter = originMode === 'CUSTOM' ? customCenter : null;
  const centerLat = effectiveCustomCenter?.lat ?? currentLocation?.latitude ?? 28.6139;
  const centerLng = effectiveCustomCenter?.lng ?? currentLocation?.longitude ?? 77.2090;
  const accuracy = currentLocation?.accuracy;

  const distToAnchor = currentLocation && effectiveCustomCenter
    ? haversineDistance(
        { latitude: currentLocation.latitude, longitude: currentLocation.longitude },
        { latitude: effectiveCustomCenter.lat, longitude: effectiveCustomCenter.lng }
      )
    : 0;

  // Search places via Mapbox Geocoding API with OpenStreetMap Nominatim fallback
  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (!text.trim() || text.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
      if (mapboxToken) {
        const prox = currentLocation
          ? `&proximity=${currentLocation.longitude},${currentLocation.latitude}`
          : '&proximity=77.2090,28.6139';
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(text)}.json?access_token=${mapboxToken}&autocomplete=true&limit=5${prox}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data && data.features && data.features.length > 0) {
          const results: PlaceSearchResult[] = data.features.map((feat: any) => {
            let estimatedRadius = 500;
            if (feat.bbox && feat.bbox.length === 4) {
              const [, , maxLng, maxLat] = feat.bbox;
              const center = feat.center;
              const cornerDist = haversineDistance(
                { latitude: center[1], longitude: center[0] },
                { latitude: maxLat, longitude: maxLng }
              );
              estimatedRadius = Math.min(3000, Math.max(200, Math.round(cornerDist / 50) * 50));
            } else if (
              feat.text?.toLowerCase().includes('dtu') ||
              feat.text?.toLowerCase().includes('delhi technological')
            ) {
              estimatedRadius = 550;
            } else if (
              feat.text?.toLowerCase().includes('connaught') ||
              feat.text?.toLowerCase().includes('cp')
            ) {
              estimatedRadius = 650;
            } else if (feat.place_type?.includes('poi')) {
              estimatedRadius = 350;
            } else if (feat.place_type?.includes('neighborhood')) {
              estimatedRadius = 700;
            }
            return {
              id: feat.id,
              name: feat.text,
              fullName: feat.place_name,
              lng: feat.center[0],
              lat: feat.center[1],
              radius: estimatedRadius,
            };
          });
          setSearchResults(results);
          setIsSearching(false);
          return;
        }
      }

      // OpenStreetMap Nominatim Fallback
      const osmUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&limit=5&countrycodes=in`;
      const res = await fetch(osmUrl, {
        headers: { 'User-Agent': 'ManhuntGPSApp/1.0' },
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        const results: PlaceSearchResult[] = data.map((item: any) => {
          const lat = parseFloat(item.lat);
          const lng = parseFloat(item.lon);
          let estimatedRadius = 500;
          if (item.boundingbox && item.boundingbox.length === 4) {
            const [, maxLat, , maxLng] = item.boundingbox.map(parseFloat);
            const cornerDist = haversineDistance(
              { latitude: lat, longitude: lng },
              { latitude: maxLat, longitude: maxLng }
            );
            estimatedRadius = Math.min(3000, Math.max(200, Math.round(cornerDist / 50) * 50));
          }
          return {
            id: String(item.place_id),
            name: item.display_name.split(',')[0],
            fullName: item.display_name,
            lat,
            lng,
            radius: estimatedRadius,
          };
        });
        setSearchResults(results);
      }
    } catch {
      // Ignore network errors
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectPlace = (place: PlaceSearchResult) => {
    setCustomCenter({ lat: place.lat, lng: place.lng });
    setZoneRadius(place.radius);
    setOriginMode('CUSTOM');
    setSearchResults([]);
    setSearchQuery(place.name);
    Keyboard.dismiss();
  };

  const handleSelectPresetLandmark = (lm: typeof QUICK_LANDMARKS[0]) => {
    setCustomCenter({ lat: lm.lat, lng: lm.lng });
    setZoneRadius(lm.radius);
    setOriginMode('CUSTOM');
    setSearchResults([]);
    setSearchQuery(lm.name);
  };

  const handleSelectMapCenter = (coords: { latitude: number; longitude: number }) => {
    setCustomCenter({ lat: coords.latitude, lng: coords.longitude });
    setOriginMode('CUSTOM');
  };

  const handleResetToGps = () => {
    setOriginMode('GPS');
    setCustomCenter(null);
  };

  const handleRecenter = (lat: number, lng: number) => {
    if (originMode === 'CUSTOM') {
      setCustomCenter({ lat, lng });
    }
  };

  const handleAdjustRadius = (delta: number) => {
    setZoneRadius((prev) => Math.min(400000, Math.max(50, prev + delta)));
  };

  const handleSave = async () => {
    const savedConfig = {
      mode: originMode,
      customCenter: originMode === 'CUSTOM' ? { lat: centerLat, lng: centerLng } : null,
      zoneRadius,
    };
    await AsyncStorage.setItem('@manhunt/configured_playzone', JSON.stringify(savedConfig));

    Alert.alert(
      'PLAY ZONE SAVED',
      `Play zone configured to ${zoneRadius}m radius (${originMode === 'CUSTOM' ? 'Custom Map Anchor' : 'Live Device GPS'}) centered at [${centerLat.toFixed(5)}, ${centerLng.toFixed(5)}].`,
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

        {/* Search Place / Landmark / Campus Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search DTU, Connaught Place, campus, landmark..."
              placeholderTextColor={colors.text.muted}
              value={searchQuery}
              onChangeText={handleSearch}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {isSearching && <ActivityIndicator size="small" color={colors.runner.primary} />}
            {searchQuery.length > 0 && !isSearching && (
              <TouchableOpacity
                style={styles.searchClearBtn}
                onPress={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}
              >
                <Text style={styles.searchClearText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Auto-suggest Search Results Dropdown */}
          {searchResults.length > 0 && (
            <View style={styles.searchResultsBox}>
              <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 200 }}>
                {searchResults.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.searchResultItem}
                    onPress={() => handleSelectPlace(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.searchResultRow}>
                      <Text style={styles.searchResultTitle} numberOfLines={1}>
                        📍 {item.name}
                      </Text>
                      <View style={styles.searchResultRadiusBadge}>
                        <Text style={styles.searchResultRadiusText}>{item.radius}m</Text>
                      </View>
                    </View>
                    <Text style={styles.searchResultFull} numberOfLines={1}>
                      {item.fullName}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Quick Landmark Campus Presets */}
        <View style={styles.landmarkRow}>
          {QUICK_LANDMARKS.map((lm) => (
            <TouchableOpacity
              key={lm.name}
              style={styles.landmarkPill}
              onPress={() => handleSelectPresetLandmark(lm)}
              activeOpacity={0.7}
            >
              <Text style={styles.landmarkPillText}>
                {lm.name} ({lm.radius}m)
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Origin Mode Toggle Bar */}
        <View style={styles.originModeBar}>
          <TouchableOpacity
            style={[
              styles.originModeBtn,
              originMode === 'GPS' && styles.originModeBtnActiveGps,
            ]}
            onPress={() => setOriginMode('GPS')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.originModeBtnText,
                originMode === 'GPS' && styles.originModeBtnTextActive,
              ]}
            >
              📍 CURRENT GPS
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.originModeBtn,
              originMode === 'CUSTOM' && styles.originModeBtnActiveCustom,
            ]}
            onPress={() => {
              setOriginMode('CUSTOM');
              if (!customCenter && currentLocation) {
                setCustomCenter({
                  lat: currentLocation.latitude,
                  lng: currentLocation.longitude,
                });
              }
            }}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.originModeBtnText,
                originMode === 'CUSTOM' && styles.originModeBtnTextActive,
              ]}
            >
              🎯 CUSTOM MAP ANCHOR
            </Text>
          </TouchableOpacity>
        </View>

        {/* Live Satellite / Street Map with Slippy Tiles, Pinch-Zoom, Tap-to-Select and Distance Control Dots */}
        <LivePlayZoneMap
          currentLocation={currentLocation}
          zoneRadius={zoneRadius}
          onRecenter={handleRecenter}
          customCenter={effectiveCustomCenter ? { latitude: effectiveCustomCenter.lat, longitude: effectiveCustomCenter.lng } : null}
          onSelectCenter={handleSelectMapCenter}
          allowTapToSelectCenter={originMode === 'CUSTOM'}
          onChangeRadius={setZoneRadius}
        />

        {/* Custom Mode Tactical Hint */}
        {originMode === 'CUSTOM' && (
          <View style={styles.customHintCard}>
            <Text style={styles.customHintTitle}>🎯 CUSTOM ANCHOR & RADIUS ACTIVE</Text>
            <Text style={styles.customHintText}>
              • Tap anywhere on the map to place the anchor pin exactly there.{'\n'}
              • Use 2 fingers to pinch in/out to zoom.{'\n'}
              • Tap the (+) and (−) distance dots on the circle perimeter to expand/contract zone.
            </Text>
            <TouchableOpacity
              style={styles.resetGpsBtn}
              onPress={handleResetToGps}
              activeOpacity={0.8}
            >
              <Text style={styles.resetGpsText}>📍 RESET TO MY GPS POSITION</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Live GPS Telemetry Card */}
        <Card variant="glass" style={styles.telemetryCard}>
          <View style={styles.telemetryRow}>
            <Text style={styles.telemetryLabel}>GEOFENCE MODE:</Text>
            <Text style={[styles.telemetryVal, { color: originMode === 'CUSTOM' ? colors.brand.gradientEnd : colors.runner.primary }]}>
              {originMode === 'CUSTOM' ? '🎯 CUSTOM MAP ANCHOR' : '📍 DEVICE GPS ANCHOR'}
            </Text>
          </View>
          <View style={styles.telemetryRow}>
            <Text style={styles.telemetryLabel}>GEOFENCE ORIGIN:</Text>
            <Text style={styles.telemetryVal}>
              {centerLat.toFixed(6)}, {centerLng.toFixed(6)}
            </Text>
          </View>
          {originMode === 'CUSTOM' && currentLocation && (
            <View style={styles.telemetryRow}>
              <Text style={styles.telemetryLabel}>DISTANCE TO ANCHOR:</Text>
              <Text style={[styles.telemetryVal, { color: colors.status.safe }]}>
                {Math.round(distToAnchor)} METERS
              </Text>
            </View>
          )}
          <View style={styles.telemetryRow}>
            <Text style={styles.telemetryLabel}>GPS ACCURACY:</Text>
            <Text
              style={[
                styles.telemetryVal,
                {
                  color:
                    accuracy && accuracy <= 10
                      ? colors.status.safe
                      : colors.brand.gradientEnd,
                },
              ]}
            >
              {accuracy ? `±${accuracy.toFixed(1)}m (HIGH PRECISION)` : 'ACQUIRING...'}
            </Text>
          </View>
          <View style={styles.telemetryRow}>
            <Text style={styles.telemetryLabel}>ZONE RADIUS:</Text>
            <Text style={[styles.telemetryVal, { color: colors.brand.gradientEnd }]}>
              {zoneRadius >= 1000
                ? `${(zoneRadius / 1000).toFixed(1).replace(/\.0$/, '')} KM (${zoneRadius.toLocaleString()} METERS)`
                : `${zoneRadius} METERS`}
            </Text>
          </View>
        </Card>

        {/* Fine-Tuning Distance Dots Stepper */}
        <Text style={styles.sectionTitle}>FINE-TUNE ZONE RADIUS (DISTANCE DOTS)</Text>
        <View style={styles.stepperRow}>
          <TouchableOpacity
            style={styles.stepperBtn}
            onPress={() => handleAdjustRadius(-1000)}
            activeOpacity={0.7}
          >
            <Text style={styles.stepperBtnText}>−1km</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.stepperBtn}
            onPress={() => handleAdjustRadius(-100)}
            activeOpacity={0.7}
          >
            <Text style={styles.stepperBtnText}>−100m</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.stepperBtn}
            onPress={() => handleAdjustRadius(-50)}
            activeOpacity={0.7}
          >
            <Text style={styles.stepperBtnText}>−50m</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.stepperBtn}
            onPress={() => handleAdjustRadius(50)}
            activeOpacity={0.7}
          >
            <Text style={styles.stepperBtnText}>+50m</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.stepperBtn}
            onPress={() => handleAdjustRadius(100)}
            activeOpacity={0.7}
          >
            <Text style={styles.stepperBtnText}>+100m</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.stepperBtn}
            onPress={() => handleAdjustRadius(1000)}
            activeOpacity={0.7}
          >
            <Text style={styles.stepperBtnText}>+1km</Text>
          </TouchableOpacity>
        </View>

        {/* Custom Radius Direct Number Input */}
        <View style={styles.customRadiusRow}>
          <Text style={styles.customRadiusLabel}>CUSTOM ZONE RADIUS:</Text>
          <TextInput
            style={styles.customRadiusInput}
            keyboardType="number-pad"
            value={String(zoneRadius)}
            onChangeText={(txt) => {
              const val = parseInt(txt.replace(/[^0-9]/g, ''), 10);
              if (!isNaN(val) && val > 0) {
                setZoneRadius(Math.min(400000, Math.max(50, val)));
              }
            }}
          />
          <Text style={styles.customRadiusUnit}>meters</Text>
        </View>

        {/* Radius Preset Selectors */}
        <Text style={styles.sectionTitle}>QUICK ZONE RADIUS PRESETS (UP TO 400KM)</Text>
        <View style={styles.presetRow}>
          {[300, 1000, 5000, 25000, 100000, 400000].map((radius) => (
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
                {radius >= 1000 ? `${radius / 1000}km` : `${radius}m`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Safety & Hazard Warning */}
        <Card variant="glass" style={styles.hazardCard}>
          <Text style={styles.hazardTitle}>⚠️ SAFETY & BOUNDARY NOTICE</Text>
          <Text style={styles.hazardText}>
            Ensure the play area does not cross busy roads, railway tracks, bodies of water, or private property. Players must remain aware of their physical surroundings at all times.
          </Text>
        </Card>

        {/* Save Button */}
        <Button
          title="CONFIRM PLAY ZONE"
          variant="gradient"
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
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  telemetryVal: {
    color: colors.text.primary,
    fontSize: typography.fontSize.xs,
    fontWeight: '800',
    fontFamily: typography.fontFamily.mono,
  },
  sectionTitle: {
    alignSelf: 'flex-start',
    color: colors.text.secondary,
    fontSize: typography.fontSize.xs,
    letterSpacing: typography.letterSpacing.wide,
    fontWeight: '800',
    marginTop: spacing.md,
    marginBottom: spacing.xs + 2,
  },
  presetRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  presetPill: {
    flex: 1,
    paddingVertical: spacing.sm + 4,
    backgroundColor: colors.background.surfaceCard,
    borderColor: colors.border.glass,
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  presetPillActive: {
    borderColor: colors.brand.gradientMid,
    backgroundColor: 'rgba(232, 93, 59, 0.15)',
  },
  presetText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.xs,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  presetTextActive: {
    color: colors.brand.gradientEnd,
  },
  hazardCard: {
    width: '100%',
    marginVertical: spacing.sm,
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
    marginBottom: spacing.xl,
  },
  originModeBar: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: '#0F131A',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: 3,
    marginBottom: spacing.sm,
    gap: 4,
  },
  originModeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.sm,
  },
  originModeBtnActiveGps: {
    backgroundColor: 'rgba(0, 229, 255, 0.2)',
    borderColor: colors.runner.primary,
    borderWidth: 1,
  },
  originModeBtnActiveCustom: {
    backgroundColor: 'rgba(232, 93, 59, 0.2)',
    borderColor: colors.brand.gradientEnd,
    borderWidth: 1,
  },
  originModeBtnText: {
    color: colors.text.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  originModeBtnTextActive: {
    color: '#FFFFFF',
  },
  customHintCard: {
    width: '100%',
    backgroundColor: 'rgba(232, 93, 59, 0.12)',
    borderColor: colors.brand.gradientMid,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.sm + 2,
    marginVertical: spacing.xs,
  },
  customHintTitle: {
    color: colors.brand.gradientEnd,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 2,
  },
  customHintText: {
    color: colors.text.secondary,
    fontSize: 10,
    lineHeight: 14,
  },
  resetGpsBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.sm,
  },
  resetGpsText: {
    color: colors.runner.primary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  searchContainer: {
    width: '100%',
    marginBottom: spacing.xs + 2,
    position: 'relative',
    zIndex: 50,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121620',
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm + 2,
    height: 44,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    paddingVertical: 0,
  },
  searchClearBtn: {
    padding: 4,
  },
  searchClearText: {
    color: colors.text.muted,
    fontSize: 14,
  },
  searchResultsBox: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    backgroundColor: '#161B26',
    borderColor: colors.brand.accent,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: 4,
    zIndex: 100,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    maxHeight: 220,
  },
  searchResultItem: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    borderBottomWidth: 1,
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  searchResultTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    flex: 1,
  },
  searchResultRadiusBadge: {
    backgroundColor: 'rgba(0, 229, 255, 0.2)',
    borderColor: colors.runner.primary,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginLeft: 6,
  },
  searchResultRadiusText: {
    color: colors.runner.primary,
    fontSize: 9,
    fontWeight: '800',
  },
  searchResultFull: {
    color: colors.text.muted,
    fontSize: 10,
    marginTop: 2,
  },
  landmarkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.sm,
    width: '100%',
  },
  landmarkPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  landmarkPillText: {
    color: colors.text.secondary,
    fontSize: 10,
    fontWeight: '700',
  },
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginVertical: spacing.xs,
    gap: 6,
  },
  stepperBtn: {
    flex: 1,
    backgroundColor: '#161B26',
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: {
    color: colors.runner.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  customRadiusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121620',
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    width: '100%',
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  customRadiusLabel: {
    color: colors.text.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  customRadiusInput: {
    backgroundColor: '#1A2130',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    paddingHorizontal: 12,
    paddingVertical: 4,
    width: 90,
    textAlign: 'center',
  },
  customRadiusUnit: {
    color: colors.brand.gradientEnd,
    fontSize: 12,
    fontWeight: '800',
  },
});

