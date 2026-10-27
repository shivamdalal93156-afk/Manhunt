import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Button,
  Card,
  Chip,
  Screen,
  SegmentedControl,
  SettingRow,
  Toggle,
  TopBar,
} from '@/components/ui';
import { lobbyService } from '@/services/lobby/lobbyService';
import { useLobbyStore } from '@/store/lobbyStore';
import { ZoneShrinkMode } from '@/types/lobby';
import { borderRadius, colors, shadows, spacing, typography } from '@/theme/tokens';

const HEAD_START_PRESETS = [0, 30, 60, 90, 120, 180];
const MAX_USES_OPTIONS = [
  { value: 'unlimited', label: 'Unlimited' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '5', label: '5' },
];

export default function AdvancedSettingsScreen() {
  const router = useRouter();
  const { lobbyState, session } = useLobbyStore();
  const isHost = session?.isHost ?? false;

  const currentSettings = lobbyState?.settings;

  // Head Start
  const [headStart, setHeadStart] = useState<number>(
    currentSettings?.headStartSeconds ?? 60
  );

  // Caught runners become chasers
  const [caughtBecomeChasers, setCaughtBecomeChasers] = useState<boolean>(false);

  // Hearts
  const [hearts, setHearts] = useState<number>(
    currentSettings?.runnerHearts ?? 3
  );

  // Spectators
  const [allowSpectators, setAllowSpectators] = useState<boolean>(
    currentSettings?.allowSpectators ?? true
  );

  // Zone shrink
  const [shrinkMode, setShrinkMode] = useState<ZoneShrinkMode>(
    currentSettings?.zoneShrinkMode ?? 'NONE'
  );

  // Tactical abilities
  const [abilitiesEnabled, setAbilitiesEnabled] = useState<boolean>(
    currentSettings?.tacticalAbilities?.enabled ?? true
  );
  const [maxUses, setMaxUses] = useState<string>(
    currentSettings?.tacticalAbilities?.maxUsesPerPlayer
      ? String(currentSettings.tacticalAbilities.maxUsesPerPlayer)
      : 'unlimited'
  );
  const [stealthEnabled, setStealthEnabled] = useState<boolean>(true);
  const [mapScanEnabled, setMapScanEnabled] = useState<boolean>(true);
  const [jammerEnabled, setJammerEnabled] = useState<boolean>(true);
  const [decoyEnabled, setDecoyEnabled] = useState<boolean>(true);

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!lobbyState?.gameId) return;

    if (!isHost) {
      Alert.alert('Host Only', 'Only the match host can modify game settings.');
      return;
    }

    setIsSaving(true);
    try {
      const allowedList: string[] = [];
      if (stealthEnabled) allowedList.push('stealth');
      if (mapScanEnabled) allowedList.push('mapScan');
      if (jammerEnabled) allowedList.push('jammer');
      if (decoyEnabled) allowedList.push('decoy');

      const maxUsesVal = maxUses === 'unlimited' ? null : parseInt(maxUses, 10);

      await lobbyService.updateGameSettings(lobbyState.gameId, {
        headStartSeconds: headStart,
        runnerHearts: hearts,
        allowSpectators,
        zoneShrinkMode: shrinkMode,
        tacticalAbilities: {
          enabled: abilitiesEnabled,
          allowedAbilities: allowedList,
          maxUsesPerPlayer: maxUsesVal,
        },
      });

      router.back();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save settings.';
      Alert.alert('Error', msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Screen scroll>
      <TopBar title="ADVANCED SETTINGS" onBack={() => router.back()} />

      <View style={styles.container}>
        {/* Head Start */}
        <Text style={styles.sectionTitle}>RUNNER HEAD START</Text>
        <Card variant="portal" style={styles.card}>
          <Text style={styles.cardDesc}>
            Time runners have to scatter and hide before chasers are released.
          </Text>
          <View style={styles.chipsRow}>
            {HEAD_START_PRESETS.map((seconds) => (
              <Chip
                key={seconds}
                label={seconds === 0 ? '0s (None)' : `${seconds}s`}
                selected={headStart === seconds}
                onPress={isHost ? () => setHeadStart(seconds) : undefined}
                disabled={!isHost}
                style={styles.chip}
              />
            ))}
          </View>
        </Card>

        {/* Caught Runners Become Chasers */}
        <Text style={styles.sectionTitle}>CATCH TRANSMUTATION</Text>
        <Card variant="portal" style={styles.card}>
          <SettingRow
            title="Caught Runners Become Chasers"
            description="Eliminated runners flip roles and join the hunt squad."
            rightElement={
              <Toggle
                value={caughtBecomeChasers}
                onValueChange={isHost ? setCaughtBecomeChasers : () => {}}
                disabled={!isHost}
              />
            }
            borderBottom={false}
          />
        </Card>

        {/* Runner Hearts */}
        <Text style={styles.sectionTitle}>RUNNER SURVIVAL HEARTS</Text>
        <Card variant="portal" style={styles.card}>
          <Text style={styles.cardDesc}>
            Number of tags a runner can withstand before being eliminated.
          </Text>
          <View style={styles.heartsRow}>
            {[1, 2, 3, 5, 10].map((count) => (
              <TouchableOpacity
                key={count}
                activeOpacity={0.8}
                disabled={!isHost}
                onPress={() => setHearts(count)}
                style={[
                  styles.heartBtn,
                  hearts === count && styles.heartBtnSelected,
                ]}
              >
                <Ionicons
                  name="heart"
                  size={20}
                  color={hearts === count ? '#EF4444' : '#9CA3AF'}
                />
                <Text
                  style={[
                    styles.heartText,
                    hearts === count && styles.heartTextSelected,
                  ]}
                >
                  {count} {count === 1 ? 'Heart' : 'Hearts'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Spectator Mode */}
        <Text style={styles.sectionTitle}>SPECTATOR PERMISSIONS</Text>
        <Card variant="portal" style={styles.card}>
          <SettingRow
            title="Allow Spectating After Elimination"
            description="Eliminated operatives can view the live satellite radar."
            rightElement={
              <Toggle
                value={allowSpectators}
                onValueChange={isHost ? setAllowSpectators : () => {}}
                disabled={!isHost}
              />
            }
            borderBottom={false}
          />
        </Card>

        {/* Zone Shrink Mode */}
        <Text style={styles.sectionTitle}>PLAY ZONE SHRINK MODE</Text>
        <Card variant="portal" style={styles.card}>
          <SegmentedControl
            options={[
              { value: 'NONE', label: 'Static (Off)' },
              { value: 'CONCENTRIC', label: 'Concentric' },
              { value: 'BATTLE_ROYALE', label: 'Danger Zone' },
            ]}
            value={shrinkMode}
            onChange={isHost ? (v) => setShrinkMode(v as ZoneShrinkMode) : () => {}}
          />
          <View style={styles.shrinkDescriptionBox}>
            <Ionicons name="information-circle-outline" size={16} color={colors.text.secondary} />
            <Text style={styles.shrinkDescriptionText}>
              {shrinkMode === 'NONE' && 'Static: Zone boundaries remain fixed throughout the entire match.'}
              {shrinkMode === 'CONCENTRIC' && 'Concentric: Play zone steadily shrinks towards the center over time.'}
              {shrinkMode === 'BATTLE_ROYALE' && 'Danger Zone: Battle royale storm contracts; staying outside drains hearts.'}
            </Text>
          </View>
        </Card>

        {/* Tactical Abilities */}
        <Text style={styles.sectionTitle}>TACTICAL ABILITIES</Text>
        <Card variant="portal" style={styles.card}>
          <SettingRow
            title="Enable Tactical Abilities"
            description="Allow operatives to trigger electronic warfare power-ups."
            rightElement={
              <Toggle
                value={abilitiesEnabled}
                onValueChange={isHost ? setAbilitiesEnabled : () => {}}
                disabled={!isHost}
              />
            }
          />

          {abilitiesEnabled && (
            <>
              <View style={styles.usesSection}>
                <Text style={styles.subLabel}>MAX USES PER PLAYER</Text>
                <SegmentedControl
                  options={MAX_USES_OPTIONS}
                  value={maxUses}
                  onChange={isHost ? setMaxUses : () => {}}
                />
              </View>

              <SettingRow
                title="Stealth Cloak"
                description="Conceals runner GPS coordinates during radar sweeps."
                rightElement={
                  <Toggle
                    value={stealthEnabled}
                    onValueChange={isHost ? setStealthEnabled : () => {}}
                    disabled={!isHost}
                  />
                }
              />
              <SettingRow
                title="Map Scan"
                description="Temporarily reveals live positions of chasers."
                rightElement={
                  <Toggle
                    value={mapScanEnabled}
                    onValueChange={isHost ? setMapScanEnabled : () => {}}
                    disabled={!isHost}
                  />
                }
              />
              <SettingRow
                title="Radar Jammer"
                description="Scrambles chaser radar feeds for 45 seconds."
                rightElement={
                  <Toggle
                    value={jammerEnabled}
                    onValueChange={isHost ? setJammerEnabled : () => {}}
                    disabled={!isHost}
                  />
                }
              />
              <SettingRow
                title="Decoy Beacon"
                description="Projects false GPS signatures away from true location."
                rightElement={
                  <Toggle
                    value={decoyEnabled}
                    onValueChange={isHost ? setDecoyEnabled : () => {}}
                    disabled={!isHost}
                  />
                }
                borderBottom={false}
              />
            </>
          )}
        </Card>

        {/* Save Button (Host Only) */}
        {isHost && (
          <View style={styles.bottomBar}>
            <Button
              title={isSaving ? 'SAVING SETTINGS...' : 'APPLY SETTINGS'}
              variant="gradient"
              size="lg"
              fullWidth
              loading={isSaving}
              onPress={handleSave}
            />
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    letterSpacing: typography.letterSpacing.tactical,
    color: colors.text.muted,
    marginBottom: spacing.xs,
    marginLeft: 4,
  },
  card: {
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.lg,
  },
  cardDesc: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    marginBottom: spacing.md,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    minWidth: 70,
  },
  heartsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  heartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: colors.border.default,
    borderRadius: borderRadius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
    ...shadows.sm,
  },
  heartBtnSelected: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  heartText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  heartTextSelected: {
    color: '#EF4444',
  },
  usesSection: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.default,
  },
  subLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: colors.text.muted,
    marginBottom: spacing.xs,
  },
  bottomBar: {
    marginTop: spacing.md,
    marginBottom: spacing.xxl,
  },
  shrinkDescriptionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 12,
    gap: 8,
  },
  shrinkDescriptionText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: colors.text.secondary,
    fontWeight: '500',
  },
});
