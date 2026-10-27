import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { Ionicons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';
import { authService, UserAccount } from '@/services/auth/authService';
import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {});

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    console.error('[RootErrorBoundary] Unhandled error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorStyles.container}>
          <Text style={errorStyles.title}>Something went wrong</Text>
          <Text style={errorStyles.message}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.background.base,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.status.danger,
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
  },
});

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);

  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const [forceReady, setForceReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setForceReady(true);
      setAuthLoaded(true);
      SplashScreen.hideAsync().catch(() => {});
    }, 2500);

    // 1. Initial auth check with safe fallback
    authService.loadSession()
      .then((user) => {
        setCurrentUser(user);
        setAuthLoaded(true);
      })
      .catch(() => {
        setAuthLoaded(true);
      });

    // 2. Auth state change listener
    const unsub = authService.onAuthStateChange((user) => {
      setCurrentUser(user);
      setAuthLoaded(true);
    });

    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, []);

  const isAppReady = (fontsLoaded || forceReady) && (authLoaded || forceReady);

  useEffect(() => {
    if (isAppReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isAppReady]);

  useEffect(() => {
    if (!isAppReady) return;

    const rootSegment = (segments as string[])[0];
    const isAuthRoute = rootSegment === 'auth';

    if (!currentUser && !isAuthRoute) {
      router.replace('/auth' as any);
    } else if (currentUser && isAuthRoute) {
      router.replace('/');
    }
  }, [currentUser, isAppReady, segments]);

  if (!isAppReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background.base }}>
        <ActivityIndicator size="large" color={colors.brand.accent} />
      </View>
    );
  }

  return (
    <RootErrorBoundary>
      <SafeAreaProvider>
        <StatusBar style="dark" backgroundColor={colors.background.base} />
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: colors.background.base,
            },
            headerTintColor: colors.text.primary,
            headerTitleStyle: {
              fontWeight: '700',
            },
            headerShadowVisible: false,
            contentStyle: {
              backgroundColor: colors.background.base,
            },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="auth" options={{ headerShown: false }} />
          <Stack.Screen name="create" options={{ headerShown: false }} />
          <Stack.Screen name="lobby/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="lobby/settings" options={{ headerShown: false }} />
          <Stack.Screen name="friends" options={{ headerShown: false }} />
          <Stack.Screen name="profile/index" options={{ headerShown: false }} />
          <Stack.Screen name="profile/setup" options={{ headerShown: false }} />
          <Stack.Screen name="rules" options={{ headerShown: false }} />
          <Stack.Screen name="settings" options={{ headerShown: false }} />
          <Stack.Screen name="map/editor" options={{ headerShown: false }} />
          <Stack.Screen name="game/hunter" options={{ headerShown: false }} />
          <Stack.Screen name="game/runner" options={{ headerShown: false }} />
          <Stack.Screen name="game/referee" options={{ headerShown: false }} />
          <Stack.Screen name="game/results" options={{ headerShown: false }} />
        </Stack>
      </SafeAreaProvider>
    </RootErrorBoundary>
  );
}
