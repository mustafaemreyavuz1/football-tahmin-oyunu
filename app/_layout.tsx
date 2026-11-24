import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';
import { refreshTenaBallQuestions } from '../src/data/tenaballRepository';

function RootNavigator() {
  const { tokens, onboardingDone, isHydrated } = useTheme();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    refreshTenaBallQuestions().catch(() => {});
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    const inOnboarding = segments[0] === 'onboarding';
    if (!onboardingDone && !inOnboarding) {
      router.replace('/onboarding');
    }
  }, [isHydrated, onboardingDone, segments, router]);

  if (!isHydrated) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: tokens.background,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator size="large" color={tokens.footballGreen} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={tokens.isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: tokens.background },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="games/tenaball" />
        <Stack.Screen name="games/who-are-ya" />
        <Stack.Screen name="games/wordle" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <RootNavigator />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
