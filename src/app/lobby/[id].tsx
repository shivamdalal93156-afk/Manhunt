import React, { useEffect, useState } from 'react';
import {
  Alert,
  Clipboard,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Avatar,
  Button,
  Card,
  Chip,
  LoadingSpinner,
  Screen,
  TopBar,
} from '@/components/ui';
import {
  ArrowBackIcon,
  SettingsIcon,
  CopyIcon,
  CheckIcon,
  TimerIcon,
  RadarIcon,
  ShapesIcon,
  FlashIcon,
  SprintIcon,
  HeartIcon,
} from '@/components/ui/Icons';
import { useLobbyStore } from '@/store/lobbyStore';
import { LobbyPlayer, PlayerRole } from '@/types/lobby';
import { borderRadius, colors, shadows, spacing, typography } from '@/theme/tokens';

export default function LobbyScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    session,
    lobbyState,
    subscribeToLobby,
    updateRole,
    toggleReady,
    startMatch,
    leaveMatch,
  } = useLobbyStore();

  const [copied, setCopied] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    if (!id) return;
    const unsubscribe = subscribeToLobby(id);
    return () => unsubscribe();
  }, [id, subscribeToLobby]);

  // Navigate when match launches
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
      <Screen>
        <LoadingSpinner message="JOINING LIVE SQUAD LOBBY..." />
      </Screen>
    );
  }

  const isHost = session?.isHost ?? false;
  const myPlayerId = session?.myPlayerId;
  const myPlayer = lobbyState.players.find((p) => p.id === myPlayerId);

  const hunters = lobbyState.players.filter((p) => p.role === 'HUNTER');
  const runners = lobbyState.players.filter((p) => p.role === 'RUNNER');
  const referees = lobbyState.players.filter((p) => p.role === 'REFEREE');

  const canStartMatch = hunters.length >= 1 && runners.length >= 1;

  const handleCopyCode = () => {
    Clipboard.setString(lobbyState.joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeaveLobby = () => {
    Alert.alert(
      'Leave Lobby',
      isHost
        ? 'As host, leaving will disband this match lobby. Are you sure?'
        : 'Are you sure you want to leave this match?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            await leaveMatch();
            router.replace('/');
          },
        },
      ]
    );
  };

  const handleSwitchRole = async (targetRole: PlayerRole) => {
    if (!myPlayerId || session?.myRole === targetRole) return;
    try {
      await updateRole(myPlayerId, targetRole);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to switch squad';
      Alert.alert('Error', msg);
    }
  };

  const handleStartGame = async () => {
    if (!canStartMatch) {
      Alert.alert(
        'More Operatives Needed',
        `A live tactical match requires at least 1 Chaser and 1 Runner (Match Code: ${lobbyState.joinCode}). Would you like to enter Solo Practice to preview your tactical HUD?`,
        [
          { text: 'Wait for Squad', style: 'cancel' },
          {
            text: 'Solo Practice',
            onPress: () => {
              const myRole = session?.myRole ?? 'HUNTER';
              if (myRole === 'RUNNER') {
                router.replace('/game/runner');
              } else if (myRole === 'REFEREE') {
                router.replace('/game/referee');
              } else {
                router.replace('/game/hunter');
              }
            },
          },
        ]
      );
      return;
    }

    setIsStarting(true);
    try {
      await startMatch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to launch match.';
      Alert.alert('Error', msg);
      setIsStarting(false);
    }
  };

  const settings = lobbyState.settings;
  const playZone = lobbyState.playZone;

  const getPlayZoneLabel = () => {
    if (!playZone || (playZone as any).mode === 'NONE') return 'Off (Infinite)';
    const shrink =
      settings?.zoneShrinkMode === 'BATTLE_ROYALE' || playZone.shrinkMode === 'BATTLE_ROYALE'
        ? ' (Danger)'
        : settings?.zoneShrinkMode === 'CONCENTRIC' || playZone.shrinkMode === 'CONCENTRIC'
        ? ' (Shrink)'
        : '';
    if (playZone.type === 'polygon') return `Polygon${shrink}`;
    return `${playZone.radiusMeters || 500}m${shrink}`;
  };

  return (
    <Screen scroll>
      {/* Top Bar with Join Code Capsule & Settings Gear */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleLeaveLobby}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowBackIcon size={20} color={colors.text.primary} />
        </TouchableOpacity>

        {/* Join Code Capsule */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleCopyCode}
          style={styles.codeCapsule}
        >
          <Text style={styles.codeLabel}>CODE</Text>
          <Text style={styles.codeValue}>{lobbyState.joinCode}</Text>
          {copied ? (
            <CheckIcon size={14} color={colors.status.safe} />
          ) : (
            <CopyIcon size={14} color={colors.text.muted} />
          )}
        </TouchableOpacity>

        {/* Advanced Settings Gear */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push('/lobby/settings' as any)}
          style={styles.gearBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <SettingsIcon size={20} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        {/* Squad Rosters (2 Columns: Chasers vs Runners) */}
        <View style={styles.rostersGrid}>
          {/* Chasers Column */}
          <View style={styles.squadCol}>
            <View style={[styles.squadHeader, { borderBottomColor: colors.hunter.primary }]}>
              <Text style={[styles.squadTitle, { color: colors.hunter.primary }]}>CHASERS</Text>
              <View style={[styles.countBadge, { backgroundColor: colors.hunter.primary }]}>
                <Text style={styles.countText}>{hunters.length}</Text>
              </View>
            </View>

            <View style={styles.playersList}>
              {hunters.map((p) => {
                const isMe = p.id === myPlayerId;
                return (
                  <Card key={p.id} variant="portal" style={[styles.playerCard, isMe && styles.myPlayerCard]}>
                    <Avatar name={p.displayName} size="sm" borderRole="chaser" />
                    <View style={styles.playerMeta}>
                      <Text style={styles.playerName} numberOfLines={1}>
                        {p.displayName} {isMe ? '(You)' : ''}
                      </Text>
                      <Text style={styles.playerSub}>
                        {p.isHost ? 'Host' : p.isReady ? 'Ready' : 'Standby'}
                      </Text>
                    </View>
                  </Card>
                );
              })}

              {session?.myRole !== 'HUNTER' && (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleSwitchRole('HUNTER')}
                  style={[styles.switchSquadBtn, { borderColor: colors.hunter.primary }]}
                >
                  <Text style={[styles.switchSquadText, { color: colors.hunter.primary }]}>
                    + Switch to Chaser
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Runners Column */}
          <View style={styles.squadCol}>
            <View style={[styles.squadHeader, { borderBottomColor: colors.runner.primary }]}>
              <Text style={[styles.squadTitle, { color: colors.runner.primary }]}>RUNNERS</Text>
              <View style={[styles.countBadge, { backgroundColor: colors.runner.primary }]}>
                <Text style={styles.countText}>{runners.length}</Text>
              </View>
            </View>

            <View style={styles.playersList}>
              {runners.map((p) => {
                const isMe = p.id === myPlayerId;
                return (
                  <Card key={p.id} variant="portal" style={[styles.playerCard, isMe && styles.myPlayerCard]}>
                    <Avatar name={p.displayName} size="sm" borderRole="runner" />
                    <View style={styles.playerMeta}>
                      <Text style={styles.playerName} numberOfLines={1}>
                        {p.displayName} {isMe ? '(You)' : ''}
                      </Text>
                      <Text style={styles.playerSub}>
                        {p.isHost ? 'Host' : p.isReady ? 'Ready' : 'Standby'}
                      </Text>
                    </View>
                  </Card>
                );
              })}

              {session?.myRole !== 'RUNNER' && (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleSwitchRole('RUNNER')}
                  style={[styles.switchSquadBtn, { borderColor: colors.runner.primary }]}
                >
                  <Text style={[styles.switchSquadText, { color: colors.runner.primary }]}>
                    + Switch to Runner
                  </Text>
                </TouchableOpacity>
              )}

              {runners.length === 0 && (
                <View style={styles.awaitingCard}>
                  <View style={styles.awaitingIconCircle}>
                    <SprintIcon size={18} color={colors.runner.primary} />
                  </View>
                  <Text style={styles.awaitingTitle}>Awaiting Runners</Text>
                  <Text style={styles.awaitingSub}>Invite with code {lobbyState.joinCode}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Referee Row */}
        {referees.length > 0 || session?.myRole === 'REFEREE' ? (
          <Card variant="portal" style={styles.refereeCard}>
            <View style={styles.refereeHeader}>
              <Ionicons name="eye" size={18} color={colors.referee.primary} />
              <Text style={styles.refereeTitle}>OVERSEEING REFEREE</Text>
            </View>
            {referees.map((r) => (
              <View key={r.id} style={styles.refereeRow}>
                <Avatar name={r.displayName} size="sm" borderRole="referee" />
                <Text style={styles.refereeName}>{r.displayName}</Text>
              </View>
            ))}
          </Card>
        ) : (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => handleSwitchRole('REFEREE')}
            style={styles.becomeRefereeBtn}
          >
            <Ionicons name="eye-outline" size={16} color={colors.referee.primary} />
            <Text style={styles.becomeRefereeText}>Join as Referee (God Mode Spectator)</Text>
          </TouchableOpacity>
        )}

        {/* 2x3 Settings Grid with Tactical Icon Pills */}
        <Text style={styles.gridSectionHeader}>MATCH CONFIGURATION</Text>
        <View style={styles.settingsGrid}>
          {/* Card 1: Duration */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={isHost ? () => router.push('/create' as any) : undefined}
            style={styles.gridCard}
          >
            <View style={[styles.cardIconPill, { backgroundColor: 'rgba(249, 115, 22, 0.12)' }]}>
              <TimerIcon size={18} color="#EA580C" />
            </View>
            <Text style={styles.gridValue}>{settings?.durationMinutes || 30} mins</Text>
            <Text style={styles.gridLabel}>DURATION</Text>
          </TouchableOpacity>

          {/* Card 2: Ping Interval */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={isHost ? () => router.push('/create' as any) : undefined}
            style={styles.gridCard}
          >
            <View style={[styles.cardIconPill, { backgroundColor: 'rgba(59, 130, 246, 0.12)' }]}>
              <RadarIcon size={18} color="#2563EB" />
            </View>
            <Text style={styles.gridValue}>Every {settings?.locationPingIntervalSeconds || 30}s</Text>
            <Text style={styles.gridLabel}>RADAR PING</Text>
          </TouchableOpacity>

          {/* Card 3: Play Zone (Editor) */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={isHost ? () => router.push({ pathname: '/create', params: { step: '3', gameId: lobbyState.gameId } } as any) : undefined}
            style={styles.gridCard}
          >
            <View style={[styles.cardIconPill, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
              <ShapesIcon size={18} color="#059669" />
            </View>
            <Text style={styles.gridValue} numberOfLines={1}>{getPlayZoneLabel()}</Text>
            <Text style={styles.gridLabel}>PLAY ZONE</Text>
          </TouchableOpacity>

          {/* Card 4: Abilities */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push('/lobby/settings' as any)}
            style={styles.gridCard}
          >
            <View style={[styles.cardIconPill, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
              <FlashIcon size={18} color="#D97706" />
            </View>
            <Text style={styles.gridValue}>
              {settings?.tacticalAbilities?.enabled !== false ? 'Enabled' : 'Disabled'}
            </Text>
            <Text style={styles.gridLabel}>ABILITIES</Text>
          </TouchableOpacity>

          {/* Card 5: Head Start */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push('/lobby/settings' as any)}
            style={styles.gridCard}
          >
            <View style={[styles.cardIconPill, { backgroundColor: 'rgba(99, 102, 241, 0.12)' }]}>
              <SprintIcon size={18} color="#4F46E5" />
            </View>
            <Text style={styles.gridValue}>{settings?.headStartSeconds || 60}s</Text>
            <Text style={styles.gridLabel}>HEAD START</Text>
          </TouchableOpacity>

          {/* Card 6: Hearts */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push('/lobby/settings' as any)}
            style={styles.gridCard}
          >
            <View style={[styles.cardIconPill, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
              <HeartIcon size={18} color="#DC2626" />
            </View>
            <Text style={styles.gridValue}>{settings?.runnerHearts || 3} Hearts</Text>
            <Text style={styles.gridLabel}>HEARTS</Text>
          </TouchableOpacity>
        </View>

        {/* Action Button: Start Match (Host) vs Ready Up (Player) */}
        <View style={styles.bottomBar}>
          {isHost ? (
            <Button
              title={isStarting ? 'LAUNCHING MISSION...' : 'START GAME'}
              variant="gradient"
              size="lg"
              fullWidth
              loading={isStarting}
              onPress={handleStartGame}
            />
          ) : (
            <Button
              title={myPlayer?.isReady ? "I'M READY ✓" : 'READY UP'}
              variant={myPlayer?.isReady ? 'runner' : 'primary'}
              size="lg"
              fullWidth
              onPress={toggleReady}
            />
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.base,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.background.surface,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.surface,
    borderWidth: 1.5,
    borderColor: colors.border.default,
    borderRadius: borderRadius.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 6,
    ...shadows.sm,
  },
  codeLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.text.muted,
  },
  codeValue: {
    fontSize: typography.fontSize.base,
    fontWeight: '800',
    letterSpacing: typography.letterSpacing.code,
    color: colors.text.primary,
  },
  gearBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.background.surface,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    padding: spacing.md,
  },
  rostersGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  squadCol: {
    flex: 1,
    backgroundColor: colors.background.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    minHeight: 220,
    ...shadows.sm,
  },
  squadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.xs + 2,
    marginBottom: spacing.sm,
    borderBottomWidth: 2,
  },
  squadTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: '800',
    letterSpacing: 1,
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  countText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  playersList: {
    gap: spacing.xs,
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.xs + 2,
    borderRadius: borderRadius.md,
  },
  myPlayerCard: {
    borderColor: colors.brand.accent,
    borderWidth: 1,
  },
  playerMeta: {
    marginLeft: 6,
    flex: 1,
  },
  playerName: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.primary,
  },
  playerSub: {
    fontSize: 9,
    color: colors.text.muted,
  },
  switchSquadBtn: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: borderRadius.md,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  switchSquadText: {
    fontSize: 10,
    fontWeight: '700',
  },
  refereeCard: {
    padding: spacing.sm,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  refereeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  refereeTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.referee.primary,
    letterSpacing: 1,
  },
  refereeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  refereeName: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: colors.text.primary,
  },
  becomeRefereeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    marginBottom: spacing.md,
  },
  becomeRefereeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: colors.referee.primary,
  },
  gridSectionHeader: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    letterSpacing: typography.letterSpacing.tactical,
    color: colors.text.muted,
    marginBottom: spacing.xs,
    marginLeft: 4,
  },
  settingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  gridCard: {
    width: '48%',
    backgroundColor: colors.background.surface,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    borderRadius: borderRadius.lg,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    ...shadows.sm,
  },
  cardIconPill: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  gridValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: '800',
    color: colors.text.primary,
    marginTop: 2,
    textAlign: 'center',
  },
  gridLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.text.muted,
    marginTop: 3,
    letterSpacing: 0.8,
  },
  awaitingCard: {
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(0, 229, 255, 0.3)',
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(0, 229, 255, 0.03)',
    marginTop: spacing.xs,
  },
  awaitingIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  awaitingTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.runner.primary,
  },
  awaitingSub: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.text.muted,
    textAlign: 'center',
    marginTop: 2,
  },
  bottomBar: {
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
});
