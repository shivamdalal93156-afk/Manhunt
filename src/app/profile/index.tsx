import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Button, Card, Screen, TopBar } from '@/components/ui';
import { authService, UserAccount } from '@/services/auth/authService';
import { progressionService } from '@/services/progression/progressionService';
import { PlayerProgression } from '@/types/progression';
import { borderRadius, colors, shadows, spacing, typography } from '@/theme/tokens';

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<UserAccount | null>(null);
  const [progression, setProgression] = useState<PlayerProgression | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        router.replace('/auth' as any);
        return;
      }
      setUser(currentUser);

      const prog = await progressionService.getProgression(
        currentUser.id,
        currentUser.displayName
      );
      setProgression(prog);
    } catch (err) {
      console.warn('[ProfileScreen] Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of your operative account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await authService.signOut();
            router.replace('/auth' as any);
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <Screen>
        <TopBar title="OPERATIVE PROFILE" onBack={() => router.back()} />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.brand.accent} />
        </View>
      </Screen>
    );
  }

  const stats = progression?.stats || {
    totalPlayTimeMinutes: 0,
    totalDistanceTraveledKm: 0,
    totalWins: 0,
    hunterGames: 0,
    runnerGames: 0,
  };

  return (
    <Screen scroll>
      <TopBar
        title="OPERATIVE PROFILE"
        onBack={() => router.back()}
        rightSlot={
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push('/profile/setup' as any)}
            style={styles.editBtn}
          >
            <Ionicons name="create-outline" size={20} color={colors.text.primary} />
          </TouchableOpacity>
        }
      />

      <View style={styles.container}>
        {/* User Hero Capsule */}
        <Card variant="portal" style={styles.heroCard}>
          <View style={styles.avatarRow}>
            <Avatar uri={user?.avatarUrl} name={user?.displayName} size="xl" />
            <View style={styles.heroInfo}>
              <Text style={styles.displayName}>{user?.displayName}</Text>
              <Text style={styles.emailText}>{user?.email}</Text>
              <View style={styles.badgeRow}>
                <View style={styles.levelBadge}>
                  <Text style={styles.levelText}>LVL {progression?.level || 1}</Text>
                </View>
                <View style={styles.rankBadge}>
                  <Text style={styles.rankText}>{progression?.rankTitle || 'Rookie Scout'}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* XP Progress Bar */}
          <View style={styles.xpSection}>
            <View style={styles.xpHeader}>
              <Text style={styles.xpLabel}>EXPERIENCE POINTS</Text>
              <Text style={styles.xpValue}>
                {progression?.currentXP || 0} XP
              </Text>
            </View>
            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${Math.min(100, Math.max(0, progression?.progressPercent || 0))}%` },
                ]}
              />
            </View>
            <Text style={styles.xpFooter}>
              {progression?.xpToNextLevel || 0} XP to Next Level
            </Text>
          </View>
        </Card>

        {/* Tactical Statistics */}
        <Text style={styles.sectionTitle}>TACTICAL CAREER STATS</Text>
        <View style={styles.statsGrid}>
          <Card variant="portal" style={styles.statBox}>
            <Ionicons name="time-outline" size={24} color={colors.hunter.primary} />
            <Text style={styles.statValue}>
              {Math.floor(stats.totalPlayTimeMinutes)}m
            </Text>
            <Text style={styles.statLabel}>PLAY TIME</Text>
          </Card>

          <Card variant="portal" style={styles.statBox}>
            <Ionicons name="footsteps-outline" size={24} color={colors.runner.primary} />
            <Text style={styles.statValue}>
              {(stats.totalDistanceTraveledKm || 0).toFixed(1)}km
            </Text>
            <Text style={styles.statLabel}>DISTANCE</Text>
          </Card>

          <Card variant="portal" style={styles.statBox}>
            <Ionicons name="trophy-outline" size={24} color="#F59E0B" />
            <Text style={styles.statValue}>{stats.totalWins || 0}</Text>
            <Text style={styles.statLabel}>VICTORIES</Text>
          </Card>

          <Card variant="portal" style={styles.statBox}>
            <Ionicons name="game-controller-outline" size={24} color={colors.referee.primary} />
            <Text style={styles.statValue}>
              {(stats.hunterGames || 0) + (stats.runnerGames || 0)}
            </Text>
            <Text style={styles.statLabel}>MATCHES</Text>
          </Card>
        </View>

        {/* Achievements Section */}
        {progression?.achievements && progression.achievements.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>ACHIEVEMENTS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.achievementsScroll}>
              {progression.achievements.map((ach) => (
                <Card
                  key={ach.id}
                  variant="portal"
                  style={[
                    styles.achievementCard,
                    !ach.isUnlocked && styles.achievementLocked,
                  ]}
                >
                  <View style={styles.achievementIconBox}>
                    <Ionicons
                      name={ach.isUnlocked ? 'medal' : 'lock-closed'}
                      size={28}
                      color={ach.isUnlocked ? '#F59E0B' : colors.text.muted}
                    />
                  </View>
                  <Text style={styles.achievementTitle} numberOfLines={1}>
                    {ach.title}
                  </Text>
                  <Text style={styles.achievementDesc} numberOfLines={2}>
                    {ach.description}
                  </Text>
                  <View style={styles.achievementReward}>
                    <Text style={styles.rewardText}>+{ach.xpReward} XP</Text>
                  </View>
                </Card>
              ))}
            </ScrollView>
          </>
        )}

        {/* Sign Out Section */}
        <View style={styles.actionSection}>
          <Button
            title="SIGN OUT"
            variant="danger"
            size="md"
            fullWidth
            onPress={handleSignOut}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.background.surface,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.lg,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  displayName: {
    fontSize: typography.fontSize.xl,
    fontWeight: '800',
    color: colors.text.primary,
  },
  emailText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.sm,
  },
  levelBadge: {
    backgroundColor: colors.brand.accent,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  levelText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.xs,
    fontWeight: '800',
  },
  rankBadge: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  rankText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
  },
  xpSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  xpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  xpLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: colors.text.muted,
  },
  xpValue: {
    fontSize: typography.fontSize.xs,
    fontWeight: '800',
    color: colors.brand.accent,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.brand.accent,
    borderRadius: 4,
  },
  xpFooter: {
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 6,
    textAlign: 'right',
  },
  sectionTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    letterSpacing: typography.letterSpacing.tactical,
    color: colors.text.muted,
    marginBottom: spacing.sm,
    marginLeft: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statBox: {
    width: '48%',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.muted,
    letterSpacing: 0.8,
    marginTop: 2,
  },
  achievementsScroll: {
    marginBottom: spacing.xl,
  },
  achievementCard: {
    width: 140,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginRight: spacing.sm,
    alignItems: 'center',
  },
  achievementLocked: {
    opacity: 0.6,
  },
  achievementIconBox: {
    marginBottom: spacing.xs,
  },
  achievementTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
  },
  achievementDesc: {
    fontSize: 10,
    color: colors.text.muted,
    textAlign: 'center',
    marginTop: 2,
    lineHeight: 13,
  },
  achievementReward: {
    marginTop: spacing.xs,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  rewardText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
  },
  actionSection: {
    marginTop: spacing.md,
    marginBottom: spacing.xxl,
  },
});
