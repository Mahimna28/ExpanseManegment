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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ExpensesRepo } from '../../../../../src/repositories/expenses.repo';
import { GroupsRepo } from '../../../../../src/repositories/groups.repo';
import { CategoriesRepo } from '../../../../../src/repositories/categories.repo';
import { useAuthStore } from '../../../../../src/stores/auth.store';
import { paiseToRupees } from '../../../../../src/engine/currency';
import { triggerSync } from '../../../../../src/sync/engine';
import { AppHeader, Avatar, CategoryBadge } from '../../../../../src/components/ui';
import { colors, spacing, typography, radii, shadows } from '../../../../../src/theme';
import { Trash2, AlertCircle, Calendar, Tag, Receipt, User, AlertTriangle } from 'lucide-react-native';

export default function ExpenseDetailScreen() {
  const { groupId, expenseId } = useLocalSearchParams<{ groupId: string; expenseId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const currentUserId = useAuthStore((s) => s.userId);

  const expense = ExpensesRepo.getExpenseById(expenseId);
  const members = GroupsRepo.listMembers(groupId);
  const categories = CategoriesRepo.listActiveCategories(groupId);

  const memberNameMap = new Map<string, string>();
  members.forEach((m) => {
    memberNameMap.set(m.user_id, m.display_name || m.email?.split('@')[0] || 'Member');
  });

  const categoryName = expense?.category_id
    ? categories.find((c) => c.id === expense.category_id)?.name || 'General'
    : 'General';

  if (!expense) {
    return (
      <View style={styles.root}>
        <AppHeader title="Expense Details" showBack onBack={() => router.back()} />
        <View style={styles.centerContainer}>
          <Receipt size={40} color={colors.textMuted} />
          <Text style={styles.notFoundText}>Expense not found</Text>
        </View>
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

  const payerName = memberNameMap.get(expense.paid_by) || 'Member';

  return (
    <View style={styles.root}>
      <AppHeader
        title="Expense Details"
        showBack
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 24 },
        ]}
      >
        {/* Void Notice Banner */}
        {expense.is_voided && (
          <View style={[styles.voidNoticeBanner, shadows.subtle]}>
            <AlertTriangle size={20} color={colors.danger[600]} />
            <View style={styles.voidNoticeContent}>
              <Text style={styles.voidNoticeTitle}>Expense Voided</Text>
              <Text style={styles.voidNoticeSub}>
                This expense does not count toward group balances, but remains in the audit log.
              </Text>
            </View>
          </View>
        )}

        {/* Hero Amount & Title Card */}
        <View style={[styles.heroCard, shadows.subtle]}>
          <View style={styles.heroTopRow}>
            <CategoryBadge categoryName={categoryName} size={32} />
            <Text style={styles.dateBadge}>{expense.expense_date}</Text>
          </View>

          <Text
            style={[
              styles.heroAmount,
              expense.is_voided && styles.voidedText,
            ]}
          >
            {paiseToRupees(expense.total_paise)}
          </Text>

          <Text
            style={[
              styles.heroTitle,
              expense.is_voided && styles.voidedText,
            ]}
          >
            {expense.title}
          </Text>

          <View style={styles.heroPayerRow}>
            <Avatar name={payerName} size={28} />
            <Text style={styles.heroPayerText}>
              Paid by <Text style={styles.heroPayerBold}>{payerName}</Text>
            </Text>
          </View>
        </View>

        {/* Participant Split Breakdown Card */}
        <View style={[styles.card, shadows.subtle]}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Split Breakdown</Text>
            <Text style={styles.cardSubtitle}>
              {expense.split_type === 'equal' ? 'Equal Split' : 'Custom Split'}
            </Text>
          </View>

          <View style={styles.splitsList}>
            {expense.splits && expense.splits.length > 0 ? (
              expense.splits.map((split) => {
                const pName = memberNameMap.get(split.participant_id) || 'Member';
                return (
                  <View key={split.id} style={styles.splitRow}>
                    <View style={styles.splitUserCol}>
                      <Avatar name={pName} size={32} />
                      <Text style={styles.splitUserName}>{pName}</Text>
                    </View>
                    <Text style={styles.splitAmount}>
                      {paiseToRupees(split.owed_paise)}
                    </Text>
                  </View>
                );
              })
            ) : (
              <Text style={styles.emptySplitsText}>No participant breakdown available.</Text>
            )}
          </View>
        </View>

        {/* Audit Details Card */}
        <View style={[styles.card, shadows.subtle]}>
          <Text style={styles.cardTitle}>Audit Info</Text>

          <View style={styles.metaRow}>
            <Calendar size={16} color={colors.textSecondary} />
            <Text style={styles.metaLabel}>Expense Date</Text>
            <Text style={styles.metaValue}>{expense.expense_date}</Text>
          </View>

          <View style={styles.metaRow}>
            <Tag size={16} color={colors.textSecondary} />
            <Text style={styles.metaLabel}>Category</Text>
            <Text style={styles.metaValue}>{categoryName}</Text>
          </View>

          <View style={styles.metaRow}>
            <Calendar size={16} color={colors.textSecondary} />
            <Text style={styles.metaLabel}>Recorded On</Text>
            <Text style={styles.metaValue}>
              {new Date(expense.created_at).toLocaleDateString()}
            </Text>
          </View>

          {expense.notes && (
            <View style={styles.notesBox}>
              <Text style={styles.notesLabel}>Notes</Text>
              <Text style={styles.notesText}>{expense.notes}</Text>
            </View>
          )}
        </View>

        {/* Void Button (Only if active) */}
        {!expense.is_voided && (
          <TouchableOpacity
            style={[styles.voidButton, shadows.subtle]}
            onPress={handleVoid}
          >
            <Trash2 size={18} color={colors.danger[600]} />
            <Text style={styles.voidButtonText}>Void Expense</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  notFoundText: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  voidNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.dangerLight,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  voidNoticeContent: {
    flex: 1,
  },
  voidNoticeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.danger[600],
  },
  voidNoticeSub: {
    fontSize: 12,
    color: colors.danger[600],
    marginTop: 2,
    lineHeight: 16,
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: spacing.sm,
  },
  dateBadge: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  heroAmount: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.textPrimary,
    marginVertical: spacing.xs,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  heroPayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceElevated,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: radii.full,
  },
  heroPayerText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  heroPayerBold: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: spacing.sm,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cardSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary[600],
  },
  splitsList: {
    gap: spacing.xs,
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  splitUserCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  splitUserName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  splitAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptySplitsText: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 10,
  },
  metaLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  notesBox: {
    marginTop: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  notesLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: 18,
  },
  voidedText: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
  voidButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    marginTop: spacing.sm,
  },
  voidButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.danger[600],
  },
});
