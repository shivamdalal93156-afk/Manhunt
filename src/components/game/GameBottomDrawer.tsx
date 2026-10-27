import React, { useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CustomAlertModal, GradientView } from '@/components/ui';
import { AbilityPanel } from '@/components/game/AbilityPanel';
import { AbilityType, ActiveEffect, RunnerSnapshot } from '@/types/game';
import { ChatMessageBroadcast } from '@/services/game/gameService';
import { colors } from '@/theme/tokens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export type DrawerTab = 'PLAYERS' | 'HACKS' | 'CHAT' | 'ARREST';

export interface DrawerPlayerItem {
  id: string;
  name: string;
  initials: string;
  avatarColor: string;
  distanceMeters?: number;
  statusText?: string;
  isSelf?: boolean;
}

interface GameBottomDrawerProps {
  role: 'HUNTER' | 'RUNNER';
  players: DrawerPlayerItem[];
  playersSectionTitle?: string;
  activeEffects?: ActiveEffect[];
  onActivateAbility?: (ability: AbilityType) => void;
  chatMessages?: ChatMessageBroadcast[];
  onSendChatMessage?: (text: string, scope?: 'TEAM' | 'ALL') => void;
  onFocusPlayer?: (player: DrawerPlayerItem) => void;
  // Arrest / Catch verification
  catchCode?: string; // For runner: their code
  onSubmitCatchCode?: (code: string) => Promise<void>; // For hunter: verify
  isCollapsed?: boolean;
  onCollapseChange?: (collapsed: boolean) => void;
}

