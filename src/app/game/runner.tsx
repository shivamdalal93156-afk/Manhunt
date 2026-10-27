import React, { useEffect, useState } from 'react';
import {
  Alert,
  AppState,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, Button, Card } from '@/components/ui';
import { AbilityPanel } from '@/components/game/AbilityPanel';
import { DirectionalCompass } from '@/components/game/DirectionalCompass';
import { TacticalRadarMap } from '@/components/game/TacticalRadarMap';
import { useLocation } from '@/hooks/useLocation';
import { pointInCircle, pointInPolygon } from '@/lib/geo/geofence';
import { GameEngine } from '@/services/game/gameEngine';
import { gameService } from '@/services/game/gameService';
import { sessionManager } from '@/services/session/sessionManager';
import { useLobbyStore } from '@/store/lobbyStore';
import { AbilityType, ActiveEffect, HunterSnapshot, RunnerSnapshot } from '@/types/game';
import { evaluateDynamicZone } from '@/lib/geo/battleRoyaleZone';
import { TacticalRadioModal } from '@/components/game/TacticalRadioModal';
import { ChatMessageBroadcast } from '@/services/game/gameService';
import { defaultGPSFilter } from '@/lib/geo/gpsFilter';
import { borderRadius, colors, spacing, typography } from '@/theme/tokens';

