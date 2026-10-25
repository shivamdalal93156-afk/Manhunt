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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button, Card, ErrorFallback } from '@/components/ui';
import { useLobbyStore } from '@/store/lobbyStore';
import { ZoneShrinkMode } from '@/types/lobby';
import { borderRadius, colors, spacing, typography } from '@/theme/tokens';

export default function CreateMatchScreen() {
  const router = useRouter();
  const { createMatch, isLoading, error, clearError } = useLobbyStore();
  const [selectedDuration, setSelectedDuration] = useState(30);
  const [isCustomDuration, setIsCustomDuration] = useState(false);
  const [customDurationText, setCustomDurationText] = useState('30');

  // Runner Location Reveal Interval (formerly Radar Ping) - Up to 1 Day (86,400s)
  const [selectedPing, setSelectedPing] = useState(30);
  const [isCustomPing, setIsCustomPing] = useState(false);
  const [customPingText, setCustomPingText] = useState('30');

  // Play Zone Area Radius - Up to 400km (400,000 meters)
  const [selectedRadius, setSelectedRadius] = useState(500);
  const [isCustomRadius, setIsCustomRadius] = useState(false);
  const [customRadiusText, setCustomRadiusText] = useState('500');

  // Play Zone Center Origin: Device GPS vs Custom Anchor
  const [zoneOriginMode, setZoneOriginMode] = useState<'GPS' | 'CUSTOM'>('GPS');
  const [customCenter, setCustomCenter] = useState<{ lat: number; lng: number } | null>(null);

  // Game Mode: ONE_CATCH (1 Heart) vs MULTI_HEARTS (Customizable)
  const [selectedMode, setSelectedMode] = useState<'ONE_CATCH' | 'MULTI_HEARTS'>('MULTI_HEARTS');
  const [customHearts, setCustomHearts] = useState(3);

  // Zone Shrink Mode: Static vs Concentric vs Battle Royale (PUBG/Free Fire)
  const [selectedShrinkMode, setSelectedShrinkMode] = useState<ZoneShrinkMode>('NONE');

  useEffect(() => {
    AsyncStorage.getItem('@manhunt/configured_playzone').then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed.customCenter) {
            setCustomCenter(parsed.customCenter);
            if (parsed.mode === 'CUSTOM') {
              setZoneOriginMode('CUSTOM');
            }
          }
          if (parsed.zoneRadius) {
            setSelectedRadius(parsed.zoneRadius);
            setCustomRadiusText(String(parsed.zoneRadius));
            if (![300, 1000, 5000, 25000, 100000, 400000].includes(parsed.zoneRadius)) {
              setIsCustomRadius(true);
            }
          }
        } catch {
          // ignore
        }
      }
    });
  }, []);

  const handleSelectPresetDuration = (mins: number) => {
    setIsCustomDuration(false);
    setSelectedDuration(mins);
    setCustomDurationText(String(mins));
  };

  const handleCustomDurationChange = (text: string) => {
    setCustomDurationText(text);
    const num = parseInt(text.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(num) && num > 0) {
      setSelectedDuration(Math.min(1440, Math.max(5, num)));
    }
  };

  const handleAdjustDuration = (delta: number) => {
    setIsCustomDuration(true);
    setSelectedDuration((prev) => {
      const next = Math.min(1440, Math.max(5, prev + delta));
      setCustomDurationText(String(next));
      return next;
    });
  };

  const handleSelectPresetPing = (sec: number) => {
    setIsCustomPing(false);
    setSelectedPing(sec);
    setCustomPingText(String(sec));
  };

  const handleCustomPingChange = (text: string) => {
    setCustomPingText(text);
    const num = parseInt(text.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(num) && num > 0) {
      setSelectedPing(Math.min(86400, Math.max(5, num)));
    }
  };

  const handleAdjustPing = (delta: number) => {
    setIsCustomPing(true);
    setSelectedPing((prev) => {
      const next = Math.min(86400, Math.max(5, prev + delta));
      setCustomPingText(String(next));
      return next;
    });
  };

  const handleSelectPresetRadius = (rad: number) => {
    setIsCustomRadius(false);
    setSelectedRadius(rad);
    setCustomRadiusText(String(rad));
  };

  const handleCustomRadiusChange = (text: string) => {
    setCustomRadiusText(text);
    const num = parseInt(text.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(num) && num > 0) {
      setSelectedRadius(Math.min(400000, Math.max(50, num)));
    }
  };

  const handleAdjustRadius = (delta: number) => {
    setIsCustomRadius(true);
    setSelectedRadius((prev) => {
      const next = Math.min(400000, Math.max(50, prev + delta));
      setCustomRadiusText(String(next));
      return next;
    });
  };

  const effectiveHearts = selectedMode === 'ONE_CATCH' ? 1 : customHearts;

  const handleCreate = async () => {
    try {
      const session = await createMatch({
        durationMinutes: selectedDuration,
        pingIntervalSeconds: selectedPing,
        zoneRadiusMeters: selectedRadius,
        runnerHearts: effectiveHearts,
        gameMode: selectedMode,
        customZoneCenter: zoneOriginMode === 'CUSTOM' ? customCenter : null,
        zoneShrinkMode: selectedShrinkMode,
      });
      router.push(`/lobby/${session.gameId}`);
    } catch (err: unknown) {
      Alert.alert(
        'CREATE MATCH FAILED',
        err instanceof Error ? err.message : 'Unable to initialize match room'
      );
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {error && (
        <ErrorFallback
          error={error}
          onRetry={clearError}
          title="INITIALIZATION FAILED"
        />
      )}

      {/* Game Mode Selection */}
      <Text style={styles.sectionTitle}>GAME MODE & RUNNER LIVES</Text>
      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[
            styles.modeCard,
            selectedMode === 'ONE_CATCH' && styles.modeCardActive,
          ]}
          onPress={() => setSelectedMode('ONE_CATCH')}
          activeOpacity={0.8}
        >
          <Text style={styles.modeIcon}>⚡</Text>
          <Text
            style={[
              styles.modeTitle,
              selectedMode === 'ONE_CATCH' && styles.modeTitleActive,
            ]}
          >
            SUDDEN DEATH
          </Text>
          <Text style={styles.modeDesc}>1 Catch = Immediate Elimination</Text>
          <View style={styles.modePillBadge}>
            <Text style={styles.modePillText}>1 LIFE</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.modeCard,
            selectedMode === 'MULTI_HEARTS' && styles.modeCardActive,
          ]}
          onPress={() => setSelectedMode('MULTI_HEARTS')}
          activeOpacity={0.8}
        >
          <Text style={styles.modeIcon}>❤️</Text>
          <Text
            style={[
              styles.modeTitle,
              selectedMode === 'MULTI_HEARTS' && styles.modeTitleActive,
            ]}
          >
            SURVIVAL LIVES
          </Text>
          <Text style={styles.modeDesc}>Multiple Hearts / Tag Escapes</Text>
          <View style={styles.modePillBadge}>
            <Text style={styles.modePillText}>{customHearts} HEARTS</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Customizable Hearts Selector (shown only in Multi-Hearts mode) */}
      {selectedMode === 'MULTI_HEARTS' && (
        <View style={styles.customHeartsBox}>
          <Text style={styles.subSectionTitle}>CUSTOMIZE NUMBER OF HEARTS</Text>
          <View style={styles.optionRow}>
            {[2, 3, 4, 5].map((count) => (
              <TouchableOpacity
                key={count}
                style={[
                  styles.optionPill,
                  customHearts === count && styles.optionPillActiveHearts,
                ]}
                onPress={() => setCustomHearts(count)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.optionText,
                    customHearts === count && styles.optionTextActiveHearts,
                  ]}
                >
                  {count} HEARTS
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Match Parameters - Duration up to 1 Day (1,440 mins) */}
      <Text style={styles.sectionTitle}>MATCH DURATION</Text>
      <Text style={styles.sectionSubTitle}>
        Total time hunters have to catch all runners (max 1 day)
      </Text>
      <View style={styles.optionRow}>
        {[15, 30, 60, 180, 360, 720, 1440].map((mins) => (
          <TouchableOpacity
            key={mins}
            style={[
              styles.optionPill,
              !isCustomDuration && selectedDuration === mins && styles.optionPillActive,
            ]}
            onPress={() => handleSelectPresetDuration(mins)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.optionText,
                !isCustomDuration && selectedDuration === mins && styles.optionTextActive,
              ]}
            >
              {mins >= 60
                ? `${mins / 60 >= 24 ? '24h (1D)' : `${mins / 60}h`}`
                : `${mins}m`}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[
            styles.optionPill,
            isCustomDuration && styles.optionPillActiveCustom,
          ]}
          onPress={() => setIsCustomDuration(true)}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.optionText,
              isCustomDuration && styles.optionTextActiveCustom,
            ]}
          >
            ⚙️ CUSTOM
          </Text>
        </TouchableOpacity>
      </View>

      {/* Custom Duration Input Card */}
      {isCustomDuration && (
        <View style={styles.customInputCard}>
          <View style={styles.customInputHeader}>
            <Text style={styles.customInputLabel}>CUSTOM MATCH DURATION:</Text>
            <Text style={styles.customInputVal}>
              {selectedDuration >= 60
                ? `${(selectedDuration / 60).toFixed(1).replace(/\.0$/, '')} HRS (${selectedDuration} MINS)`
                : `${selectedDuration} MINS`}
            </Text>
          </View>
          <View style={styles.customInputRow}>
            <TextInput
              style={styles.customTextInput}
              keyboardType="number-pad"
              value={customDurationText}
              onChangeText={handleCustomDurationChange}
              placeholder="e.g. 90"
              placeholderTextColor={colors.text.muted}
            />
            <Text style={styles.customUnitText}>minutes</Text>
            <View style={styles.customAdjustGroup}>
              <TouchableOpacity
                style={styles.adjustBtn}
                onPress={() => handleAdjustDuration(-60)}
                activeOpacity={0.7}
              >
                <Text style={styles.adjustBtnText}>−1h</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.adjustBtn}
                onPress={() => handleAdjustDuration(-15)}
                activeOpacity={0.7}
              >
                <Text style={styles.adjustBtnText}>−15m</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.adjustBtn}
                onPress={() => handleAdjustDuration(15)}
                activeOpacity={0.7}
              >
                <Text style={styles.adjustBtnText}>+15m</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.adjustBtn}
                onPress={() => handleAdjustDuration(60)}
                activeOpacity={0.7}
              >
                <Text style={styles.adjustBtnText}>+1h</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.adjustBtn}
                onPress={() => handleAdjustDuration(360)}
                activeOpacity={0.7}
              >
                <Text style={styles.adjustBtnText}>+6h</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.customInputHint}>
            Set any duration from 5 to 1,440 minutes (up to 24 hours / 1 day).
          </Text>
        </View>
      )}

      {/* Runner Location Reveal Timer (Intuitive wording for Radar Ping) - Up to 1 Day */}
      <Text style={styles.sectionTitle}>RUNNER LOCATION REVEAL TIMER</Text>
      <Text style={styles.sectionSubTitle}>
        How often runner locations ping on hunter compass & map (max 1 day)
      </Text>
      <View style={styles.optionRow}>
        {[15, 30, 60, 120, 300, 600].map((sec) => (
          <TouchableOpacity
            key={sec}
            style={[
              styles.optionPill,
              !isCustomPing && selectedPing === sec && styles.optionPillActive,
            ]}
            onPress={() => handleSelectPresetPing(sec)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.optionText,
                !isCustomPing && selectedPing === sec && styles.optionTextActive,
              ]}
            >
              {sec >= 60 ? `${sec / 60}m` : `${sec}s`}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[
            styles.optionPill,
            isCustomPing && styles.optionPillActiveCustom,
          ]}
          onPress={() => setIsCustomPing(true)}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.optionText,
              isCustomPing && styles.optionTextActiveCustom,
            ]}
          >
            ⚙️ CUSTOM
          </Text>
        </TouchableOpacity>
      </View>

      {/* Custom Location Reveal Input Card */}
      {isCustomPing && (
        <View style={styles.customInputCard}>
          <View style={styles.customInputHeader}>
            <Text style={styles.customInputLabel}>CUSTOM REVEAL INTERVAL:</Text>
            <Text style={styles.customInputVal}>
              {selectedPing >= 3600
                ? `${(selectedPing / 3600).toFixed(1).replace(/\.0$/, '')} HRS (${selectedPing}s)`
                : selectedPing >= 60
                ? `${Math.floor(selectedPing / 60)}m ${selectedPing % 60 ? `${selectedPing % 60}s` : ''} (${selectedPing}s)`
                : `${selectedPing} SECONDS`}
            </Text>
          </View>
          <View style={styles.customInputRow}>
            <TextInput
              style={styles.customTextInput}
              keyboardType="number-pad"
              value={customPingText}
              onChangeText={handleCustomPingChange}
              placeholder="e.g. 45"
              placeholderTextColor={colors.text.muted}
            />
            <Text style={styles.customUnitText}>seconds</Text>
            <View style={styles.customAdjustGroup}>
              <TouchableOpacity
                style={styles.adjustBtn}
                onPress={() => handleAdjustPing(-30)}
                activeOpacity={0.7}
              >
                <Text style={styles.adjustBtnText}>−30s</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.adjustBtn}
                onPress={() => handleAdjustPing(-5)}
                activeOpacity={0.7}
              >
                <Text style={styles.adjustBtnText}>−5s</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.adjustBtn}
                onPress={() => handleAdjustPing(5)}
                activeOpacity={0.7}
              >
                <Text style={styles.adjustBtnText}>+5s</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.adjustBtn}
                onPress={() => handleAdjustPing(30)}
                activeOpacity={0.7}
              >
                <Text style={styles.adjustBtnText}>+30s</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.adjustBtn}
                onPress={() => handleAdjustPing(300)}
                activeOpacity={0.7}
              >
                <Text style={styles.adjustBtnText}>+5m</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.customInputHint}>
            Set any reveal interval from 5 to 86,400 seconds (up to 24 hours / 1 day).
          </Text>
        </View>
      )}

      {/* Play Zone Area / Radius - Up to 400km (400,000m) */}
      <Text style={styles.sectionTitle}>PLAY ZONE AREA (RADIUS)</Text>
      <Text style={styles.sectionSubTitle}>
        Boundary size where all players hunt & evade (up to 400km)
      </Text>
      <View style={styles.optionRow}>
        {[300, 1000, 5000, 25000, 100000, 400000].map((rad) => (
          <TouchableOpacity
            key={rad}
            style={[
              styles.optionPill,
              !isCustomRadius && selectedRadius === rad && styles.optionPillActive,
            ]}
            onPress={() => handleSelectPresetRadius(rad)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.optionText,
                !isCustomRadius && selectedRadius === rad && styles.optionTextActive,
              ]}
            >
              {rad >= 1000 ? `${rad / 1000}km` : `${rad}m`}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[
            styles.optionPill,
            isCustomRadius && styles.optionPillActiveCustom,
          ]}
          onPress={() => setIsCustomRadius(true)}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.optionText,
              isCustomRadius && styles.optionTextActiveCustom,
            ]}
          >
            🎯 CUSTOM
          </Text>
        </TouchableOpacity>
      </View>

      {/* Custom Radius Input Card */}
      {isCustomRadius && (
        <View style={styles.customInputCard}>
          <View style={styles.customInputHeader}>
            <Text style={styles.customInputLabel}>CUSTOM ZONE RADIUS:</Text>
            <Text style={styles.customInputVal}>
              {selectedRadius >= 1000
                ? `${(selectedRadius / 1000).toFixed(1).replace(/\.0$/, '')} KM (${selectedRadius.toLocaleString()} METERS)`
                : `${selectedRadius} METERS`}
            </Text>
          </View>
          <View style={styles.customInputRow}>
            <TextInput
              style={styles.customTextInput}
              keyboardType="number-pad"
              value={customRadiusText}
              onChangeText={handleCustomRadiusChange}
              placeholder="e.g. 5000"
              placeholderTextColor={colors.text.muted}
            />
            <Text style={styles.customUnitText}>meters</Text>
            <View style={styles.customAdjustGroup}>
              <TouchableOpacity
                style={styles.adjustBtn}
                onPress={() => handleAdjustRadius(-1000)}
                activeOpacity={0.7}
              >
                <Text style={styles.adjustBtnText}>−1km</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.adjustBtn}
                onPress={() => handleAdjustRadius(-100)}
                activeOpacity={0.7}
              >
                <Text style={styles.adjustBtnText}>−100m</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.adjustBtn}
                onPress={() => handleAdjustRadius(100)}
                activeOpacity={0.7}
              >
                <Text style={styles.adjustBtnText}>+100m</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.adjustBtn}
                onPress={() => handleAdjustRadius(1000)}
                activeOpacity={0.7}
              >
                <Text style={styles.adjustBtnText}>+1km</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.adjustBtn}
                onPress={() => handleAdjustRadius(10000)}
                activeOpacity={0.7}
              >
                <Text style={styles.adjustBtnText}>+10km</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.customRadiusActions}>
            <Text style={styles.customInputHint}>
              Set any play area between 50m to 400,000m (400km).
            </Text>
            <TouchableOpacity
              style={styles.openMapBtn}
              onPress={() => router.push('/map/editor')}
              activeOpacity={0.8}
            >
              <Text style={styles.openMapBtnText}>🗺️ PIN & ADJUST ON MAP</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Play Zone Map Center Origin Option */}
      <Text style={styles.sectionTitle}>PLAY ZONE MAP CENTER ANCHOR</Text>
      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[
            styles.modeCard,
            zoneOriginMode === 'GPS' && styles.modeCardActive,
          ]}
          onPress={() => setZoneOriginMode('GPS')}
          activeOpacity={0.8}
        >
          <Text style={styles.modeIcon}>📍</Text>
          <Text
            style={[
              styles.modeTitle,
              zoneOriginMode === 'GPS' && styles.modeTitleActive,
            ]}
          >
            DEVICE GPS
          </Text>
          <Text style={styles.modeDesc}>Centered at Host GPS</Text>
          <View style={styles.modePillBadge}>
            <Text style={styles.modePillText}>DEFAULT</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.modeCard,
            zoneOriginMode === 'CUSTOM' && styles.modeCardActive,
          ]}
          onPress={() => {
            setZoneOriginMode('CUSTOM');
            if (!customCenter) {
              router.push('/map/editor');
            }
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.modeIcon}>🎯</Text>
          <Text
            style={[
              styles.modeTitle,
              zoneOriginMode === 'CUSTOM' && styles.modeTitleActive,
            ]}
          >
            CUSTOM MAP
          </Text>
          <Text style={styles.modeDesc}>
            {customCenter
              ? `[${customCenter.lat.toFixed(3)}, ${customCenter.lng.toFixed(3)}]`
              : 'Tap to Select On Map'}
          </Text>
          <View style={styles.modePillBadge}>
            <Text style={styles.modePillText}>MANUAL</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Play Zone Dynamic Shrink Mode (PUBG / Free Fire) */}
      <Text style={styles.sectionTitle}>DYNAMIC ZONE SHRINK MODE</Text>
      <View style={styles.shrinkCol}>
        <TouchableOpacity
          style={[
            styles.shrinkCard,
            selectedShrinkMode === 'NONE' && styles.shrinkCardActive,
          ]}
          onPress={() => setSelectedShrinkMode('NONE')}
          activeOpacity={0.8}
        >
          <View style={styles.shrinkRow}>
            <Text style={styles.shrinkIcon}>🛡️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.shrinkTitle}>1. STATIC (NO SHRINK)</Text>
              <Text style={styles.shrinkDesc}>Fixed boundary throughout the entire match</Text>
            </View>
            {selectedShrinkMode === 'NONE' && (
              <View style={styles.shrinkActiveBadge}>
                <Text style={styles.shrinkActiveBadgeText}>ACTIVE</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.shrinkCard,
            selectedShrinkMode === 'CONCENTRIC' && styles.shrinkCardActive,
          ]}
          onPress={() => setSelectedShrinkMode('CONCENTRIC')}
          activeOpacity={0.8}
        >
          <View style={styles.shrinkRow}>
            <Text style={styles.shrinkIcon}>🎯</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.shrinkTitle}>2. CONCENTRIC SHRINK</Text>
              <Text style={styles.shrinkDesc}>Zone shrinks inwards towards original center anchor</Text>
            </View>
            {selectedShrinkMode === 'CONCENTRIC' && (
              <View style={styles.shrinkActiveBadge}>
                <Text style={styles.shrinkActiveBadgeText}>ACTIVE</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.shrinkCard,
            selectedShrinkMode === 'BATTLE_ROYALE' && styles.shrinkCardActiveBR,
          ]}
          onPress={() => setSelectedShrinkMode('BATTLE_ROYALE')}
          activeOpacity={0.8}
        >
          <View style={styles.shrinkRow}>
            <Text style={styles.shrinkIcon}>⚡</Text>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.shrinkTitle, { color: colors.hunter.primary }]}>
                  3. BATTLE ROYALE (PUBG / FREE FIRE)
                </Text>
                <View style={styles.popularBadge}>
                  <Text style={styles.popularBadgeText}>POPULAR</Text>
                </View>
              </View>
              <Text style={styles.shrinkDesc}>
                Next safe white zone appears randomly inside current circle in timed shrink phases
              </Text>
            </View>
            {selectedShrinkMode === 'BATTLE_ROYALE' && (
              <View style={styles.shrinkActiveBadgeBR}>
                <Text style={styles.shrinkActiveBadgeText}>ACTIVE</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Configuration Summary */}
      <Card variant="glass" style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>MATCH PARAMETERS SUMMARY</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Game Mode:</Text>
          <Text style={styles.summaryVal}>
            {selectedMode === 'ONE_CATCH'
              ? '⚡ Sudden Death (1 Catch = Out)'
              : `❤️ Survival Lives (${customHearts} Hearts)`}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Time Limit:</Text>
          <Text style={styles.summaryVal}>
            {selectedDuration >= 60
              ? `${(selectedDuration / 60).toFixed(1).replace(/\.0$/, '')} Hours (${selectedDuration} Mins)`
              : `${selectedDuration} Minutes`}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Location Reveal Time:</Text>
          <Text style={styles.summaryVal}>
            {selectedPing >= 3600
              ? `Every ${(selectedPing / 3600).toFixed(1).replace(/\.0$/, '')} Hours (${selectedPing}s)`
              : selectedPing >= 60
              ? `Every ${Math.floor(selectedPing / 60)}m ${selectedPing % 60 ? `${selectedPing % 60}s` : ''} (${selectedPing}s)`
              : `Every ${selectedPing} Seconds`}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Play Zone Area:</Text>
          <Text style={styles.summaryVal}>
            {selectedRadius >= 1000
              ? `${(selectedRadius / 1000).toFixed(1).replace(/\.0$/, '')}km (${selectedRadius.toLocaleString()}m Radius)`
              : `${selectedRadius}m Radius`}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Play Zone Center:</Text>
          <Text style={styles.summaryVal}>
            {zoneOriginMode === 'CUSTOM' && customCenter
              ? `🎯 Custom [${customCenter.lat.toFixed(4)}, ${customCenter.lng.toFixed(4)}]`
              : '📍 Current Device GPS'}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Zone Shrink Mode:</Text>
          <Text style={[styles.summaryVal, { color: selectedShrinkMode === 'BATTLE_ROYALE' ? colors.hunter.primary : colors.text.primary }]}>
            {selectedShrinkMode === 'NONE'
              ? '🛡️ Static (No Shrink)'
              : selectedShrinkMode === 'CONCENTRIC'
              ? '🎯 Concentric (Center Inwards)'
              : '⚡ Battle Royale (Dynamic Circles)'}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Catch Verification:</Text>
          <Text style={styles.summaryVal}>15 Meters Proximity + PIN</Text>
        </View>

        <Button
          title="🗺️ CONFIGURE MAP & ANCHOR"
          variant="secondary"
          size="sm"
          onPress={() => router.push('/map/editor')}
          style={{ marginTop: spacing.md }}
        />
      </Card>

      <Button
        title={isLoading ? 'CREATING MATCH...' : 'CREATE MATCH ROOM'}
        variant="gradient"
        size="lg"
        fullWidth
        loading={isLoading}
        onPress={handleCreate}
        style={styles.submitBtn}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.base,
  },
  content: {
    padding: spacing.lg,
  },
  sectionTitle: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.xs,
    letterSpacing: typography.letterSpacing.wide,
    fontWeight: '800',
    marginTop: spacing.md,
    marginBottom: spacing.xs + 2,
  },
  sectionSubTitle: {
    color: colors.text.muted,
    fontSize: 10,
    marginTop: -2,
    marginBottom: spacing.xs + 4,
    lineHeight: 14,
  },
  subSectionTitle: {
    color: colors.hunter.primary,
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  modeCard: {
    flex: 1,
    padding: spacing.md,
    backgroundColor: colors.background.surfaceCard,
    borderColor: colors.border.glass,
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeCardActive: {
    backgroundColor: 'rgba(232, 93, 59, 0.16)',
    borderColor: colors.brand.gradientMid,
  },
  modeIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  modeTitle: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.xs,
    fontWeight: '900',
    letterSpacing: 1,
  },
  modeTitleActive: {
    color: colors.text.primary,
  },
  modeDesc: {
    color: colors.text.muted,
    fontSize: 9,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 6,
  },
  modePillBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: borderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  modePillText: {
    color: colors.brand.gradientEnd,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  customHeartsBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  optionPill: {
    flex: 1,
    paddingVertical: spacing.sm + 4,
    backgroundColor: colors.background.surfaceCard,
    borderColor: colors.border.glass,
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  optionPillActive: {
    backgroundColor: 'rgba(232, 93, 59, 0.15)',
    borderColor: colors.brand.gradientMid,
  },
  optionPillActiveHearts: {
    backgroundColor: 'rgba(239, 68, 68, 0.20)',
    borderColor: colors.status.danger,
  },
  optionText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.xs,
    fontWeight: '800',
    letterSpacing: 1,
  },
  optionTextActive: {
    color: colors.brand.gradientEnd,
  },
  optionTextActiveHearts: {
    color: '#EF4444',
  },
  summaryCard: {
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  summaryTitle: {
    color: colors.hunter.primary,
    fontWeight: '900',
    fontSize: typography.fontSize.xs,
    letterSpacing: typography.letterSpacing.tactical,
    marginBottom: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  summaryLabel: {
    color: colors.text.muted,
    fontSize: typography.fontSize.xs,
  },
  summaryVal: {
    color: colors.text.primary,
    fontSize: typography.fontSize.xs,
    fontWeight: '800',
  },
  shrinkCol: {
    gap: spacing.xs + 2,
    marginBottom: spacing.sm,
  },
  shrinkCard: {
    backgroundColor: '#121620',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    padding: spacing.sm + 4,
  },
  shrinkCardActive: {
    borderColor: colors.brand.gradientMid,
    backgroundColor: 'rgba(232, 93, 59, 0.12)',
  },
  shrinkCardActiveBR: {
    borderColor: colors.hunter.primary,
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
  },
  shrinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  shrinkIcon: {
    fontSize: 22,
  },
  shrinkTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  shrinkDesc: {
    color: colors.text.muted,
    fontSize: 10,
    marginTop: 2,
    lineHeight: 14,
  },
  popularBadge: {
    backgroundColor: colors.hunter.primary,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  popularBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  shrinkActiveBadge: {
    backgroundColor: 'rgba(232, 93, 59, 0.25)',
    borderColor: colors.brand.gradientMid,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  shrinkActiveBadgeBR: {
    backgroundColor: 'rgba(255, 59, 48, 0.25)',
    borderColor: colors.hunter.primary,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  shrinkActiveBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  optionPillActiveCustom: {
    backgroundColor: 'rgba(0, 229, 255, 0.16)',
    borderColor: colors.runner.primary,
  },
  optionTextActiveCustom: {
    color: colors.runner.primary,
  },
  customInputCard: {
    backgroundColor: '#121620',
    borderColor: 'rgba(0, 229, 255, 0.3)',
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    padding: spacing.sm + 4,
    marginBottom: spacing.sm,
  },
  customInputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  customInputLabel: {
    color: colors.text.muted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  customInputVal: {
    color: colors.runner.primary,
    fontSize: 11,
    fontWeight: '900',
    fontFamily: typography.fontFamily.mono,
  },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  customTextInput: {
    backgroundColor: '#1A2130',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingVertical: 6,
    width: 80,
    textAlign: 'center',
  },
  customUnitText: {
    color: colors.text.secondary,
    fontSize: 11,
    fontWeight: '700',
  },
  customAdjustGroup: {
    flexDirection: 'row',
    gap: 4,
    marginLeft: 'auto',
  },
  adjustBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  adjustBtnText: {
    color: colors.runner.primary,
    fontSize: 10,
    fontWeight: '800',
  },
  customInputHint: {
    color: colors.text.muted,
    fontSize: 9,
    marginTop: 6,
  },
  customRadiusActions: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  openMapBtn: {
    backgroundColor: 'rgba(232, 93, 59, 0.2)',
    borderColor: colors.brand.gradientMid,
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  openMapBtnText: {
    color: colors.brand.gradientEnd,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  submitBtn: {
    marginTop: spacing.xl,
  },
});
