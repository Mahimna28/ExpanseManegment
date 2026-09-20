import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { typography, spacing } from '../../theme';

interface SectionHeaderProps {
  title: string;
  count?: number;
  actionText?: string;
  onAction?: () => void;
}

export function SectionHeader({ title, count, actionText, onAction }: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {title}
        {count !== undefined ? ` (${count})` : ''}
      </Text>
      {actionText && onAction ? (
        <TouchableOpacity onPress={onAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.actionText}>{actionText}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: {
    ...typography.caption,
  },
  actionText: {
    ...typography.secondarySemibold,
    color: '#2563EB',
  },
});
