import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '@/theme/tokens';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor={colors.background.base} />
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
        <Stack.Screen
          name="index"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="create"
          options={{
            title: 'CREATE MATCH',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="join"
          options={{
            title: 'JOIN MATCH',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            title: 'SYSTEM SETTINGS',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="lobby/[id]"
          options={{
            title: 'SQUAD LOBBY',
            headerBackVisible: false,
          }}
        />
        <Stack.Screen
          name="game/hunter"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="game/runner"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="game/referee"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="game/results"
          options={{
            headerShown: false,
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
