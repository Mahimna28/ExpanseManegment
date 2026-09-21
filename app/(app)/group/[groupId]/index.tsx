import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { GroupsRepo } from '../../../../src/repositories/groups.repo';
import { useGroupBalances } from '../../../../src/hooks/useGroupBalances';
import { useGroupExpenses } from '../../../../src/hooks/useGroupExpenses';
import { useAuthStore } from '../../../../src/stores/auth.store';
import { paiseToRupees } from '../../../../src/engine/currency';
import { SyncStatusChip } from '../../../../src/components/sync/SyncStatusChip';
import {
  Avatar,
  EmptyState,
  ExpenseCard,
  DebtFlowCard,
  NetBalanceHero,
  SegmentedControl,
  FloatingDock,
  PrimaryButton,
} from '../../../../src/components/ui';
import { colors, spacing, typography, radii, shadows } from '../../../../src/theme';
import {
  ArrowLeft,
  Share2,
  Users,
  Plus,
  Receipt,
  CheckCircle2,
} from 'lucide-react-native';
import type { Expense } from '../../../../src/types/models';

type GroupTab = 'activity' | 'balances';

export default function GroupDetailScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const currentUserId = useAuthStore((s) => s.userId);

  const [activeTab, setActiveTab] = useState<GroupTab>('activity');

  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0,
  );
  const bottomInset = Math.max(insets.bottom, 12);

  const group = GroupsRepo.getGroupById(groupId);
  const members = GroupsRepo.listMembers(groupId);
  const { balances, suggestions, netMap } = useGroupBalances(groupId);
  const { expenses } = useGroupExpenses(groupId, false);

  const memberNameMap = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((m) => {
      map.set(m.user_id, m.display_name || m.email?.split('@')[0] || 'Member');
    });
    return map;
  }, [members]);

  const myNet = currentUserId ? (netMap.get(currentUserId) ?? 0) : 0;

  // Breakdown for current user in this group
  const { owedToMe, iOwe } = useMemo(() => {
    let owed = 0;
    let owe = 0;
    suggestions.forEach((s) => {
      if (s.to_user_id === currentUserId) {
        owed += s.amount_paise;
      } else if (s.from_user_id === currentUserId) {
        owe += s.amount_paise;
      }
    });
    return { owedToMe: owed, iOwe: owe };
  }, [suggestions, currentUserId]);

  const handleShareInvite = () => {
    if (!group) return;
    Alert.alert(
      'Group Invite Code',
      `Share this code with your friends to join "${group.name}":\n\n${group.invite_code}`,
      [{ text: 'OK' }],
    );
  };

  if (!group) {
    return (
      <View style={[styles.container, { paddingTop: topInset + spacing.lg }]}>
        <View style={styles.notFoundContainer}>
          <Text style={styles.notFoundText}>Group not found</Text>
          <TouchableOpacity onPress={() => router.replace('/(app)')}>
            <Text style={styles.backLink}>Return to Groups</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const renderExpenseItem = ({ item }: { item: Expense }) => {
    const payerName = memberNameMap.get(item.paid_by) || 'Member';
    const isCurrentUserPayer = item.paid_by === currentUserId;

    // Calculate personal split share
    let mySharePaise: number | undefined;
    if (item.splits && item.splits.length > 0) {
      const split = item.splits.find((s) => s.participant_id === currentUserId);
      mySharePaise = split ? split.owed_paise : 0;
    } else {
      const count = Math.max(members.length, 1);
      mySharePaise = Math.round(item.total_paise / count);
    }

    return (
      <ExpenseCard
        expense={item}
        payerName={payerName}
        isCurrentUserPayer={isCurrentUserPayer}
        mySharePaise={mySharePaise}
        onPress={() => router.push(`/(app)/group/${groupId}/expense/${item.id}` as any)}
      />
    );
  };

  return (
    <View style={styles.container}>
      {/* Top App Bar — extends behind status bar */}
      <View style={[styles.topBar, { paddingTop: topInset + 6 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.replace('/(app)')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Back to Groups"
          accessibilityRole="button"
        >
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.titleCol}>
          <Text style={styles.groupTitle} numberOfLines={1}>
            {group.name}
          </Text>
          <Text style={styles.memberCountSub}>
            {members.length === 1 ? '1 member' : `${members.length} members`}
          </Text>
        </View>

        <View style={styles.topActions}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={handleShareInvite}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Share invite code"
            accessibilityRole="button"
          >
            <Share2 size={17} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => router.push(`/(app)/group/${groupId}/members` as any)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Group members"
            accessibilityRole="button"
          >
            <Users size={17} color={colors.text} />
          </TouchableOpacity>

          <SyncStatusChip />
        </View>
      </View>

      {/* Dynamic Financial Hero Card */}
      <View style={styles.heroSection}>
        <NetBalanceHero
          totalNetPaise={myNet}
          owedToYouPaise={owedToMe}
          youOwePaise={iOwe}
          title="Your Group Standing"
        />
      </View>

      {/* Capsule Tab Switcher */}
      <View style={styles.tabsSection}>
        <SegmentedControl<GroupTab>
          tabs={[
            { id: 'activity', label: 'Activity', badgeCount: expenses.length },
            { id: 'balances', label: 'Who Owes Who', badgeCount: suggestions.length },
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </View>

      {/* TAB 1: ACTIVITY (EXPENSES FEED) */}
      {activeTab === 'activity' ? (
        <View style={styles.tabContentContainer}>
          <FlatList
            data={expenses}
            keyExtractor={(item) => item.id}
            renderItem={renderExpenseItem}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: 84 + bottomInset },
            ]}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <EmptyState
                  icon={<Receipt size={22} color={colors.textMuted} />}
                  title="No expenses yet"
                  description="Add your first group expense to start splitting bills automatically."
                />
              </View>
            }
          />

          {/* Floating Thumb Dock for Adding Expense */}
          <FloatingDock>
            <PrimaryButton
              label="Add Expense"
              icon={<Plus size={18} color="#FFFFFF" />}
              onPress={() => router.push(`/(app)/group/${groupId}/new-expense` as any)}
              style={styles.dockPrimaryBtn}
            />
          </FloatingDock>
        </View>
      ) : (
        /* TAB 2: WHO OWES WHO (BALANCES & DEBT FLOWS) */
        <FlatList
          data={balances}
          keyExtractor={(item) => item.user_id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: 84 + bottomInset },
          ]}
            ListHeaderComponent={
              <View style={styles.balancesHeaderSection}>
                {/* Visual Debt Transfers */}
                <Text style={styles.sectionHeaderTitle}>Simplified Transfers</Text>
                <Text style={styles.sectionHeaderSub}>
                  Fewest transfers to settle all group balances completely.
                </Text>

                {suggestions.map((s, idx) => {
                  const fromName = memberNameMap.get(s.from_user_id) || 'Member';
                  const toName = memberNameMap.get(s.to_user_id) || 'Member';
                  const isMeFrom = s.from_user_id === currentUserId;
                  const isMeTo = s.to_user_id === currentUserId;

                  return (
                    <DebtFlowCard
                      key={idx}
                      fromName={fromName}
                      toName={toName}
                      amountPaise={s.amount_paise}
                      isMeFrom={isMeFrom}
                      isMeTo={isMeTo}
                      onSettle={() =>
                        router.push(`/(app)/group/${groupId}/new-settlement` as any)
                      }
                    />
                  );
                })}

                {suggestions.length === 0 && (
                  <View style={[styles.allSettledCard, shadows.card]}>
                    <CheckCircle2 size={28} color={colors.moneyPositive} />
                    <Text style={styles.allSettledTitle}>
                      All balances are settled!
                    </Text>
                    <Text style={styles.allSettledSub}>
                      No one in this group owes anything right now.
                    </Text>
                  </View>
                )}

                {/* Individual Member Standings */}
                <Text style={[styles.sectionHeaderTitle, { marginTop: spacing.lg }]}>
                  Member Standings
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const name = memberNameMap.get(item.user_id) || 'Member';
              const isCurrentUser = item.user_id === currentUserId;
              const isPositive = item.net_paise > 0;
              const isNegative = item.net_paise < 0;

              let statusLabel = 'Settled';
              let amountText = '₹0.00';
              let amountColor = colors.moneyNeutral;
              let badgeBg = colors.moneyNeutralBg;

              if (isPositive) {
                statusLabel = isCurrentUser ? 'You are owed' : `${name} is owed`;
                amountText = `+${paiseToRupees(item.net_paise)}`;
                amountColor = colors.moneyPositive;
                badgeBg = colors.moneyPositiveBg;
              } else if (isNegative) {
                statusLabel = isCurrentUser ? 'You owe' : `${name} owes`;
                amountText = `-${paiseToRupees(Math.abs(item.net_paise))}`;
                amountColor = colors.moneyNegative;
                badgeBg = colors.moneyNegativeBg;
              }

              return (
                <View style={[styles.memberCard, shadows.subtle]}>
                  <Avatar name={name} size={38} />
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName} numberOfLines={1}>
                      {name} {isCurrentUser && <Text style={styles.youTag}>(You)</Text>}
                    </Text>
                    <Text style={styles.memberStandingSub}>{statusLabel}</Text>
                  </View>

                  <View style={[styles.memberAmountPill, { backgroundColor: badgeBg }]}>
                    <Text style={[styles.memberAmountText, { color: amountColor }]}>
                      {amountText}
                    </Text>
                  </View>
                </View>
              );
            }}
            ListFooterComponent={
              <View style={styles.footerActionSection}>
                <PrimaryButton
                  label="Record a Settlement"
                  onPress={() =>
                    router.push(`/(app)/group/${groupId}/new-settlement` as any)
                  }
                />
              </View>
            }
          />
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -spacing.xs,
  },
  titleCol: {
    flex: 1,
    marginLeft: spacing.xs,
    justifyContent: 'center',
  },
  groupTitle: {
    ...typography.title,
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  memberCountSub: {
    ...typography.secondary,
    fontSize: 12,
    color: colors.textMuted,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  tabsSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  tabContentContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  emptyContainer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockPrimaryBtn: {
    flex: 1,
    borderRadius: radii.pill,
    height: 46,
  },
  balancesHeaderSection: {
    marginBottom: spacing.xs,
  },
  sectionHeaderTitle: {
    ...typography.caption,
    fontSize: 11,
    marginBottom: 2,
  },
  sectionHeaderSub: {
    ...typography.secondary,
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  allSettledCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  allSettledTitle: {
    ...typography.title,
    fontSize: 16,
    color: colors.moneyPositive,
  },
  allSettledSub: {
    ...typography.secondary,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  memberInfo: {
    flex: 1,
    marginLeft: spacing.md,
    gap: 2,
  },
  memberName: {
    ...typography.bodySemibold,
    color: colors.text,
  },
  youTag: {
    ...typography.secondary,
    color: colors.textMuted,
    fontSize: 12,
  },
  memberStandingSub: {
    ...typography.secondary,
    fontSize: 12,
    color: colors.textMuted,
  },
  memberAmountPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  memberAmountText: {
    ...typography.amount,
    fontSize: 13,
  },
  footerActionSection: {
    marginTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  notFoundContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  notFoundText: {
    ...typography.title,
    marginBottom: spacing.md,
  },
  backLink: {
    ...typography.bodySemibold,
    color: colors.primary,
  },
});
