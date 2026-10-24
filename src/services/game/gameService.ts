import { supabase } from '@/services/supabase';
import { GPSLocation } from '@/types/geo';
import { AbilityType, ActiveEffect, HunterSnapshot, RunnerSnapshot } from '@/types/game';
import { PlayerRole } from '@/types/lobby';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface PlayerLocationBroadcast {
  playerId: string;
  role: PlayerRole;
  displayName: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number | null;
  measuredAt: number;
}

export interface AbilityBroadcast {
  effect: ActiveEffect;
}

class GameService {
  private channel: RealtimeChannel | null = null;
  private lastDbWriteTime = 0;

  /**
   * Initializes the realtime game communications channel for 30-player sync.
   */
  joinGameChannel(
    gameId: string,
    onLocationReceived: (data: PlayerLocationBroadcast) => void,
    onAbilityActivated: (effect: ActiveEffect) => void,
    onCatchEvent: (payload: any) => void
  ): () => void {
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }

    const channel = supabase.channel(`live_game:${gameId}`, {
      config: {
        broadcast: { ack: false, self: false },
      },
    });

    channel
      .on('broadcast', { event: 'location' }, ({ payload }) => {
        if (payload) {
          onLocationReceived(payload as PlayerLocationBroadcast);
        }
      })
      .on('broadcast', { event: 'ability' }, ({ payload }) => {
        if (payload?.effect) {
          onAbilityActivated(payload.effect as ActiveEffect);
        }
      })
      .on('broadcast', { event: 'catch' }, ({ payload }) => {
        if (payload) {
          onCatchEvent(payload);
        }
      })
      .subscribe();

    this.channel = channel;

    return () => {
      channel.unsubscribe();
      if (this.channel === channel) {
        this.channel = null;
      }
    };
  }

  /**
   * Broadcasts the player's real GPS location to all match participants.
   * Rate-limits database writes to avoid unnecessary roundtrips, while maintaining 100% real-time broadcasts.
   */
  async broadcastLocation(
    gameId: string,
    playerId: string,
    role: PlayerRole,
    displayName: string,
    location: GPSLocation
  ): Promise<void> {
    const payload: PlayerLocationBroadcast = {
      playerId,
      role,
      displayName,
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy,
      heading: location.heading,
      measuredAt: location.measuredAt,
    };

    // 1. Instant WebSocket broadcast via Supabase Realtime
    if (this.channel) {
      await this.channel.send({
        type: 'broadcast',
        event: 'location',
        payload,
      });
    }

    // 2. Persist to database once every 10 seconds per player (rate-limited persistence)
    const now = Date.now();
    if (now - this.lastDbWriteTime >= 10000) {
      this.lastDbWriteTime = now;
      try {
        await supabase.from('player_locations').insert({
          game_id: gameId,
          player_id: playerId,
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          heading: location.heading,
          speed: location.speed,
          measured_at: new Date(location.measuredAt).toISOString(),
        });
      } catch {
        // Non-blocking telemetry persistence
      }
    }
  }

  /**
   * Broadcasts activation of a tactical ability to all clients.
   */
  async broadcastAbility(effect: ActiveEffect): Promise<void> {
    if (this.channel) {
      await this.channel.send({
        type: 'broadcast',
        event: 'ability',
        payload: { effect },
      });
    }
  }

  /**
   * Broadcasts a catch event to all participants.
   */
  async broadcastCatchEvent(eventData: any): Promise<void> {
    if (this.channel) {
      await this.channel.send({
        type: 'broadcast',
        event: 'catch',
        payload: eventData,
      });
    }
  }
}

export const gameService = new GameService();
