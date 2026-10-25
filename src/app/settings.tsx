import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Badge, Button, Card } from '@/components/ui';
import { useLocation } from '@/hooks/useLocation';
import { guestAuth } from '@/services/auth/guestAuth';
import { borderRadius, colors, spacing, typography } from '@/theme/tokens';

export default function SettingsScreen() {
  const { permissionStatus, currentLocation, refreshLocation } = useLocation();
  const [displayName, setDisplayName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    guestAuth.getGuestProfile().then((p) => {
      setDisplayName(p.displayName);
    });
  }, []);

  const handleSaveProfile = async () => {
    if (!displayName.trim()) return;
    setSavingProfile(true);
    try {
      await guestAuth.updateDisplayName(displayName.trim());
      Alert.alert('SUCCESS', 'Profile codename updated.');
    } catch {
      Alert.alert('ERROR', 'Failed to update codename.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleRefreshGPS = async () => {
    setRefreshing(true);
    try {
      await refreshLocation();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Player Identity */}
      <Text style={styles.sectionTitle}>OPERATOR PROFILE</Text>
      <Card style={styles.card}>
        <Text style={styles.fieldLabel}>CODENAME / DISPLAY NAME</Text>
        <TextInput
          style={styles.textInput}
          value={displayName}
          onChangeText={setDisplayName}
          placeholderTextColor={colors.text.muted}
          maxLength={20}
        />
        <Button
          title="UPDATE CODENAME"
          variant="secondary"
          size="sm"
          onPress={handleSaveProfile}
          loading={savingProfile}
          style={styles.saveProfileBtn}
        />
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>IDENTITY TYPE</Text>
          <Badge label="ANONYMOUS GUEST" variant="neutral" />
        </View>
      </Card>

      {/* GPS & Sensor Diagnostics */}
      <Text style={styles.sectionTitle}>GPS & SENSOR DIAGNOSTICS</Text>
      <Card style={styles.card}>
        <View style={styles.diagnosticRow}>
          <Text style={styles.diagLabel}>Permission Status:</Text>
          <Badge
            label={permissionStatus}
            variant={permissionStatus === 'granted' ? 'safe' : 'warning'}
          />
        </View>

        <View style={styles.diagnosticRow}>
          <Text style={styles.diagLabel}>Coordinates:</Text>
          <Text style={styles.diagVal}>
            {currentLocation
              ? `${currentLocation.latitude.toFixed(5)}, ${currentLocation.longitude.toFixed(5)}`
              : 'Standby / Inactive'}
          </Text>
        </View>

        <View style={styles.diagnosticRow}>
          <Text style={styles.diagLabel}>Signal Accuracy:</Text>
          <Text style={styles.diagVal}>
            {currentLocation?.accuracy
              ? `±${currentLocation.accuracy.toFixed(1)}m`
              : 'N/A'}
          </Text>
        </View>

        <View style={styles.diagnosticRow}>
          <Text style={styles.diagLabel}>Compass Heading:</Text>
          <Text style={styles.diagVal}>
            {currentLocation?.heading !== null && currentLocation?.heading !== undefined
              ? `${currentLocation.heading.toFixed(1)}°`
              : 'Sensor Stationary'}
          </Text>
        </View>

        <Button
          title="DIAGNOSTIC REFRESH"
          variant="secondary"
          size="sm"
          onPress={handleRefreshGPS}
          loading={refreshing}
          style={styles.diagBtn}
        />
      </Card>

      {/* Privacy & Compliance Section */}
      <Text style={styles.sectionTitle}>LOCATION PRIVACY DOCTRINE</Text>
      <Card variant="elevated" style={styles.card}>
        <Text style={styles.privacyHeading}>🔒 Operational Privacy Policy</Text>
        <Text style={styles.privacyBody}>
          1. <Text style={styles.privacyBold}>No Inactive Tracking:</Text> Background and foreground location collection runs ONLY during an active match. Tracking terminates automatically upon match completion or forfeiture.
        </Text>
        <Text style={styles.privacyBody}>
          2. <Text style={styles.privacyBold}>5-Minute Transient Purge:</Text> Movement logs and player coordinates are purged from our database 5 minutes following match termination.
        </Text>
        <Text style={styles.privacyBody}>
          3. <Text style={styles.privacyBold}>Asymmetric Zero-Leak:</Text> Raw runner coordinates are never transmitted across the network to hunters; only authorized periodic snapshots are dispatched.
        </Text>
      </Card>

      <View style={styles.footer}>
        <Text style={styles.footerText}>GPS MANHUNT V1.0.0 (PHASE 1 BUILD)</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.base,
  },
  content: {
    padding: spacing.lg,
  },
  sectionTitle: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.xs,
    letterSpacing: typography.letterSpacing.wide,
    fontWeight: '700',
    marginTop: spacing.md,
    marginBottom: spacing.xs + 2,
  },
  card: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    color: colors.text.muted,
    fontSize: typography.fontSize.xs,
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  textInput: {
    backgroundColor: colors.background.elevated,
    borderColor: colors.border.subtle,
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  saveProfileBtn: {
    marginBottom: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  metaLabel: {
    color: colors.text.muted,
    fontSize: typography.fontSize.xs,
  },
  diagnosticRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  diagLabel: {
    color: colors.text.muted,
    fontSize: typography.fontSize.xs,
  },
  diagVal: {
    color: colors.text.primary,
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
  },
  diagBtn: {
    marginTop: spacing.md,
  },
  privacyHeading: {
    color: colors.status.safe,
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  privacyBody: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.xs,
    lineHeight: 18,
    marginVertical: 4,
  },
  privacyBold: {
    color: colors.text.primary,
    fontWeight: '700',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  footerText: {
    color: colors.text.muted,
    fontSize: 10,
    letterSpacing: 1.5,
  },
});
