import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { paiseToRupees } from '../../engine/currency';
import { colors, radii, spacing, typography } from '../../theme';
import { ArrowRight } from 'lucide-react-native';

interface BalanceBannerProps {
  netPaise: number;
  onPress?: () => void;
  label?: string;
}

export function BalanceBanner({ netPaise, onPress, label }: BalanceBannerProps) {
  const isPositive = netPaise > 0;
  const isNegative = netPaise < 0;

  let bg = colors.moneyNeutralBg;
  let textColor = colors.moneyNeutral;
  let statusText = 'You are all settled up';
  let formattedAmount = '₹0.00';

  if (isPositive) {
    bg = colors.moneyPositiveBg;
    textColor = colors.moneyPositive;
    statusText = label || 'You are owed';
    formattedAmount = `+${paiseToRupees(netPaise)}`;
  } else if (isNegative) {
    bg = colors.moneyNegativeBg;
    textColor = colors.moneyNegative;
    statusText = label || 'You owe';
    formattedAmount = `-${paiseToRupees(Math.abs(netPaise))}`;
  }

  const content = (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <View style={styles.textContainer}>
        <Text style={styles.statusLabel}>{statusText}</Text>
        <Text style={[styles.amountText, { color: textColor }]}>
          {formattedAmount}
        </Text>
      </View>
      {onPress && (
        <View style={styles.actionContainer}>
          <Text style={[styles.actionText, { color: textColor }]}>Balances</Text>
          <ArrowRight size={14} color={textColor} />
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  textContainer: {
    gap: 2,
  },
  statusLabel: {
    ...typography.secondarySemibold,
    color: colors.textMuted,
  },
  amountText: {
    ...typography.display,
    fontSize: 24,
  },
  actionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionText: {
    ...typography.secondarySemibold,
  },
});
