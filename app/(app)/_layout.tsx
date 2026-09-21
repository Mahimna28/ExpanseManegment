import React from 'react';
import { Stack } from 'expo-router';
import { colors } from '../../src/theme';

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="new-group" />
      <Stack.Screen name="join-group" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="group/[groupId]/index" />
      <Stack.Screen name="group/[groupId]/expenses" />
      <Stack.Screen name="group/[groupId]/new-expense" />
      <Stack.Screen name="group/[groupId]/settlements" />
      <Stack.Screen name="group/[groupId]/new-settlement" />
      <Stack.Screen name="group/[groupId]/members" />
      <Stack.Screen name="group/[groupId]/categories" />
      <Stack.Screen name="group/[groupId]/expense/[expenseId]" />
    </Stack>
  );
}
