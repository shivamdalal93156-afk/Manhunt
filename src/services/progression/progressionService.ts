import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/services/supabase';
import {
  Achievement,
  FriendItem,
  MatchHistoryItem,
  PlayerProgression,
  PlayerStats,
} from '@/types/progression';

const PROGRESSION_STORAGE_KEY = '@manhunt/player_progression';

export const LEVEL_THRESHOLDS = [
  { level: 1, title: 'Rookie', minXP: 0, maxXP: 250 },
  { level: 2, title: 'Scout', minXP: 250, maxXP: 550 },
  { level: 3, title: 'Tracker', minXP: 550, maxXP: 900 },
  { level: 4, title: 'Stalker', minXP: 900, maxXP: 1350 },
  { level: 5, title: 'Infiltrator', minXP: 1350, maxXP: 1900 },
  { level: 6, title: 'Apex Hunter', minXP: 1900, maxXP: 2550 },
  { level: 7, title: 'Phantom Master', minXP: 2550, maxXP: 3300 },
  { level: 8, title: 'Ghost Legend', minXP: 3300, maxXP: 4500 },
];

export const INITIAL_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_victory',
    title: 'First Victory',
    description: 'Win your first game in any role',
    icon: '👑',
    xpReward: 50,
    coinReward: 15,
    isUnlocked: false,
    progress: 0,
    target: 1,
  },
  {
    id: 'hunter_victory',
    title: 'Hunter Victory',
    description: 'Win your first game as a Chaser',
    icon: '🏆',
    xpReward: 100,
    coinReward: 25,
    isUnlocked: false,
    progress: 0,
    target: 1,
  },
  {
    id: 'first_arrest',
    title: 'First Arrest',
    description: 'Physically catch and tag your first runner',
    icon: '⛓️',
    xpReward: 150,
    coinReward: 30,
    isUnlocked: false,
    progress: 0,
    target: 1,
  },
  {
    id: 'phantom_evader',
    title: 'Phantom Evader',
    description: 'Survive and escape until match time expires',
    icon: '👻',
    xpReward: 200,
    coinReward: 40,
    isUnlocked: false,
    progress: 0,
    target: 1,
  },
  {
    id: 'marathon_tracker',
    title: 'Marathon Tracker',
    description: 'Travel over 5.0 km across real-world games',
    icon: '🏃',
    xpReward: 250,
    coinReward: 50,
    isUnlocked: false,
    progress: 0,
    target: 5,
  },
  {
    id: 'tactical_hacker',
    title: 'Tactical Hacker',
    description: 'Deploy 5 tactical abilities or hacks',
    icon: '⚡',
    xpReward: 100,
    coinReward: 20,
    isUnlocked: false,
    progress: 0,
    target: 5,
  },
  {
    id: 'apex_hunter',
    title: 'Apex Hunter',
    description: 'Confirm 10 total runner catches',
    icon: '🎯',
    xpReward: 500,
    coinReward: 100,
    isUnlocked: false,
    progress: 0,
    target: 10,
  },
];

export const INITIAL_FRIENDS = [
  {
    id: 'f-1',
    codename: 'ShadowReaper',
    level: 6,
    rankTitle: 'Apex Hunter',
    isOnline: true,
    statusText: 'In Lobby #3910',
    matchesPlayed: 42,
    winRate: 78,
  },
  {
    id: 'f-2',
    codename: 'ViperSprint',
    level: 4,
    rankTitle: 'Stalker',
    isOnline: true,
    statusText: 'Online (Ready to Hunt)',
    matchesPlayed: 28,
    winRate: 64,
  },
  {
    id: 'f-3',
    codename: 'GhostEcho',
    level: 7,
    rankTitle: 'Phantom Master',
    isOnline: false,
    statusText: 'Last seen 2h ago',
    matchesPlayed: 95,
    winRate: 82,
  },
  {
    id: 'f-4',
    codename: 'NightCrawler',
    level: 3,
    rankTitle: 'Tracker',
    isOnline: false,
    statusText: 'Offline',
    matchesPlayed: 14,
    winRate: 50,
  },
];

export function calculateLevelFromXP(totalXP: number) {
  let tier = LEVEL_THRESHOLDS[0];
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalXP >= LEVEL_THRESHOLDS[i].minXP) {
      tier = LEVEL_THRESHOLDS[i];
      break;
    }
  }

  const xpInTier = totalXP - tier.minXP;
  const tierSpan = tier.maxXP - tier.minXP;
  const progressPercent = Math.min(100, Math.max(0, Math.round((xpInTier / tierSpan) * 100)));
  const xpToNextLevel = Math.max(0, tier.maxXP - totalXP);

  return {
    level: tier.level,
    rankTitle: tier.title,
    xpForCurrentLevel: tier.minXP,
    xpForNextLevel: tier.maxXP,
    xpToNextLevel,
    progressPercent,
  };
}

