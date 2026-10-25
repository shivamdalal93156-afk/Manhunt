import AsyncStorage from '@react-native-async-storage/async-storage';
import { PlayerProfile } from '@/types/lobby';
import { supabase } from '@/services/supabase';

const GUEST_STORAGE_KEY = '@manhunt/guest_profile';

function generateRandomGhostName(): string {
  const code = Math.floor(100 + Math.random() * 900); // 3-digit number 100-999
  return `Ghost-${code}`;
}

function generateSimpleUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

class GuestAuthService {
  private cachedProfile: PlayerProfile | null = null;
  private authInitPromise: Promise<string | null> | null = null;

  /**
   * Ensures the user has an active authenticated session via Supabase Anonymous Auth.
   * Derives a cryptographic JWT and session user ID (auth.uid()).
   */
  async ensureAuthenticatedSession(): Promise<string | null> {
    if (this.authInitPromise) {
      return this.authInitPromise;
    }

    this.authInitPromise = (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.user?.id) {
          return sessionData.session.user.id;
        }

        const { data: authData, error } = await supabase.auth.signInAnonymously();
        if (error) {
          // If anonymous sign in is disabled or network fails, log and return null for offline fallback
          console.warn('[Auth] Anonymous sign-in attempt warning:', error.message);
          return null;
        }

        return authData?.user?.id ?? null;
      } catch (err) {
        console.warn('[Auth] Session initialization failed, proceeding with offline profile:', err);
        return null;
      } finally {
        this.authInitPromise = null;
      }
    })();

    return this.authInitPromise;
  }

  async getGuestProfile(): Promise<PlayerProfile> {
    if (this.cachedProfile) {
      return this.cachedProfile;
    }

    let storedDisplayName: string | null = null;
    let fallbackId: string | null = null;

    try {
      const stored = await AsyncStorage.getItem(GUEST_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as PlayerProfile;
        if (parsed.displayName) {
          storedDisplayName = parsed.displayName;
        }
        if (parsed.id) {
          fallbackId = parsed.id;
        }
      }
    } catch {
      // Storage read non-fatal
    }

    // Authenticate with Supabase to get authoritative JWT user ID
    const authUserId = await this.ensureAuthenticatedSession();
    const effectiveId = authUserId || fallbackId || generateSimpleUUID();
    const effectiveName = storedDisplayName || generateRandomGhostName();

    const profile: PlayerProfile = {
      id: effectiveId,
      displayName: effectiveName,
      isGuest: true,
    };

    this.cachedProfile = profile;

    // Persist updated profile mapping
    try {
      await AsyncStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // Storage error non-fatal
    }

    // Synchronize remote profile
    await this.syncRemoteProfile(profile);

    return profile;
  }

  async updateDisplayName(newName: string): Promise<PlayerProfile> {
    const current = await this.getGuestProfile();
    const cleanName = newName.trim().slice(0, 30) || generateRandomGhostName();
    const updated: PlayerProfile = {
      ...current,
      displayName: cleanName,
    };

    this.cachedProfile = updated;
    try {
      await AsyncStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Storage error non-fatal
    }

    await this.syncRemoteProfile(updated);
    return updated;
  }

  async syncRemoteProfile(profile: PlayerProfile): Promise<void> {
    try {
      await supabase.from('profiles').upsert({
        id: profile.id,
        display_name: profile.displayName,
        is_guest: true,
      });
    } catch {
      // Offline or remote table not yet migrated; safe to ignore
    }
  }
}

export const guestAuth = new GuestAuthService();
