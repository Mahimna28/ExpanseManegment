import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing, typography } from '../../theme';
import { ChevronRight } from 'lucide-react-native';

interface ListRowProps {
  title: string;
  subtitle?: string;
  leftAccessory?: React.ReactNode;
  rightValue?: string;
  rightValueColor?: string;
  rightSubtitle?: string;
  onPress?: () => void;
  showChevron?: boolean;
  showDivider?: boolean;
  style?: ViewStyle;
}

export function ListRow({
  title,
  subtitle,
  leftAccessory,
  rightValue,
  rightValueColor,
  rightSubtitle,
  onPress,
  showChevron = true,
  showDivider = true,
  style,
}: ListRowProps) {
  const content = (
    <View style={[styles.row, style]}>
      {leftAccessory && <View style={styles.leftAccessory}>{leftAccessory}</View>}

      <View style={styles.middle}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {(rightValue || rightSubtitle || showChevron) && (
        <View style={styles.right}>
          {rightValue ? (
            <Text
              style={[
                styles.rightValue,
                rightValueColor ? { color: rightValueColor } : undefined,
              ]}
            >
              {rightValue}
            </Text>
          ) : null}
          {rightSubtitle ? (
            <Text style={styles.rightSubtitle}>{rightSubtitle}</Text>
          ) : null}
          {showChevron && <ChevronRight size={18} color={colors.textDim} />}
        </View>
      )}

      {showDivider && <View style={styles.divider} />}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    position: 'relative',
    minHeight: 64,
  },
  leftAccessory: {
    marginRight: spacing.md,
  },
  middle: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.bodySemibold,
    color: colors.text,
  },
  subtitle: {
    ...typography.secondary,
  },
  right: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  rightValue: {
    ...typography.amount,
    color: colors.text,
  },
  rightSubtitle: {
    ...typography.caption,
    fontSize: 10,
    marginTop: 2,
  },
  divider: {
    position: 'absolute',
    bottom: 0,
    left: spacing.lg,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
});
