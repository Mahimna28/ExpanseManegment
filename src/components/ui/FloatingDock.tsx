import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, spacing, shadows } from '../../theme';

interface FloatingDockProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function FloatingDock({ children, style }: FloatingDockProps) {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 12) + 8;

  return (
    <View
      style={[styles.outerContainer, { bottom: bottomInset }]}
      pointerEvents="box-none"
    >
      <View style={[styles.dock, shadows.floating, style]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    alignItems: 'center',
    zIndex: 999,
  },
  dock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    padding: spacing.xs + 2,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 500,
    width: '100%',
  },
});
