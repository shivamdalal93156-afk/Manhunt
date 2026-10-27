import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Avatar, Button, Card, Screen, TopBar } from '@/components/ui';
import { authService, UserAccount } from '@/services/auth/authService';
import { supabase } from '@/services/supabase';
import { FriendItem } from '@/types/progression';
import { borderRadius, colors, shadows, spacing, typography } from '@/theme/tokens';

const FRIENDS_STORAGE_KEY = '@manhunt/user_friends';

export default function FriendsScreen() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [friendCodeInput, setFriendCodeInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadFriendsData();
  }, []);

  const loadFriendsData = async () => {
    try {
      const user = authService.getCurrentUser();
      if (!user) {
        router.replace('/auth' as any);
        return;
      }
      setCurrentUser(user);

      const stored = await AsyncStorage.getItem(`${FRIENDS_STORAGE_KEY}_${user.id}`);
      if (stored) {
        setFriends(JSON.parse(stored));
      } else {
        setFriends([]);
      }
    } catch (err) {
      console.warn('[FriendsScreen] Load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getMyCode = () => {
    if (!currentUser) return '------';
    // Use first 6 chars of user id uppercased
    return currentUser.id.replace(/-/g, '').slice(0, 6).toUpperCase();
  };

  const handleCopyCode = () => {
    Clipboard.setString(getMyCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddFriend = async () => {
    const code = friendCodeInput.trim().toUpperCase();
    if (code.length < 3) {
      Alert.alert('Invalid Code', 'Please enter a valid friend code or callsign.');
      return;
    }

    if (code === getMyCode()) {
      Alert.alert('Invalid Code', 'You cannot add your own operative code.');
      return;
    }

    setIsAdding(true);
    try {
      // Lookup profile in Supabase if matching
      let codename = `Operative_${code.slice(0, 4)}`;
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, display_name')
          .ilike('display_name', code)
          .maybeSingle();
        if (data?.display_name) {
          codename = data.display_name;
        }
      } catch {
        // fallback
      }

      const newFriend: FriendItem = {
        id: `friend_${Date.now()}`,
        codename,
        level: Math.floor(Math.random() * 5) + 1,
        rankTitle: 'Scout',
        isOnline: true,
        statusText: 'Ready',
        matchesPlayed: 1,
        winRate: 100,
      };

      const updated = [newFriend, ...friends];
      setFriends(updated);
      if (currentUser) {
        await AsyncStorage.setItem(
          `${FRIENDS_STORAGE_KEY}_${currentUser.id}`,
          JSON.stringify(updated)
        );
      }
      setFriendCodeInput('');
      Alert.alert('Friend Added', `${codename} has been added to your operative roster.`);
    } catch {
      Alert.alert('Error', 'Unable to add friend at this time.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveFriend = (friendId: string, name: string) => {
    Alert.alert('Remove Friend', `Remove ${name} from your friend roster?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const updated = friends.filter((f) => f.id !== friendId);
          setFriends(updated);
          if (currentUser) {
            await AsyncStorage.setItem(
              `${FRIENDS_STORAGE_KEY}_${currentUser.id}`,
              JSON.stringify(updated)
            );
          }
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <Screen>
        <TopBar title="OPERATIVE ROSTER" onBack={() => router.back()} />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.brand.accent} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <TopBar title="OPERATIVE ROSTER" onBack={() => router.back()} />

      <View style={styles.container}>
        {/* My Friend Code Card */}
        <Card variant="portal" style={styles.myCodeCard}>
          <Text style={styles.cardHeader}>MY OPERATIVE CODE</Text>
          <View style={styles.codeRow}>
            <Text style={styles.codeText}>{getMyCode()}</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleCopyCode}
              style={styles.copyBtn}
            >
              <Ionicons
                name={copied ? 'checkmark' : 'copy-outline'}
                size={18}
                color={copied ? colors.status.safe : colors.text.primary}
              />
              <Text
                style={[
                  styles.copyBtnText,
                  copied && { color: colors.status.safe },
                ]}
              >
                {copied ? 'COPIED' : 'COPY'}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.codeHint}>
            Share this 6-character code with friends so they can add you directly.
          </Text>
        </Card>

        {/* Add Friend Input */}
        <Card variant="portal" style={styles.addCard}>
          <Text style={styles.cardHeader}>ADD OPERATIVE</Text>
          <View style={styles.addInputRow}>
            <TextInput
              style={styles.addInput}
              placeholder="ENTER CODE OR CALLSIGN"
              placeholderTextColor={colors.text.muted}
              value={friendCodeInput}
              onChangeText={setFriendCodeInput}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleAddFriend}
              disabled={isAdding || friendCodeInput.trim().length < 3}
              style={[
                styles.addBtn,
                (isAdding || friendCodeInput.trim().length < 3) && styles.addBtnDisabled,
              ]}
            >
              {isAdding ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.addBtnText}>ADD</Text>
              )}
            </TouchableOpacity>
          </View>
        </Card>

        {/* Friends List */}
        <Text style={styles.sectionTitle}>
          FRIENDS ({friends.length})
        </Text>

        {friends.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color={colors.text.muted} />
            <Text style={styles.emptyTitle}>No Operatives Yet</Text>
            <Text style={styles.emptySubtitle}>
              Share your code above to start building your tactical squad.
            </Text>
          </View>
        ) : (
          friends.map((friend) => (
            <Card key={friend.id} variant="portal" style={styles.friendRow}>
              <Avatar name={friend.codename} size="md" />
              <View style={styles.friendInfo}>
                <View style={styles.friendHeader}>
                  <Text style={styles.friendName}>{friend.codename}</Text>
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor: friend.isOnline
                          ? colors.status.safe
                          : colors.text.muted,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.friendDetails}>
                  LVL {friend.level} • {friend.rankTitle} • {friend.statusText}
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => handleRemoveFriend(friend.id, friend.codename)}
                style={styles.removeBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle-outline" size={22} color={colors.text.muted} />
              </TouchableOpacity>
            </Card>
          ))
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  myCodeCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.md,
  },
  cardHeader: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    letterSpacing: typography.letterSpacing.tactical,
    color: colors.text.muted,
    marginBottom: spacing.xs,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F3F4F6',
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    marginVertical: spacing.xs,
  },
  codeText: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text.primary,
    letterSpacing: typography.letterSpacing.code,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  copyBtnText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: colors.text.primary,
  },
  codeHint: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    marginTop: 4,
  },
  addCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.lg,
  },
  addInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  addInput: {
    flex: 1,
    height: 48,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border.default,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.md,
    fontSize: typography.fontSize.base,
    fontWeight: '700',
    color: colors.text.primary,
  },
  addBtn: {
    height: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.brand.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: {
    opacity: 0.5,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.sm,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    letterSpacing: typography.letterSpacing.tactical,
    color: colors.text.muted,
    marginBottom: spacing.sm,
    marginLeft: 4,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
  },
  friendInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  friendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  friendName: {
    fontSize: typography.fontSize.base,
    fontWeight: '700',
    color: colors.text.primary,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  friendDetails: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    marginTop: 2,
  },
  removeBtn: {
    padding: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: spacing.xl,
  },
});
