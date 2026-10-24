import React, { useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Button, ErrorFallback } from '@/components/ui';
import { useLobbyStore } from '@/store/lobbyStore';
import { PlayerRole } from '@/types/lobby';
import { borderRadius, colors, spacing, typography } from '@/theme/tokens';

export default function JoinMatchScreen() {
  const router = useRouter();
  const { joinMatch, isLoading, error, clearError } = useLobbyStore();
  const [joinCode, setJoinCode] = useState('');
  const [selectedRole, setSelectedRole] = useState<PlayerRole>('RUNNER');

  const handleJoin = async () => {
    if (joinCode.trim().length < 4) return;
    try {
      const session = await joinMatch(joinCode, selectedRole);
      router.push(`/lobby/${session.gameId}`);
    } catch (err: unknown) {
      Alert.alert(
        'JOIN MATCH FAILED',
        err instanceof Error ? err.message : 'Invalid code or lobby is full'
      );
    }
  };

  return (
    <View style={styles.container}>
      {error && (
        <ErrorFallback
          error={error}
          onRetry={clearError}
          title="ENTRY DENIED"
        />
      )}

      <Text style={styles.inputLabel}>ENTER 6-CHARACTER GAME CODE</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. HX89K2"
        placeholderTextColor={colors.text.muted}
        value={joinCode}
        onChangeText={(text) => setJoinCode(text.toUpperCase())}
        maxLength={6}
        autoCapitalize="characters"
        autoCorrect={false}
      />

      <Text style={styles.inputLabel}>SELECT PREFERRED SQUAD</Text>
      <View style={styles.roleSelector}>
        <TouchableOpacity
          style={[
            styles.roleOption,
            selectedRole === 'RUNNER' && styles.roleOptionRunnerActive,
          ]}
          onPress={() => setSelectedRole('RUNNER')}
        >
          <Text
            style={[
              styles.roleOptionText,
              selectedRole === 'RUNNER' && styles.roleOptionRunnerText,
            ]}
          >
            RUNNER (EVADER)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.roleOption,
            selectedRole === 'HUNTER' && styles.roleOptionHunterActive,
          ]}
          onPress={() => setSelectedRole('HUNTER')}
        >
          <Text
            style={[
              styles.roleOptionText,
              selectedRole === 'HUNTER' && styles.roleOptionHunterText,
            ]}
          >
            HUNTER (CHASER)
          </Text>
        </TouchableOpacity>
      </View>

      <Button
        title={isLoading ? 'VERIFYING CODE...' : 'JOIN SQUAD LOBBY'}
        variant={selectedRole === 'HUNTER' ? 'hunter' : 'runner'}
        size="lg"
        fullWidth
        disabled={joinCode.trim().length < 4 || isLoading}
        loading={isLoading}
        onPress={handleJoin}
        style={styles.joinBtn}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.base,
    padding: spacing.lg,
  },
  devBanner: {
    marginBottom: spacing.lg,
    borderColor: colors.status.warning,
  },
  devHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  devTag: {
    color: colors.status.warning,
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    letterSpacing: typography.letterSpacing.tactical,
  },
  devText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.xs,
    lineHeight: 18,
  },
  inputLabel: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.xs,
    letterSpacing: typography.letterSpacing.wide,
    fontWeight: '700',
    marginTop: spacing.md,
    marginBottom: spacing.xs + 2,
  },
  input: {
    backgroundColor: colors.background.surface,
    borderColor: colors.border.active,
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    color: colors.text.primary,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 4,
    textAlign: 'center',
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  roleSelector: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  roleOption: {
    flex: 1,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.surface,
    borderColor: colors.border.subtle,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  roleOptionRunnerActive: {
    backgroundColor: 'rgba(255, 158, 0, 0.15)',
    borderColor: colors.runner.primary,
  },
  roleOptionHunterActive: {
    backgroundColor: 'rgba(0, 240, 255, 0.15)',
    borderColor: colors.hunter.primary,
  },
  roleOptionText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    letterSpacing: 1,
  },
  roleOptionRunnerText: {
    color: colors.runner.primary,
  },
  roleOptionHunterText: {
    color: colors.hunter.primary,
  },
  joinBtn: {
    marginTop: spacing.md,
  },
});
