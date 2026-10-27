import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { supabase } from '@/services/supabase';
import { PlayerProfile } from '@/types/lobby';
import { progressionService } from '@/services/progression/progressionService';

const AUTH_STORAGE_KEY = '@manhunt/auth_session';

export interface UserAccount {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  createdAt: number;
}

const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  '608816354275-30hq31gar3ffhocdp6rq67nnfo1m6j0h.apps.googleusercontent.com';

// Safe configuration of Google Sign-In
try {
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    offlineAccess: true,
  });
} catch (err) {
  console.warn('[Auth] GoogleSignin configure warning:', err);
}

async function safeStorageGet(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function safeStorageSet(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // non-fatal
  }
}

async function safeStorageRemove(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // non-fatal
  }
}

class AuthService {
  private currentUser: UserAccount | null = null;
  private isLoaded = false;
  private authListeners: Array<(user: UserAccount | null) => void> = [];

  onAuthStateChange(listener: (user: UserAccount | null) => void): () => void {
    this.authListeners.push(listener);
    if (this.isLoaded) {
      listener(this.currentUser);
    }
    return () => {
      this.authListeners = this.authListeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners() {
    for (const listener of this.authListeners) {
      try {
        listener(this.currentUser);
      } catch (err) {
        console.error('[Auth] Listener callback error:', err);
      }
    }
  }

  async loadSession(): Promise<UserAccount | null> {
    if (this.isLoaded && this.currentUser) {
      return this.currentUser;
    }

    try {
      // 1. Check active Supabase session (with 1.5s timeout for fast offline fallback)
      const sessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) =>
        setTimeout(() => resolve({ data: { session: null } }), 1500)
      );
      const { data } = await Promise.race([sessionPromise, timeoutPromise]);
      if (data?.session?.user) {
        const user = data.session.user;
        const account: UserAccount = {
          id: user.id,
          email: user.email || '',
          displayName:
            user.user_metadata?.display_name ||
            user.user_metadata?.full_name ||
            user.email?.split('@')[0] ||
            'Operative',
          avatarUrl: user.user_metadata?.avatar_url || undefined,
          createdAt: new Date(user.created_at).getTime(),
        };

        // Query profile from database for any updated avatar/display_name
        try {
          const { data: dbProfile } = await supabase
            .from('profiles')
            .select('display_name, avatar_url')
            .eq('id', user.id)
            .maybeSingle();

          if (dbProfile) {
            if (dbProfile.display_name) account.displayName = dbProfile.display_name;
            if (dbProfile.avatar_url) account.avatarUrl = dbProfile.avatar_url;
          } else {
            await this.syncDatabaseProfile(account);
          }
        } catch {
          // non-fatal
        }

        this.currentUser = account;
        this.isLoaded = true;
        await safeStorageSet(AUTH_STORAGE_KEY, JSON.stringify(account));
        this.notifyListeners();
        return account;
      }

      // 2. Fallback to cached session in AsyncStorage
      const stored = await safeStorageGet(AUTH_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as UserAccount;
        if (parsed?.id && parsed?.email) {
          this.currentUser = parsed;
          this.isLoaded = true;
          this.notifyListeners();
          return parsed;
        }
      }
    } catch (err) {
      console.warn('[Auth] loadSession warning:', err);
    }

    this.isLoaded = true;
    this.currentUser = null;
    this.notifyListeners();
    return null;
  }

  getCurrentUser(): UserAccount | null {
    return this.currentUser;
  }

  isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  /**
   * Persists or updates the player profile in Supabase public.profiles table.
   * Guarantees is_guest: false and updates display_name, avatar_url, updated_at.
   */
  async syncDatabaseProfile(account: UserAccount): Promise<void> {
    try {
      const { error } = await supabase.from('profiles').upsert(
        {
          id: account.id,
          user_id: account.id,
          display_name: account.displayName,
          avatar_url: account.avatarUrl || null,
          is_guest: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
      if (error) {
        console.warn('[Auth] syncDatabaseProfile error:', error.message);
      }
    } catch (err) {
      console.warn('[Auth] syncDatabaseProfile network exception:', err);
    }
  }

  /**
   * Checks if a display name / username is available.
   */
  async checkUsernameAvailable(username: string): Promise<boolean> {
    const clean = username.trim();
    if (clean.length < 2 || clean.length > 30) return false;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .ilike('display_name', clean)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.warn('[Auth] checkUsernameAvailable error:', error.message);
        return true; // Default to permissive on transient error
      }

      // If found and not owned by current user, it is taken
      if (data && data.id !== this.currentUser?.id) {
        return false;
      }
      return true;
    } catch {
      return true;
    }
  }

