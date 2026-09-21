import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { paiseToRupees } from '../../engine/currency';
import { AvatarStack } from './AvatarStack';
import { colors, radii, spacing, typography, shadows } from '../../theme';
import { ChevronRight } from 'lucide-react-native';
import type { Group } from '../../types/models';

interface GroupBentoCardProps {
  group: Group;
  memberNames: string[];
  myNetPaise: number;
  latestActivityText?: string;
  onPress: () => void;
}

export function GroupBentoCard({
  group,
  memberNames,
  myNetPaise,
  latestActivityText,
  onPress,
}: GroupBentoCardProps) {
  const isPositive = myNetPaise > 0;
  const isNegative = myNetPaise < 0;

  let balanceText = 'Settled';
  let balanceBg = colors.moneyNeutralBg;
  let balanceTextColor = colors.moneyNeutral;

  if (isPositive) {
    balanceText = `+${paiseToRupees(myNetPaise)}`;
    balanceBg = colors.moneyPositiveBg;
    balanceTextColor = colors.moneyPositive;
  } else if (isNegative) {
    balanceText = `-${paiseToRupees(Math.abs(myNetPaise))}`;
    balanceBg = colors.moneyNegativeBg;
    balanceTextColor = colors.moneyNegative;
  }

  const memberCount = memberNames.length;
  const memberCountText = memberCount === 1 ? '1 member' : `${memberCount} members`;

  return (
    <TouchableOpacity
      style={[styles.card, shadows.card]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Top Header: Title & Avatars */}
      <View style={styles.topRow}>
        <View style={styles.titleCol}>
          <Text style={styles.groupName} numberOfLines={1}>
            {group.name}
          </Text>
          {group.description ? (
            <Text style={styles.description} numberOfLines={1}>
              {group.description}
            </Text>
          ) : null}
        </View>

        <AvatarStack names={memberNames} size={28} max={3} />
      </View>

      {/* Middle: Latest Activity if available */}
      {latestActivityText ? (
        <View style={styles.activityRow}>
          <Text style={styles.activityText} numberOfLines={1}>
            {latestActivityText}
          </Text>
        </View>
      ) : null}

      {/* Bottom Footer: Member Count & Net Balance Pill */}
      <View style={styles.bottomRow}>
        <View style={styles.memberBadge}>
          <Text style={styles.memberBadgeText}>{memberCountText}</Text>
        </View>

        <View style={[styles.balancePill, { backgroundColor: balanceBg }]}>
          <Text style={[styles.balancePillText, { color: balanceTextColor }]}>
            {balanceText}
          </Text>
          <ChevronRight size={14} color={balanceTextColor} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  titleCol: {
    flex: 1,
    gap: 2,
  },
  groupName: {
    ...typography.title,
    fontSize: 18,
    color: colors.text,
  },
  description: {
    ...typography.secondary,
    color: colors.textMuted,
  },
  activityRow: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    marginTop: spacing.md,
    alignSelf: 'flex-start',
  },
  activityText: {
    ...typography.secondary,
    fontSize: 12,
    color: colors.textMuted,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
  },
  memberBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceSubtle,
  },
  memberBadgeText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textMuted,
  },
  balancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  balancePillText: {
    ...typography.amount,
    fontSize: 13,
  },
});
