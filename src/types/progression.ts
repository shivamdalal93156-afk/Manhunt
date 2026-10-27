export interface PlayerStats {
  totalPlayTimeMinutes: number;
  totalDistanceTraveledKm: number;
  hunterGames: number;
  runnerGames: number;
  catchesMade: number;
  abilitiesUsed: number;
  totalWins: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  xpReward: number;
  coinReward: number;
  isUnlocked: boolean;
  unlockedAt?: number;
  progress: number; // e.g. 1/5
  target: number;
}

export interface MatchHistoryItem {
  id: string;
  gameId: string;
  playedAt: number;
  role: 'HUNTER' | 'RUNNER';
  result: 'VICTORY' | 'DEFEAT' | 'ESCAPED' | 'CAUGHT';
  durationMinutes: number;
  xpEarned: number;
  coinsEarned: number;
  catchesCount?: number;
  distanceKm?: number;
}

export interface FriendItem {
  id: string;
  codename: string;
  level: number;
  rankTitle: string;
  isOnline: boolean;
  statusText: string;
  matchesPlayed: number;
  winRate: number;
}

export interface PlayerProgression {
  profileId: string;
  email?: string;
  displayName: string;
  level: number;
  rankTitle: string;
  currentXP: number;
  xpForCurrentLevel: number;
  xpForNextLevel: number;
  xpToNextLevel: number;
  progressPercent: number; // 0 - 100
  coins: number;
  boostMultiplier: number; // e.g. 1.5
  stats: PlayerStats;
  achievements: Achievement[];
  history: MatchHistoryItem[];
  friends?: FriendItem[];
}
