import React from 'react';
import {
  View,
  Text,
  ScrollView,
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
import { paiseToRupees, formatNetBalance } from '../../../../src/engine/currency';
import { SyncStatusChip } from '../../../../src/components/sync/SyncStatusChip';
import {
  Plus,
  ArrowRightLeft,
  Users,
  Tags,
  Receipt,
  Share2,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react-native';

export default function GroupDashboardScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);

  const group = GroupsRepo.getGroupById(groupId);
  const members = GroupsRepo.listMembers(groupId);
  const { balances, suggestions, netMap } = useGroupBalances(groupId);
  const { expenses } = useGroupExpenses(groupId, false);

  const myNet = userId ? (netMap.get(userId) ?? 0) : 0;
  const myStatus = formatNetBalance(myNet);

  const memberNameMap = new Map<string, string>();
  members.forEach((m) => {
    memberNameMap.set(m.user_id, m.display_name || m.email?.split('@')[0] || 'Member');
  });

  const handleShareInvite = () => {
    if (!group) return;
    Alert.alert(
      'Group Invite Code',
      `Share this code with your friends so they can join "${group.name}":\n\n${group.invite_code}`,
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

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/(app)')}>
          <ArrowLeft size={20} color="#94A3B8" />
        </TouchableOpacity>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.groupTitle} numberOfLines={1}>{group.name}</Text>
          <TouchableOpacity style={styles.codeBadge} onPress={handleShareInvite}>
            <Text style={styles.codeBadgeText}>{group.invite_code}</Text>
            <Share2 size={11} color="#3B82F6" />
          </TouchableOpacity>
        </View>
        <SyncStatusChip />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* User's Personal Net Balance Card */}
        <View style={styles.myBalanceCard}>
          <Text style={styles.myBalanceLabel}>Your Total Balance</Text>
          <Text style={[styles.myBalanceAmount, { color: myStatus.color }]}>
            {myNet === 0 ? '₹0.00' : paiseToRupees(myNet)}
          </Text>
          <Text style={[styles.myBalanceSubtitle, { color: myStatus.color }]}>
            {myStatus.label}
          </Text>
        </View>

        {/* Primary Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.expenseBtn]}
            onPress={() => router.push(`/(app)/group/${groupId}/new-expense` as any)}
          >
            <Plus size={18} color="#FFFFFF" />
            <Text style={styles.expenseBtnText}>Add Expense</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.settleBtn]}
            onPress={() => router.push(`/(app)/group/${groupId}/new-settlement` as any)}
          >
            <ArrowRightLeft size={18} color="#93C5FD" />
            <Text style={styles.settleBtnText}>Settle Up</Text>
          </TouchableOpacity>
        </View>

        {/* Navigation Shortcut Grid */}
        <View style={styles.navGrid}>
          <TouchableOpacity
            style={styles.navCard}
            onPress={() => router.push(`/(app)/group/${groupId}/expenses` as any)}
          >
            <Receipt size={18} color="#3B82F6" />
            <Text style={styles.navCardTitle}>Expenses</Text>
            <Text style={styles.navCardCount}>{expenses.length}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navCard}
            onPress={() => router.push(`/(app)/group/${groupId}/settlements` as any)}
          >
            <ArrowRightLeft size={18} color="#10B981" />
            <Text style={styles.navCardTitle}>Debts</Text>
            <Text style={styles.navCardCount}>{suggestions.length}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navCard}
            onPress={() => router.push(`/(app)/group/${groupId}/members` as any)}
          >
            <Users size={18} color="#F59E0B" />
            <Text style={styles.navCardTitle}>Members</Text>
            <Text style={styles.navCardCount}>{members.length}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navCard}
            onPress={() => router.push(`/(app)/group/${groupId}/categories` as any)}
          >
            <Tags size={18} color="#8B5CF6" />
            <Text style={styles.navCardTitle}>Categories</Text>
            <Text style={styles.navCardCount}>Tags</Text>
          </TouchableOpacity>
        </View>

        {/* Member Balances Overview */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Group Balances</Text>
            <TouchableOpacity onPress={() => router.push(`/(app)/group/${groupId}/settlements` as any)}>
              <Text style={styles.seeAllLink}>Who owes whom</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.card}>
            {balances.map((b) => {
              const name = memberNameMap.get(b.user_id) || 'Member';
              const status = formatNetBalance(b.net_paise);
              return (
                <View key={b.user_id} style={styles.memberBalanceRow}>
                  <Text style={styles.memberName}>{name}</Text>
                  <Text style={[styles.memberBalanceText, { color: status.color }]}>
                    {status.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Recent Expenses */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Recent Expenses</Text>
            <TouchableOpacity onPress={() => router.push(`/(app)/group/${groupId}/expenses` as any)}>
              <Text style={styles.seeAllLink}>See all ({expenses.length})</Text>
            </TouchableOpacity>
          </View>

          {expenses.slice(0, 5).map((exp) => (
            <TouchableOpacity
              key={exp.id}
              style={styles.expenseItem}
              onPress={() => router.push(`/(app)/group/${groupId}/expense/${exp.id}` as any)}
            >
              <View style={styles.expenseInfo}>
                <Text style={styles.expenseTitle}>{exp.title}</Text>
                <Text style={styles.expenseSub}>
                  Paid by {memberNameMap.get(exp.paid_by) || 'Member'} • {exp.expense_date}
                </Text>
              </View>
              <View style={styles.expenseAmountCol}>
                <Text style={styles.expenseAmount}>{paiseToRupees(exp.total_paise)}</Text>
                <ChevronRight size={16} color="#64748B" />
              </View>
            </TouchableOpacity>
          ))}

          {expenses.length === 0 && (
            <View style={styles.emptyExpenses}>
              <Text style={styles.emptyExpensesText}>No expenses added yet.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  notFoundContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  notFoundText: {
    color: '#F8FAFC',
    fontSize: 18,
    marginBottom: 12,
  },
  backLink: {
    color: '#3B82F6',
    fontSize: 15,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  backButton: {
    padding: 6,
    marginRight: 6,
  },
  headerTitleGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  groupTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    maxWidth: 160,
  },
  codeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  codeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#93C5FD',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  myBalanceCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  myBalanceLabel: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
    marginBottom: 4,
  },
  myBalanceAmount: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 2,
  },
  myBalanceSubtitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
  },
  expenseBtn: {
    backgroundColor: '#2563EB',
  },
  expenseBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  settleBtn: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  settleBtnText: {
    color: '#93C5FD',
    fontWeight: '600',
    fontSize: 14,
  },
  navGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  navCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  navCardTitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
    fontWeight: '500',
  },
  navCardCount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
    marginTop: 2,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  seeAllLink: {
    fontSize: 13,
    color: '#3B82F6',
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  memberBalanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#0F172A',
  },
  memberName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#F8FAFC',
  },
  memberBalanceText: {
    fontSize: 13,
    fontWeight: '600',
  },
  expenseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  expenseInfo: {
    flex: 1,
  },
  expenseTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F8FAFC',
    marginBottom: 2,
  },
  expenseSub: {
    fontSize: 12,
    color: '#94A3B8',
  },
  expenseAmountCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  expenseAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  emptyExpenses: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyExpensesText: {
    color: '#64748B',
    fontSize: 14,
  },
});
