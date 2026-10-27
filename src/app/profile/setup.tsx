import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Avatar, Button, Card, Screen, TopBar } from '@/components/ui';
import { authService, UserAccount } from '@/services/auth/authService';
import { supabase } from '@/services/supabase';
import { borderRadius, colors, shadows, spacing, typography } from '@/theme/tokens';

export default function ProfileSetupScreen() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [username, setUsername] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isUsernameValid, setIsUsernameValid] = useState<boolean | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const user = authService.getCurrentUser();
    if (user) {
      setCurrentUser(user);
      setUsername(user.displayName !== 'Operative' ? user.displayName : '');
      if (user.avatarUrl) setAvatarUri(user.avatarUrl);
    }
  }, []);

  const handlePickAvatar = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera roll access is required to pick an avatar.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const manipResult = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 300, height: 300 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );

        setAvatarUri(manipResult.uri);

        // Upload to Supabase Storage if user exists
        if (currentUser && manipResult.base64) {
          try {
            const fileName = `${currentUser.id}-${Date.now()}.jpg`;
            const { data, error } = await supabase.storage
              .from('avatars')
              .upload(fileName, decodeBase64(manipResult.base64), {
                contentType: 'image/jpeg',
                upsert: true,
              });

            if (!error && data) {
              const { data: publicUrlData } = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName);
              if (publicUrlData?.publicUrl) {
                setAvatarUri(publicUrlData.publicUrl);
              }
            }
          } catch (uploadErr) {
            console.warn('[ProfileSetup] Storage upload warning:', uploadErr);
          }
        }
      }
    } catch (err) {
      console.warn('[ProfileSetup] Pick avatar error:', err);
    }
  };

  const decodeBase64 = (base64String: string): Uint8Array => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let bufferLength = base64String.length * 0.75;
    if (base64String[base64String.length - 1] === '=') {
      bufferLength--;
      if (base64String[base64String.length - 2] === '=') bufferLength--;
    }
    const bytes = new Uint8Array(bufferLength);
    let p = 0;
    for (let i = 0; i < base64String.length; i += 4) {
      const encoded1 = chars.indexOf(base64String[i]);
      const encoded2 = chars.indexOf(base64String[i + 1]);
      const encoded3 = chars.indexOf(base64String[i + 2]);
      const encoded4 = chars.indexOf(base64String[i + 3]);
      bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
      bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
      bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
    }
    return bytes;
  };

  const handleUsernameChange = async (text: string) => {
    const sanitized = text.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24);
    setUsername(sanitized);
    setErrorMessage(null);

    if (sanitized.length < 3) {
      setIsUsernameValid(null);
      return;
    }

    setIsCheckingUsername(true);
    try {
      const available = await authService.checkUsernameAvailable(sanitized);
      setIsUsernameValid(available);
    } catch {
      setIsUsernameValid(true);
    } finally {
      setIsCheckingUsername(false);
    }
  };

  const handleSave = async () => {
    const clean = username.trim();
    if (clean.length < 3) {
      setErrorMessage('Username must be at least 3 characters.');
      return;
    }

    if (isUsernameValid === false) {
      setErrorMessage('This username is already taken. Please choose another.');
      return;
    }

    setIsSaving(true);
    try {
      await authService.updateProfile({
        displayName: clean,
        avatarUrl: avatarUri || undefined,
      });
      router.replace('/');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update profile.');
      setIsSaving(false);
    }
  };

  return (
    <Screen scroll>
      <TopBar
        title="OPERATIVE PROFILE"
        subtitle="Set up your in-game identity"
        onBack={() => router.back()}
      />

      <View style={styles.container}>
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handlePickAvatar}
            style={styles.avatarWrapper}
          >
            <Avatar uri={avatarUri} name={username || 'Agent'} size="xl" />
            <View style={styles.cameraBadge}>
              <Ionicons name="camera" size={18} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
          <Text style={styles.avatarHint}>Tap to choose photo</Text>
        </View>

        {/* Form Card */}
        <Card variant="portal" style={styles.card}>
          <Text style={styles.fieldLabel}>TACTICAL CALLSIGN (@USERNAME)</Text>
          <View style={styles.inputRow}>
            <Text style={styles.atSign}>@</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Maverick"
              placeholderTextColor={colors.text.muted}
              value={username}
              onChangeText={handleUsernameChange}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={24}
            />
            {isCheckingUsername ? (
              <ActivityIndicator size="small" color={colors.brand.accent} />
            ) : isUsernameValid === true ? (
              <Ionicons name="checkmark-circle" size={22} color={colors.status.safe} />
            ) : isUsernameValid === false ? (
              <Ionicons name="close-circle" size={22} color={colors.status.danger} />
            ) : null}
          </View>
          <Text style={styles.fieldHelp}>
            Visible to teammates, chasers, and on match scoreboards. 3–24 characters.
          </Text>

          {errorMessage && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={colors.status.danger} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Action Button */}
          <View style={styles.buttonContainer}>
            <Button
              title={isSaving ? 'SAVING PROFILE...' : 'SAVE & CONTINUE'}
              variant="gradient"
              size="lg"
              fullWidth
              loading={isSaving}
              disabled={isSaving || username.trim().length < 3}
              onPress={handleSave}
            />
          </View>
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
  },
  avatarSection: {
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  avatarWrapper: {
    position: 'relative',
    ...shadows.md,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brand.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarHint: {
    marginTop: spacing.sm,
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    fontWeight: '600',
  },
  card: {
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
  },
  fieldLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    letterSpacing: typography.letterSpacing.tactical,
    color: colors.text.muted,
    marginBottom: spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border.default,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    height: 52,
    backgroundColor: colors.background.surface,
  },
  atSign: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    color: colors.text.muted,
    marginRight: 4,
  },
  input: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontWeight: '600',
    color: colors.text.primary,
  },
  fieldHelp: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    marginTop: 6,
    marginBottom: spacing.lg,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
    gap: 6,
  },
  errorText: {
    flex: 1,
    fontSize: typography.fontSize.xs,
    color: colors.status.danger,
    fontWeight: '600',
  },
  buttonContainer: {
    marginTop: spacing.sm,
  },
});
