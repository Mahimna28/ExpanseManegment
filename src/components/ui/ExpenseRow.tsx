import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { paiseToRupees } from '../../engine/currency';
import { colors, spacing, typography } from '../../theme';
import type { Expense } from '../../types/models';

interface ExpenseRowProps {
  expense: Expense;
  payerName: string;
  isCurrentUserPayer: boolean;
  mySharePaise?: number;
  onPress: () => void;
  showDivider?: boolean;
}

export function ExpenseRow({
  expense,
  payerName,
  isCurrentUserPayer,
  mySharePaise,
  onPress,
  showDivider = true,
}: ExpenseRowProps) {
  const isVoided = expense.is_voided;

  // Personal share subtext
  let shareText = '';
  let shareColor = colors.textMuted;

  if (mySharePaise !== undefined && !isVoided) {
    if (isCurrentUserPayer) {
      const lentPaise = expense.total_paise - mySharePaise;
      if (lentPaise > 0) {
        shareText = `You lent ${paiseToRupees(lentPaise)}`;
        shareColor = colors.moneyPositive;
      } else {
        shareText = 'You paid for yourself';
      }
    } else {
      if (mySharePaise > 0) {
        shareText = `Your share: ${paiseToRupees(mySharePaise)}`;
        shareColor = colors.moneyNegative;
      } else {
        shareText = 'Not involved';
      }
    }
  }

  return (
    <TouchableOpacity
      style={[styles.row, isVoided && styles.voidedRow]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.left}>
        <Text style={[styles.title, isVoided && styles.voidedText]} numberOfLines={1}>
          {expense.title}
        </Text>
        <Text style={styles.payerSubtitle} numberOfLines={1}>
          {isCurrentUserPayer ? 'You' : payerName} paid • {expense.expense_date}
        </Text>
      </View>

      <View style={styles.right}>
        <Text style={[styles.amount, isVoided && styles.voidedText]}>
          {paiseToRupees(expense.total_paise)}
        </Text>
        {shareText ? (
          <Text style={[styles.shareText, { color: shareColor }]}>
            {shareText}
          </Text>
        ) : null}
      </View>

      {showDivider && <View style={styles.divider} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    position: 'relative',
    minHeight: 60,
  },
  voidedRow: {
    opacity: 0.45,
  },
  left: {
    flex: 1,
    paddingRight: spacing.md,
    gap: 2,
  },
  title: {
    ...typography.bodySemibold,
    color: colors.text,
  },
  payerSubtitle: {
    ...typography.secondary,
    color: colors.textMuted,
  },
  right: {
    alignItems: 'flex-end',
    gap: 2,
  },
  amount: {
    ...typography.amount,
    color: colors.text,
  },
  shareText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'none',
  },
  voidedText: {
    textDecorationLine: 'line-through',
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