class ProgressionService {
  private cachedProgression: PlayerProgression | null = null;

  async getProgression(profileId?: string, displayName?: string): Promise<PlayerProgression> {
    if (this.cachedProgression && (!profileId || this.cachedProgression.profileId === profileId)) {
      return this.cachedProgression;
    }

    try {
      const stored = await AsyncStorage.getItem(PROGRESSION_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as PlayerProgression;
        if (!profileId || parsed.profileId === profileId) {
          // Zero-tolerance check: if player has never played a match, stats MUST be zero
          if (
            !parsed.stats ||
            (parsed.stats.hunterGames === 0 &&
              parsed.stats.runnerGames === 0 &&
              (!parsed.history || parsed.history.length === 0))
          ) {
            parsed.stats = {
              totalPlayTimeMinutes: 0,
              totalDistanceTraveledKm: 0,
              hunterGames: 0,
              runnerGames: 0,
              catchesMade: 0,
              abilitiesUsed: 0,
              totalWins: 0,
            };
          }

          const levelInfo = calculateLevelFromXP(parsed.currentXP || 0);
          this.cachedProgression = {
            ...parsed,
            ...levelInfo,
            displayName: displayName || parsed.displayName || 'Player',
          };
          return this.cachedProgression;
        }
      }
    } catch {
      // Storage read non-fatal
    }

    // Real progression state for player (starts at Level 1 Rookie with 0 XP, 0 coins, 1.0x boost)
    const initialXP = 0;
    const levelInfo = calculateLevelFromXP(initialXP);

    const initialProgression: PlayerProgression = {
      profileId: profileId || 'default-player',
      displayName: displayName || 'Player',
      currentXP: initialXP,
      coins: 0,
      boostMultiplier: 1.0,
      ...levelInfo,
      stats: {
        totalPlayTimeMinutes: 0,
        totalDistanceTraveledKm: 0,
        hunterGames: 0,
        runnerGames: 0,
        catchesMade: 0,
        abilitiesUsed: 0,
        totalWins: 0,
      },
      achievements: INITIAL_ACHIEVEMENTS.map((a) => ({
        ...a,
        isUnlocked: false,
        progress: 0,
      })),
      history: [],
      friends: [],
    };

    this.cachedProgression = initialProgression;
    await this.saveProgression(initialProgression);
    return initialProgression;
  }

