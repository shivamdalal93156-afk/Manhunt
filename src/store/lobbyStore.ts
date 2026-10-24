import { create } from 'zustand';
import {
  LobbyPlayer,
  LobbyState,
  MatchSession,
  PlayerRole,
} from '@/types/lobby';
import { CreateMatchOptions, lobbyService } from '@/services/lobby/lobbyService';

interface LobbyStoreState {
  session: MatchSession | null;
  lobbyState: LobbyState | null;
  isLoading: boolean;
  error: string | null;

  createMatch: (options?: CreateMatchOptions) => Promise<MatchSession>;
  joinMatch: (joinCode: string, preferredRole?: PlayerRole) => Promise<MatchSession>;
  subscribeToLobby: (gameId: string) => () => void;
  updateRole: (targetPlayerId: string, newRole: PlayerRole) => Promise<void>;
  toggleReady: () => Promise<void>;
  startMatch: () => Promise<void>;
  leaveMatch: () => Promise<void>;
  clearError: () => void;
}

export const useLobbyStore = create<LobbyStoreState>((set, get) => ({
  session: null,
  lobbyState: null,
  isLoading: false,
  error: null,

  createMatch: async (options) => {
    set({ isLoading: true, error: null });
    try {
      const session = await lobbyService.createMatch(options);
      set({ session, isLoading: false });
      return session;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create match';
      set({ error: msg, isLoading: false });
      throw err;
    }
  },

  joinMatch: async (joinCode, preferredRole = 'RUNNER') => {
    set({ isLoading: true, error: null });
    try {
      const session = await lobbyService.joinMatch(joinCode, preferredRole);
      set({ session, isLoading: false });
      return session;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to join match';
      set({ error: msg, isLoading: false });
      throw err;
    }
  },

  subscribeToLobby: (gameId: string) => {
    return lobbyService.subscribeLobby(gameId, (state) => {
      set({ lobbyState: state });

      // Update my own role if changed by host
      const currentSession = get().session;
      if (currentSession) {
        const me = state.players.find((p) => p.id === currentSession.myPlayerId);
        if (me && me.role !== currentSession.myRole) {
          set({
            session: {
              ...currentSession,
              myRole: me.role,
              isHost: me.isHost,
            },
          });
        }
      }
    });
  },

  updateRole: async (targetPlayerId: string, newRole: PlayerRole) => {
    const { session } = get();
    if (!session) return;
    try {
      await lobbyService.updatePlayerRole(session.gameId, targetPlayerId, newRole);
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : 'Failed to update role' });
    }
  },

  toggleReady: async () => {
    const { session, lobbyState } = get();
    if (!session || !lobbyState) return;

    const me = lobbyState.players.find((p) => p.id === session.myPlayerId);
    if (!me) return;

    try {
      await lobbyService.toggleReadyStatus(session.gameId, session.myPlayerId, !me.isReady);
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : 'Failed to update readiness' });
    }
  },

  startMatch: async () => {
    const { session } = get();
    if (!session) return;
    set({ isLoading: true, error: null });
    try {
      await lobbyService.startMatch(session.gameId);
      set({ isLoading: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start match';
      set({ error: msg, isLoading: false });
      throw err;
    }
  },

  leaveMatch: async () => {
    const { session } = get();
    if (!session) return;
    try {
      await lobbyService.leaveMatch(session.gameId, session.myPlayerId);
    } finally {
      set({ session: null, lobbyState: null });
    }
  },

  clearError: () => set({ error: null }),
}));
