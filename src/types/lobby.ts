export type PlayerRole = 'HUNTER' | 'RUNNER' | 'REFEREE' | 'SPECTATOR';
export type PlayerStatus = 'ALIVE' | 'CAUGHT' | 'OUT_OF_BOUNDS' | 'DISCONNECTED';
export type GameStatus =
  | 'CREATED'
  | 'LOBBY'
  | 'COUNTDOWN'
  | 'ACTIVE'
  | 'PAUSED'
  | 'FINISHED'
  | 'CANCELLED';

export interface PlayerProfile {
  id: string;
  displayName: string;
  avatarUrl?: string;
  isGuest: boolean;
}

export interface LobbyPlayer {
  id: string; // game_players.id
  profileId: string;
  displayName: string;
  role: PlayerRole;
  status: PlayerStatus;
  isReady: boolean;
  isHost: boolean;
  heartsRemaining: number;
  catchCode?: string;
  lastSeenAt: number;
}

export interface MatchSettings {
  durationMinutes: number;
  headStartSeconds: number;
  locationPingIntervalSeconds: number;
  maxPlayers: number;
  runnerHearts: number;
  catchRadiusMeters: number;
}

export interface PlayZoneSettings {
  type: 'circle';
  radiusMeters: number;
  center?: [number, number]; // [lng, lat]
}

export interface MatchSession {
  gameId: string;
  joinCode: string;
  hostProfileId: string;
  status: GameStatus;
  settings: MatchSettings;
  playZone: PlayZoneSettings;
  myPlayerId: string;
  myRole: PlayerRole;
  isHost: boolean;
  catchCode?: string;
}

export interface LobbyState {
  gameId: string;
  joinCode: string;
  status: GameStatus;
  settings: MatchSettings;
  playZone: PlayZoneSettings;
  hostProfileId: string;
  players: LobbyPlayer[];
}
