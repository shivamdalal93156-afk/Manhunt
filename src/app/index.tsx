import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  AddUserIcon,
  Avatar,
  Button,
  Card,
  Chip,
  HelpIcon,
  PermissionPrompt,
  Screen,
  SettingsIcon,
} from '@/components/ui';
import { useLocation } from '@/hooks/useLocation';
import { authService, UserAccount } from '@/services/auth/authService';
import { progressionService } from '@/services/progression/progressionService';
import { sessionManager, PersistedMatchSession } from '@/services/session/sessionManager';
import { useLobbyStore } from '@/store/lobbyStore';
import { PlayerProfile, PlayerRole } from '@/types/lobby';
import { PlayerProgression } from '@/types/progression';
import { borderRadius, colors, shadows, spacing, typography } from '@/theme/tokens';

export default function HomeScreen() {
  const router = useRouter();
  const { permissionStatus, requestPermission } = useLocation();
  const { joinMatch, restoreSession } = useLobbyStore();

  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [progression, setProgression] = useState<PlayerProgression | null>(null);
  const [activeSession, setActiveSession] = useState<PersistedMatchSession | null>(null);

  // Join match state
  const [joinCode, setJoinCode] = useState('');
  const [selectedRole, setSelectedRole] = useState<PlayerRole>('RUNNER');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    loadUserData();
    checkActiveSession();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        checkActiveSession();
      }
    });

    return () => sub.remove();
  }, []);

  const loadUserData = async () => {
    const user = await authService.loadSession();
    if (!user) {
      router.replace('/auth' as any);
      return;
    }
    setCurrentUser(user);

    const prof: PlayerProfile = {
      id: user.id,
      displayName: user.displayName,
      isGuest: false,
    };
    setProfile(prof);

    const prog = await progressionService.getProgression(prof.id, prof.displayName);
    setProgression(prog);
  };

  const checkActiveSession = async () => {
    try {
      const saved = await sessionManager.getActiveSession();
      if (saved) {
        const status = await sessionManager.verifyServerStatus(saved.gameId);
        if (status === 'ACTIVE' || status === 'LOBBY') {
          setActiveSession(saved);
        } else {
          await sessionManager.clearActiveSession();
          setActiveSession(null);
        }
      } else {
        setActiveSession(null);
      }
    } catch {
      setActiveSession(null);
    }
  };

  const handleJoinGame = async () => {
    const code = joinCode.trim().toUpperCase();
    setJoinError(null);

    if (code.length !== 6) {
      setJoinError('Please enter a valid 6-character match code.');
      return;
    }

    setIsJoining(true);
    try {
      const matchSession = await joinMatch(code, selectedRole);
      if (matchSession?.gameId) {
        router.push(`/lobby/${matchSession.gameId}` as any);
      } else {
        const err = useLobbyStore.getState().error;
        setJoinError(err || 'Failed to join match. Check game code.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to join match.';
      setJoinError(msg);
    } finally {
      setIsJoining(false);
    }
  };

  const handleResumeActiveSession = async () => {
    if (!activeSession) return;
    try {
      restoreSession(activeSession);
      if (activeSession.myRole === 'HUNTER') {
        router.push('/game/hunter' as any);
      } else if (activeSession.myRole === 'REFEREE') {
        router.push('/game/referee' as any);
      } else {
        router.push('/game/runner' as any);
      }
    } catch {
      Alert.alert('Session Expired', 'The match has already concluded.');
      await sessionManager.clearActiveSession();
      setActiveSession(null);
    }
  };

  return (
    <Screen scroll>
      {/* Top Navigation Bar mirroring Reference 8 */}
      <View style={styles.topHeader}>
        {/* Left: Add Friend Pill */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push('/friends' as any)}
          style={styles.addFriendPill}
        >
          <AddUserIcon size={16} color={colors.text.primary} />
          <Text style={styles.addFriendText}>Add a friend</Text>
        </TouchableOpacity>

        {/* Right: Rules (?) Button & Profile Capsule */}
        <View style={styles.headerRight}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push('/rules' as any)}
            style={styles.rulesBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <HelpIcon size={22} color={colors.text.secondary} />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push('/settings' as any)}
            style={styles.rulesBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <SettingsIcon size={20} color={colors.text.secondary} />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push('/profile' as any)}
            style={styles.profileCapsule}
          >
            <Avatar uri={currentUser?.avatarUrl} name={currentUser?.displayName} size="sm" />
            <View style={styles.levelBadge}>
              <Text style={styles.levelText}>{progression?.level || 1}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.container}>
        {/* Permission Banner if location not granted */}
        {permissionStatus !== 'granted' && (
          <View style={styles.permissionBox}>
            <PermissionPrompt onGrant={requestPermission} />
          </View>
        )}

        {/* Active Mission Banner */}
        {activeSession && (
          <Card variant="portal" style={styles.activeMissionCard}>
            <View style={styles.activeMissionHeader}>
              <View style={styles.livePulseDot} />
              <Text style={styles.activeMissionTitle}>LIVE MATCH IN PROGRESS</Text>
            </View>
            <Text style={styles.activeMissionSubtitle}>
              You have an ongoing match ({activeSession.myRole}). Reconnect immediately!
            </Text>
            <Button
              title="RECONNECT TO MISSION"
              variant="hunter"
              size="sm"
              onPress={handleResumeActiveSession}
              style={{ marginTop: spacing.sm }}
            />
          </Card>
        )}

        {/* Join Game Card (Reference 8) */}
        <Card variant="portal" style={styles.joinCard}>
          <Text style={styles.cardHeader}>GOT A CODE?</Text>
          <Text style={styles.cardSubtitle}>
            Enter the 6-character match code from your host
          </Text>

          <TextInput
            style={styles.codeInput}
            placeholder="ABC123"
            placeholderTextColor={colors.text.muted}
            value={joinCode}
            onChangeText={(txt) => {
              setJoinCode(txt.toUpperCase().slice(0, 6));
              setJoinError(null);
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
          />

          {/* Role Selection Chips */}
          <Text style={styles.roleLabel}>CHOOSE YOUR SQUAD ROLE</Text>
          <View style={styles.roleChipsRow}>
            <Chip
              label="Chaser"
              selected={selectedRole === 'HUNTER'}
              onPress={() => setSelectedRole('HUNTER')}
              variant="chaser"
              style={styles.roleChip}
            />
            <Chip
              label="Runner"
              selected={selectedRole === 'RUNNER'}
              onPress={() => setSelectedRole('RUNNER')}
              variant="runner"
              style={styles.roleChip}
            />
            <Chip
              label="Referee"
              selected={selectedRole === 'REFEREE'}
              onPress={() => setSelectedRole('REFEREE')}
              variant="referee"
              style={styles.roleChip}
            />
          </View>

          {joinError && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={colors.status.danger} />
              <Text style={styles.errorText}>{joinError}</Text>
            </View>
          )}

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleJoinGame}
            disabled={isJoining || joinCode.length !== 6}
            style={[
              styles.joinBtn,
              (isJoining || joinCode.length !== 6) && styles.joinBtnDisabled,
            ]}
          >
            {isJoining ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.joinBtnText}>JOIN MATCH</Text>
            )}
          </TouchableOpacity>
        </Card>

        {/* Start Game Section (Reference 8) */}
        <View style={styles.hostSection}>
          <Button
            title="START A NEW GAME"
            variant="gradient"
            size="lg"
            fullWidth
            onPress={() => router.push('/create' as any)}
          />
          <Text style={styles.hostSubtitle}>
            Create a match lobby, customize play zone, and invite friends.
          </Text>
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
  addFriendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.surface,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
    ...shadows.sm,
  },
  addFriendText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    color: colors.text.primary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rulesBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.surface,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  profileCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  levelBadge: {
    position: 'absolute',
    bottom: -2,
    right: -4,
    backgroundColor: colors.brand.accent,
    borderRadius: 8,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  levelText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  container: {
    padding: spacing.md,
  },
  permissionBox: {
    marginBottom: spacing.md,
  },
  activeMissionCard: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.status.safe,
    marginBottom: spacing.md,
  },
  activeMissionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  livePulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.status.safe,
  },
  activeMissionTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: '800',
    color: colors.text.primary,
    letterSpacing: typography.letterSpacing.tactical,
  },
  activeMissionSubtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: 4,
  },
  joinCard: {
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  cardHeader: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text.primary,
    letterSpacing: typography.letterSpacing.tactical,
  },
  cardSubtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    marginTop: 4,
    marginBottom: spacing.lg,
  },
  codeInput: {
    width: '100%',
    height: 60,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.border.default,
    backgroundColor: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: typography.letterSpacing.code,
    textAlign: 'center',
    color: colors.text.primary,
    marginBottom: spacing.lg,
  },
  roleLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    letterSpacing: typography.letterSpacing.tactical,
    color: colors.text.muted,
    marginBottom: spacing.sm,
  },
  roleChipsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  roleChip: {
    flex: 1,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
    width: '100%',
    gap: 6,
  },
  errorText: {
    flex: 1,
    fontSize: typography.fontSize.xs,
    color: colors.status.danger,
    fontWeight: '600',
  },
  joinBtn: {
    width: '100%',
    height: 50,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.text.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  joinBtnDisabled: {
    opacity: 0.4,
  },
  joinBtnText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: typography.letterSpacing.tactical,
  },
  hostSection: {
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  hostSubtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    textAlign: 'center',
    marginTop: 8,
  },
});