export const GameBottomDrawer: React.FC<GameBottomDrawerProps> = ({
  role,
  players,
  playersSectionTitle = role === 'HUNTER' ? 'Targets (Runners)' : 'Hunters',
  activeEffects = [],
  onActivateAbility,
  chatMessages = [],
  onSendChatMessage,
  onFocusPlayer,
  catchCode,
  onSubmitCatchCode,
  isCollapsed: controlledCollapsed,
  onCollapseChange,
}) => {
  const [activeTab, setActiveTab] = useState<DrawerTab>('PLAYERS');
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;

  const setCollapsed = (val: boolean) => {
    setInternalCollapsed(val);
    onCollapseChange?.(val);
  };

  const [typedMessage, setTypedMessage] = useState('');
  const [chatScope, setChatScope] = useState<'TEAM' | 'ALL'>('TEAM');
  const [enteredPin, setEnteredPin] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message?: string;
  }>({
    visible: false,
    title: '',
  });

  // Swipe gesture: swipe down to lower/collapse, swipe up to expand
  const handlePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return Math.abs(gestureState.dy) > 8;
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > 15) {
            setCollapsed(true);
          } else if (gestureState.dy < -15) {
            setCollapsed(false);
          }
        },
      }),
    [isCollapsed, controlledCollapsed]
  );

  const handleSendChat = () => {
    if (!typedMessage.trim() || !onSendChatMessage) return;
    onSendChatMessage(typedMessage.trim(), chatScope);
    setTypedMessage('');
  };

  const handleVerifyPin = async () => {
    if (enteredPin.length !== 4) {
      setAlertConfig({
        visible: true,
        title: 'INVALID CODE',
        message: 'Please enter a 4-digit catch verification code.',
      });
      return;
    }
    if (!onSubmitCatchCode) return;
    setIsVerifying(true);
    try {
      await onSubmitCatchCode(enteredPin);
      setEnteredPin('');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleTabPress = (tab: DrawerTab) => {
    setActiveTab(tab);
    if (isCollapsed) {
      setCollapsed(false);
    }
  };

  return (
    <View style={[styles.sheetContainer, isCollapsed && styles.sheetContainerCollapsed]}>
      {/* Centered Grab Handle & Expand/Collapse Arrow Button (Swipe down to lower, swipe up to expand) */}
      <View {...handlePanResponder.panHandlers} style={styles.handleContainer}>
        <TouchableOpacity
          onPress={() => setCollapsed(!isCollapsed)}
          activeOpacity={0.7}
          style={styles.handleTouchable}
        >
          <View style={styles.handleBar} />
          <View style={styles.collapseArrowBadge}>
            <Text style={styles.collapseArrowText}>
              {isCollapsed ? '▲ EXPAND MISSION CONTROL' : '▼ LOWER / FULL MAP'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* 4 Segmented Tabs matching screenshot_1_ui.webp and screenshot_3_ui.webp */}
      <View style={styles.tabBar}>
        {/* Tab 1: Players */}
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'PLAYERS' && styles.tabBtnActive]}
          onPress={() => handleTabPress('PLAYERS')}
          activeOpacity={0.8}
        >
          {activeTab === 'PLAYERS' ? (
            <GradientView
              borderRadius={12}
              colors={['#DE3B7E', '#F45B36']}
              style={styles.tabActiveGradient}
            >
              <Text style={styles.tabIconActive}>👥</Text>
              <Text style={styles.tabLabelActive}>Players</Text>
            </GradientView>
          ) : (
            <View style={styles.tabInactiveInner}>
              <Text style={styles.tabIconInactive}>👥</Text>
              <Text style={styles.tabLabelInactive}>Players</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Tab 2: Hacks */}
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'HACKS' && styles.tabBtnActive]}
          onPress={() => handleTabPress('HACKS')}
          activeOpacity={0.8}
        >
          {activeTab === 'HACKS' ? (
            <GradientView
              borderRadius={12}
              colors={['#DE3B7E', '#F45B36']}
              style={styles.tabActiveGradient}
            >
              <Text style={styles.tabIconActive}>⚡</Text>
              <Text style={styles.tabLabelActive}>Hacks</Text>
            </GradientView>
          ) : (
            <View style={styles.tabInactiveInner}>
              <Text style={styles.tabIconInactive}>⚡</Text>
              <Text style={styles.tabLabelInactive}>Hacks</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Tab 3: Chat */}
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'CHAT' && styles.tabBtnActive]}
          onPress={() => handleTabPress('CHAT')}
          activeOpacity={0.8}
        >
          {activeTab === 'CHAT' ? (
            <GradientView
              borderRadius={12}
              colors={['#DE3B7E', '#F45B36']}
              style={styles.tabActiveGradient}
            >
              <Text style={styles.tabIconActive}>💬</Text>
              <Text style={styles.tabLabelActive}>Chat</Text>
            </GradientView>
          ) : (
            <View style={styles.tabInactiveInner}>
              <Text style={styles.tabIconInactive}>💬</Text>
              <Text style={styles.tabLabelInactive}>Chat</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Tab 4: Arrest */}
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'ARREST' && styles.tabBtnActive]}
          onPress={() => handleTabPress('ARREST')}
          activeOpacity={0.8}
        >
          {activeTab === 'ARREST' ? (
            <GradientView
              borderRadius={12}
              colors={['#DE3B7E', '#F45B36']}
              style={styles.tabActiveGradient}
            >
              <Text style={styles.tabIconActive}>🔒</Text>
              <Text style={styles.tabLabelActive}>Arrest</Text>
            </GradientView>
          ) : (
            <View style={styles.tabInactiveInner}>
              <Text style={styles.tabIconInactive}>🔒</Text>
              <Text style={styles.tabLabelInactive}>Arrest</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Tab Content - Collapsible */}
      {!isCollapsed && (
        <View style={styles.contentArea}>
        {/* TAB 1: PLAYERS */}
        {activeTab === 'PLAYERS' && (
          <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollList}>
            <Text style={styles.sectionHeaderTitle}>{playersSectionTitle}</Text>
            {players.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No active operatives detected nearby</Text>
              </View>
            ) : (
              players.map((item) => (
                <View key={item.id} style={styles.playerCard}>
                  <View
                    style={[
                      styles.playerAvatar,
                      { backgroundColor: item.avatarColor || '#DE3B7E' },
                    ]}
                  >
                    <Text style={styles.playerAvatarText}>{item.initials}</Text>
                  </View>

                  <View style={styles.playerInfoCol}>
                    <Text style={styles.playerCardName}>{item.name}</Text>
                    <Text style={styles.playerCardSub}>
                      {item.distanceMeters !== undefined
                        ? `${item.distanceMeters}m Away`
                        : 'Tracking'}{' '}
                      • {item.statusText || 'Live Location'}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.focusTargetBtn}
                    onPress={() => onFocusPlayer?.(item)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.focusTargetIcon}>🎯</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>
        )}

        {/* TAB 2: HACKS / ABILITIES */}
        {activeTab === 'HACKS' && (
          <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollList}>
            <Text style={styles.sectionHeaderTitle}>Tactical Abilities</Text>
            {onActivateAbility && (
              <AbilityPanel
                role={role}
                activeEffects={activeEffects}
                onActivate={onActivateAbility}
              />
            )}
          </ScrollView>
        )}

        {/* TAB 3: CHAT */}
        {activeTab === 'CHAT' && (
          <View style={styles.chatWrapper}>
            <View style={styles.chatHeaderRow}>
              <Text style={styles.sectionHeaderTitle}>Radio Comms</Text>
              {/* Channel Scope Selector */}
              <View style={styles.channelScopeToggleRow}>
                <TouchableOpacity
                  style={[
                    styles.channelScopeBtn,
                    chatScope === 'TEAM' && styles.channelScopeBtnActive,
                  ]}
                  onPress={() => setChatScope('TEAM')}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.channelScopeText,
                      chatScope === 'TEAM' && styles.channelScopeTextActive,
                    ]}
                  >
                    {role === 'HUNTER' ? '🎯 CHASER ONLY' : '🛡️ RUNNER ONLY'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.channelScopeBtn,
                    chatScope === 'ALL' && styles.channelScopeBtnActive,
                  ]}
                  onPress={() => setChatScope('ALL')}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.channelScopeText,
                      chatScope === 'ALL' && styles.channelScopeTextActive,
                    ]}
                  >
                    🌐 ALL PLAYERS
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={styles.chatScroll} showsVerticalScrollIndicator={false}>
              {chatMessages.filter((m) =>
                chatScope === 'ALL'
                  ? m.channelScope === 'ALL'
                  : !m.channelScope || m.channelScope === 'TEAM'
              ).length === 0 ? (
                <Text style={styles.emptyText}>
                  {chatScope === 'ALL'
                    ? 'No global transmissions yet. Visible to both Chasers and Evaders.'
                    : 'No squad radio chatter. Encrypted for your team only.'}
                </Text>
              ) : (
                chatMessages
                  .filter((m) =>
                    chatScope === 'ALL'
                      ? m.channelScope === 'ALL'
                      : !m.channelScope || m.channelScope === 'TEAM'
                  )
                  .map((msg) => (
                    <View key={msg.id} style={styles.chatBubble}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={styles.chatSender}>
                          {msg.senderName} ({msg.role})
                        </Text>
                        <Text
                          style={[
                            styles.channelBadge,
                            msg.channelScope === 'ALL'
                              ? styles.channelBadgeGlobal
                              : styles.channelBadgeTeam,
                          ]}
                        >
                          {msg.channelScope === 'ALL' ? 'GLOBAL' : 'SQUAD'}
                        </Text>
                      </View>
                      <Text style={styles.chatBody}>{msg.text}</Text>
                    </View>
                  ))
              )}
            </ScrollView>

            <View style={styles.chatInputRow}>
              <TextInput
                style={styles.chatInput}
                placeholder={
                  chatScope === 'ALL'
                    ? 'Broadcast to ALL players (mid-game)...'
                    : role === 'HUNTER'
                    ? 'Chaser squad comms only...'
                    : 'Runner team comms only...'
                }
                placeholderTextColor="#9CA3AF"
                value={typedMessage}
                onChangeText={setTypedMessage}
              />
              <TouchableOpacity
                style={styles.chatSendBtn}
                onPress={handleSendChat}
                activeOpacity={0.8}
              >
                <GradientView
                  borderRadius={10}
                  colors={['#DE3B7E', '#F45B36']}
                  style={styles.chatSendGradient}
                >
                  <Text style={styles.chatSendText}>Send</Text>
                </GradientView>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* TAB 4: ARREST / VERIFY */}
        {activeTab === 'ARREST' && (
          <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollList}>
            <Text style={styles.sectionHeaderTitle}>
              {role === 'HUNTER' ? 'Arrest Runner' : 'My Catch Code'}
            </Text>

            {role === 'HUNTER' ? (
              <View style={styles.arrestCard}>
                <Text style={styles.arrestPrompt}>
                  When you tag a runner within 15 meters, ask them for their 4-digit catch PIN to confirm arrest:
                </Text>
                <TextInput
                  style={styles.pinInput}
                  placeholder="0000"
                  placeholderTextColor="#9CA3AF"
                  value={enteredPin}
                  onChangeText={(t) => setEnteredPin(t.replace(/[^0-9]/g, '').slice(0, 4))}
                  keyboardType="numeric"
                  maxLength={4}
                />
                <TouchableOpacity
                  style={styles.confirmArrestBtn}
                  onPress={handleVerifyPin}
                  disabled={isVerifying}
                  activeOpacity={0.8}
                >
                  <GradientView
                    borderRadius={14}
                    colors={['#DE3B7E', '#F45B36']}
                    style={styles.confirmArrestGradient}
                  >
                    <Text style={styles.confirmArrestText}>
                      {isVerifying ? 'VERIFYING...' : 'CONFIRM ARREST'}
                    </Text>
                  </GradientView>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.arrestCard}>
                <Text style={styles.arrestPrompt}>
                  If a hunter tags you within 15 meters, give them this 4-digit PIN:
                </Text>
                <View style={styles.codeDisplayBox}>
                  <Text style={styles.codeDisplayText}>{catchCode || '8492'}</Text>
                </View>
                <Text style={styles.codeDesc}>
                  Once entered by the hunter, 1 Heart will be subtracted.
                </Text>
              </View>
            )}
          </ScrollView>
        )}
      </View>
      )}

      {/* In-App Rounded Alert Modal */}
      <CustomAlertModal
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        onClose={() => setAlertConfig((prev) => ({ ...prev, visible: false }))}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
    maxHeight: 340,
  },
  sheetContainerCollapsed: {
    paddingBottom: 10,
    maxHeight: 120,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 2,
  },
  handleTouchable: {
    alignItems: 'center',
    gap: 3,
    paddingVertical: 2,
    paddingHorizontal: 20,
  },
  handleBar: {
    width: 36,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
  },
  collapseArrowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  collapseArrowText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 0.5,
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 12,
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  tabBtnActive: {
    backgroundColor: 'transparent',
  },
  tabActiveGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  tabInactiveInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  tabIconActive: {
    fontSize: 14,
  },
  tabLabelActive: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tabIconInactive: {
    fontSize: 14,
  },
  tabLabelInactive: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  contentArea: {
    minHeight: 180,
  },
  scrollList: {
    maxHeight: 230,
  },
  sectionHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  playerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  playerAvatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  playerInfoCol: {
    flex: 1,
  },
  playerCardName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  playerCardSub: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 2,
  },
  focusTargetBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusTargetIcon: {
    fontSize: 16,
  },
  emptyCard: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '500',
  },
  chatWrapper: {
    flex: 1,
  },
  chatHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  channelScopeToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 2,
    gap: 4,
  },
  channelScopeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  channelScopeBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  channelScopeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 0.3,
  },
  channelScopeTextActive: {
    color: '#DE3B7E',
  },
  channelBadge: {
    fontSize: 9,
    fontWeight: '900',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
    letterSpacing: 0.5,
  },
  channelBadgeTeam: {
    backgroundColor: 'rgba(2, 132, 199, 0.12)',
    color: '#0284C7',
  },
  channelBadgeGlobal: {
    backgroundColor: 'rgba(244, 91, 54, 0.12)',
    color: '#F45B36',
  },
  chatScroll: {
    maxHeight: 140,
    marginBottom: 8,
  },
  chatBubble: {
    backgroundColor: '#F8F9FA',
    padding: 8,
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chatSender: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F45B36',
  },
  chatBody: {
    fontSize: 13,
    color: '#1C1C1E',
    marginTop: 2,
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chatInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#1C1C1E',
  },
  chatSendBtn: {
    height: 40,
    borderRadius: 10,
  },
  chatSendGradient: {
    paddingHorizontal: 14,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatSendText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  arrestCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  arrestPrompt: {
    fontSize: 13,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 18,
  },
  pinInput: {
    width: 140,
    height: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#DE3B7E',
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 6,
    color: '#1C1C1E',
    marginBottom: 12,
  },
  confirmArrestBtn: {
    width: '100%',
  },
  confirmArrestGradient: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmArrestText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  codeDisplayBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: '#22C55E',
    marginBottom: 8,
  },
  codeDisplayText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#1C1C1E',
    letterSpacing: 8,
  },
  codeDesc: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
});
