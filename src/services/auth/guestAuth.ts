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

  async getGuestProfile(): Promise<PlayerProfile> {
    if (this.cachedProfile) {
      return this.cachedProfile;
    }

    try {
      const stored = await AsyncStorage.getItem(GUEST_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as PlayerProfile;
        if (parsed.id && parsed.displayName) {
          this.cachedProfile = parsed;
          this.syncRemoteProfile(parsed);
          return parsed;
        }
      }
    } catch {
      // Fallback if storage fails
    }

    // Generate new guest profile
    const newProfile: PlayerProfile = {
      id: generateSimpleUUID(),
      displayName: generateRandomGhostName(),
      isGuest: true,
    };

    try {
      await AsyncStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(newProfile));
    } catch {
      // Storage error non-fatal
    }

    this.cachedProfile = newProfile;
    this.syncRemoteProfile(newProfile);
    return newProfile;
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

    this.syncRemoteProfile(updated);
    return updated;
  }

  private async syncRemoteProfile(profile: PlayerProfile): Promise<void> {
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
