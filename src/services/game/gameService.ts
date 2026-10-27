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

export interface ChatMessageBroadcast {
  id: string;
  senderId: string;
  senderName: string;
  role: PlayerRole;
  channelScope?: 'TEAM' | 'ALL';
  text: string;
  timestamp: number;
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
    onCatchEvent: (payload: any) => void,
    onConnectionError?: (err: Error) => void,
    onChatMessage?: (msg: ChatMessageBroadcast) => void
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
      .on('broadcast', { event: 'chat' }, ({ payload }) => {
        if (payload && onChatMessage) {
          onChatMessage(payload as ChatMessageBroadcast);
        }
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          onConnectionError?.(new Error('Connection to match server lost. Attempting to reconnect...'));
        }
      });

    this.channel = channel;

    return () => {
      channel.unsubscribe();
      if (this.channel === channel) {
        this.channel = null;
      }
    };
  }

  /**
   * Authoritatively activates a tactical ability via Supabase RPC.
   * Validates role eligibility, cooldown, and duration server-side.
   */
  async activateAbility(
    gameId: string,
    playerId: string,
    ability: AbilityType
  ): Promise<ActiveEffect> {
    const { data, error } = await supabase.rpc('activate_ability', {
      p_game_id: gameId,
      p_player_id: playerId,
      p_ability: ability,
    });

    if (error) {
      if (error.code === 'PGRST202') {
        throw new Error(
          `Server function 'activate_ability' not found on backend. Please apply the latest Supabase migration.`
        );
      }
      throw new Error(error.message || 'Server rejected ability activation.');
    }

    if (!data?.success) {
      throw new Error(data?.message || 'Ability activation failed on server.');
    }

    const effect: ActiveEffect = {
      id: data.effect_id,
      ability: data.ability,
      actorPlayerId: playerId,
      startedAt: Number(data.started_at),
      expiresAt: Number(data.expires_at),
      cooldownUntil: Number(data.cooldown_until),
    };

    // Broadcast server-validated effect to all match participants
    await this.broadcastAbility(effect);

    return effect;
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

  /**
   * Broadcasts a tactical radio / chat message to teammates.
   */
  async broadcastChatMessage(msg: {
    id: string;
    senderId: string;
    senderName: string;
    role: PlayerRole;
    channelScope?: 'TEAM' | 'ALL';
    text: string;
    timestamp: number;
  }): Promise<void> {
    if (this.channel) {
      await this.channel.send({
        type: 'broadcast',
        event: 'chat',
        payload: msg,
      });
    }
  }
}

export const gameService = new GameService();

