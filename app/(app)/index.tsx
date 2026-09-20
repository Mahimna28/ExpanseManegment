import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { GroupsRepo } from '../../src/repositories/groups.repo';
import { ExpensesRepo } from '../../src/repositories/expenses.repo';
import { SettlementsRepo } from '../../src/repositories/settlements.repo';
import { calculateNetBalances } from '../../src/engine/debt-graph';
import { paiseToRupees } from '../../src/engine/currency';
import { useAuthStore } from '../../src/stores/auth.store';
import { useSyncStore } from '../../src/stores/sync.store';
import { triggerSync } from '../../src/sync/engine';
import { SyncStatusChip } from '../../src/components/sync/SyncStatusChip';
import {
  Avatar,
  EmptyState,
  SectionHeader,
  PrimaryButton,
  SecondaryButton,
} from '../../src/components/ui';
import { colors, spacing, typography, radii } from '../../src/theme';
import { Plus, KeyRound, Settings, ChevronRight, Users } from 'lucide-react-native';
import type { Group } from '../../src/types/models';

interface GroupWithMeta {
  group: Group;
  memberCount: number;
  myNetPaise: number;
}

export default function GroupsScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  const profile = useAuthStore((s) => s.profile);
  const dbVersion = useSyncStore((s) => s.dbVersion);

  const [groupsWithMeta, setGroupsWithMeta] = useState<GroupWithMeta[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadGroups = useCallback(() => {
    try {
      const activeGroups = GroupsRepo.listActiveGroups();
      const enriched: GroupWithMeta[] = activeGroups.map((group) => {
        const members = GroupsRepo.listMembers(group.id);
        let myNet = 0;
        if (userId) {
          const memberIds = members.map((m) => m.user_id);
          const expenses = ExpensesRepo.listExpenses(group.id, false);
          const settlements = SettlementsRepo.listSettlements(group.id, false);
          const netMap = calculateNetBalances(memberIds, expenses, settlements);
          myNet = netMap.get(userId) ?? 0;
        }
        return {
          group,
          memberCount: members.length,
          myNetPaise: myNet,
        };
      });
      setGroupsWithMeta(enriched);
    } catch {
      setGroupsWithMeta([]);
    }
  }, [userId]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups, dbVersion]);

  const onRefresh = async () => {
    setRefreshing(true);
    await triggerSync().catch(console.warn);
    loadGroups();
    setRefreshing(false);
  };

  // Overall aggregate balance calculation
  const totalNetPaise = useMemo(() => {
    return groupsWithMeta.reduce((sum, item) => sum + item.myNetPaise, 0);
  }, [groupsWithMeta]);

  const renderGroupRow = ({ item }: { item: GroupWithMeta }) => {
    const { group, memberCount, myNetPaise } = item;
    const isPositive = myNetPaise > 0;
    const isNegative = myNetPaise < 0;

    let balanceText = 'Settled';
    let balanceColor = colors.moneyNeutral;

    if (isPositive) {
      balanceText = `+${paiseToRupees(myNetPaise)}`;
      balanceColor = colors.moneyPositive;
    } else if (isNegative) {
      balanceText = `-${paiseToRupees(Math.abs(myNetPaise))}`;
      balanceColor = colors.moneyNegative;
    }

    const memberLabel = memberCount === 1 ? '1 member' : `${memberCount} members`;

    return (
      <TouchableOpacity
        style={styles.groupRow}
        onPress={() => router.push(`/(app)/group/${group.id}` as any)}
        activeOpacity={0.7}
      >
        <Avatar name={group.name} size={44} />

        <View style={styles.groupInfo}>
          <Text style={styles.groupName} numberOfLines={1}>
            {group.name}
          </Text>
          <Text style={styles.groupMeta} numberOfLines={1}>
            {memberLabel}
            {group.description ? ` • ${group.description}` : ''}
          </Text>
        </View>

        <View style={styles.balanceCol}>
          <Text style={[styles.balanceAmount, { color: balanceColor }]}>
            {balanceText}
          </Text>
          <Text style={styles.balanceStatus}>
            {isPositive ? 'you are owed' : isNegative ? 'you owe' : 'all settled'}
          </Text>
        </View>

        <ChevronRight size={18} color={colors.textDim} style={styles.chevron} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.topHeader}>
          <View style={styles.profileSection}>
            <Avatar name={profile?.display_name || 'Member'} size={38} />
            <View style={styles.welcomeTextGroup}>
              <Text style={styles.appName}>ExpenseShare</Text>
              <Text style={styles.userName} numberOfLines={1}>
                {profile?.display_name || 'Member'}
              </Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <SyncStatusChip />
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => router.push('/(app)/settings')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Settings size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Global Net Balance Card */}
        {groupsWithMeta.length > 0 && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryContent}>
              <Text style={styles.summaryLabel}>Total Net Balance</Text>
              <Text
                style={[
                  styles.summaryAmount,
                  {
                    color:
                      totalNetPaise > 0
                        ? colors.moneyPositive
                        : totalNetPaise < 0
                        ? colors.moneyNegative
                        : colors.text,
                  },
                ]}
              >
                {totalNetPaise === 0
                  ? '₹0.00'
                  : totalNetPaise > 0
                  ? `+${paiseToRupees(totalNetPaise)}`
                  : `-${paiseToRupees(Math.abs(totalNetPaise))}`}
              </Text>
              <Text style={styles.summarySub}>
                {totalNetPaise > 0
                  ? 'You are owed overall across groups'
                  : totalNetPaise < 0
                  ? 'You owe overall across groups'
                  : 'All group balances are settled'}
              </Text>
            </View>
          </View>
        )}

        {/* Action Buttons Row */}
        <View style={styles.actionRow}>
          <PrimaryButton
            label="New Group"
            icon={<Plus size={18} color="#FFFFFF" />}
            onPress={() => router.push('/(app)/new-group')}
            style={styles.actionBtn}
          />
          <SecondaryButton
            label="Join with Code"
            icon={<KeyRound size={18} color={colors.primary} />}
            onPress={() => router.push('/(app)/join-group')}
            style={styles.actionBtn}
          />
        </View>

        {/* Groups List */}
        <View style={styles.listContainer}>
          <SectionHeader
            title="Your Groups"
            count={groupsWithMeta.length}
          />

          <FlatList
            data={groupsWithMeta}
            keyExtractor={(item) => item.group.id}
            renderItem={renderGroupRow}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={
              <EmptyState
                icon={<Users size={28} color={colors.textMuted} />}
                title="No groups yet"
                description="Create a group for a trip, house, or project, or enter an invite code to join one."
              />
            }
          />
        </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  welcomeTextGroup: {
    gap: 1,
  },
  appName: {
    ...typography.caption,
    color: colors.primary,
  },
  userName: {
    ...typography.largeTitle,
    fontSize: 18,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryContent: {
    gap: 2,
  },
  summaryLabel: {
    ...typography.caption,
  },
  summaryAmount: {
    ...typography.display,
    fontSize: 26,
  },
  summarySub: {
    ...typography.secondary,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  actionBtn: {
    flex: 1,
  },
  listContainer: {
    flex: 1,
    marginTop: spacing.sm,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  groupInfo: {
    flex: 1,
    marginLeft: spacing.md,
    gap: 2,
  },
  groupName: {
    ...typography.bodySemibold,
    fontSize: 16,
  },
  groupMeta: {
    ...typography.secondary,
    color: colors.textMuted,
  },
  balanceCol: {
    alignItems: 'flex-end',
    marginRight: spacing.xs,
    gap: 1,
  },
  balanceAmount: {
    ...typography.amount,
  },
  balanceStatus: {
    ...typography.caption,
    fontSize: 10,
    textTransform: 'lowercase',
  },
  chevron: {
    marginLeft: spacing.xs,
  },
});
