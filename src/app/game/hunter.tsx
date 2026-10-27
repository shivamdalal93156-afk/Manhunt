import React, { useEffect, useState } from 'react';
import {
  AppState,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CustomAlertModal,
  AlertButton,
  HelpIcon,
  CloseIcon,
  CompassIcon,
  LocateIcon,
  ListIcon,
} from '@/components/ui';
import { colors } from '@/theme/tokens';
import { LivePlayZoneMap, MapViewMode } from '@/components/game/LivePlayZoneMap';
import { GameBottomDrawer, DrawerPlayerItem } from '@/components/game/GameBottomDrawer';
import { useLocation } from '@/hooks/useLocation';
import { haversineDistance } from '@/lib/geo/distance';
import { AbilityType, ActiveEffect, RunnerSnapshot } from '@/types/game';
import { evaluateDynamicZone } from '@/lib/geo/battleRoyaleZone';
import { gameService, ChatMessageBroadcast } from '@/services/game/gameService';
import { lobbyService } from '@/services/lobby/lobbyService';
import { sessionManager } from '@/services/session/sessionManager';
import { supabase } from '@/services/supabase';
import { useLobbyStore } from '@/store/lobbyStore';
import { PlayZoneSettings } from '@/types/lobby';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const AVATAR_COLORS = ['#22C55E', '#06B6D4', '#DE3B7E', '#8B5CF6', '#F59E0B'];

