import { create } from 'zustand';
import {
  LobbyPlayer,
  LobbyState,
  MatchSession,
  PlayerRole,
} from '@/types/lobby';
import { CreateMatchOptions, lobbyService } from '@/services/lobby/lobbyService';
import { sessionManager, PersistedMatchSession } from '@/services/session/sessionManager';

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
  restoreSession: (persisted: PersistedMatchSession) => void;
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

      await sessionManager.saveActiveSession({
        gameId: session.gameId,
        joinCode: session.joinCode,
        myPlayerId: session.myPlayerId,
        myRole: session.myRole,
        isHost: true,
        route: `/lobby/${session.gameId}`,
        savedAt: Date.now(),
        durationMinutes: options?.durationMinutes ?? 30,
        runnerHearts: options?.runnerHearts ?? 3,
      });

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

      await sessionManager.saveActiveSession({
        gameId: session.gameId,
        joinCode: session.joinCode,
        myPlayerId: session.myPlayerId,
        myRole: session.myRole,
        isHost: false,
        route: `/lobby/${session.gameId}`,
        savedAt: Date.now(),
        durationMinutes: session.settings.durationMinutes,
        catchCode: session.catchCode,
      });

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
    const { session, lobbyState } = get();
    if (!session) return;

    // Optimistic UI update so room owner sees instant visual feedback
    if (lobbyState) {
      const updatedPlayers = lobbyState.players.map((p) =>
        p.id === targetPlayerId ? { ...p, role: newRole } : p
      );
      set({
        lobbyState: {
          ...lobbyState,
          players: updatedPlayers,
        },
      });
    }

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

      // Update persisted session route to live game
      const targetRoute = session.myRole === 'RUNNER' ? '/game/runner' : '/game/hunter';
      await sessionManager.saveActiveSession({
        gameId: session.gameId,
        joinCode: session.joinCode,
        myPlayerId: session.myPlayerId,
        myRole: session.myRole,
        isHost: session.isHost,
        route: targetRoute,
        savedAt: Date.now(),
        durationMinutes: session.settings.durationMinutes,
        catchCode: session.catchCode,
      });
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
      await sessionManager.clearActiveSession();
      set({ session: null, lobbyState: null });
    }
  },

  restoreSession: (persisted: PersistedMatchSession) => {
    set({
      session: {
        gameId: persisted.gameId,
        joinCode: persisted.joinCode,
        hostProfileId: '',
        status: 'ACTIVE',
        settings: {
          durationMinutes: persisted.durationMinutes,
          headStartSeconds: 60,
          locationPingIntervalSeconds: 30,
          maxPlayers: 30,
          runnerHearts: persisted.runnerHearts ?? 3,
          catchRadiusMeters: 15,
        },
        playZone: {
          type: 'circle',
          radiusMeters: 500,
        },
        myPlayerId: persisted.myPlayerId,
        myRole: persisted.myRole,
        isHost: persisted.isHost,
        catchCode: persisted.catchCode,
      },
    });
  },

  clearError: () => set({ error: null }),
}));
