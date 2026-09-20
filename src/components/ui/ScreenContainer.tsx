import React from 'react';
import { View, StyleSheet, ViewStyle, SafeAreaView } from 'react-native';
import { colors } from '../../theme';

interface ScreenContainerProps {
  children: React.ReactNode;
  style?: ViewStyle;
  safeArea?: boolean;
}

export function ScreenContainer({ children, style, safeArea = true }: ScreenContainerProps) {
  if (safeArea) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.container, style]}>{children}</View>
      </SafeAreaView>
    );
  }

  return <View style={[styles.container, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
