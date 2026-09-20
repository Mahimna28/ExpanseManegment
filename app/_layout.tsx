import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { supabase } from '../src/services/supabase';
import { getCurrentProfile } from '../src/services/auth';
import { useAuthStore } from '../src/stores/auth.store';
import { initLocalDatabase } from '../src/db/schema';
import { startNetworkListener, stopNetworkListener } from '../src/sync/network';
import { triggerSync } from '../src/sync/engine';
import { PinLockModal } from '../src/components/auth/PinLockModal';
import { OfflineBanner } from '../src/components/sync/OfflineBanner';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const {
    isAuthenticated,
    isBootstrapped,
    setUser,
    setBootstrapped,
  } = useAuthStore();

  // 1. App initialization: SQLite DB, network listeners, and session recovery
  useEffect(() => {
    try {
      initLocalDatabase();
    } catch (e) {
      console.error('Failed to init local database:', e);
    }

    startNetworkListener();

    // Check active Supabase session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const profile = await getCurrentProfile();
        setUser(session.user.id, profile);
        triggerSync().catch(console.warn);
      } else {
        setUser(null, null);
      }
      setBootstrapped();
    });

    // Listen to Supabase auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const profile = await getCurrentProfile();
          setUser(session.user.id, profile);
          triggerSync().catch(console.warn);
        } else if (event === 'SIGNED_OUT') {
          setUser(null, null);
        }
      },
    );

    return () => {
      stopNetworkListener();
      subscription.unsubscribe();
    };
  }, []);

  // 2. Navigation guard
  useEffect(() => {
    if (!isBootstrapped) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect unauthenticated users to login
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect authenticated users into the app
      router.replace('/(app)');
    }
  }, [isAuthenticated, isBootstrapped, segments]);

  if (!isBootstrapped) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="auto" />
      <OfflineBanner />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack>
      <PinLockModal />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
