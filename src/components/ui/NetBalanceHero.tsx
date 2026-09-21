import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { paiseToRupees } from '../../engine/currency';
import { colors, radii, spacing, typography, shadows } from '../../theme';

interface NetBalanceHeroProps {
  totalNetPaise: number;
  owedToYouPaise?: number;
  youOwePaise?: number;
  groupCount?: number;
  title?: string;
  style?: ViewStyle;
}

export function NetBalanceHero({
  totalNetPaise,
  owedToYouPaise = 0,
  youOwePaise = 0,
  groupCount,
  title = 'Your Net Standing',
  style,
}: NetBalanceHeroProps) {
  const isPositive = totalNetPaise > 0;
  const isNegative = totalNetPaise < 0;

  let netColor = colors.text;
  let netText = '₹0.00';
  let badgeLabel = 'All settled up';
  let badgeBg = colors.moneyNeutralBg;
  let badgeColor = colors.moneyNeutral;

  if (isPositive) {
    netColor = colors.moneyPositive;
    netText = `+${paiseToRupees(totalNetPaise)}`;
    badgeLabel = 'You are owed';
    badgeBg = colors.moneyPositiveBg;
    badgeColor = colors.moneyPositive;
  } else if (isNegative) {
    netColor = colors.moneyNegative;
    netText = `-${paiseToRupees(Math.abs(totalNetPaise))}`;
    badgeLabel = 'You owe overall';
    badgeBg = colors.moneyNegativeBg;
    badgeColor = colors.moneyNegative;
  }

  const showBreakdown = owedToYouPaise > 0 || youOwePaise > 0;

  return (
    <View style={[styles.card, shadows.card, style]}>
      {/* Top Header Row */}
      <View style={styles.topRow}>
        <Text style={styles.titleText}>{title}</Text>
        <View style={[styles.statusPill, { backgroundColor: badgeBg }]}>
          <Text style={[styles.statusPillText, { color: badgeColor }]}>{badgeLabel}</Text>
        </View>
      </View>

      {/* Hero Amount */}
      <Text style={[styles.heroAmount, { color: netColor }]}>{netText}</Text>

      {/* Secondary Breakdown */}
      {showBreakdown ? (
        <View style={styles.breakdownRow}>
          <View style={styles.metricCol}>
            <View style={styles.metricHeader}>
              <View style={[styles.metricDot, { backgroundColor: colors.moneyPositive }]} />
              <Text style={styles.metricLabel}>To collect</Text>
            </View>
            <Text style={[styles.metricValue, { color: colors.moneyPositive }]}>
              {paiseToRupees(owedToYouPaise)}
            </Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricCol}>
            <View style={styles.metricHeader}>
              <View style={[styles.metricDot, { backgroundColor: colors.moneyNegative }]} />
              <Text style={styles.metricLabel}>To pay</Text>
            </View>
            <Text style={[styles.metricValue, { color: colors.moneyNegative }]}>
              {paiseToRupees(youOwePaise)}
            </Text>
          </View>
        </View>
      ) : groupCount !== undefined && groupCount > 0 ? (
        <Text style={styles.groupCountSub}>
          Across {groupCount === 1 ? '1 active group' : `${groupCount} active groups`}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  titleText: {
    ...typography.secondarySemibold,
    fontSize: 12,
    color: colors.textMuted,
  },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  statusPillText: {
    ...typography.caption,
    fontSize: 10,
  },
  heroAmount: {
    ...typography.display,
    fontSize: 26,
    marginBottom: 4,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radii.sm,
    paddingVertical: 4,
    paddingHorizontal: spacing.md,
    marginTop: 2,
  },
  metricCol: {
    flex: 1,
    gap: 1,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metricDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  metricLabel: {
    ...typography.caption,
    fontSize: 10,
    color: colors.textMuted,
  },
  metricValue: {
    ...typography.amount,
    fontSize: 13,
  },
  metricDivider: {
    width: 1,
    height: 18,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
  },
  groupCountSub: {
    ...typography.secondary,
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
});
