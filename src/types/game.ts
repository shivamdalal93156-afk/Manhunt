import { GPSLocation, LatLng } from '@/types/geo';
import { GameStatus, PlayerRole, PlayerStatus } from '@/types/lobby';

export type AbilityType = 'STEALTH' | 'PING' | 'BLIND' | 'MAP_VIEW' | 'DECOY';

export interface ActiveEffect {
  id: string;
  ability: AbilityType;
  actorPlayerId: string;
  targetPlayerId?: string;
  startedAt: number;
  expiresAt: number;
  cooldownUntil: number;
}

export interface RunnerSnapshot {
  playerId: string;
  displayName: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  measuredAt: number;
  isDecoy?: boolean;
}

export interface HunterSnapshot {
  playerId: string;
  displayName: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  measuredAt: number;
}

export interface ThreatTelemetry {
  nearestHunterDistanceMeters: number | null;
  relativeBearingDegrees: number | null; // 0-360 clockwise from device heading
  threatLevel: 'SAFE' | 'WARNING' | 'DANGER' | 'CLEAR';
  nearestHunterName?: string;
}

export interface CatchAttemptResult {
  success: boolean;
  message: string;
  targetRunnerId: string;
  heartsRemaining: number;
  isEliminated: boolean;
  distanceMeters: number;
}

export interface MatchResults {
  gameId: string;
  winningTeam: 'HUNTERS' | 'RUNNERS' | 'DRAW';
  durationSeconds: number;
  totalRunners: number;
  runnersCaught: number;
  finishedAt: number;
}
