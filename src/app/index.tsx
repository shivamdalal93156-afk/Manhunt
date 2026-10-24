import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Badge,
  Button,
  Card,
  PermissionPrompt,
} from '@/components/ui';
import { useLocation } from '@/hooks/useLocation';
import { borderRadius, colors, spacing, typography } from '@/theme/tokens';

export default function HomeScreen() {
  const router = useRouter();
  const { permissionStatus, currentLocation, requestPermission } = useLocation();
  const [requestingPerm, setRequestingPerm] = useState(false);

  const handleRequestPermission = async () => {
    setRequestingPerm(true);
    try {
      await requestPermission();
    } finally {
      setRequestingPerm(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Top Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>TACTICAL GPS CHASE</Text>
            <Text style={styles.title}>GPS MANHUNT</Text>
          </View>
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => router.push('/settings')}
            activeOpacity={0.7}
          >
            <Text style={styles.settingsIcon}>⚙</Text>
          </TouchableOpacity>
        </View>

        {/* Player Profile Banner */}
        <Card style={styles.profileCard}>
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>OP</Text>
            </View>
            <View style={styles.profileInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.profileName}>OPERATOR GHOST-94</Text>
                <Badge label="GUEST ID" variant="neutral" />
              </View>
              <Text style={styles.profileSub}>READY FOR DEPLOYMENT</Text>
            </View>
          </View>
          <View style={styles.telemetryDivider} />
          <View style={styles.telemetryRow}>
            <View style={styles.telemetryItem}>
              <Text style={styles.telemetryLabel}>GPS STATUS</Text>
              <Text
                style={[
                  styles.telemetryVal,
                  {
                    color:
                      permissionStatus === 'granted'
                        ? colors.status.safe
                        : colors.status.warning,
                  },
                ]}
              >
                {permissionStatus === 'granted' ? 'ONLINE' : 'NEEDS PERMISSION'}
              </Text>
            </View>
            <View style={styles.telemetryItem}>
              <Text style={styles.telemetryLabel}>ACCURACY</Text>
              <Text style={styles.telemetryVal}>
                {currentLocation?.accuracy
                  ? `±${currentLocation.accuracy.toFixed(1)}m`
                  : 'STANDBY'}
              </Text>
            </View>
          </View>
        </Card>

        {/* Location Permission Prompt (Shown if not yet granted) */}
        {permissionStatus !== 'granted' && (
          <PermissionPrompt
            onGrant={handleRequestPermission}
            loading={requestingPerm}
          />
        )}

        {/* Primary Action Buttons */}
        <View style={styles.actions}>
          <Button
            title="CREATE MATCH"
            variant="hunter"
            size="lg"
            fullWidth
            onPress={() => router.push('/create')}
            style={styles.actionBtn}
          />

          <Button
            title="JOIN WITH CODE"
            variant="runner"
            size="lg"
            fullWidth
            onPress={() => router.push('/join')}
            style={styles.actionBtn}
          />
        </View>

        {/* Game Rules & Intelligence Showcase */}
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => router.push('/rules')}
          activeOpacity={0.7}
        >
          <Text style={styles.sectionTitle}>TACTICAL DOCTRINE</Text>
          <Badge label="RULES & SAFETY ↗" variant="neutral" />
        </TouchableOpacity>

        <Card variant="hunter" style={styles.roleCard}>
          <View style={styles.roleHeader}>
            <Text style={styles.roleTitleHunter}>CHASERS (HUNTERS)</Text>
            <Badge label="RADAR" variant="hunter" />
          </View>
          <Text style={styles.roleDesc}>
            Track runners using periodic satellite radar pings. Close distance to within
            15m to initiate proximity capture before the match timer expires.
          </Text>
        </Card>

        <Card variant="runner" style={styles.roleCard}>
          <View style={styles.roleHeader}>
            <Text style={styles.roleTitleRunner}>EVADERS (RUNNERS)</Text>
            <Badge label="COMPASS" variant="runner" />
          </View>
          <Text style={styles.roleDesc}>
            Hunters are hidden from your map. Use your directional geodesic compass and
            tactical stealth abilities to survive until zero hour.
          </Text>
        </Card>

        <Card variant="referee" style={styles.roleCard}>
          <View style={styles.roleHeader}>
            <Text style={styles.roleTitleReferee}>SUPERVISORS (FAMILY MODE)</Text>
            <Badge label="SAFETY" variant="referee" />
          </View>
          <Text style={styles.roleDesc}>
            Non-combatant referee role to monitor safety, maintain geofenced boundaries,
            and assist young players in outdoor parks.
          </Text>
        </Card>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            GPS MANHUNT V1.0 • PRIVACY ENFORCED • NO TRACKING OUTSIDE MATCHES
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background.base,
  },
  container: {
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  eyebrow: {
    fontSize: typography.fontSize.xs,
    letterSpacing: typography.letterSpacing.wide,
    color: colors.hunter.primary,
    fontWeight: '700',
  },
  title: {
    fontSize: typography.fontSize.xxl,
    fontWeight: '900',
    color: colors.text.primary,
    letterSpacing: typography.letterSpacing.tactical,
  },
  settingsBtn: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.surface,
    borderColor: colors.border.subtle,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: {
    color: colors.text.primary,
    fontSize: 20,
  },
  profileCard: {
    marginBottom: spacing.md,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background.elevated,
    borderColor: colors.hunter.primary,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.hunter.primary,
    fontWeight: '800',
    fontSize: typography.fontSize.sm,
  },
  profileInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileName: {
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
    fontWeight: '800',
    letterSpacing: typography.letterSpacing.tactical,
  },
  profileSub: {
    color: colors.text.muted,
    fontSize: typography.fontSize.xs,
    marginTop: 2,
  },
  telemetryDivider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginVertical: spacing.md,
  },
  telemetryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  telemetryItem: {
    flex: 1,
  },
  telemetryLabel: {
    color: colors.text.muted,
    fontSize: typography.fontSize.xs,
    letterSpacing: typography.letterSpacing.tactical,
  },
  telemetryVal: {
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    marginTop: 2,
    color: colors.text.primary,
  },
  actions: {
    marginVertical: spacing.md,
  },
  actionBtn: {
    marginVertical: spacing.xs + 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.xs,
    letterSpacing: typography.letterSpacing.wide,
    fontWeight: '700',
  },
  roleCard: {
    marginVertical: spacing.xs + 2,
  },
  roleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  roleTitleHunter: {
    color: colors.hunter.primary,
    fontWeight: '800',
    fontSize: typography.fontSize.base,
    letterSpacing: typography.letterSpacing.tactical,
  },
  roleTitleRunner: {
    color: colors.runner.primary,
    fontWeight: '800',
    fontSize: typography.fontSize.base,
    letterSpacing: typography.letterSpacing.tactical,
  },
  roleTitleReferee: {
    color: colors.referee.primary,
    fontWeight: '800',
    fontSize: typography.fontSize.base,
    letterSpacing: typography.letterSpacing.tactical,
  },
  roleDesc: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
    lineHeight: 19,
  },
  footer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  footerText: {
    color: colors.text.muted,
    fontSize: 10,
    letterSpacing: 1.2,
    textAlign: 'center',
  },
});
