import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { paiseToRupees } from '../../engine/currency';
import { Avatar } from './Avatar';
import { colors, radii, spacing, typography, shadows } from '../../theme';
import { ArrowRight } from 'lucide-react-native';

interface DebtFlowCardProps {
  fromName: string;
  toName: string;
  amountPaise: number;
  isMeFrom: boolean;
  isMeTo: boolean;
  onSettle?: () => void;
}

export function DebtFlowCard({
  fromName,
  toName,
  amountPaise,
  isMeFrom,
  isMeTo,
  onSettle,
}: DebtFlowCardProps) {
  const isMeInvolved = isMeFrom || isMeTo;

  let highlightBorder = colors.border;
  let bg = colors.surface;

  if (isMeTo) {
    // You are getting paid (positive)
    highlightBorder = colors.moneyPositiveBorder;
  } else if (isMeFrom) {
    // You need to pay (negative)
    highlightBorder = colors.moneyNegativeBorder;
  }

  return (
    <View style={[styles.card, { borderColor: highlightBorder }, shadows.card]}>
      <View style={styles.partiesRow}>
        {/* Debtor */}
        <View style={styles.partyCol}>
          <Avatar name={fromName} size={36} />
          <Text style={styles.partyName} numberOfLines={1}>
            {isMeFrom ? 'You' : fromName}
          </Text>
        </View>

        {/* Transfer Arrow & Amount */}
        <View style={styles.arrowCol}>
          <Text style={styles.amountText}>{paiseToRupees(amountPaise)}</Text>
          <View style={styles.arrowLine}>
            <View style={styles.lineSegment} />
            <ArrowRight size={16} color={colors.primary} />
          </View>
        </View>

        {/* Creditor */}
        <View style={styles.partyCol}>
          <Avatar name={toName} size={36} />
          <Text style={styles.partyName} numberOfLines={1}>
            {isMeTo ? 'You' : toName}
          </Text>
        </View>
      </View>

      {/* 1-Tap Settle Action if user is involved */}
      {isMeInvolved && onSettle && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.settleButton}
            onPress={onSettle}
            activeOpacity={0.8}
          >
            <Text style={styles.settleButtonText}>
              {isMeFrom ? `Pay ${toName} ${paiseToRupees(amountPaise)}` : `Record Settlement`}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
  },
  partiesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  partyCol: {
    alignItems: 'center',
    width: 72,
    gap: 4,
  },
  partyName: {
    ...typography.secondarySemibold,
    fontSize: 12,
    textAlign: 'center',
    color: colors.text,
  },
  arrowCol: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    gap: 4,
  },
  amountText: {
    ...typography.amount,
    fontSize: 15,
    color: colors.primary,
  },
  arrowLine: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '80%',
    justifyContent: 'center',
    gap: 2,
  },
  lineSegment: {
    flex: 1,
    height: 1.5,
    backgroundColor: colors.primaryBorder,
  },
  actionRow: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
  },
  settleButton: {
    backgroundColor: colors.primarySubtle,
    borderRadius: radii.md,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settleButtonText: {
    ...typography.secondarySemibold,
    color: colors.primary,
  },
});