export default function RunnerGameScreen() {
  const router = useRouter();
  const { session, lobbyState } = useLobbyStore();
  const { currentLocation, startTracking, stopTracking, refreshLocation } = useLocation();

  // Restore session from device storage if app was killed / reopened
  useEffect(() => {
    if (!session?.gameId) {
      sessionManager.getActiveSession().then((persisted) => {
        if (persisted) {
          useLobbyStore.getState().restoreSession(persisted);
        }
      });
    }
  }, [session?.gameId]);

  // Keep GPS and match alive when app is backgrounded or switched
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        refreshLocation();
        startTracking({ timeIntervalMs: 1000, distanceIntervalMeters: 2 });
      }
    });
    return () => sub.remove();
  }, [refreshLocation, startTracking]);

  const maxHearts = lobbyState?.settings?.runnerHearts ?? session?.settings?.runnerHearts ?? 3;
  const isSuddenDeath = maxHearts === 1;

  const [activeEffects, setActiveEffects] = useState<ActiveEffect[]>([]);
  const [heartsRemaining, setHeartsRemaining] = useState(maxHearts);
  const [isNightStealth, setIsNightStealth] = useState(false);

  useEffect(() => {
    if (lobbyState?.settings?.runnerHearts !== undefined) {
      setHeartsRemaining((prev) => Math.min(prev, lobbyState.settings.runnerHearts));
    }
  }, [lobbyState?.settings?.runnerHearts]);

  const [liveHunterLocations, setLiveHunterLocations] = useState<Map<string, HunterSnapshot>>(
    new Map()
  );
  const [liveTeammateLocations, setLiveTeammateLocations] = useState<Map<string, RunnerSnapshot>>(
    new Map()
  );
  const [chatMessages, setChatMessages] = useState<ChatMessageBroadcast[]>([]);
  const [radioModalVisible, setRadioModalVisible] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(
    (lobbyState?.settings.durationMinutes ?? 30) * 60
  );

  // My private 4-digit catch code
  const me = lobbyState?.players.find((p) => p.id === session?.myPlayerId);
  const myCatchCode = session?.catchCode || me?.catchCode || '----';

  // Join live game communications channel
  useEffect(() => {
    if (!session?.gameId) return;

    const unsubChannel = gameService.joinGameChannel(
      session.gameId,
      (broadcast) => {
        if (broadcast.role === 'HUNTER') {
          setLiveHunterLocations((prev) => {
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
        } else if (broadcast.role === 'RUNNER' && broadcast.playerId !== session.myPlayerId) {
          setLiveTeammateLocations((prev) => {
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
      (newEffect) => {
        setActiveEffects((prev) => [...prev, newEffect]);
      },
      (catchPayload) => {
        if (catchPayload?.runner_id === session.myPlayerId) {
          const newHearts = catchPayload.hearts_left ?? 0;
          setHeartsRemaining(newHearts);
          if (catchPayload.eliminated) {
            Alert.alert(
              'ELIMINATED!',
              'You have been caught by a Hunter and lost all hearts. You can no longer see other runners.',
              [{ text: 'View Results', onPress: () => router.replace('/game/results') }]
            );
          } else {
            Alert.alert(
              'TAGGED!',
              `A Hunter confirmed a catch! You have ${newHearts} heart(s) remaining.`
            );
          }
        }
      },
      (connErr) => {
        Alert.alert('CONNECTION ISSUE', connErr.message);
      },
      (chatMsg) => {
        if (chatMsg.channelScope === 'ALL' || !chatMsg.channelScope || chatMsg.role === 'RUNNER') {
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
  }, [session?.gameId, session?.myPlayerId, router]);

  // Start continuous location tracking and broadcast to live channel
  useEffect(() => {
    let cleanupTracking: (() => void) | undefined;
    startTracking({ timeIntervalMs: 1000, distanceIntervalMeters: 2 }).then(
      (unsub) => {
        cleanupTracking = unsub;
      }
    );

    return () => {
      cleanupTracking?.();
      stopTracking();
    };
  }, [startTracking, stopTracking]);

  // Match countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.replace('/game/results');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  // Match duration and synchronized elapsed time
  const totalMatchDurationMin =
    lobbyState?.settings?.durationMinutes ?? session?.settings?.durationMinutes ?? 30;
  const matchElapsedSec = Math.max(
    0,
    totalMatchDurationMin * 60 - timeRemaining
  );

  // Synchronized Location Reveal Countdown
  const pingIntervalSec =
    lobbyState?.settings?.locationPingIntervalSeconds ??
    session?.settings?.locationPingIntervalSeconds ??
    30;
  const secondsUntilNextPing =
    pingIntervalSec > 0
      ? pingIntervalSec - (matchElapsedSec % pingIntervalSec)
      : 0;

  // Broadcast location when GPS updates or when periodic ping reveal fires
  useEffect(() => {
    if (!currentLocation || !session?.gameId || !session?.myPlayerId) return;

    // High precision GPS filter: eliminates stationary flutter
    const filteredLoc = defaultGPSFilter.filterLocation(currentLocation);

    // Check if this is the scheduled ping interval reveal
    const isPingReveal = secondsUntilNextPing === 0 || secondsUntilNextPing === pingIntervalSec;

    // Gated broadcast: only send when motion >= 3m, or heartbeat (5s), or ping timer fires
    if (defaultGPSFilter.shouldBroadcast(filteredLoc, isPingReveal)) {
      gameService.broadcastLocation(
        session.gameId,
        session.myPlayerId,
        'RUNNER',
        me?.displayName || 'Runner',
        filteredLoc
      );
    }
  }, [
    currentLocation,
    session?.gameId,
    session?.myPlayerId,
    me?.displayName,
    secondsUntilNextPing,
    pingIntervalSec,
  ]);

  const rawHunterSnapshots = Array.from(liveHunterLocations.values());
  // Pure authentic data: no hardcoded mock hunters!
  const hunterSnapshots = rawHunterSnapshots;

  // Once caught, a runner can no longer see other runner locations on compass
  const isCaughtOrEliminated = heartsRemaining <= 0;
  const friendlyRunners = isCaughtOrEliminated
    ? []
    : Array.from(liveTeammateLocations.values());

  // Check if Map View ability is currently deployed
  const isMapViewActive = activeEffects.some(
    (e) => e.ability === 'MAP_VIEW' && e.expiresAt > Date.now()
  );

  // Check if Blind effect is affecting runner
  const isBlinded = activeEffects.some(
    (e) => e.ability === 'BLIND' && e.expiresAt > Date.now()
  );

  // Calculate geodesic threat to nearest hunter
  const threat = currentLocation
    ? GameEngine.calculateRunnerThreat(
        currentLocation,
        hunterSnapshots,
        currentLocation.heading,
        isBlinded
      )
    : {
        nearestHunterDistanceMeters: null,
        relativeBearingDegrees: null,
        threatLevel: 'CLEAR' as const,
      };

  const dynamicZone = React.useMemo(() => {
    const shrinkMode =
      lobbyState?.settings?.zoneShrinkMode ??
      lobbyState?.playZone?.shrinkMode ??
      session?.settings?.zoneShrinkMode ??
      session?.playZone?.shrinkMode ??
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
      lobbyState?.playZone?.type === 'polygon' && lobbyState.playZone.coordinates
        ? lobbyState.playZone.coordinates
        : session?.playZone?.type === 'polygon' && session.playZone.coordinates
        ? session.playZone.coordinates
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
    lobbyState?.playZone?.shrinkMode,
    session?.settings?.zoneShrinkMode,
    session?.playZone?.shrinkMode,
    lobbyState?.playZone,
    session?.playZone,
    currentLocation,
    totalMatchDurationMin,
    matchElapsedSec,
    session?.joinCode,
  ]);

  const isZoneOff = (lobbyState?.playZone as any)?.mode === 'NONE';
  const isPolygonZone = lobbyState?.playZone?.type === 'polygon' && !!lobbyState?.playZone?.coordinates;

  const boundaryCheck = React.useMemo(() => {
    if (isZoneOff) {
      return { isInside: true, distanceToBoundaryMeters: 999999, warningGraceActive: false };
    }
    return {
      isInside: dynamicZone.isInsideActiveZone,
      distanceToBoundaryMeters: Math.round(dynamicZone.distanceToActiveBoundaryMeters),
      warningGraceActive: !dynamicZone.isInsideActiveZone,
    };
  }, [isZoneOff, dynamicZone]);

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
      Alert.alert(
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
      senderName: me?.displayName ?? 'Runner',
      role: 'RUNNER',
      channelScope: scope ?? 'TEAM',
      text,
      timestamp: Date.now(),
    };
    setChatMessages((prev) => [...prev, msg]);
    await gameService.broadcastChatMessage(msg);
  };

  const formatTimer = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <SafeAreaView style={[styles.safeArea, isNightStealth ? styles.safeAreaNight : styles.safeAreaLight]}>
      <ScrollView contentContainerStyle={[styles.container, isNightStealth ? styles.containerNight : styles.containerLight]}>
        {/* Top HUD: Role, Night Stealth Toggle & Clock */}
        <View style={styles.topHud}>
          <View style={styles.roleIdentity}>
            <Badge label="EVADER" variant="runner" />
            <Text style={[styles.hudTitle, isNightStealth ? styles.hudTitleNight : styles.hudTitleLight]}>RUNNER</Text>
          </View>

          {/* Night Stealth Toggle: switches whole screen to pitch-black to avoid screen light revelation */}
          <TouchableOpacity
            style={[
              styles.stealthToggleBtn,
              isNightStealth ? styles.stealthToggleBtnNight : styles.stealthToggleBtnLight,
            ]}
            onPress={() => setIsNightStealth((prev) => !prev)}
            activeOpacity={0.7}
          >
            <Text style={styles.stealthToggleIcon}>{isNightStealth ? '🌙' : '☀️'}</Text>
            <Text
              style={[
                styles.stealthToggleText,
                isNightStealth ? styles.stealthToggleTextNight : styles.stealthToggleTextLight,
              ]}
            >
              {isNightStealth ? 'STEALTH' : 'DAY MODE'}
            </Text>
          </TouchableOpacity>

          <View style={[styles.clockPill, isNightStealth ? styles.clockPillNight : styles.clockPillLight]}>
            <Text style={[styles.clockLabel, isNightStealth ? styles.clockLabelNight : styles.clockLabelLight]}>TIME</Text>
            <Text style={styles.clockVal}>{formatTimer(timeRemaining)}</Text>
          </View>
        </View>

        {/* Lives: Sudden Death (1 Catch) vs Customizable Survival Hearts Gauge */}
        {isSuddenDeath ? (
          <View style={styles.suddenDeathBanner}>
            <View style={styles.suddenDeathBadge}>
              <Text style={styles.suddenDeathIcon}>⚡</Text>
              <Text style={styles.suddenDeathLabel}>SUDDEN DEATH MODE</Text>
            </View>
            <Text style={styles.suddenDeathSub}>1 Catch = Immediate Elimination</Text>
          </View>
        ) : (
          <View style={[styles.heartsRow, isNightStealth ? styles.heartsRowNight : styles.heartsRowLight]}>
            <Text style={[styles.heartsLabel, isNightStealth ? styles.heartsLabelNight : styles.heartsLabelLight]}>
              SURVIVAL HEARTS ({heartsRemaining}/{maxHearts})
            </Text>
            <View style={styles.heartsIcons}>
              {Array.from({ length: maxHearts }, (_, i) => i + 1).map((index) => (
                <Text
                  key={index}
                  style={[
                    styles.heartIcon,
                    index <= heartsRemaining
                      ? styles.heartActive
                      : styles.heartLost,
                  ]}
                >
                  ♥
                </Text>
              ))}
            </View>
          </View>
        )}

        {/* Official Hunting Game 4-Digit Catch-Code Display */}
        <Card
          variant={isNightStealth ? 'glass' : 'default'}
          style={[styles.catchCodeCard, !isNightStealth && styles.catchCodeCardLight]}
        >
          <Text style={[styles.catchCodeLabel, !isNightStealth && styles.catchCodeLabelLight]}>
            YOUR SECRET CATCH CODE
          </Text>
          <View style={styles.codeBoxesRow}>
            {(myCatchCode.padEnd(4, '-').slice(0, 4)).split('').map((char, index) => (
              <View
                key={index}
                style={[
                  styles.codeBox,
                  !isNightStealth && styles.codeBoxLight,
                ]}
              >
                <Text
                  style={[
                    styles.codeBoxDigit,
                    !isNightStealth && styles.codeBoxDigitLight,
                  ]}
                >
                  {char}
                </Text>
              </View>
            ))}
          </View>
          <Text style={[styles.catchCodeHelp, !isNightStealth && styles.catchCodeHelpLight]}>
            Only reveal this 4-digit code if a Hunter physically catches and tags you!
          </Text>
        </Card>

        {/* Live Location Reveal Timer Banner */}
        <View
          style={[
            styles.revealTimerBar,
            !isNightStealth && styles.revealTimerBarLight,
            secondsUntilNextPing <= 5 && styles.revealTimerBarUrgent,
          ]}
        >
          <View style={styles.revealTimerLeft}>
            <Text style={styles.revealTimerIcon}>📡</Text>
            <View>
              <Text style={[styles.revealTimerTitle, !isNightStealth && styles.revealTimerTitleLight]}>
                {secondsUntilNextPing <= 5 ? '⚠️ RADAR SCAN INCOMING!' : 'LOCATION PING COUNTDOWN'}
              </Text>
              <Text style={[styles.revealTimerSub, !isNightStealth && styles.revealTimerSubLight]}>
                {secondsUntilNextPing <= 5
                  ? `Your GPS will be revealed to hunters in ${secondsUntilNextPing}s`
                  : `Next live position reveal in ${secondsUntilNextPing}s`}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.revealTimerBadge,
              secondsUntilNextPing <= 5 && styles.revealTimerBadgeUrgent,
            ]}
          >
            <Text
              style={[
                styles.revealTimerBadgeText,
                secondsUntilNextPing <= 5 && styles.revealTimerBadgeTextUrgent,
              ]}
            >
              {secondsUntilNextPing}s
            </Text>
          </View>
        </View>

        {/* Dynamic Zone Phase Telemetry Bar */}
        {dynamicZone.mode !== 'NONE' && (
          <View style={[styles.dynamicZoneBar, !isNightStealth && styles.dynamicZoneBarLight]}>
            <View style={styles.dynamicZoneHeader}>
              <View style={styles.dynamicZoneBadge}>
                <Text style={styles.dynamicZoneBadgeText}>
                  {dynamicZone.mode === 'BATTLE_ROYALE' ? '⚡ BATTLE ROYALE' : '🎯 CONCENTRIC'}
                </Text>
              </View>
              <Text style={[styles.dynamicZonePhaseText, !isNightStealth && styles.dynamicZonePhaseTextLight]}>
                PHASE {dynamicZone.phaseNumber}/{dynamicZone.totalPhases}
              </Text>
            </View>
            <Text style={[styles.dynamicZoneStatusText, !isNightStealth && styles.dynamicZoneStatusTextLight]}>
              {dynamicZone.statusText}
            </Text>
          </View>
        )}

        {/* Boundary Grace Warning Banner */}
        {boundaryCheck.warningGraceActive && (
          <Card variant="runner" style={styles.boundaryWarning}>
            <Text style={styles.boundaryWarningTitle}>
              ⚠️ OUTSIDE ACTIVE PLAY ZONE!
            </Text>
            <Text style={styles.boundaryWarningText}>
              You have crossed the active perimeter ({Math.abs(boundaryCheck.distanceToBoundaryMeters)}m outside). Move back inside the safe circle immediately!
            </Text>
          </Card>
        )}

        {/* Blinded Jammer Warning */}
        {isBlinded && (
          <Card variant="elevated" style={styles.jammedCard}>
            <Text style={styles.jammedTitle}>⚡ COMPASS SIGNAL JAMMED</Text>
            <Text style={styles.jammedText}>
              Hunter blackout active. Compass telemetry offline.
            </Text>
          </Card>
        )}

        {/* Asymmetric Sensory Tool: Multi-Hunter Concentric Radar Compass */}
        {!isMapViewActive ? (
          <DirectionalCompass
            telemetry={threat}
            deviceHeading={currentLocation?.heading}
            hunters={hunterSnapshots}
            friendlyRunners={friendlyRunners}
            runnerLocation={currentLocation}
            dynamicZone={dynamicZone}
            isNightStealth={isNightStealth}
          />
        ) : (
          <View style={styles.mapRevealContainer}>
            <Text style={styles.mapRevealTitle}>
              TACTICAL MAP REVEAL ACTIVE (15s)
            </Text>
            <TacticalRadarMap
              hunterLocation={currentLocation}
              runners={hunterSnapshots.map((h) => ({
                playerId: h.playerId,
                displayName: h.displayName,
                latitude: h.latitude,
                longitude: h.longitude,
                measuredAt: h.measuredAt,
              }))}
              zoneRadiusMeters={dynamicZone.currentCircle.radiusMeters}
            />
          </View>
        )}

        {/* Tactical Ability Dock */}
        <AbilityPanel
          role="RUNNER"
          activeEffects={activeEffects}
          onActivate={handleActivateAbility}
          isNightStealth={isNightStealth}
        />
      </ScrollView>

      {/* Floating Tactical Radio Trigger (Runner Squad + Global Comms) */}
      <TouchableOpacity
        style={styles.floatingRadioBtn}
        onPress={() => setRadioModalVisible(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.floatingRadioIcon}>💬</Text>
        {chatMessages.length > 0 && (
          <View style={styles.radioBadge}>
            <Text style={styles.radioBadgeText}>{chatMessages.length}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Tactical Radio Comms Modal */}
      <TacticalRadioModal
        visible={radioModalVisible}
        onClose={() => setRadioModalVisible(false)}
        myRole="RUNNER"
        myPlayerId={session?.myPlayerId ?? ''}
        myDisplayName={me?.displayName ?? 'Runner'}
        messages={chatMessages}
        onSendMessage={handleSendChatMessage}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background.base,
  },
  safeAreaLight: {
    backgroundColor: '#F8F9FA',
  },
  safeAreaNight: {
    backgroundColor: '#000000',
  },
  container: {
    padding: spacing.md,
  },
  containerLight: {
    backgroundColor: '#F8F9FA',
  },
  containerNight: {
    backgroundColor: '#000000',
  },
  topHud: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  roleIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  hudTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.lg,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  hudTitleLight: {
    color: '#0F172A',
  },
  hudTitleNight: {
    color: '#FFFFFF',
  },
  stealthToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  stealthToggleBtnLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  stealthToggleBtnNight: {
    backgroundColor: '#0B0F19',
    borderColor: '#38BDF8',
  },
  stealthToggleIcon: {
    fontSize: 13,
  },
  stealthToggleText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  stealthToggleTextLight: {
    color: '#475569',
  },
  stealthToggleTextNight: {
    color: '#38BDF8',
  },
  clockPill: {
    backgroundColor: colors.background.surfaceCard,
    borderColor: colors.border.glass,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    alignItems: 'center',
  },
  clockPillLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  clockPillNight: {
    backgroundColor: '#0A0E17',
    borderColor: '#1E293B',
  },
  clockLabel: {
    color: colors.text.muted,
    fontSize: 9,
    letterSpacing: 1,
    fontWeight: '700',
  },
  clockLabelLight: {
    color: '#64748B',
  },
  clockLabelNight: {
    color: '#64748B',
  },
  clockVal: {
    color: colors.brand.gradientEnd,
    fontSize: typography.fontSize.base,
    fontWeight: '900',
  },
  heartsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background.surfaceCard,
    borderColor: colors.border.glass,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 4,
    borderRadius: borderRadius.full,
    marginBottom: spacing.sm,
  },
  heartsRowLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  heartsRowNight: {
    backgroundColor: '#0A0E17',
    borderColor: '#1E293B',
  },
  heartsLabel: {
    color: colors.text.muted,
    fontSize: typography.fontSize.xs,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  heartsLabelLight: {
    color: '#64748B',
  },
  heartsLabelNight: {
    color: '#94A3B8',
  },
  heartsIcons: {
    flexDirection: 'row',
    gap: 8,
  },
  heartIcon: {
    fontSize: 22,
  },
  heartActive: {
    color: colors.status.danger,
    textShadowColor: 'rgba(239, 68, 68, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  heartLost: {
    color: colors.text.muted,
    opacity: 0.25,
  },
  suddenDeathBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: colors.status.danger,
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  suddenDeathBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  suddenDeathIcon: {
    fontSize: 14,
  },
  suddenDeathLabel: {
    color: colors.status.danger,
    fontSize: typography.fontSize.xs,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  suddenDeathSub: {
    color: colors.text.secondary,
    fontSize: 10,
    fontWeight: '700',
  },
  catchCodeCard: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    borderWidth: 1.5,
    backgroundColor: 'rgba(0, 229, 255, 0.04)',
  },
  catchCodeCardLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#38BDF8',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  catchCodeLabel: {
    color: colors.runner.primary,
    fontSize: typography.fontSize.xs,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  catchCodeLabelLight: {
    color: '#0284C7',
  },
  codeBoxesRow: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
    marginVertical: spacing.xs,
  },
  codeBox: {
    width: 52,
    height: 56,
    borderRadius: borderRadius.md,
    backgroundColor: '#161616',
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  codeBoxLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#0284C7',
    borderWidth: 2,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  codeBoxDigit: {
    color: colors.text.primary,
    fontSize: 28,
    fontWeight: '900',
    fontFamily: typography.fontFamily.mono,
  },
  codeBoxDigitLight: {
    color: '#0F172A',
  },
  catchCodeHelp: {
    color: colors.text.muted,
    fontSize: 11,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  catchCodeHelpLight: {
    color: '#64748B',
  },

  boundaryWarning: {
    marginVertical: spacing.xs,
    borderColor: colors.status.warning,
  },
  boundaryWarningTitle: {
    color: colors.status.warning,
    fontWeight: '800',
    fontSize: typography.fontSize.xs,
    letterSpacing: 1,
  },
  boundaryWarningText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.xs,
    marginTop: 2,
  },
  jammedCard: {
    marginVertical: spacing.xs,
    borderColor: colors.referee.primary,
    alignItems: 'center',
  },
  jammedTitle: {
    color: colors.referee.primary,
    fontWeight: '800',
    fontSize: typography.fontSize.xs,
    letterSpacing: 1.5,
  },
  jammedText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.xs,
    marginTop: 2,
  },
  mapRevealContainer: {
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  mapRevealTitle: {
    color: colors.hunter.primary,
    fontWeight: '800',
    fontSize: typography.fontSize.xs,
    letterSpacing: 1.5,
    marginBottom: spacing.xs,
  },
  dynamicZoneBar: {
    width: '100%',
    backgroundColor: '#161B26',
    borderColor: colors.hunter.primary,
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    marginVertical: spacing.xs,
  },
  dynamicZoneBarLight: {
    backgroundColor: '#FFFFFF',
    borderColor: colors.hunter.primary,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  dynamicZoneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  dynamicZoneBadge: {
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
    borderColor: colors.hunter.primary,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  dynamicZoneBadgeText: {
    color: colors.hunter.primary,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  dynamicZonePhaseText: {
    color: colors.text.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dynamicZonePhaseTextLight: {
    color: '#64748B',
  },
  dynamicZoneStatusText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  dynamicZoneStatusTextLight: {
    color: '#0F172A',
  },
  floatingRadioBtn: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 8,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  floatingRadioIcon: {
    fontSize: 22,
  },
  radioBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  radioBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  revealTimerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    borderColor: 'rgba(56, 189, 248, 0.4)',
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
  },
  revealTimerBarLight: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
  },
  revealTimerBarUrgent: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#EF4444',
  },
  revealTimerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  revealTimerIcon: {
    fontSize: 20,
  },
  revealTimerTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#38BDF8',
    letterSpacing: 0.6,
  },
  revealTimerTitleLight: {
    color: '#0284C7',
  },
  revealTimerSub: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
    marginTop: 1,
  },
  revealTimerSubLight: {
    color: '#64748B',
  },
  revealTimerBadge: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  revealTimerBadgeUrgent: {
    backgroundColor: '#EF4444',
  },
  revealTimerBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  revealTimerBadgeTextUrgent: {
    color: '#FFFFFF',
  },
});
