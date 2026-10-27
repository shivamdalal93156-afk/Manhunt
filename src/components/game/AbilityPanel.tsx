import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AbilityType, ActiveEffect } from '@/types/game';
import { PlayerRole } from '@/types/lobby';
import { borderRadius, colors, spacing, typography } from '@/theme/tokens';

interface AbilityPanelProps {
  role: PlayerRole;
  activeEffects: ActiveEffect[];
  onActivate: (ability: AbilityType) => void;
  isNightStealth?: boolean;
}

export const AbilityPanel: React.FC<AbilityPanelProps> = ({
  role,
  activeEffects,
  onActivate,
  isNightStealth = false,
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
    icon: string,
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
        activeOpacity={0.75}
        disabled={isOnCooldown || isActive}
        style={[
          styles.abilityBtn,
          isNightStealth ? styles.abilityBtnNight : styles.abilityBtnLight,
          isActive && { borderColor: accentColor, backgroundColor: isNightStealth ? 'rgba(232, 93, 59, 0.2)' : 'rgba(232, 93, 59, 0.1)' },
          isOnCooldown && styles.abilityBtnCooldown,
        ]}
        onPress={() => onActivate(ability)}
      >
        <Text style={styles.abilityIcon}>{icon}</Text>
        <Text style={[styles.abilityTitle, { color: isActive ? accentColor : isNightStealth ? '#E2E8F0' : '#0F172A' }]}>
          {title.toUpperCase()}
        </Text>
        <Text style={[styles.abilityStatus, isActive && { color: accentColor }, isNightStealth ? styles.abilityStatusNight : styles.abilityStatusLight]}>
          {isActive
            ? `ACTIVE ${activeSec}s`
            : isOnCooldown
            ? `${cooldownSec}s`
            : sub}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, isNightStealth ? styles.containerNight : styles.containerLight]}>
      <Text style={[styles.panelHeader, isNightStealth ? styles.panelHeaderNight : styles.panelHeaderLight]}>TACTICAL ABILITIES</Text>
      <View style={styles.row}>
        {role === 'RUNNER' && (
          <>
            {renderAbilityButton('STEALTH', '👻', 'STEALTH', '45s CLOAK', colors.runner.primary)}
            {renderAbilityButton('MAP_VIEW', '🗺️', 'MAP SCAN', '15s REVEAL', colors.hunter.primary)}
            {renderAbilityButton('BLIND', '⚡', 'JAMMER', '20s BLIND', colors.referee.primary)}
          </>
        )}

        {role === 'HUNTER' && (
          <>
            {renderAbilityButton('PING', '📡', 'RADAR PING', 'REFRESH', colors.hunter.primary)}
            {renderAbilityButton('BLIND', '⚡', 'JAMMER', '20s BLIND', colors.referee.primary)}
            {renderAbilityButton('DECOY', '🎯', 'DECOY', 'SPOOF PING', colors.runner.primary)}
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
    backgroundColor: colors.background.surfaceCard,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderColor: colors.border.glass,
    borderWidth: 1,
  },
  containerLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  containerNight: {
    backgroundColor: '#050811',
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  panelHeader: {
    color: colors.text.muted,
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '800',
    marginBottom: spacing.xs + 2,
    textAlign: 'center',
  },
  panelHeaderLight: {
    color: '#64748B',
  },
  panelHeaderNight: {
    color: '#475569',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  abilityBtn: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  abilityBtnLight: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  abilityBtnNight: {
    backgroundColor: '#090D18',
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  abilityBtnCooldown: {
    opacity: 0.4,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  abilityIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  abilityTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  abilityStatus: {
    color: colors.text.muted,
    fontSize: 9,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  abilityStatusLight: {
    color: '#64748B',
  },
  abilityStatusNight: {
    color: '#475569',
  },
  refereeNotice: {
    color: colors.referee.primary,
    fontSize: typography.fontSize.xs,
    fontStyle: 'italic',
    padding: spacing.xs,
    textAlign: 'center',
  },
});

