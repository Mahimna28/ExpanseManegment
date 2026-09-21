import React from 'react';
import { View, StyleSheet, ViewStyle, Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme';

interface ScreenContainerProps {
  children: React.ReactNode;
  style?: ViewStyle;
  safeArea?: boolean;
}

export function ScreenContainer({ children, style, safeArea = true }: ScreenContainerProps) {
  const insets = useSafeAreaInsets();
  const topInset = safeArea
    ? Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0)
    : 0;
  const bottomInset = safeArea ? insets.bottom : 0;

  return (
    <View
      style={[
        styles.container,
        safeArea && { paddingTop: topInset, paddingBottom: bottomInset },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
