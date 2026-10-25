import AsyncStorage from '@react-native-async-storage/async-storage';
import { PlayerRole } from '@/types/lobby';
import { supabase } from '@/services/supabase';

const ACTIVE_SESSION_KEY = '@manhunt/active_match_session';

export interface PersistedMatchSession {
  gameId: string;
  joinCode: string;
  myPlayerId: string;
  myRole: PlayerRole;
  isHost: boolean;
  route: string;
  savedAt: number;
  durationMinutes: number;
  catchCode?: string;
  runnerHearts?: number;
}

export const sessionManager = {
  /**
   * Persists active match session to device storage so backgrounding or app restart never loses the game.
   */
  async saveActiveSession(session: PersistedMatchSession): Promise<void> {
    try {
      await AsyncStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
    } catch (err) {
      console.warn('[SessionManager] Failed to persist active match session:', err);
    }
  },

  /**
   * Retrieves the persisted match session if still valid.
   */
  async getActiveSession(): Promise<PersistedMatchSession | null> {
    try {
      const raw = await AsyncStorage.getItem(ACTIVE_SESSION_KEY);
      if (!raw) return null;
      const parsed: PersistedMatchSession = JSON.parse(raw);

      // Verify the session isn't older than 4 hours
      const elapsedMs = Date.now() - parsed.savedAt;
      if (elapsedMs > 4 * 60 * 60 * 1000) {
        await this.clearActiveSession();
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  },

  /**
   * Checks with server whether the match is still active or finished.
   */
  async verifyServerStatus(gameId: string): Promise<'ACTIVE' | 'LOBBY' | 'FINISHED' | 'EXPIRED'> {
    try {
      const { data, error } = await supabase
        .from('games')
        .select('status, started_at, settings')
        .eq('id', gameId)
        .single();

      if (error || !data) {
        return 'EXPIRED';
      }

      if (data.status === 'FINISHED' || data.status === 'CANCELLED') {
        return 'FINISHED';
      }

      if (data.status === 'ACTIVE' || data.status === 'LOBBY') {
        return data.status;
      }

      return 'ACTIVE';
    } catch {
      // In offline/mock environment, assume still active
      return 'ACTIVE';
    }
  },

  /**
   * Clears the active match session when explicitly abandoned or finished.
   */
  async clearActiveSession(): Promise<void> {
    try {
      await AsyncStorage.removeItem(ACTIVE_SESSION_KEY);
    } catch (err) {
      console.warn('[SessionManager] Failed to clear session:', err);
    }
  },
};
