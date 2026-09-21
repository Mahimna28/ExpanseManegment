import React from 'react';
import { Stack } from 'expo-router';
import { colors } from '../../src/theme';

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '600', fontSize: 17 },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="new-group" options={{ title: 'New Group' }} />
      <Stack.Screen name="join-group" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      <Stack.Screen name="group/[groupId]/index" options={{ headerShown: false }} />
      <Stack.Screen name="group/[groupId]/expenses" options={{ title: 'All Expenses' }} />
      <Stack.Screen name="group/[groupId]/new-expense" options={{ title: 'Add Expense' }} />
      <Stack.Screen name="group/[groupId]/settlements" options={{ title: 'Settlements & Balances' }} />
      <Stack.Screen name="group/[groupId]/new-settlement" options={{ title: 'Record Settlement' }} />
      <Stack.Screen name="group/[groupId]/members" options={{ headerShown: false }} />
      <Stack.Screen name="group/[groupId]/categories" options={{ title: 'Categories' }} />
    </Stack>
  );
}
