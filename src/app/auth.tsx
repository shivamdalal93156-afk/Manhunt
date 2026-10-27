import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, Screen } from '@/components/ui';
import { authService } from '@/services/auth/authService';
import { borderRadius, colors, shadows, spacing, typography } from '@/theme/tokens';

export default function AuthScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const user = await authService.signInWithGoogle();
      // If user has default display name, route them to profile setup, otherwise home
      if (user.displayName === 'Operative' || !user.displayName) {
        router.replace('/profile/setup' as any);
      } else {
        router.replace('/');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google Sign-In failed.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Screen style={styles.screen}>
      <View style={styles.container}>
        {/* Brand Header */}
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Ionicons name="navigate" size={36} color="#FFFFFF" />
          </View>
          <Text style={styles.brandTitle}>GPS MANHUNT</Text>
          <Text style={styles.brandSubtitle}>
            Real-world tactical GPS pursuit & evasion
          </Text>
        </View>

        {/* Auth Action Card */}
        <Card variant="portal" style={styles.authCard}>
          <Text style={styles.cardHeader}>AUTHENTICATION</Text>
          <Text style={styles.cardDescription}>
            Sign in with your Google account to sync your operative statistics, join live lobbies, and manage friends.
          </Text>

          {errorMessage && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color={colors.status.danger} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Official Google Sign-In Button */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleGoogleSignIn}
            disabled={isLoading}
            style={styles.googleButton}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.brand.accent} />
            ) : (
              <View style={styles.googleContent}>
                <Ionicons name="logo-google" size={20} color="#EA4335" style={styles.googleIcon} />
                <Text style={styles.googleText}>Continue with Google</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.securityRow}>
            <Ionicons name="shield-checkmark" size={14} color={colors.status.safe} />
            <Text style={styles.securityText}>Verified Google OAuth • Encrypted Sync</Text>
          </View>
        </Card>

        {/* Bottom Safety & Disclaimer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Always remain aware of your physical surroundings, observe pedestrian rules, and stay within designated safe play zones.
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background.base,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'space-between',
    paddingVertical: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.brand.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    ...shadows.md,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text.primary,
    letterSpacing: typography.letterSpacing.tactical,
  },
  brandSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 6,
    textAlign: 'center',
  },
  authCard: {
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
  },
  cardHeader: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    letterSpacing: typography.letterSpacing.tactical,
    color: colors.text.muted,
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: borderRadius.md,
    padding: spacing.sm + 2,
    marginBottom: spacing.md,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: typography.fontSize.xs,
    color: colors.status.danger,
    fontWeight: '600',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: borderRadius.lg,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: colors.border.default,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  googleContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  googleIcon: {
    marginRight: 10,
  },
  googleText: {
    fontSize: typography.fontSize.base,
    fontWeight: '700',
    color: colors.text.primary,
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.xs,
  },
  securityText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
  },
  footerText: {
    fontSize: 11,
    color: colors.text.muted,
    textAlign: 'center',
    lineHeight: 16,
  },
});
