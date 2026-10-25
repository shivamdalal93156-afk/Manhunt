import React, { useEffect, useState } from 'react';
import {
  Alert,
  AppState,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Badge,
  Button,
  Card,
  PermissionPrompt,
} from '@/components/ui';
import { useLocation } from '@/hooks/useLocation';
import { guestAuth } from '@/services/auth/guestAuth';
import { sessionManager, PersistedMatchSession } from '@/services/session/sessionManager';
import { useLobbyStore } from '@/store/lobbyStore';
import { PlayerProfile } from '@/types/lobby';
import { borderRadius, colors, spacing, typography } from '@/theme/tokens';

export default function HomeScreen() {
  const router = useRouter();
  const { permissionStatus, currentLocation, requestPermission } = useLocation();
  const { restoreSession } = useLobbyStore();
  const [requestingPerm, setRequestingPerm] = useState(false);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [activeSession, setActiveSession] = useState<PersistedMatchSession | null>(null);

  const checkActiveMission = async () => {
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
  };

  useEffect(() => {
    guestAuth.getGuestProfile().then(setProfile);
    checkActiveMission();

    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        checkActiveMission();
      }
    });

    return () => sub.remove();
  }, []);

  const handleRequestPermission = async () => {
    setRequestingPerm(true);
    try {
      await requestPermission();
    } finally {
      setRequestingPerm(false);
    }
  };

  const handleResumeMission = () => {
    if (!activeSession) return;
    restoreSession(activeSession);
    router.push(activeSession.route as any);
  };

  const handleAbandonMission = () => {
    Alert.alert(
      'LEAVE ACTIVE MATCH',
      'Are you sure you want to exit your ongoing match?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            await sessionManager.clearActiveSession();
            setActiveSession(null);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Top Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>REAL-LIFE GPS PURSUIT</Text>
            <Text style={styles.title}>HUNTING GAME</Text>
          </View>
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => router.push('/settings')}
            activeOpacity={0.7}
          >
            <Text style={styles.settingsIcon}>⚙</Text>
          </TouchableOpacity>
        </View>

        {/* Persistent Active Combat Mission Resume Banner */}
        {activeSession && (
          <Card variant="glass" style={styles.activeMissionCard}>
            <View style={styles.activeMissionHeader}>
              <View style={styles.pulsingBadge}>
                <View style={styles.pulsingDot} />
                <Text style={styles.pulsingText}>MISSION IN PROGRESS</Text>
              </View>
              <Badge
                label={activeSession.myRole === 'RUNNER' ? '🏃 RUNNER' : '⚡ CHASER'}
                variant={activeSession.myRole === 'RUNNER' ? 'safe' : 'danger'}
              />
            </View>

            <Text style={styles.activeMissionTitle}>
              ACTIVE MATCH #{activeSession.joinCode}
            </Text>
            <Text style={styles.activeMissionSub}>
              You have an active ongoing game! The app remembered your session so you were not kicked out when switching apps.
            </Text>

            <View style={styles.activeMissionActions}>
              <Button
                title="⚡ RESUME MISSION"
                variant="gradient"
                size="md"
                onPress={handleResumeMission}
                style={{ flex: 1 }}
              />
              <TouchableOpacity
                style={styles.abandonBtn}
                onPress={handleAbandonMission}
                activeOpacity={0.7}
              >
                <Text style={styles.abandonText}>QUIT</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* Player Profile Banner */}
        <Card variant="glass" style={styles.profileCard}>
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {profile?.displayName ? profile.displayName.slice(0, 2).toUpperCase() : 'HG'}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.profileName}>
                  {profile?.displayName ? profile.displayName.toUpperCase() : 'PLAYER'}
                </Text>
                <Badge label="ONLINE" variant="safe" />
              </View>
              <Text style={styles.profileSub}>READY FOR NEXT MATCH</Text>
            </View>
          </View>
          <View style={styles.telemetryDivider} />
          <View style={styles.telemetryRow}>
            <View style={styles.telemetryItem}>
              <Text style={styles.telemetryLabel}>GPS STATUS</Text>
              <Text
                style={[
                  styles.telemetryVal,
                  {
                    color:
                      permissionStatus === 'granted'
                        ? colors.status.safe
                        : colors.status.warning,
                  },
                ]}
              >
                {permissionStatus === 'granted' ? 'LOCK ACQUIRED' : 'NEEDS PERMISSION'}
              </Text>
            </View>
            <View style={styles.telemetryItem}>
              <Text style={styles.telemetryLabel}>ACCURACY</Text>
              <Text style={styles.telemetryVal}>
                {currentLocation?.accuracy
                  ? `±${currentLocation.accuracy.toFixed(1)}m`
                  : 'STANDBY'}
              </Text>
            </View>
          </View>
        </Card>

        {/* Location Permission Prompt (Shown if not yet granted) */}
        {permissionStatus !== 'granted' && (
          <PermissionPrompt
            onGrant={handleRequestPermission}
            loading={requestingPerm}
          />
        )}

        {/* Primary Action Buttons */}
        <View style={styles.actions}>
          <Button
            title="CREATE MATCH"
            variant="gradient"
            size="lg"
            fullWidth
            onPress={() => router.push('/create')}
            style={styles.actionBtn}
          />

          <Button
            title="JOIN WITH CODE"
            variant="secondary"
            size="lg"
            fullWidth
            onPress={() => router.push('/join')}
            style={styles.actionBtn}
          />

          <Button
            title="🛰️ TACTICAL MAP & SATELLITE"
            variant="ghost"
            size="md"
            fullWidth
            onPress={() => router.push('/map/editor')}
            style={styles.actionBtn}
          />
        </View>

        {/* Game Rules & Intelligence Showcase */}
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => router.push('/rules')}
          activeOpacity={0.7}
        >
          <Text style={styles.sectionTitle}>GAMEPLAY ROLES</Text>
          <Badge label="RULES & GUIDE ↗" variant="neutral" />
        </TouchableOpacity>

        <Card variant="hunter" style={styles.roleCard}>
          <View style={styles.roleHeader}>
            <Text style={styles.roleTitleHunter}>CHASERS (HUNTERS)</Text>
            <Badge label="RADAR" variant="hunter" />
          </View>
          <Text style={styles.roleDesc}>
            Track runners using periodic satellite radar pings. Close distance to within
            15m to physically catch them and verify their 4-digit secret code.
          </Text>
        </Card>

        <Card variant="runner" style={styles.roleCard}>
          <View style={styles.roleHeader}>
            <Text style={styles.roleTitleRunner}>EVADERS (RUNNERS)</Text>
            <Badge label="COMPASS" variant="runner" />
          </View>
          <Text style={styles.roleDesc}>
            Chasers are invisible on your map. Rely on your directional threat compass and
            tactical stealth abilities to survive until the timer expires.
          </Text>
        </Card>

        <Card variant="referee" style={styles.roleCard}>
          <View style={styles.roleHeader}>
            <Text style={styles.roleTitleReferee}>SUPERVISORS (FAMILY MODE)</Text>
            <Badge label="SAFETY" variant="referee" />
          </View>
          <Text style={styles.roleDesc}>
            Non-combatant referee role to monitor safety, maintain geofenced boundaries,
            and oversee real-world games in outdoor parks.
          </Text>
        </Card>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            HUNTING GAME • GPS MANHUNT V1.0 • PRIVACY PROTECTED
          </Text>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  eyebrow: {
    fontSize: typography.fontSize.xs,
    letterSpacing: typography.letterSpacing.wide,
    color: colors.hunter.primary,
    fontWeight: '700',
  },
  title: {
    fontSize: typography.fontSize.xxl,
    fontWeight: '900',
    color: colors.text.primary,
    letterSpacing: typography.letterSpacing.tactical,
  },
  settingsBtn: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.surface,
    borderColor: colors.border.subtle,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: {
    color: colors.text.primary,
    fontSize: 20,
  },
  activeMissionCard: {
    marginBottom: spacing.md,
    backgroundColor: 'rgba(232, 93, 59, 0.12)',
    borderColor: colors.brand.gradientMid,
    borderWidth: 1.5,
    padding: spacing.md,
  },
  activeMissionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  pulsingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.status.safe,
  },
  pulsingText: {
    color: colors.status.safe,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  activeMissionTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.lg,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 2,
    marginBottom: 4,
  },
  activeMissionSub: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.xs,
    lineHeight: 16,
    marginBottom: spacing.md,
  },
  activeMissionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  abandonBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  abandonText: {
    color: colors.status.danger,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  profileCard: {
    marginBottom: spacing.md,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background.elevated,
    borderColor: colors.hunter.primary,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.hunter.primary,
    fontWeight: '800',
    fontSize: typography.fontSize.sm,
  },
  profileInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileName: {
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
    fontWeight: '800',
    letterSpacing: typography.letterSpacing.tactical,
  },
  profileSub: {
    color: colors.text.muted,
    fontSize: typography.fontSize.xs,
    marginTop: 2,
  },
  telemetryDivider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginVertical: spacing.md,
  },
  telemetryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  telemetryItem: {
    flex: 1,
  },
  telemetryLabel: {
    color: colors.text.muted,
    fontSize: typography.fontSize.xs,
    letterSpacing: typography.letterSpacing.tactical,
  },
  telemetryVal: {
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    marginTop: 2,
    color: colors.text.primary,
  },
  actions: {
    marginVertical: spacing.md,
  },
  actionBtn: {
    marginVertical: spacing.xs + 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.xs,
    letterSpacing: typography.letterSpacing.wide,
    fontWeight: '700',
  },
  roleCard: {
    marginVertical: spacing.xs + 2,
  },
  roleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  roleTitleHunter: {
    color: colors.hunter.primary,
    fontWeight: '800',
    fontSize: typography.fontSize.base,
    letterSpacing: typography.letterSpacing.tactical,
  },
  roleTitleRunner: {
    color: colors.runner.primary,
    fontWeight: '800',
    fontSize: typography.fontSize.base,
    letterSpacing: typography.letterSpacing.tactical,
  },
  roleTitleReferee: {
    color: colors.referee.primary,
    fontWeight: '800',
    fontSize: typography.fontSize.base,
    letterSpacing: typography.letterSpacing.tactical,
  },
  roleDesc: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
    lineHeight: 19,
  },
  footer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  footerText: {
    color: colors.text.muted,
    fontSize: 10,
    letterSpacing: 1.2,
    textAlign: 'center',
  },
});