  async saveProgression(progression: PlayerProgression): Promise<void> {
    const levelInfo = calculateLevelFromXP(progression.currentXP);
    const updated = {
      ...progression,
      ...levelInfo,
    };
    this.cachedProgression = updated;

    try {
      await AsyncStorage.setItem(PROGRESSION_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Storage error non-fatal
    }

    // Attempt remote sync if authenticated
    try {
      if (progression.profileId && progression.profileId !== 'default-player') {
        await supabase.from('player_progression').upsert({
          profile_id: progression.profileId,
          xp: updated.currentXP,
          level: updated.level,
          coins: updated.coins,
          stats: updated.stats,
          updated_at: new Date().toISOString(),
        });
      }
    } catch {
      // Non-fatal if table not yet migrated or offline
    }
  }

  async resetProgression(profileId?: string, displayName?: string): Promise<PlayerProgression> {
    this.cachedProgression = null;
    try {
      await AsyncStorage.removeItem(PROGRESSION_STORAGE_KEY);
    } catch {
      // Non-fatal
    }
    return this.getProgression(profileId, displayName);
  }

  async addXPAndCoins(
    xpAmount: number,
    coinsAmount: number,
    source?: string
  ): Promise<{ progression: PlayerProgression; didLevelUp: boolean; newLevel: number }> {
    const current = await this.getProgression();
    const oldLevel = current.level;
    const effectiveXP = Math.round(xpAmount * current.boostMultiplier);
    const newXP = current.currentXP + effectiveXP;
    const newCoins = current.coins + coinsAmount;

    const levelInfo = calculateLevelFromXP(newXP);
    const didLevelUp = levelInfo.level > oldLevel;

    const updated: PlayerProgression = {
      ...current,
      currentXP: newXP,
      coins: newCoins,
      ...levelInfo,
    };

    await this.saveProgression(updated);
    return { progression: updated, didLevelUp, newLevel: levelInfo.level };
  }

  async recordMatchResult(params: {
    gameId: string;
    role: 'HUNTER' | 'RUNNER';
    result: 'VICTORY' | 'DEFEAT' | 'ESCAPED' | 'CAUGHT';
    durationMinutes: number;
    catchesCount?: number;
    distanceKm?: number;
    abilitiesUsed?: number;
  }): Promise<{ progression: PlayerProgression; xpEarned: number; coinsEarned: number }> {
    const current = await this.getProgression();

    // Calculate match rewards
    let baseXP = 100;
    let baseCoins = 20;

    if (params.result === 'VICTORY' || params.result === 'ESCAPED') {
      baseXP += 100;
      baseCoins += 25;
    }

    if (params.catchesCount) {
      baseXP += params.catchesCount * 50;
      baseCoins += params.catchesCount * 10;
    }

    const effectiveXP = Math.round(baseXP * current.boostMultiplier);
    const newXP = current.currentXP + effectiveXP;
    const newCoins = current.coins + baseCoins;

    // Update stats
    const stats: PlayerStats = {
      totalPlayTimeMinutes: current.stats.totalPlayTimeMinutes + params.durationMinutes,
      totalDistanceTraveledKm:
        Math.round((current.stats.totalDistanceTraveledKm + (params.distanceKm ?? 0.5)) * 10) / 10,
      hunterGames: current.stats.hunterGames + (params.role === 'HUNTER' ? 1 : 0),
      runnerGames: current.stats.runnerGames + (params.role === 'RUNNER' ? 1 : 0),
      catchesMade: current.stats.catchesMade + (params.catchesCount ?? 0),
      abilitiesUsed: current.stats.abilitiesUsed + (params.abilitiesUsed ?? 0),
      totalWins:
        current.stats.totalWins + (params.result === 'VICTORY' || params.result === 'ESCAPED' ? 1 : 0),
    };

    // Evaluate achievements
    const achievements = current.achievements.map((ach) => {
      let nextProgress = ach.progress;
      let newlyUnlocked = ach.isUnlocked;

      if (ach.id === 'first_victory' && stats.totalWins >= 1) {
        nextProgress = 1;
        newlyUnlocked = true;
      } else if (ach.id === 'hunter_victory' && params.role === 'HUNTER' && params.result === 'VICTORY') {
        nextProgress = 1;
        newlyUnlocked = true;
      } else if (ach.id === 'first_arrest' && stats.catchesMade >= 1) {
        nextProgress = Math.min(ach.target, stats.catchesMade);
        newlyUnlocked = true;
      } else if (ach.id === 'phantom_evader' && params.role === 'RUNNER' && params.result === 'ESCAPED') {
        nextProgress = 1;
        newlyUnlocked = true;
      } else if (ach.id === 'marathon_tracker') {
        nextProgress = Math.min(ach.target, Math.round(stats.totalDistanceTraveledKm));
        if (nextProgress >= ach.target) newlyUnlocked = true;
      } else if (ach.id === 'tactical_hacker') {
        nextProgress = Math.min(ach.target, stats.abilitiesUsed);
        if (nextProgress >= ach.target) newlyUnlocked = true;
      } else if (ach.id === 'apex_hunter') {
        nextProgress = Math.min(ach.target, stats.catchesMade);
        if (nextProgress >= ach.target) newlyUnlocked = true;
      }

      return {
        ...ach,
        progress: nextProgress,
        isUnlocked: newlyUnlocked,
        unlockedAt: newlyUnlocked && !ach.isUnlocked ? Date.now() : ach.unlockedAt,
      };
    });

    const newHistoryItem: MatchHistoryItem = {
      id: `hist-${Date.now()}`,
      gameId: params.gameId,
      playedAt: Date.now(),
      role: params.role,
      result: params.result,
      durationMinutes: params.durationMinutes,
      xpEarned: effectiveXP,
      coinsEarned: baseCoins,
      catchesCount: params.catchesCount,
      distanceKm: params.distanceKm,
    };

    const levelInfo = calculateLevelFromXP(newXP);

    const updated: PlayerProgression = {
      ...current,
      currentXP: newXP,
      coins: newCoins,
      stats,
      achievements,
      history: [newHistoryItem, ...current.history.slice(0, 29)],
      ...levelInfo,
    };

    await this.saveProgression(updated);
    return { progression: updated, xpEarned: effectiveXP, coinsEarned: baseCoins };
  }

  async claimAchievement(achievementId: string): Promise<PlayerProgression> {
    const current = await this.getProgression();
    const targetAch = current.achievements.find((a) => a.id === achievementId);
    if (!targetAch || !targetAch.isUnlocked) return current;

    return this.addXPAndCoins(targetAch.xpReward, targetAch.coinReward, `Achievement: ${targetAch.title}`).then(
      (res) => res.progression
    );
  }

  async getFriends(): Promise<FriendItem[]> {
    const p = await this.getProgression();
    return p.friends || [];
  }

  async addFriend(codename: string): Promise<PlayerProgression> {
    const current = await this.getProgression();
    const existing = current.friends || [];
    const newFriend: FriendItem = {
      id: `f-${Date.now()}`,
      codename: codename.trim(),
      level: 1,
      rankTitle: 'Rookie',
      isOnline: true,
      statusText: 'Recently Added',
      matchesPlayed: 0,
      winRate: 0,
    };
    const updated: PlayerProgression = {
      ...current,
      friends: [newFriend, ...existing],
    };
    await this.saveProgression(updated);
    return updated;
  }
}

export const progressionService = new ProgressionService();