  /**
   * Primary authentication via Google Sign-In with Supabase ID Token exchange.
   */
  async signInWithGoogle(): Promise<UserAccount> {
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const signInResult = await GoogleSignin.signIn();

      const idToken =
        signInResult.data?.idToken || (signInResult as any).idToken;

      if (!idToken) {
        throw new Error('Google Sign-In succeeded but no ID token was received.');
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (error) {
        throw new Error(`Supabase Auth error: ${error.message}`);
      }

      if (!data.user) {
        throw new Error('No user returned from Supabase authentication.');
      }

      const googleUser = signInResult.data?.user || (signInResult as any).user;
      const email = data.user.email || googleUser?.email || '';
      const defaultName =
        googleUser?.name ||
        data.user.user_metadata?.full_name ||
        email.split('@')[0] ||
        'Operative';
      const avatarUrl = googleUser?.photo || data.user.user_metadata?.avatar_url;

      const account: UserAccount = {
        id: data.user.id,
        email,
        displayName: defaultName,
        avatarUrl,
        createdAt: new Date(data.user.created_at).getTime(),
      };

      // Ensure profile exists in public.profiles table
      await this.syncDatabaseProfile(account);

      // Initialize progression profile if not existing
      await progressionService.getProgression(account.id, account.displayName);

      this.currentUser = account;
      this.isLoaded = true;
      await safeStorageSet(AUTH_STORAGE_KEY, JSON.stringify(account));
      this.notifyListeners();

      return account;
    } catch (err: any) {
      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        throw new Error('Sign in was cancelled.');
      } else if (err.code === statusCodes.IN_PROGRESS) {
        throw new Error('Sign in is already in progress.');
      } else if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error('Google Play Services is not available or outdated.');
      }
      throw err;
    }
  }

  /**
   * Update profile display name and/or avatar URL.
   */
  async updateProfile(updates: {
    displayName?: string;
    avatarUrl?: string;
  }): Promise<UserAccount | null> {
    if (!this.currentUser) return null;

    const updatedAccount: UserAccount = {
      ...this.currentUser,
      displayName: updates.displayName?.trim() || this.currentUser.displayName,
      avatarUrl: updates.avatarUrl !== undefined ? updates.avatarUrl : this.currentUser.avatarUrl,
    };

    this.currentUser = updatedAccount;
    await safeStorageSet(AUTH_STORAGE_KEY, JSON.stringify(updatedAccount));

    // Persist to Supabase Auth metadata
    try {
      await supabase.auth.updateUser({
        data: {
          display_name: updatedAccount.displayName,
          avatar_url: updatedAccount.avatarUrl,
        },
      });
    } catch {
      // non-fatal
    }

    // Persist to public.profiles table
    await this.syncDatabaseProfile(updatedAccount);

    // Sync progression display name
    await progressionService.getProgression(updatedAccount.id, updatedAccount.displayName);

    this.notifyListeners();
    return updatedAccount;
  }

  async signOut(): Promise<void> {
    try {
      await GoogleSignin.signOut().catch(() => {});
    } catch {
      // non-fatal
    }

    try {
      await supabase.auth.signOut().catch(() => {});
    } catch {
      // non-fatal
    }

    this.currentUser = null;
    this.isLoaded = true;
    await safeStorageRemove(AUTH_STORAGE_KEY);
    this.notifyListeners();
  }

  async getPlayerProfile(): Promise<PlayerProfile | null> {
    const user = await this.loadSession();
    if (user) {
      return {
        id: user.id,
        displayName: user.displayName,
        isGuest: false,
      };
    }
    return null;
  }
}

export const authService = new AuthService();
