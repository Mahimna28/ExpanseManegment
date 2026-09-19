import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ExpensesRepo } from '../../../../../src/repositories/expenses.repo';
import { GroupsRepo } from '../../../../../src/repositories/groups.repo';
import { useAuthStore } from '../../../../../src/stores/auth.store';
import { paiseToRupees } from '../../../../../src/engine/currency';
import { triggerSync } from '../../../../../src/sync/engine';
import { Trash2, AlertCircle, Calendar, Tag, FileText } from 'lucide-react-native';

export default function ExpenseDetailScreen() {
  const { groupId, expenseId } = useLocalSearchParams<{ groupId: string; expenseId: string }>();
  const router = useRouter();
  const currentUserId = useAuthStore((s) => s.userId);

  const expense = ExpensesRepo.getExpenseById(expenseId);
  const members = GroupsRepo.listMembers(groupId);

  const memberNameMap = new Map<string, string>();
  members.forEach((m) => {
    memberNameMap.set(m.user_id, m.display_name || m.email?.split('@')[0] || 'Member');
  });

  if (!expense) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.notFoundText}>Expense not found</Text>
      </View>
    );
  }

  const handleVoid = () => {
    Alert.alert(
      'Void Expense',
      'Are you sure you want to void this expense? It will be removed from balances, but preserved in audit history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Void Expense',
          style: 'destructive',
          onPress: () => {
            try {
              ExpensesRepo.voidExpenseAtomic(expense.id, currentUserId || expense.paid_by);
              triggerSync().catch(console.warn);
              router.back();
            } catch (err: unknown) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Could not void expense');
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Void Notice */}
      {expense.is_voided && (
        <View style={styles.voidNotice}>
          <AlertCircle size={16} color="#EF4444" />
          <Text style={styles.voidNoticeText}>
            This expense was voided and does not affect balances.
          </Text>
        </View>
      )}

      {/* Main Header */}
      <View style={styles.card}>
        <Text style={[styles.title, expense.is_voided && styles.voidedTitle]}>
          {expense.title}
        </Text>
        <Text style={[styles.amount, expense.is_voided && styles.voidedAmount]}>
          {paiseToRupees(expense.total_paise)}
        </Text>
        <Text style={styles.paidByText}>
          Paid by <Text style={styles.paidByName}>{memberNameMap.get(expense.paid_by) || 'Member'}</Text>
        </Text>
      </View>

      {/* Metadata */}
      <View style={styles.card}>
        <View style={styles.metaRow}>
          <Calendar size={16} color="#64748B" />
          <Text style={styles.metaLabel}>Date:</Text>
          <Text style={styles.metaValue}>{expense.expense_date}</Text>
        </View>

        <View style={styles.metaRow}>
          <Tag size={16} color="#64748B" />
          <Text style={styles.metaLabel}>Split Method:</Text>
          <Text style={styles.metaValue}>
            {expense.split_type === 'equal' ? 'Equal Split' : 'Custom Split'}
          </Text>
        </View>

        {expense.notes ? (
          <View style={styles.metaRow}>
            <FileText size={16} color="#64748B" />
            <Text style={styles.metaLabel}>Notes:</Text>
            <Text style={styles.metaValue}>{expense.notes}</Text>
          </View>
        ) : null}
      </View>

      {/* Split Breakdown */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Split Breakdown</Text>
        {expense.splits?.map((split) => {
          const name = memberNameMap.get(split.participant_id) || 'Member';
          return (
            <View key={split.participant_id} style={styles.splitRow}>
              <Text style={styles.splitMemberName}>{name}</Text>
              <Text style={styles.splitAmount}>{paiseToRupees(split.owed_paise)}</Text>
            </View>
          );
        })}
      </View>

      {/* Void Action Button */}
      {!expense.is_voided && (
        <TouchableOpacity style={styles.voidButton} onPress={handleVoid}>
          <Trash2 size={16} color="#EF4444" />
          <Text style={styles.voidButtonText}>Void This Expense</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundText: {
    color: '#94A3B8',
    fontSize: 16,
  },
  voidNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#451A1A',
    borderColor: '#7F1D1D',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  voidNoticeText: {
    color: '#FCA5A5',
    fontSize: 13,
    flex: 1,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  voidedTitle: {
    textDecorationLine: 'line-through',
    color: '#94A3B8',
  },
  amount: {
    fontSize: 28,
    fontWeight: '800',
    color: '#3B82F6',
    marginBottom: 6,
  },
  voidedAmount: {
    color: '#64748B',
    textDecorationLine: 'line-through',
  },
  paidByText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  paidByName: {
    color: '#F8FAFC',
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  metaLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  metaValue: {
    fontSize: 14,
    color: '#F8FAFC',
    flex: 1,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  splitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#0F172A',
  },
  splitMemberName: {
    fontSize: 15,
    color: '#F8FAFC',
  },
  splitAmount: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  voidButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 10,
  },
  voidButtonText: {
    color: '#EF4444',
    fontWeight: '600',
    fontSize: 15,
  },
});
