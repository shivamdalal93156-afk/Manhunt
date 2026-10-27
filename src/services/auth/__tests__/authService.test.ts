import { authService } from '../authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/services/supabase';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

let mockStorage: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStorage[key] || null)),
  setItem: jest.fn((key: string, val: string) => {
    mockStorage[key] = val;
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    delete mockStorage[key];
    return Promise.resolve();
  }),
  clear: jest.fn(() => {
    mockStorage = {};
    return Promise.resolve();
  }),
}));

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn().mockResolvedValue({
      data: {
        idToken: 'mock-google-id-token',
        user: {
          id: 'google-user-123',
          name: 'Agent Maverick',
          email: 'maverick@manhunt.app',
          photo: 'https://example.com/avatar.jpg',
        },
      },
    }),
    signOut: jest.fn().mockResolvedValue(null),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  },
}));

jest.mock('@/services/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      upsert: jest.fn().mockResolvedValue({ error: null }),
      select: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signInWithIdToken: jest.fn().mockResolvedValue({
        data: {
          user: {
            id: 'auth-user-999',
            email: 'maverick@manhunt.app',
            user_metadata: { full_name: 'Agent Maverick' },
            created_at: new Date().toISOString(),
          },
        },
        error: null,
      }),
      updateUser: jest.fn().mockResolvedValue({ error: null }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
    },
  },
}));

describe('AuthService (Google Auth)', () => {
  beforeEach(async () => {
    mockStorage = {};
    jest.clearAllMocks();
    await authService.signOut();
  });

  it('signs in with Google, exchanges ID token with Supabase and sets session', async () => {
    const account = await authService.signInWithGoogle();
    expect(account.id).toBe('auth-user-999');
    expect(account.email).toBe('maverick@manhunt.app');
    expect(account.displayName).toBe('Agent Maverick');
    expect(authService.isAuthenticated()).toBe(true);

    const profile = await authService.getPlayerProfile();
    expect(profile?.displayName).toBe('Agent Maverick');
    expect(profile?.isGuest).toBe(false);
  });

  it('updates player profile display name and avatar', async () => {
    await authService.signInWithGoogle();
    const updated = await authService.updateProfile({
      displayName: 'TopGun',
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde',
    });

    expect(updated?.displayName).toBe('TopGun');
    expect(updated?.avatarUrl).toBe('https://images.unsplash.com/photo-1535713875002-d1d0cf377fde');
  });

  it('signs out and clears authenticated profile', async () => {
    await authService.signInWithGoogle();
    expect(authService.isAuthenticated()).toBe(true);

    await authService.signOut();
    expect(authService.isAuthenticated()).toBe(false);

    const profile = await authService.getPlayerProfile();
    expect(profile).toBeNull();
  });
});
