import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Badge,
  Button,
  Card,
  ErrorFallback,
  LoadingSpinner,
} from '@/components/ui';
import { useLobbyStore } from '@/store/lobbyStore';
import { LobbyPlayer, PlayerRole } from '@/types/lobby';
import { borderRadius, colors, spacing, typography } from '@/theme/tokens';

export default function LobbyScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    session,
    lobbyState,
    isLoading,
    error,
    subscribeToLobby,
    updateRole,
    toggleReady,
    startMatch,
    leaveMatch,
    clearError,
  } = useLobbyStore();

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    const unsubscribe = subscribeToLobby(id);
    return () => {
      unsubscribe();
    };
  }, [id, subscribeToLobby]);

  // Handle match launch -> route to role-specific gameplay screen
  useEffect(() => {
    if (lobbyState?.status === 'COUNTDOWN' || lobbyState?.status === 'ACTIVE') {
      const myRole = session?.myRole ?? 'RUNNER';
      if (myRole === 'HUNTER') {
        router.replace('/game/hunter');
      } else if (myRole === 'REFEREE') {
        router.replace('/game/referee');
      } else {
        router.replace('/game/runner');
      }
    }
  }, [lobbyState?.status, session?.myRole, router]);

  if (!lobbyState) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LoadingSpinner message="JOINING SATELLITE LOBBY..." />
      </SafeAreaView>
    );
  }

  const isHost = session?.isHost ?? false;
  const hunters = lobbyState.players.filter((p) => p.role === 'HUNTER');
  const runners = lobbyState.players.filter((p) => p.role === 'RUNNER');
  const referees = lobbyState.players.filter((p) => p.role === 'REFEREE');

  const canStartMatch = hunters.length >= 1 && runners.length >= 1;
  const myPlayer = lobbyState.players.find((p) => p.id === session?.myPlayerId);

  const handleCopyCode = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeave = () => {
    Alert.alert('LEAVE LOBBY', 'Are you sure you want to exit this match lobby?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          await leaveMatch();
          router.replace('/');
        },
      },
    ]);
  };

  const handleStartGame = async () => {
    try {
      await startMatch();
    } catch (err: unknown) {
      Alert.alert(
        'CANNOT START MATCH',
        err instanceof Error ? err.message : 'Failed to start match on server'
      );
    }
  };

  const renderPlayerRow = (player: LobbyPlayer) => {
    const isMe = player.id === session?.myPlayerId;

    return (
      <View key={player.id} style={styles.playerRow}>
        <View style={styles.playerInfo}>
          <View
            style={[
              styles.avatar,
              player.role === 'HUNTER' && styles.avatarHunter,
              player.role === 'RUNNER' && styles.avatarRunner,
              player.role === 'REFEREE' && styles.avatarReferee,
            ]}
          >
            <Text style={styles.avatarText}>
              {player.displayName.slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View style={styles.playerNameCol}>
            <View style={styles.nameBadges}>
              <Text style={styles.playerName}>
                {player.displayName} {isMe ? '(YOU)' : ''}
              </Text>
              {player.isHost && <Badge label="HOST" variant="warning" />}
            </View>
            <Text style={styles.playerRoleText}>
              {player.isReady ? 'READY FOR COMBAT' : 'STANDBY'}
            </Text>
          </View>
        </View>

        {/* Host role swap authority controls */}
        {isHost ? (
          <View style={styles.hostRoleControls}>
            <TouchableOpacity
              style={[
                styles.roleSwapPill,
                player.role === 'HUNTER'
                  ? styles.roleSwapPillHunterActive
                  : styles.roleSwapPillInactive,
              ]}
              onPress={() => updateRole(player.id, 'HUNTER')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.roleSwapText,
                  player.role === 'HUNTER' && styles.roleSwapTextHunterActive,
                ]}
              >
                ⚡ CHASER
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.roleSwapPill,
                player.role === 'RUNNER'
                  ? styles.roleSwapPillRunnerActive
                  : styles.roleSwapPillInactive,
              ]}
              onPress={() => updateRole(player.id, 'RUNNER')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.roleSwapText,
                  player.role === 'RUNNER' && styles.roleSwapTextRunnerActive,
                ]}
              >
                🏃 RUNNER
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Badge
            label={player.isReady ? 'READY' : 'WAITING'}
            variant={player.isReady ? 'safe' : 'neutral'}
          />
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Error Alert */}
        {error && (
          <ErrorFallback
            error={error}
            onRetry={clearError}
            title="LOBBY ERROR"
          />
        )}

        {/* Join Code Header Banner */}
        <Card variant="glass" style={styles.codeCard}>
          <Text style={styles.codeEyebrow}>INVITATION JOIN CODE</Text>
          <View style={styles.codeRow}>
            <Text style={styles.codeText}>{lobbyState.joinCode}</Text>
            <TouchableOpacity
              style={styles.copyBtn}
              onPress={handleCopyCode}
              activeOpacity={0.7}
            >
              <Text style={styles.copyText}>
                {copied ? 'COPIED!' : 'SHARE CODE'}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.codeHint}>
            Share this 6-character code with players to enter this match.
          </Text>
        </Card>

        {/* Match Rule Telemetry */}
        <View style={styles.telemetryRow}>
          <View style={styles.telemetryBox}>
            <Text style={styles.telemetryLabel}>DURATION</Text>
            <Text style={styles.telemetryVal}>
              {lobbyState.settings.durationMinutes >= 60
                ? `${(lobbyState.settings.durationMinutes / 60).toFixed(lobbyState.settings.durationMinutes % 60 ? 1 : 0)}h`
                : `${lobbyState.settings.durationMinutes}m`}
            </Text>
          </View>
          <View style={styles.telemetryBox}>
            <Text style={styles.telemetryLabel}>GPS REVEAL</Text>
            <Text style={styles.telemetryVal}>
              {lobbyState.settings.locationPingIntervalSeconds >= 3600
                ? `${(lobbyState.settings.locationPingIntervalSeconds / 3600).toFixed(1).replace(/\.0$/, '')}h`
                : lobbyState.settings.locationPingIntervalSeconds >= 60
                ? `${Math.floor(lobbyState.settings.locationPingIntervalSeconds / 60)}m`
                : `${lobbyState.settings.locationPingIntervalSeconds}s`}
            </Text>
          </View>
          <View style={styles.telemetryBox}>
            <Text style={styles.telemetryLabel}>PLAY ZONE</Text>
            <Text style={styles.telemetryVal}>
              {lobbyState.playZone.radiusMeters >= 1000
                ? `${(lobbyState.playZone.radiusMeters / 1000).toFixed(lobbyState.playZone.radiusMeters % 1000 ? 1 : 0)}km`
                : `${lobbyState.playZone.radiusMeters}m`}
            </Text>
          </View>
          <View style={styles.telemetryBox}>
            <Text style={styles.telemetryLabel}>PLAYERS</Text>
            <Text style={styles.telemetryVal}>
              {lobbyState.players.length}/{lobbyState.settings.maxPlayers}
            </Text>
          </View>
        </View>

        {/* Game Mode Banner */}
        <View style={styles.modeRuleBanner}>
          <Text style={styles.modeRuleIcon}>
            {lobbyState.settings.runnerHearts === 1 ? '⚡' : '❤️'}
          </Text>
          <Text style={styles.modeRuleText}>
            {lobbyState.settings.runnerHearts === 1
              ? 'SUDDEN DEATH: 1 Catch = Immediate Elimination'
              : `SURVIVAL MODE: Runners have ${lobbyState.settings.runnerHearts} Lives / Hearts`}
          </Text>
        </View>

        {/* Hunters Squadron */}
        <View style={styles.squadHeader}>
          <Text style={styles.squadTitleHunter}>
            CHASERS ({hunters.length})
          </Text>
          <Badge label="HUNTER" variant="hunter" />
        </View>
        <Card variant="hunter" style={styles.squadCard}>
          {hunters.length > 0 ? (
            hunters.map(renderPlayerRow)
          ) : (
            <Text style={styles.emptySquadText}>
              No Hunters assigned. Match requires at least 1 Hunter.
            </Text>
          )}
        </Card>

        {/* Runners Squadron */}
        <View style={styles.squadHeader}>
          <Text style={styles.squadTitleRunner}>
            EVADERS ({runners.length})
          </Text>
          <Badge label="RUNNER" variant="runner" />
        </View>
        <Card variant="runner" style={styles.squadCard}>
          {runners.length > 0 ? (
            runners.map(renderPlayerRow)
          ) : (
            <Text style={styles.emptySquadText}>
              No Runners assigned. Match requires at least 1 Runner.
            </Text>
          )}
        </Card>

        {/* Supervisors Squadron (If any) */}
        {referees.length > 0 && (
          <>
            <View style={styles.squadHeader}>
              <Text style={styles.squadTitleReferee}>
                SUPERVISORS ({referees.length})
              </Text>
              <Badge label="SAFETY" variant="referee" />
            </View>
            <Card variant="referee" style={styles.squadCard}>
              {referees.map(renderPlayerRow)}
            </Card>
          </>
        )}

        {/* Action Controls */}
        <View style={styles.actionSection}>
          {isHost ? (
            <>
              {!canStartMatch && (
                <Text style={styles.ruleNotice}>
                  ⚠️ Cannot start: Must have at least 1 Hunter and 1 Runner.
                </Text>
              )}
              <Button
                title={isLoading ? 'STARTING...' : 'LAUNCH MATCH'}
                variant="gradient"
                size="lg"
                fullWidth
                disabled={!canStartMatch || isLoading}
                onPress={handleStartGame}
                style={styles.mainActionBtn}
              />
            </>
          ) : (
            <Button
              title={myPlayer?.isReady ? 'MARK NOT READY' : 'I AM READY'}
              variant={myPlayer?.isReady ? 'secondary' : 'gradient'}
              size="lg"
              fullWidth
              onPress={toggleReady}
              style={styles.mainActionBtn}
            />
          )}

          <Button
            title="LEAVE MATCH"
            variant="ghost"
            size="md"
            fullWidth
            onPress={handleLeave}
          />
        </View>

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
  },
  codeCard: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    marginBottom: spacing.md,
    borderColor: 'rgba(232, 93, 59, 0.4)',
    borderWidth: 1.5,
  },
  codeEyebrow: {
    color: colors.hunter.primary,
    fontSize: typography.fontSize.xs,
    letterSpacing: typography.letterSpacing.wide,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  codeText: {
    color: colors.text.primary,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 8,
    fontFamily: typography.fontFamily.mono,
  },
  copyBtn: {
    backgroundColor: 'rgba(232, 93, 59, 0.15)',
    borderColor: colors.hunter.primary,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 3,
    borderRadius: borderRadius.full,
  },
  copyText: {
    color: colors.hunter.primary,
    fontSize: typography.fontSize.xs,
    fontWeight: '800',
    letterSpacing: 1,
  },
  codeHint: {
    color: colors.text.muted,
    fontSize: typography.fontSize.xs,
    marginTop: spacing.sm,
  },
  telemetryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  telemetryBox: {
    flex: 1,
    backgroundColor: colors.background.surfaceCard,
    borderColor: colors.border.glass,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    alignItems: 'center',
  },
  telemetryLabel: {
    color: colors.text.muted,
    fontSize: 9,
    letterSpacing: 1,
    fontWeight: '700',
  },
  telemetryVal: {
    color: colors.text.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: '800',
    marginTop: 2,
  },

  squadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  squadTitleHunter: {
    color: colors.hunter.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  squadTitleRunner: {
    color: colors.runner.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  squadTitleReferee: {
    color: colors.referee.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  squadCard: {
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  emptySquadText: {
    color: colors.text.muted,
    fontSize: typography.fontSize.xs,
    fontStyle: 'italic',
    padding: spacing.sm,
    textAlign: 'center',
  },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background.elevated,
    borderWidth: 1.5,
    borderColor: colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  avatarHunter: {
    borderColor: colors.hunter.primary,
  },
  avatarRunner: {
    borderColor: colors.runner.primary,
  },
  avatarReferee: {
    borderColor: colors.referee.primary,
  },
  avatarText: {
    color: colors.text.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  playerNameCol: {
    flex: 1,
  },
  nameBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  playerName: {
    color: colors.text.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
  },
  playerRoleText: {
    color: colors.text.muted,
    fontSize: 10,
    marginTop: 2,
  },
  hostRoleControls: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  roleSwapPill: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleSwapPillInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  roleSwapPillHunterActive: {
    borderColor: colors.hunter.primary,
    backgroundColor: 'rgba(232, 93, 59, 0.25)',
  },
  roleSwapPillRunnerActive: {
    borderColor: colors.runner.primary,
    backgroundColor: 'rgba(0, 229, 255, 0.2)',
  },
  roleSwapText: {
    color: colors.text.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  roleSwapTextHunterActive: {
    color: colors.brand.gradientEnd,
  },
  roleSwapTextRunnerActive: {
    color: colors.runner.primary,
  },
  actionSection: {
    marginTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  ruleNotice: {
    color: colors.status.warning,
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  mainActionBtn: {
    marginBottom: spacing.sm,
  },
  modeRuleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  modeRuleIcon: {
    fontSize: 14,
  },
  modeRuleText: {
    color: colors.text.primary,
    fontSize: typography.fontSize.xs,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
