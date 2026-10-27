import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { PlayerRole } from '@/types/lobby';
import { borderRadius, colors, spacing, typography } from '@/theme/tokens';
import { ChatMessageBroadcast } from '@/services/game/gameService';

interface TacticalRadioModalProps {
  visible: boolean;
  onClose: () => void;
  myRole: PlayerRole;
  myPlayerId: string;
  myDisplayName: string;
  messages: ChatMessageBroadcast[];
  onSendMessage: (text: string, scope?: 'TEAM' | 'ALL') => void;
}

const HUNTER_QUICK_CALLS = [
  '🎯 Target in sight!',
  '🧭 Pincer maneuver!',
  '🏢 Runner entered building',
  '💨 Closing distance fast!',
  '⚡ Deploying radar ping!',
  '📍 Meet at zone center',
];

const RUNNER_QUICK_CALLS = [
  '⚠️ Chaser right behind me!',
  '🏃 Fleeing to safe cover',
  '👻 Activating Stealth!',
  '🧭 Heading South-East',
  '🛡️ Safe for now, scatter!',
  '⚡ Chasers lost my trail',
];

const GLOBAL_QUICK_CALLS = [
  '👀 You cannot hide for long!',
  '💨 You will never catch me!',
  '⏱️ Time is running out!',
  '⚡ Play zone is shrinking fast!',
  '🎯 Spotted near the edge!',
  '🤝 Well played, gg!',
];

