import { guestAuth } from '../guestAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/services/supabase';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

jest.mock('@/services/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      upsert: jest.fn().mockResolvedValue({ error: null }),
    })),
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signInAnonymously: jest.fn().mockResolvedValue({
        data: { user: { id: 'auth-user-jwt-1234' }, session: { access_token: 'fake-jwt' } },
        error: null,
      }),
    },
  },
}));

describe('Guest Authentication & Profile Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (guestAuth as any).cachedProfile = null;
    (guestAuth as any).authInitPromise = null;
  });

  it('authenticates anonymously via Supabase when no stored session exists', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

    const profile = await guestAuth.getGuestProfile();

    expect(supabase.auth.signInAnonymously).toHaveBeenCalled();
    expect(profile.id).toBe('auth-user-jwt-1234');
    expect(profile.displayName).toMatch(/^Ghost-\d{3}$/);
    expect(profile.isGuest).toBe(true);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@manhunt/guest_profile',
      expect.stringContaining('auth-user-jwt-1234')
    );
  });

  it('reuses existing authenticated Supabase session when present', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
    (supabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
      data: { session: { user: { id: 'existing-session-user-5678' } } },
      error: null,
    });

    const profile = await guestAuth.getGuestProfile();

    expect(profile.id).toBe('existing-session-user-5678');
    expect(supabase.auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it('migrates existing stored guest profile while preserving custom display name', async () => {
    const existingOldProfile = {
      id: 'old-local-uuid-9999',
      displayName: 'Commander-Viper',
      isGuest: true,
    };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(existingOldProfile));
    (supabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
      data: { session: { user: { id: 'migrated-auth-user-0001' } } },
      error: null,
    });

    const profile = await guestAuth.getGuestProfile();

    // Display name is preserved, but ID is now the authenticated auth.uid()
    expect(profile.displayName).toBe('Commander-Viper');
    expect(profile.id).toBe('migrated-auth-user-0001');
    expect(supabase.from).toHaveBeenCalledWith('profiles');
  });

  it('gracefully falls back to offline UUID if network fails during auth', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
    (supabase.auth.getSession as jest.Mock).mockRejectedValueOnce(new Error('Network offline'));

    const profile = await guestAuth.getGuestProfile();

    expect(profile.id).toBeDefined();
    expect(profile.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(profile.displayName).toMatch(/^Ghost-\d{3}$/);
  });

  it('updates display name and synchronizes remote profiles table', async () => {
    const existing = {
      id: 'auth-user-jwt-1234',
      displayName: 'Operator-Raven',
      isGuest: true,
    };
    (guestAuth as any).cachedProfile = existing;

    const updated = await guestAuth.updateDisplayName('Shadow-Hunter');

    expect(updated.displayName).toBe('Shadow-Hunter');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@manhunt/guest_profile',
      JSON.stringify(updated)
    );
    expect(supabase.from).toHaveBeenCalledWith('profiles');
  });
});
