import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
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
  ExpenseRow,
  BalanceBanner,
  SegmentedControl,
  PrimaryButton,
} from '../../../../src/components/ui';
import { colors, spacing, typography, radii } from '../../../../src/theme';
import {
  ArrowLeft,
  Share2,
  Users,
  Plus,
  ArrowRight,
  Receipt,
  CheckCircle2,
} from 'lucide-react-native';
import type { Expense } from '../../../../src/types/models';

type GroupTab = 'expenses' | 'balances';

export default function GroupDetailScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const currentUserId = useAuthStore((s) => s.userId);

  const [activeTab, setActiveTab] = useState<GroupTab>('expenses');

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
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.notFoundContainer}>
          <Text style={styles.notFoundText}>Group not found</Text>
          <TouchableOpacity onPress={() => router.replace('/(app)')}>
            <Text style={styles.backLink}>Return to Groups</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Pre-compute user's share for each expense for the clean ExpenseRow
  const renderExpenseItem = ({ item }: { item: Expense }) => {
    const payerName = memberNameMap.get(item.paid_by) || 'Member';
    const isCurrentUserPayer = item.paid_by === currentUserId;

    // Determine user's split from local_splits if available, or approximate equal split
    let mySharePaise: number | undefined;
    if (item.splits && item.splits.length > 0) {
      const split = item.splits.find((s) => s.participant_id === currentUserId);
      mySharePaise = split ? split.owed_paise : 0;
    } else {
      // Fallback equal estimation
      const memberCount = Math.max(members.length, 1);
      mySharePaise = Math.round(item.total_paise / memberCount);
    }

    return (
      <ExpenseRow
        expense={item}
        payerName={payerName}
        isCurrentUserPayer={isCurrentUserPayer}
        mySharePaise={mySharePaise}
        onPress={() => router.push(`/(app)/group/${groupId}/expense/${item.id}` as any)}
      />
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.topHeader}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.replace('/(app)')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={22} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.titleWrapper}>
            <Text style={styles.groupTitle} numberOfLines={1}>
              {group.name}
            </Text>
            <Text style={styles.memberSubtitle}>
              {members.length === 1 ? '1 member' : `${members.length} members`}
            </Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={handleShareInvite}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Share2 size={18} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => router.push(`/(app)/group/${groupId}/members` as any)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Users size={18} color={colors.text} />
            </TouchableOpacity>
            <SyncStatusChip />
          </View>
        </View>

        {/* Compact Group Balance Banner */}
        <View style={styles.bannerWrapper}>
          <BalanceBanner
            netPaise={myNet}
            onPress={() => setActiveTab('balances')}
          />
        </View>

        {/* Tab Switcher (Expenses vs Balances) */}
        <View style={styles.tabsWrapper}>
          <SegmentedControl<GroupTab>
            tabs={[
              { id: 'expenses', label: 'Expenses', badgeCount: expenses.length },
              { id: 'balances', label: 'Balances' },
            ]}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </View>

        {/* TAB 1: EXPENSES LIST */}
        {activeTab === 'expenses' ? (
          <View style={styles.feedContainer}>
            <FlatList
              data={expenses}
              keyExtractor={(item) => item.id}
              renderItem={renderExpenseItem}
              contentContainerStyle={styles.expensesListContent}
              ListEmptyComponent={
                <EmptyState
                  icon={<Receipt size={28} color={colors.textMuted} />}
                  title="No expenses yet"
                  description="Tap 'Add Expense' below to log your first shared cost."
                />
              }
            />

            {/* Docked Primary Add Expense CTA */}
            <View style={styles.bottomBar}>
              <PrimaryButton
                label="Add Expense"
                icon={<Plus size={18} color="#FFFFFF" />}
                onPress={() => router.push(`/(app)/group/${groupId}/new-expense` as any)}
              />
            </View>
          </View>
        ) : (
          /* TAB 2: BALANCES & DEBT GRAPH */
          <FlatList
            data={balances}
            keyExtractor={(item) => item.user_id}
            contentContainerStyle={styles.balancesContent}
            ListHeaderComponent={
              <>
                {/* Simplified Transfer Suggestions */}
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionHeading}>Suggested Transfers</Text>
                  <Text style={styles.sectionSubtitle}>
                    Fewest transfers to settle all group balances.
                  </Text>

                  <View style={styles.card}>
                    {suggestions.map((s, idx) => {
                      const fromName = memberNameMap.get(s.from_user_id) || 'Member';
                      const toName = memberNameMap.get(s.to_user_id) || 'Member';
                      const isMeFrom = s.from_user_id === currentUserId;
                      const isMeTo = s.to_user_id === currentUserId;

                      return (
                        <View key={idx} style={styles.transferRow}>
                          <View style={styles.transferLeft}>
                            <Avatar name={fromName} size={32} />
                            <ArrowRight size={14} color={colors.textDim} />
                            <Avatar name={toName} size={32} />
                            <View style={styles.transferTextCol}>
                              <Text style={styles.transferTitle} numberOfLines={1}>
                                <Text style={{ fontWeight: '700' }}>
                                  {isMeFrom ? 'You' : fromName}
                                </Text>{' '}
                                pays{' '}
                                <Text style={{ fontWeight: '700' }}>
                                  {isMeTo ? 'You' : toName}
                                </Text>
                              </Text>
                            </View>
                          </View>

                          <View style={styles.transferRight}>
                            <Text style={styles.transferAmount}>
                              {paiseToRupees(s.amount_paise)}
                            </Text>
                            {(isMeFrom || isMeTo) && (
                              <TouchableOpacity
                                style={styles.settleButton}
                                onPress={() =>
                                  router.push(`/(app)/group/${groupId}/new-settlement` as any)
                                }
                              >
                                <Text style={styles.settleButtonText}>Settle</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      );
                    })}

                    {suggestions.length === 0 && (
                      <View style={styles.allSettledContainer}>
                        <CheckCircle2 size={24} color={colors.moneyPositive} />
                        <Text style={styles.allSettledText}>
                          All group balances are settled!
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Member Net Balances */}
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionHeading}>All Member Standings</Text>
                </View>
              </>
            }
            renderItem={({ item }) => {
              const name = memberNameMap.get(item.user_id) || 'Member';
              const isCurrentUser = item.user_id === currentUserId;
              const isPositive = item.net_paise > 0;
              const isNegative = item.net_paise < 0;

              let text = 'Settled up';
              let textColor = colors.moneyNeutral;

              if (isPositive) {
                text = `is owed ${paiseToRupees(item.net_paise)}`;
                textColor = colors.moneyPositive;
              } else if (isNegative) {
                text = `owes ${paiseToRupees(Math.abs(item.net_paise))}`;
                textColor = colors.moneyNegative;
              }

              return (
                <View style={styles.memberBalanceRow}>
                  <View style={styles.memberLeft}>
                    <Avatar name={name} size={36} />
                    <View>
                      <Text style={styles.memberName}>
                        {name} {isCurrentUser && <Text style={styles.youTag}>(You)</Text>}
                      </Text>
                      <Text style={[styles.memberStanding, { color: textColor }]}>
                        {isCurrentUser
                          ? isPositive
                            ? `You are owed ${paiseToRupees(item.net_paise)}`
                            : isNegative
                            ? `You owe ${paiseToRupees(Math.abs(item.net_paise))}`
                            : 'You are all settled'
                          : `${name} ${text}`}
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.memberPaiseValue, { color: textColor }]}>
                    {item.net_paise === 0
                      ? '₹0.00'
                      : isPositive
                      ? `+${paiseToRupees(item.net_paise)}`
                      : `-${paiseToRupees(Math.abs(item.net_paise))}`}
                  </Text>
                </View>
              );
            }}
            ListFooterComponent={
              <View style={styles.settleActionFooter}>
                <PrimaryButton
                  label="Record Settlement"
                  onPress={() =>
                    router.push(`/(app)/group/${groupId}/new-settlement` as any)
                  }
                />
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
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
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backBtn: {
    padding: spacing.xs,
    marginLeft: -spacing.xs,
  },
  titleWrapper: {
    flex: 1,
    marginLeft: spacing.xs,
    gap: 1,
  },
  groupTitle: {
    ...typography.largeTitle,
    fontSize: 18,
  },
  memberSubtitle: {
    ...typography.secondary,
    fontSize: 12,
  },
  headerActions: {
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
  bannerWrapper: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  tabsWrapper: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  feedContainer: {
    flex: 1,
  },
  expensesListContent: {
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingBottom: 90,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 4,
  },
  balancesContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.huge,
  },
  sectionContainer: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionHeading: {
    ...typography.caption,
  },
  sectionSubtitle: {
    ...typography.secondary,
    fontSize: 12,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  transferRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  transferLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  transferTextCol: {
    marginLeft: spacing.xs,
    flex: 1,
  },
  transferTitle: {
    ...typography.body,
    fontSize: 14,
  },
  transferRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  transferAmount: {
    ...typography.amount,
    color: colors.text,
    fontSize: 15,
  },
  settleButton: {
    backgroundColor: colors.primarySubtle,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  settleButtonText: {
    ...typography.secondarySemibold,
    color: colors.primary,
    fontSize: 12,
  },
  allSettledContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  allSettledText: {
    ...typography.bodySemibold,
    color: colors.moneyPositive,
  },
  memberBalanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  memberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  memberName: {
    ...typography.bodySemibold,
  },
  youTag: {
    ...typography.secondary,
    color: colors.textMuted,
  },
  memberStanding: {
    ...typography.secondary,
    fontSize: 12,
    marginTop: 1,
  },
  memberPaiseValue: {
    ...typography.amount,
    fontSize: 15,
  },
  settleActionFooter: {
    marginTop: spacing.lg,
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
