import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Switch,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGroupExpenses } from '../../../../src/hooks/useGroupExpenses';
import { GroupsRepo } from '../../../../src/repositories/groups.repo';
import { useAuthStore } from '../../../../src/stores/auth.store';
import { CategoriesRepo } from '../../../../src/repositories/categories.repo';
import { paiseToRupees } from '../../../../src/engine/currency';
import { AppHeader, ExpenseCard, EmptyState } from '../../../../src/components/ui';
import { colors, spacing, typography, radii, shadows } from '../../../../src/theme';
import { Search, Plus, Receipt } from 'lucide-react-native';
import type { Expense } from '../../../../src/types/models';

export default function GroupExpensesScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const currentUserId = useAuthStore((s) => s.userId);

  const [search, setSearch] = useState('');
  const [includeVoided, setIncludeVoided] = useState(false);

  const { expenses } = useGroupExpenses(groupId, includeVoided);
  const members = GroupsRepo.listMembers(groupId);
  const categories = CategoriesRepo.listActiveCategories(groupId);

  const memberNameMap = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((m) => {
      map.set(m.user_id, m.display_name || m.email?.split('@')[0] || 'Member');
    });
    return map;
  }, [members]);

  const categoryNameMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => {
      map.set(c.id, c.name);
    });
    return map;
  }, [categories]);

  const filtered = useMemo(() => {
    if (!search.trim()) return expenses;
    const query = search.toLowerCase();
    return expenses.filter(
      (e) =>
        e.title.toLowerCase().includes(query) ||
        (memberNameMap.get(e.paid_by) || '').toLowerCase().includes(query),
    );
  }, [expenses, search, memberNameMap]);

  return (
    <View style={styles.root}>
      <AppHeader
        title="Expenses"
        showBack
        onBack={() => router.back()}
        rightAction={
          <TouchableOpacity
            onPress={() => router.push(`/(app)/group/${groupId}/new-expense` as any)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Plus size={22} color={colors.primary[600]} />
          </TouchableOpacity>
        }
      />

      {/* Search & Filter Header */}
      <View style={[styles.filterBar, shadows.subtle]}>
        <View style={styles.searchWrapper}>
          <Search size={16} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search by title or payer..."
            placeholderTextColor={colors.textMuted}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: '700', paddingHorizontal: 4 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.voidToggleRow}>
          <Text style={styles.voidToggleLabel}>Show Voided</Text>
          <Switch
            value={includeVoided}
            onValueChange={setIncludeVoided}
            trackColor={{ false: colors.borderSubtle, true: colors.primary[600] }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      {/* Expense List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const payerName = memberNameMap.get(item.paid_by) || 'Member';
          return (
            <ExpenseCard
              expense={item}
              payerName={payerName}
              isCurrentUserPayer={item.paid_by === currentUserId}
              onPress={() =>
                router.push(`/(app)/group/${groupId}/expense/${item.id}` as any)
              }
            />
          );
        }}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 16 },
        ]}
        ListEmptyComponent={
          <EmptyState
            icon={<Receipt size={32} color={colors.textMuted} />}
            title={search ? 'No Matching Expenses' : 'No Expenses Yet'}
            description={
              search
                ? `No expenses matching "${search}". Try clearing your search.`
                : 'Add group expenses to start tracking and splitting costs.'
            }
            action={
              search ? undefined : (
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={() => router.push(`/(app)/group/${groupId}/new-expense` as any)}
                >
                  <Text style={styles.emptyButtonText}>+ Add First Expense</Text>
                </TouchableOpacity>
              )
            }
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  filterBar: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    gap: spacing.sm,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    padding: 0,
  },
  voidToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  voidToggleLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  listContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  emptyButton: {
    marginTop: spacing.md,
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.md,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
