import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { GroupsRepo } from '../../src/repositories/groups.repo';
import { ExpensesRepo } from '../../src/repositories/expenses.repo';
import { SettlementsRepo } from '../../src/repositories/settlements.repo';
import { calculateNetBalances } from '../../src/engine/debt-graph';
import { useAuthStore } from '../../src/stores/auth.store';
import { useSyncStore } from '../../src/stores/sync.store';
import { triggerSync } from '../../src/sync/engine';
import { SyncStatusChip } from '../../src/components/sync/SyncStatusChip';
import {
  Avatar,
  EmptyState,
  SectionHeader,
  NetBalanceHero,
  GroupBentoCard,
  FloatingDock,
  PrimaryButton,
  SecondaryButton,
} from '../../src/components/ui';
import { colors, spacing, typography, radii } from '../../src/theme';
import { Plus, KeyRound, Settings, Users } from 'lucide-react-native';
import type { Group } from '../../src/types/models';

interface GroupCardData {
  group: Group;
  memberNames: string[];
  myNetPaise: number;
  latestActivityText?: string;
}

export default function GroupsScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  const profile = useAuthStore((s) => s.profile);
  const dbVersion = useSyncStore((s) => s.dbVersion);

  const [groupsData, setGroupsData] = useState<GroupCardData[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0,
  );
  const bottomInset = Math.max(insets.bottom, 12);

  const loadGroups = useCallback(() => {
    try {
      const activeGroups = GroupsRepo.listActiveGroups();
      const enriched: GroupCardData[] = activeGroups.map((group) => {
        const members = GroupsRepo.listMembers(group.id);
        const memberNames = members.map(
          (m) => m.display_name || m.email?.split('@')[0] || 'Member',
        );

        let myNet = 0;
        let latestActivityText: string | undefined;

        if (userId) {
          const memberIds = members.map((m) => m.user_id);
          const expenses = ExpensesRepo.listExpenses(group.id, false);
          const settlements = SettlementsRepo.listSettlements(group.id, false);
          const netMap = calculateNetBalances(memberIds, expenses, settlements);
          myNet = netMap.get(userId) ?? 0;

          if (expenses.length > 0) {
            const latest = expenses[0];
            latestActivityText = `${latest.title} • ${latest.expense_date}`;
          }
        }

        return {
          group,
          memberNames,
          myNetPaise: myNet,
          latestActivityText,
        };
      });
      setGroupsData(enriched);
    } catch {
      setGroupsData([]);
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

  // Aggregate financials
  const { totalNetPaise, owedToYouPaise, youOwePaise } = useMemo(() => {
    let total = 0;
    let owed = 0;
    let owe = 0;

    groupsData.forEach((item) => {
      total += item.myNetPaise;
      if (item.myNetPaise > 0) {
        owed += item.myNetPaise;
      } else if (item.myNetPaise < 0) {
        owe += Math.abs(item.myNetPaise);
      }
    });

    return { totalNetPaise: total, owedToYouPaise: owed, youOwePaise: owe };
  }, [groupsData]);

  const renderGroupItem = ({ item }: { item: GroupCardData }) => (
    <GroupBentoCard
      group={item.group}
      memberNames={item.memberNames}
      myNetPaise={item.myNetPaise}
      latestActivityText={item.latestActivityText}
      onPress={() => router.push(`/(app)/group/${item.group.id}` as any)}
    />
  );

  return (
    <View style={styles.container}>
      {/* Top App Bar */}
      <View style={[styles.topBar, { paddingTop: topInset + 6 }]}>
        <View style={styles.profileRow}>
          <Avatar name={profile?.display_name || 'Member'} size={38} />
          <View style={styles.profileText}>
            <Text style={styles.brandTitle}>ExpenseShare</Text>
            <Text style={styles.userName} numberOfLines={1}>
              {profile?.display_name || 'Member'}
            </Text>
          </View>
        </View>

        <View style={styles.topActions}>
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

      {/* Groups List with NetBalanceHero as Header */}
      <FlatList
        data={groupsData}
        keyExtractor={(item) => item.group.id}
        renderItem={renderGroupItem}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: 84 + bottomInset },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerSection}>
            {/* Financial Summary Hero */}
            <NetBalanceHero
              totalNetPaise={totalNetPaise}
              owedToYouPaise={owedToYouPaise}
              youOwePaise={youOwePaise}
              groupCount={groupsData.length}
              title="Overall Net Balance"
            />

            {/* Section Header */}
            <SectionHeader
              title="Your Active Groups"
              count={groupsData.length}
            />
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon={<Users size={24} color={colors.textMuted} />}
            title="No groups yet"
            description="Create a group for a trip, house, or project, or enter an invite code to join."
          />
        }
      />

      {/* Floating Thumb Action Dock */}
      <FloatingDock>
        <PrimaryButton
          label="New Group"
          icon={<Plus size={18} color="#FFFFFF" />}
          onPress={() => router.push('/(app)/new-group')}
          style={styles.dockPrimaryBtn}
        />
        <SecondaryButton
          label="Join Group"
          icon={<KeyRound size={17} color={colors.primary} />}
          onPress={() => router.push('/(app)/join-group')}
          style={styles.dockSecondaryBtn}
        />
      </FloatingDock>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  profileText: {
    gap: 1,
  },
  brandTitle: {
    ...typography.caption,
    color: colors.primary,
    fontSize: 10,
  },
  userName: {
    ...typography.title,
    fontSize: 17,
    color: colors.text,
  },
  topActions: {
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
  headerSection: {
    marginBottom: spacing.xs,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 110, // Content is never obscured by the bottom floating dock
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  dockPrimaryBtn: {
    flex: 1.2,
    borderRadius: radii.pill,
    height: 46,
  },
  dockSecondaryBtn: {
    flex: 1,
    borderRadius: radii.pill,
    height: 46,
  },
});