export default function HunterGameScreen() {
  const router = useRouter();
  const { session, lobbyState } = useLobbyStore();
  const { currentLocation, startTracking, stopTracking, refreshLocation } = useLocation();

  // Map imagery mode: street vs satellite
  const [mapViewMode, setMapViewMode] = useState<MapViewMode>('satellite');

  // Bottom drawer collapse state (swiping down or tapping lowers drawer to maximize Google Map)
  const [isDrawerCollapsed, setIsDrawerCollapsed] = useState(false);

  // In-app alert modal state
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message?: string;
    buttons?: AlertButton[];
  }>({
    visible: false,
    title: '',
  });

  const showAlert = (
    title: string,
    message?: string,
    buttons?: AlertButton[]
  ) => {
    setAlertConfig({
      visible: true,
      title,
      message,
      buttons: buttons || [{ text: 'CONFIRM' }],
    });
  };

  // Restore session if needed
  useEffect(() => {
    if (!session?.gameId) {
      sessionManager.getActiveSession().then((persisted) => {
        if (persisted) {
          useLobbyStore.getState().restoreSession(persisted);
        }
      });
    }
  }, [session?.gameId]);

  // Load authoritative active playZone (polygon or circle)
  const [activePlayZone, setActivePlayZone] = useState<PlayZoneSettings | null>(
    lobbyState?.playZone || session?.playZone || null
  );

  useEffect(() => {
    const loadPlayZone = async () => {
      const gid = session?.gameId || lobbyState?.gameId;
      if (gid) {
        try {
          const { data } = await supabase
            .from('games')
            .select('play_zone')
            .eq('id', gid)
            .maybeSingle();
          if (data?.play_zone) {
            setActivePlayZone(data.play_zone);
            return;
          }
        } catch {
          // ignore
        }
      }

      try {
        const stored = await AsyncStorage.getItem('@manhunt/configured_playzone');
        if (stored) {
          setActivePlayZone(JSON.parse(stored));
        }
      } catch {
        // ignore
      }
    };

    loadPlayZone();
  }, [session?.gameId, lobbyState?.gameId]);

  // AppState listener for GPS tracking
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        refreshLocation();
        startTracking({ timeIntervalMs: 1000, distanceIntervalMeters: 2 });
      }
    });
    return () => sub.remove();
  }, [refreshLocation, startTracking]);

  const [activeEffects, setActiveEffects] = useState<ActiveEffect[]>([]);
  const [liveRunnerLocations, setLiveRunnerLocations] = useState<Map<string, RunnerSnapshot>>(
    new Map()
  );
  const [timeRemaining, setTimeRemaining] = useState(
    (lobbyState?.settings.durationMinutes ?? 30) * 60
  );

  // Squad Radio
  const [chatMessages, setChatMessages] = useState<ChatMessageBroadcast[]>([]);

  const me = lobbyState?.players.find((p) => p.id === session?.myPlayerId);

  // Join live game communications channel
  useEffect(() => {
    if (!session?.gameId) return;

    const unsubChannel = gameService.joinGameChannel(
      session.gameId,
      (broadcast) => {
        if (broadcast.role === 'RUNNER') {
          setLiveRunnerLocations((prev) => {
            const next = new Map(prev);
            next.set(broadcast.playerId, {
              playerId: broadcast.playerId,
              displayName: broadcast.displayName,
              latitude: broadcast.latitude,
              longitude: broadcast.longitude,
              accuracy: broadcast.accuracy ?? 5,
              measuredAt: broadcast.measuredAt,
            });
            return next;
          });
        }
      },
      (effect) => {
        setActiveEffects((prev) => [...prev, effect]);
      },
      (catchEvt) => {
        if (catchEvt?.all_runners_eliminated) {
          showAlert('VICTORY!', 'All runners captured! Hunters win!', [
            { text: 'View Results', onPress: () => router.replace('/game/results') },
          ]);
        }
      },
      undefined,
      (chatMsg) => {
        if (chatMsg.channelScope === 'ALL' || !chatMsg.channelScope || chatMsg.role === 'HUNTER') {
          setChatMessages((prev) => {
            if (prev.some((p) => p.id === chatMsg.id)) return prev;
            return [...prev, chatMsg];
          });
        }
      }
    );

    return () => {
      unsubChannel();
    };
  }, [session?.gameId, router]);

  // Game clock countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          router.replace('/game/results');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [router]);

  // Continuous broadcast of Hunter's own GPS
  useEffect(() => {
    if (!currentLocation || !session?.gameId || !session?.myPlayerId) return;

    gameService.broadcastLocation(
      session.gameId,
      session.myPlayerId,
      'HUNTER',
      me?.displayName ?? 'Chaser',
      currentLocation
    );
  }, [currentLocation, session?.gameId, session?.myPlayerId, me?.displayName]);

  // Evaluated Dynamic Safe Zone
  const totalMatchDurationMin =
    lobbyState?.settings?.durationMinutes ?? session?.settings?.durationMinutes ?? 30;
  const matchElapsedSec = Math.max(0, totalMatchDurationMin * 60 - timeRemaining);

  const dynamicZone = React.useMemo(() => {
    const shrinkMode =
      lobbyState?.settings?.zoneShrinkMode ??
      session?.settings?.zoneShrinkMode ??
      'NONE';
    const rawCenter = lobbyState?.playZone?.center || session?.playZone?.center;
    const initialCenter = rawCenter
      ? Array.isArray(rawCenter)
        ? { latitude: rawCenter[1], longitude: rawCenter[0] }
        : rawCenter
      : currentLocation
      ? { latitude: currentLocation.latitude, longitude: currentLocation.longitude }
      : { latitude: 28.6139, longitude: 77.2090 };
    const initialRadius =
      lobbyState?.playZone?.radiusMeters ?? session?.playZone?.radiusMeters ?? 500;
    const polygonCoordinates =
      activePlayZone?.type === 'polygon' && activePlayZone.coordinates
        ? activePlayZone.coordinates
        : lobbyState?.playZone?.type === 'polygon' && lobbyState.playZone.coordinates
        ? lobbyState.playZone.coordinates
        : undefined;

    return evaluateDynamicZone({
      initialCenter,
      initialRadius,
      mode: shrinkMode,
      totalDurationMinutes: totalMatchDurationMin,
      elapsedSeconds: matchElapsedSec,
      playerLocation: currentLocation,
      seed: session?.joinCode ?? 'manhunt_seed',
      polygonCoordinates,
    });
  }, [
    lobbyState?.settings?.zoneShrinkMode,
    session?.settings?.zoneShrinkMode,
    lobbyState?.playZone,
    session?.playZone,
    activePlayZone,
    currentLocation,
    totalMatchDurationMin,
    matchElapsedSec,
    session?.joinCode,
  ]);

  const handleActivateAbility = async (ability: AbilityType) => {
    if (!me || !session?.gameId || !session?.myPlayerId) return;
    try {
      const effect = await gameService.activateAbility(
        session.gameId,
        session.myPlayerId,
        ability
      );
      setActiveEffects((prev) => [...prev, effect]);
    } catch (err: unknown) {
      showAlert(
        'ABILITY REJECTED',
        err instanceof Error ? err.message : 'Server rejected ability activation'
      );
    }
  };

  const handleSendChatMessage = async (text: string, scope?: 'TEAM' | 'ALL') => {
    if (!session?.gameId || !session?.myPlayerId) return;
    const msg: ChatMessageBroadcast = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      senderId: session.myPlayerId,
      senderName: me?.displayName ?? 'Chaser',
      role: 'HUNTER',
      channelScope: scope ?? 'TEAM',
      text,
      timestamp: Date.now(),
    };
    setChatMessages((prev) => [...prev, msg]);
    await gameService.broadcastChatMessage(msg);
  };

  const handleSubmitCatchCode = async (code: string) => {
    if (!session?.gameId || !session?.myPlayerId) return;
    try {
      const result = await lobbyService.submitCatchCode(
        session.gameId,
        session.myPlayerId,
        code,
        currentLocation?.latitude ?? 0,
        currentLocation?.longitude ?? 0
      );

      if (result.success) {
        await gameService.broadcastCatchEvent({
          hunter_id: session.myPlayerId,
          runner_id: result.runnerId,
          hearts_left: result.heartsRemaining,
          eliminated: result.isEliminated,
          all_runners_eliminated: result.allRunnersEliminated,
        });

        if (result.allRunnersEliminated) {
          showAlert('VICTORY!', 'All runners captured! Hunters win!', [
            { text: 'View Results', onPress: () => router.replace('/game/results') },
          ]);
        } else {
          showAlert(
            result.isEliminated ? 'TARGET ELIMINATED!' : 'CATCH CONFIRMED!',
            result.message
          );
        }
      } else {
        showAlert('VERIFICATION FAILED', result.message);
      }
    } catch (err: unknown) {
      showAlert(
        'SERVER ERROR',
        err instanceof Error ? err.message : 'Failed to reach game server.'
      );
    }
  };

  const handleLeave = () => {
    showAlert('LEAVE MATCH', 'Are you sure you want to exit to main menu?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          await sessionManager.clearActiveSession();
          router.replace('/');
        },
      },
    ]);
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  // Convert runners to drawer items
  const allRunners = lobbyState?.players.filter((p) => p.role === 'RUNNER') || [];
  const drawerPlayers: DrawerPlayerItem[] = allRunners.map((r, idx) => {
    const liveLoc = liveRunnerLocations.get(r.id);
    let dist: number | undefined;
    if (currentLocation && liveLoc) {
      dist = Math.round(
        haversineDistance(currentLocation, {
          latitude: liveLoc.latitude,
          longitude: liveLoc.longitude,
        })
      );
    }

    return {
      id: r.id,
      name: r.displayName,
      initials: r.displayName.slice(0, 2).toUpperCase(),
      avatarColor: AVATAR_COLORS[idx % AVATAR_COLORS.length],
      distanceMeters: dist,
      statusText: liveLoc ? 'Live Location' : 'Searching',
    };
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        {/* Full-bleed Edge-to-Edge Map View (Google Maps Style) */}
        <View style={styles.mapContainer}>
          <LivePlayZoneMap
            currentLocation={currentLocation}
            zoneRadius={dynamicZone.currentCircle.radiusMeters}
            customCenter={dynamicZone.currentCircle.center}
            dynamicNextSafeCircle={dynamicZone.nextSafeCircle}
            dynamicNextSafePolygon={dynamicZone.nextSafePolygon}
            dynamicPhaseText={dynamicZone.statusText}
            fullScreen
            hideModeToggle
            viewMode={mapViewMode}
            onViewModeChange={setMapViewMode}
            zoneMode={
              (activePlayZone as any)?.mode === 'NONE'
                ? 'NONE'
                : activePlayZone?.type === 'polygon'
                ? 'POLYGON'
                : 'CIRCLE'
            }
            polygonVertices={
              dynamicZone.currentPolygon ??
              (activePlayZone?.type === 'polygon'
                ? activePlayZone.coordinates
                : undefined)
            }
            players={Array.from(liveRunnerLocations.values()).map((r) => ({
              id: r.playerId,
              name: r.displayName,
              role: 'RUNNER' as const,
              latitude: r.latitude,
              longitude: r.longitude,
            }))}
          />
        </View>

        {/* Top Floating HUD matching reference screenshot */}
        <View style={styles.topHud}>
          {/* Left: Help (?) button */}
          <TouchableOpacity
            style={styles.hudCircleBtn}
            onPress={() => router.push('/rules')}
            activeOpacity={0.7}
          >
            <HelpIcon size={20} color={colors.text.primary} />
          </TouchableOpacity>

          {/* Center: White timer capsule */}
          <View style={styles.timerCapsule}>
            <Text style={styles.timerCapsuleText}>{formatTimer(timeRemaining)}</Text>
          </View>

          {/* Right: Exit / Leave button */}
          <TouchableOpacity
            style={styles.hudCircleBtn}
            onPress={handleLeave}
            activeOpacity={0.7}
          >
            <CloseIcon size={18} color="#DC2626" />
          </TouchableOpacity>
        </View>

        {/* Floating Map Controls on Bottom Right */}
        <View
          style={[
            styles.floatingMapControls,
            isDrawerCollapsed
              ? styles.floatingMapControlsCollapsed
              : styles.floatingMapControlsExpanded,
          ]}
        >
          {/* Quick 1-tap Lower/Expand Drawer Button for Instant Full Google Map View */}
          <TouchableOpacity
            style={styles.mapActionBtn}
            onPress={() => setIsDrawerCollapsed(!isDrawerCollapsed)}
            activeOpacity={0.8}
          >
            <ListIcon size={20} color={colors.text.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.mapActionBtn}
            onPress={() => refreshLocation()}
            activeOpacity={0.8}
          >
            <CompassIcon size={22} color={colors.text.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.mapActionBtn}
            onPress={() => refreshLocation()}
            activeOpacity={0.8}
          >
            <LocateIcon size={22} color={colors.brand.accent} />
          </TouchableOpacity>
        </View>

        {/* Street Map vs Satellite Mode Toggle floating directly above bottom drawer */}
        <View
          style={[
            styles.floatingModeToggleWrapper,
            isDrawerCollapsed
              ? styles.floatingModeToggleCollapsed
              : styles.floatingModeToggleExpanded,
          ]}
          pointerEvents="box-none"
        >
          <View style={styles.floatingModeToggleBar}>
            <TouchableOpacity
              style={[
                styles.floatingModeBtn,
                mapViewMode === 'street' && styles.floatingModeBtnActiveStreet,
              ]}
              onPress={() => setMapViewMode('street')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.floatingModeText,
                  mapViewMode === 'street' && styles.floatingModeTextActive,
                ]}
              >
                🗺️ STREET MAP
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.floatingModeBtn,
                mapViewMode === 'satellite' && styles.floatingModeBtnActiveSat,
              ]}
              onPress={() => setMapViewMode('satellite')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.floatingModeText,
                  mapViewMode === 'satellite' && styles.floatingModeTextActive,
                ]}
              >
                🛰️ SATELLITE
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom Drawer matching screenshot_1_ui.webp */}
        <View style={styles.bottomDrawerWrapper}>
          <GameBottomDrawer
            role="HUNTER"
            players={drawerPlayers}
            playersSectionTitle="Hunters & Targets"
            activeEffects={activeEffects}
            onActivateAbility={handleActivateAbility}
            chatMessages={chatMessages}
            onSendChatMessage={handleSendChatMessage}
            onSubmitCatchCode={handleSubmitCatchCode}
            isCollapsed={isDrawerCollapsed}
            onCollapseChange={setIsDrawerCollapsed}
          />
        </View>

        {/* In-App Rounded Alert Modal */}
        <CustomAlertModal
          visible={alertConfig.visible}
          title={alertConfig.title}
          message={alertConfig.message}
          buttons={alertConfig.buttons}
          onClose={() => setAlertConfig((prev) => ({ ...prev, visible: false }))}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#070A0F',
  },
  container: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#070A0F',
  },
  mapContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  topHud: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 20,
  },
  hudCircleBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  hudCircleBtnText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#4B5563',
  },
  hudLeaveIcon: {
    fontSize: 20,
    fontWeight: '900',
    color: '#F45B36',
  },
  timerCapsule: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 22,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  timerCapsuleText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1C1C1E',
    letterSpacing: -0.3,
  },
  floatingMapControls: {
    position: 'absolute',
    right: 16,
    gap: 10,
    zIndex: 20,
  },
  floatingMapControlsExpanded: {
    bottom: 350,
  },
  floatingMapControlsCollapsed: {
    bottom: 125,
  },
  mapActionBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  mapActionIcon: {
    fontSize: 20,
    color: '#1C1C1E',
  },
  floatingModeToggleWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 22,
  },
  floatingModeToggleExpanded: {
    bottom: 350,
  },
  floatingModeToggleCollapsed: {
    bottom: 125,
  },
  floatingModeToggleBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 19, 26, 0.92)',
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: 1,
    borderRadius: 24,
    padding: 3,
    gap: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  floatingModeBtn: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingModeBtnActiveStreet: {
    backgroundColor: '#1E293B',
    borderColor: 'rgba(255, 255, 255, 0.25)',
    borderWidth: 1,
  },
  floatingModeBtnActiveSat: {
    backgroundColor: '#0E7490',
    borderColor: '#22D3EE',
    borderWidth: 1,
  },
  floatingModeText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  floatingModeTextActive: {
    color: '#FFFFFF',
  },
  bottomDrawerWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 25,
  },
});
