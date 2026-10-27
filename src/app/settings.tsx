import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Screen, SettingRow, TopBar } from '@/components/ui';
import { useLocation } from '@/hooks/useLocation';
import { authService, UserAccount } from '@/services/auth/authService';
import { borderRadius, colors, spacing, typography } from '@/theme/tokens';

export default function SettingsScreen() {
  const router = useRouter();
  const { permissionStatus, currentLocation, refreshLocation } = useLocation();
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    authService.loadSession().then((u) => {
      setUserAccount(u);
    });
  }, []);

  const handleRefreshGPS = async () => {
    setRefreshing(true);
    try {
      await refreshLocation();
    } finally {
      setRefreshing(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await authService.signOut();
          router.replace('/auth' as any);
        },
      },
    ]);
  };

  return (
    <Screen scroll>
      <TopBar title="SYSTEM SETTINGS" onBack={() => router.back()} />

      <View style={styles.container}>
        {/* Account Identity */}
        <Text style={styles.sectionTitle}>AUTHENTICATED OPERATIVE</Text>
        <Card variant="portal" style={styles.card}>
          <SettingRow
            title="Operative Callsign"
            description={`@${userAccount?.displayName || 'Operative'}`}
            icon={<Ionicons name="person-circle-outline" size={24} color={colors.brand.accent} />}
            showChevron
            onPress={() => router.push('/profile/setup' as any)}
          />
          <SettingRow
            title="Google Account"
            description={userAccount?.email || 'Connected'}
            icon={<Ionicons name="logo-google" size={20} color="#EA4335" />}
            borderBottom={false}
          />
        </Card>

        {/* GPS Diagnostics */}
        <Text style={styles.sectionTitle}>GPS & HARDWARE DIAGNOSTICS</Text>
        <Card variant="portal" style={styles.card}>
          <SettingRow
            title="Location Permission"
            description={permissionStatus === 'granted' ? 'High Precision Authorized' : 'Permission Required'}
            icon={<Ionicons name="navigate-circle-outline" size={24} color={permissionStatus === 'granted' ? colors.status.safe : colors.status.warning} />}
            rightElement={
              <View style={[styles.statusBadge, permissionStatus === 'granted' ? styles.statusSafe : styles.statusWarning]}>
                <Text style={styles.statusText}>{permissionStatus.toUpperCase()}</Text>
              </View>
            }
          />
          <SettingRow
            title="Current Coordinates"
            description={
              currentLocation
                ? `${currentLocation.latitude.toFixed(5)}, ${currentLocation.longitude.toFixed(5)}`
                : 'Searching for GPS fix...'
            }
            icon={<Ionicons name="locate-outline" size={22} color={colors.text.secondary} />}
          />
          <SettingRow
            title="Signal Precision"
            description={
              currentLocation?.accuracy
                ? `±${currentLocation.accuracy.toFixed(1)}m radius`
                : 'Calibrating satellites...'
            }
            icon={<Ionicons name="radio-outline" size={22} color={colors.text.secondary} />}
            borderBottom={false}
          />

          <View style={styles.diagBtnContainer}>
            <Button
              title="REFRESH GPS SENSORS"
              variant="secondary"
              size="sm"
              loading={refreshing}
              onPress={handleRefreshGPS}
            />
          </View>
        </Card>

        {/* Privacy Policy Card */}
        <Text style={styles.sectionTitle}>LOCATION PRIVACY DOCTRINE</Text>
        <Card variant="portal" style={styles.card}>
          <View style={styles.privacyContent}>
            <View style={styles.privacyHeader}>
              <Ionicons name="shield-checkmark" size={18} color={colors.status.safe} />
              <Text style={styles.privacyTitle}>Transient Tactical Privacy</Text>
            </View>
            <Text style={styles.privacyText}>
              • Background & foreground GPS polling executes strictly during active matches and terminates automatically when matches finish.
            </Text>
            <Text style={styles.privacyText}>
              • Runner live positions are never broadcast continuously to chasers. Asymmetric radar snapshots only emit at host-specified intervals.
            </Text>
          </View>
        </Card>

        {/* Sign Out Button */}
        <View style={styles.signOutContainer}>
          <Button
            title="SIGN OUT"
            variant="danger"
            size="md"
            fullWidth
            onPress={handleSignOut}
          />
        </View>

        <Text style={styles.versionText}>GPS MANHUNT V1.0.0 • PRODUCTION BUILD</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    letterSpacing: typography.letterSpacing.tactical,
    color: colors.text.muted,
    marginBottom: spacing.xs,
    marginLeft: 4,
  },
  card: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  statusSafe: {
    backgroundColor: '#DCFCE7',
  },
  statusWarning: {
    backgroundColor: '#FEF3C7',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.text.primary,
  },
  diagBtnContainer: {
    padding: spacing.md,
    backgroundColor: colors.background.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.default,
  },
  privacyContent: {
    padding: spacing.md,
  },
  privacyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.xs,
  },
  privacyTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    color: colors.text.primary,
  },
  privacyText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    lineHeight: 18,
    marginVertical: 2,
  },
  signOutContainer: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  versionText: {
    fontSize: 11,
    color: colors.text.muted,
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: spacing.xl,
  },
});