export const TacticalRadioModal: React.FC<TacticalRadioModalProps> = ({
  visible,
  onClose,
  myRole,
  myPlayerId,
  myDisplayName,
  messages,
  onSendMessage,
}) => {
  const [inputText, setInputText] = useState('');
  const [activeScope, setActiveScope] = useState<'TEAM' | 'ALL'>('TEAM');
  const quickCalls =
    activeScope === 'ALL'
      ? GLOBAL_QUICK_CALLS
      : myRole === 'HUNTER'
      ? HUNTER_QUICK_CALLS
      : RUNNER_QUICK_CALLS;
  const roleColor = myRole === 'HUNTER' ? colors.hunter.primary : colors.runner.primary;

  const handleSend = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSendMessage(trimmed, activeScope);
    setInputText('');
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    const s = d.getSeconds().toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.radioIcon}>📻</Text>
              <View>
                <Text style={styles.title}>TACTICAL COMMS</Text>
                <Text style={[styles.subTitle, { color: activeScope === 'ALL' ? '#F45B36' : roleColor }]}>
                  {activeScope === 'ALL'
                    ? '🌐 GLOBAL OPEN FREQUENCY (ALL PLAYERS)'
                    : myRole === 'HUNTER'
                    ? '🎯 CHASER ENCRYPTED SQUAD'
                    : '🛡️ EVADER ENCRYPTED SQUAD'}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Scope Selector Bar */}
          <View style={styles.scopeBarContainer}>
            <TouchableOpacity
              style={[
                styles.scopeBtn,
                activeScope === 'TEAM' && [styles.scopeBtnActive, { borderColor: roleColor }],
              ]}
              onPress={() => setActiveScope('TEAM')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.scopeBtnText,
                  activeScope === 'TEAM' && { color: roleColor, fontWeight: '800' },
                ]}
              >
                {myRole === 'HUNTER' ? '🎯 CHASER ONLY' : '🛡️ RUNNER ONLY'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.scopeBtn,
                activeScope === 'ALL' && [styles.scopeBtnActive, { borderColor: '#F45B36' }],
              ]}
              onPress={() => setActiveScope('ALL')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.scopeBtnText,
                  activeScope === 'ALL' && { color: '#F45B36', fontWeight: '800' },
                ]}
              >
                🌐 ALL OPERATIVES (GLOBAL)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Quick Tactical Callout Buttons */}
          <View style={styles.quickCallsSection}>
            <Text style={styles.quickCallsTitle}>1-TAP TACTICAL CALLOUTS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickCallsRow}>
              {quickCalls.map((call, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.quickCallPill, { borderColor: roleColor }]}
                  onPress={() => handleSend(call)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.quickCallText}>{call}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Message Stream */}
          <ScrollView
            style={styles.messageList}
            contentContainerStyle={styles.messageContent}
            showsVerticalScrollIndicator={false}
          >
            {messages.filter((m) =>
              activeScope === 'ALL'
                ? m.channelScope === 'ALL'
                : !m.channelScope || m.channelScope === 'TEAM'
            ).length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateIcon}>📡</Text>
                <Text style={styles.emptyStateTitle}>FREQUENCY CLEAR</Text>
                <Text style={styles.emptyStateSub}>
                  {activeScope === 'ALL'
                    ? 'No global broadcast transmissions yet. Speak to both runners and chasers.'
                    : 'Send quick callouts or tactical instructions to coordinate with your squad.'}
                </Text>
              </View>
            ) : (
              messages
                .filter((m) =>
                  activeScope === 'ALL'
                    ? m.channelScope === 'ALL'
                    : !m.channelScope || m.channelScope === 'TEAM'
                )
                .map((msg) => {
                  const isSelf = msg.senderId === myPlayerId;
                  const isHunter = msg.role === 'HUNTER';
                  return (
                    <View
                      key={msg.id}
                      style={[
                        styles.msgBubble,
                        isSelf ? styles.msgBubbleSelf : styles.msgBubbleOther,
                        { borderLeftColor: isHunter ? colors.hunter.primary : colors.runner.primary },
                      ]}
                    >
                      <View style={styles.msgHeader}>
                        <Text style={[styles.msgSender, { color: isHunter ? colors.hunter.primary : colors.runner.primary }]}>
                          {isSelf ? 'YOU' : msg.senderName.toUpperCase()}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text
                            style={[
                              styles.scopeBadge,
                              msg.channelScope === 'ALL' ? styles.scopeBadgeGlobal : styles.scopeBadgeTeam,
                            ]}
                          >
                            {msg.channelScope === 'ALL' ? 'GLOBAL' : 'SQUAD'}
                          </Text>
                          <Text style={styles.msgTime}>{formatTime(msg.timestamp)}</Text>
                        </View>
                      </View>
                      <Text style={styles.msgBody}>{msg.text}</Text>
                    </View>
                  );
                })
            )}
          </ScrollView>

          {/* Message Input Box */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="Transmit tactical squad message..."
              placeholderTextColor={colors.text.muted}
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={() => handleSend(inputText)}
              returnKeyType="send"
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                { backgroundColor: roleColor },
                !inputText.trim() && styles.sendBtnDisabled,
              ]}
              disabled={!inputText.trim()}
              onPress={() => handleSend(inputText)}
              activeOpacity={0.8}
            >
              <Text style={styles.sendBtnText}>TRANSMIT</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 10, 0.85)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#0F131A',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    height: '75%',
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  radioIcon: {
    fontSize: 24,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  subTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: colors.text.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  scopeBarContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: borderRadius.md,
    padding: 3,
    gap: 6,
    marginBottom: spacing.xs,
  },
  scopeBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  scopeBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  scopeBtnText: {
    color: colors.text.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  scopeBadge: {
    fontSize: 9,
    fontWeight: '900',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
    letterSpacing: 0.5,
  },
  scopeBadgeTeam: {
    backgroundColor: 'rgba(2, 132, 199, 0.2)',
    color: '#38BDF8',
  },
  scopeBadgeGlobal: {
    backgroundColor: 'rgba(244, 91, 54, 0.2)',
    color: '#FB923C',
  },
  quickCallsSection: {
    marginVertical: spacing.sm,
  },
  quickCallsTitle: {
    color: colors.text.muted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },
  quickCallsRow: {
    gap: 8,
  },
  quickCallPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  quickCallText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  messageList: {
    flex: 1,
    marginVertical: spacing.xs,
  },
  messageContent: {
    paddingVertical: 6,
    gap: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyStateIcon: {
    fontSize: 32,
    opacity: 0.5,
  },
  emptyStateTitle: {
    color: colors.text.muted,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  emptyStateSub: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 11,
    textAlign: 'center',
    maxWidth: 240,
  },
  msgBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderLeftWidth: 3,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  msgBubbleSelf: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
  },
  msgBubbleOther: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
  msgHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  msgSender: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  msgTime: {
    color: colors.text.muted,
    fontSize: 9,
  },
  msgBody: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: spacing.xs,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#070A0F',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: borderRadius.md,
    color: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
  },
  sendBtn: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});
