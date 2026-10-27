import { progressionService, calculateLevelFromXP } from '../progressionService';

let mockStorage: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStorage[key] || null)),
  setItem: jest.fn((key: string, val: string) => {
    mockStorage[key] = val;
    return Promise.resolve();
  }),
  clear: jest.fn(() => {
    mockStorage = {};
    return Promise.resolve();
  }),
}));

jest.mock('@/services/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      upsert: jest.fn().mockResolvedValue({ error: null }),
    })),
  },
}));

describe('ProgressionService & Level System', () => {
  beforeEach(async () => {
    mockStorage = {};
    (progressionService as any).cachedProgression = null;
  });

  it('calculates correct level and rank title for various XP amounts', () => {
    expect(calculateLevelFromXP(100)).toMatchObject({ level: 1, rankTitle: 'Rookie' });
    expect(calculateLevelFromXP(300)).toMatchObject({ level: 2, rankTitle: 'Scout' });
    expect(calculateLevelFromXP(675)).toMatchObject({ level: 3, rankTitle: 'Tracker' });
    expect(calculateLevelFromXP(1000)).toMatchObject({ level: 4, rankTitle: 'Stalker' });
    expect(calculateLevelFromXP(2000)).toMatchObject({ level: 6, rankTitle: 'Apex Hunter' });
  });

  it('initializes default progression with Level, XP, Coins, and Stats', async () => {
    const prog = await progressionService.getProgression('p-1', 'Nicolas');
    expect(prog.displayName).toBe('Nicolas');
    expect(prog.coins).toBe(0);
    expect(prog.stats.hunterGames).toBe(0);
    expect(prog.stats.totalDistanceTraveledKm).toBe(0);
    expect(prog.achievements.length).toBeGreaterThan(0);
  });

  it('awards XP and Coins with XP boost multiplier on match finish', async () => {
    const before = await progressionService.getProgression('p-1', 'Nicolas');
    const startXP = before.currentXP;

    const res = await progressionService.recordMatchResult({
      gameId: 'match-999',
      role: 'HUNTER',
      result: 'VICTORY',
      durationMinutes: 20,
      catchesCount: 3,
      distanceKm: 1.5,
    });

    expect(res.xpEarned).toBeGreaterThan(0);
    expect(res.coinsEarned).toBeGreaterThan(0);
    expect(res.progression.currentXP).toBe(startXP + res.xpEarned);
    expect(res.progression.stats.catchesMade).toBe(before.stats.catchesMade + 3);
  });

  it('updates achievement progress after match events', async () => {
    await progressionService.recordMatchResult({
      gameId: 'match-888',
      role: 'HUNTER',
      result: 'VICTORY',
      durationMinutes: 15,
      catchesCount: 1,
    });

    const prog = await progressionService.getProgression();
    const firstArrest = prog.achievements.find((a) => a.id === 'first_arrest');
    expect(firstArrest?.isUnlocked).toBe(true);
  });
});
