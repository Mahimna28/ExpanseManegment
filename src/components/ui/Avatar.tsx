import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const AVATAR_COLORS = [
  { bg: '#DBEAFE', text: '#1D4ED8' }, // Blue
  { bg: '#D1FAE5', text: '#047857' }, // Emerald
  { bg: '#FEE2E2', text: '#B91C1C' }, // Rose
  { bg: '#FEF3C7', text: '#B45309' }, // Amber
  { bg: '#EDE9FE', text: '#6D28D9' }, // Purple
  { bg: '#FCE7F3', text: '#BE185D' }, // Pink
  { bg: '#E0E7FF', text: '#4338CA' }, // Indigo
  { bg: '#CCFBF1', text: '#0F766E' }, // Teal
];

function getDeterministicColor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface AvatarProps {
  name: string;
  size?: number;
}

export function Avatar({ name, size = 36 }: AvatarProps) {
  const color = getDeterministicColor(name || 'User');
  const initials = getInitials(name);
  const fontSize = Math.round(size * 0.4);

  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color.bg,
        },
      ]}
    >
      <Text style={[styles.text, { fontSize, color: color.text }]}>
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
