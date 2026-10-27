export const GoogleSignin = {
  configure: jest.fn(),
  hasPlayServices: jest.fn().mockResolvedValue(true),
  signIn: jest.fn().mockResolvedValue({
    data: {
      idToken: 'mock-google-id-token',
      user: {
        id: 'google-user-123',
        name: 'Agent Maverick',
        email: 'maverick@manhunt.app',
      },
    },
  }),
  signOut: jest.fn().mockResolvedValue(null),
};

export const statusCodes = {
  SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
  IN_PROGRESS: 'IN_PROGRESS',
  PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
};

export const GoogleSigninButton = () => null;
