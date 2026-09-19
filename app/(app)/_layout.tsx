import React from 'react';
import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0F172A' },
        headerTintColor: '#F8FAFC',
        headerTitleStyle: { fontWeight: '600', fontSize: 17 },
        contentStyle: { backgroundColor: '#0F172A' },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="new-group" options={{ title: 'New Group' }} />
      <Stack.Screen name="join-group" options={{ title: 'Join Group' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      <Stack.Screen name="group/[groupId]/index" options={{ headerShown: false }} />
      <Stack.Screen name="group/[groupId]/expenses" options={{ title: 'All Expenses' }} />
      <Stack.Screen name="group/[groupId]/new-expense" options={{ title: 'Add Expense' }} />
      <Stack.Screen name="group/[groupId]/settlements" options={{ title: 'Settlements & Balances' }} />
      <Stack.Screen name="group/[groupId]/new-settlement" options={{ title: 'Record Settlement' }} />
      <Stack.Screen name="group/[groupId]/members" options={{ title: 'Group Members' }} />
      <Stack.Screen name="group/[groupId]/categories" options={{ title: 'Categories' }} />
    </Stack>
  );
}
