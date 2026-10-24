import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AbilityType, ActiveEffect } from '@/types/game';
import { PlayerRole } from '@/types/lobby';
import { borderRadius, colors, spacing, typography } from '@/theme/tokens';

interface AbilityPanelProps {
  role: PlayerRole;
  activeEffects: ActiveEffect[];
  onActivate: (ability: AbilityType) => void;
}

export const AbilityPanel: React.FC<AbilityPanelProps> = ({
  role,
  activeEffects,
  onActivate,
}) => {
  const [, setTick] = useState(0);

  // Force re-render every second to update cooldown countdowns
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const now = Date.now();

  const getCooldownSeconds = (ability: AbilityType): number => {
    const effect = activeEffects.find(
      (e) => e.ability === ability && e.cooldownUntil > now
    );
    if (!effect) return 0;
    return Math.max(0, Math.ceil((effect.cooldownUntil - now) / 1000));
  };

  const getActiveSeconds = (ability: AbilityType): number => {
    const effect = activeEffects.find(
      (e) => e.ability === ability && e.expiresAt > now
    );
    if (!effect) return 0;
    return Math.max(0, Math.ceil((effect.expiresAt - now) / 1000));
  };

  const renderAbilityButton = (
    ability: AbilityType,
    title: string,
    sub: string,
    accentColor: string
  ) => {
    const cooldownSec = getCooldownSeconds(ability);
    const activeSec = getActiveSeconds(ability);
    const isOnCooldown = cooldownSec > 0;
    const isActive = activeSec > 0;

    return (
      <TouchableOpacity
        key={ability}
        activeOpacity={0.7}
        disabled={isOnCooldown || isActive}
        style={[
          styles.abilityBtn,
          isActive && { borderColor: accentColor, backgroundColor: 'rgba(0, 240, 255, 0.15)' },
          isOnCooldown && styles.abilityBtnCooldown,
        ]}
        onPress={() => onActivate(ability)}
      >
        <Text style={[styles.abilityTitle, { color: accentColor }]}>
          {title.toUpperCase()}
        </Text>
        <Text style={styles.abilityStatus}>
          {isActive
            ? `ACTIVE (${activeSec}s)`
            : isOnCooldown
            ? `WAIT (${cooldownSec}s)`
            : sub}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.panelHeader}>TACTICAL ABILITIES</Text>
      <View style={styles.row}>
        {role === 'RUNNER' && (
          <>
            {renderAbilityButton('STEALTH', 'STEALTH', 'HIDE 45s', colors.runner.primary)}
            {renderAbilityButton('MAP_VIEW', 'MAP VIEW', 'SCAN 15s', colors.hunter.primary)}
            {renderAbilityButton('BLIND', 'JAMMER', 'BLIND 20s', colors.referee.primary)}
          </>
        )}

        {role === 'HUNTER' && (
          <>
            {renderAbilityButton('PING', 'RADAR PING', 'REFRESH', colors.hunter.primary)}
            {renderAbilityButton('BLIND', 'RADAR JAM', 'BLIND 20s', colors.referee.primary)}
            {renderAbilityButton('DECOY', 'DECOY PING', 'SPOOF', colors.runner.primary)}
          </>
        )}

        {role === 'REFEREE' && (
          <Text style={styles.refereeNotice}>
            SUPERVISOR OVERWATCH: Unrestricted sensor telemetry active.
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.sm,
    backgroundColor: colors.background.surface,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderColor: colors.border.subtle,
    borderWidth: 1,
  },
  panelHeader: {
    color: colors.text.muted,
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  abilityBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: 4,
    backgroundColor: colors.background.elevated,
    borderColor: colors.border.active,
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
  },
  abilityBtnCooldown: {
    opacity: 0.45,
  },
  abilityTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  abilityStatus: {
    color: colors.text.muted,
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
  },
  refereeNotice: {
    color: colors.referee.primary,
    fontSize: typography.fontSize.xs,
    fontStyle: 'italic',
    padding: spacing.xs,
  },
});
