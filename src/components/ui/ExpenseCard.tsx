import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { paiseToRupees } from '../../engine/currency';
import { CategoryBadge } from './CategoryBadge';
import { colors, radii, spacing, typography, shadows } from '../../theme';
import type { Expense } from '../../types/models';

interface ExpenseCardProps {
  expense: Expense;
  payerName: string;
  isCurrentUserPayer: boolean;
  mySharePaise?: number;
  onPress: () => void;
}

export function ExpenseCard({
  expense,
  payerName,
  isCurrentUserPayer,
  mySharePaise,
  onPress,
}: ExpenseCardProps) {
  const isVoided = expense.is_voided;

  // Compute personal impact
  let shareLabel = '';
  let shareAmount = '';
  let shareColor = colors.textMuted;
  let shareBg = colors.surfaceSubtle;

  if (mySharePaise !== undefined && !isVoided) {
    if (isCurrentUserPayer) {
      const lentPaise = expense.total_paise - mySharePaise;
      if (lentPaise > 0) {
        shareLabel = 'you lent';
        shareAmount = `+${paiseToRupees(lentPaise)}`;
        shareColor = colors.moneyPositive;
        shareBg = colors.moneyPositiveBg;
      } else {
        shareLabel = 'you paid';
        shareAmount = 'for yourself';
        shareColor = colors.textMuted;
        shareBg = colors.surfaceSubtle;
      }
    } else {
      if (mySharePaise > 0) {
        shareLabel = 'your share';
        shareAmount = `-${paiseToRupees(mySharePaise)}`;
        shareColor = colors.moneyNegative;
        shareBg = colors.moneyNegativeBg;
      } else {
        shareLabel = 'not involved';
        shareAmount = '';
        shareColor = colors.textDim;
      }
    }
  }

  return (
    <TouchableOpacity
      style={[styles.card, isVoided && styles.voidedCard]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <CategoryBadge
        expenseTitle={expense.title}
        size={42}
      />

      <View style={styles.middle}>
        <Text style={[styles.title, isVoided && styles.voidedText]} numberOfLines={1}>
          {expense.title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {isCurrentUserPayer ? 'You' : payerName} paid • {expense.expense_date}
        </Text>
      </View>

      <View style={styles.right}>
        <Text style={[styles.totalAmount, isVoided && styles.voidedText]}>
          {paiseToRupees(expense.total_paise)}
        </Text>

        {shareAmount ? (
          <View style={[styles.shareBadge, { backgroundColor: shareBg }]}>
            <Text style={[styles.shareText, { color: shareColor }]}>
              {shareAmount}
            </Text>
          </View>
        ) : shareLabel ? (
          <Text style={styles.notInvolvedText}>{shareLabel}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  voidedCard: {
    opacity: 0.45,
  },
  middle: {
    flex: 1,
    marginLeft: spacing.md,
    gap: 2,
  },
  title: {
    ...typography.bodySemibold,
    fontSize: 15,
    color: colors.text,
  },
  subtitle: {
    ...typography.secondary,
    color: colors.textMuted,
    fontSize: 12,
  },
  right: {
    alignItems: 'flex-end',
    gap: 3,
  },
  totalAmount: {
    ...typography.amount,
    fontSize: 15,
    color: colors.text,
  },
  shareBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  shareText: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '700',
  },
  notInvolvedText: {
    ...typography.caption,
    fontSize: 10,
    color: colors.textDim,
  },
  voidedText: {
    textDecorationLine: 'line-through',
  },
});
