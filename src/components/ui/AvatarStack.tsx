import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Avatar } from './Avatar';
import { colors, radii } from '../../theme';

interface AvatarStackProps {
  names: string[];
  max?: number;
  size?: number;
}

export function AvatarStack({ names, max = 3, size = 28 }: AvatarStackProps) {
  const visible = names.slice(0, max);
  const remaining = names.length - max;
  const overlap = Math.round(size * 0.3);

  return (
    <View style={styles.container}>
      {visible.map((name, index) => (
        <View
          key={index}
          style={[
            styles.avatarWrapper,
            {
              marginLeft: index === 0 ? 0 : -overlap,
              zIndex: visible.length - index,
            },
          ]}
        >
          <Avatar name={name} size={size} />
        </View>
      ))}

      {remaining > 0 && (
        <View
          style={[
            styles.remainingBadge,
            {
              width: size,
              height: size,
              borderRadius: radii.full,
              marginLeft: -overlap,
              zIndex: 0,
            },
          ]}
        >
          <Text style={[styles.remainingText, { fontSize: Math.max(size * 0.36, 10) }]}>
            +{remaining}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    borderWidth: 2,
    borderColor: colors.surface,
    borderRadius: radii.full,
  },
  remainingBadge: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remainingText: {
    fontWeight: '700',
    color: colors.textMuted,
  },
});
