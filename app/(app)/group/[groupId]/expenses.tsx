import React, { useState } from 'react';
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
import { useGroupExpenses } from '../../../../src/hooks/useGroupExpenses';
import { GroupsRepo } from '../../../../src/repositories/groups.repo';
import { paiseToRupees } from '../../../../src/engine/currency';
import { Search, ChevronRight, Plus } from 'lucide-react-native';
import type { Expense } from '../../../../src/types/models';

export default function GroupExpensesScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [includeVoided, setIncludeVoided] = useState(false);

  const { expenses } = useGroupExpenses(groupId, includeVoided);
  const members = GroupsRepo.listMembers(groupId);

  const memberNameMap = new Map<string, string>();
  members.forEach((m) => {
    memberNameMap.set(m.user_id, m.display_name || m.email?.split('@')[0] || 'Member');
  });

  const filtered = expenses.filter((e) =>
    e.title.toLowerCase().includes(search.toLowerCase()),
  );

  const renderItem = ({ item }: { item: Expense }) => (
    <TouchableOpacity
      style={[styles.itemCard, item.is_voided && styles.voidedCard]}
      onPress={() => router.push(`/(app)/group/${groupId}/expense/${item.id}` as any)}
    >
      <View style={styles.itemInfo}>
        <View style={styles.titleRow}>
          <Text style={[styles.itemTitle, item.is_voided && styles.voidedText]}>
            {item.title}
          </Text>
          {item.is_voided && (
            <View style={styles.voidBadge}>
              <Text style={styles.voidBadgeText}>Voided</Text>
            </View>
          )}
        </View>
        <Text style={styles.itemSub}>
          Paid by {memberNameMap.get(item.paid_by) || 'Member'} • {item.expense_date}
        </Text>
      </View>
      <View style={styles.itemAmountCol}>
        <Text style={[styles.itemAmount, item.is_voided && styles.voidedText]}>
          {paiseToRupees(item.total_paise)}
        </Text>
        <ChevronRight size={16} color="#64748B" />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Search and Filter */}
      <View style={styles.filterBar}>
        <View style={styles.searchWrapper}>
          <Search size={16} color="#64748B" />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search expenses..."
            placeholderTextColor="#64748B"
          />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Show Voided</Text>
          <Switch
            value={includeVoided}
            onValueChange={setIncludeVoided}
            trackColor={{ false: '#334155', true: '#2563EB' }}
            thumbColor={includeVoided ? '#FFFFFF' : '#94A3B8'}
          />
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No expenses found</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push(`/(app)/group/${groupId}/new-expense` as any)}
      >
        <Plus size={24} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  filterBar: {
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  searchInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 14,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
  },
  switchLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  itemCard: {
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
  voidedCard: {
    opacity: 0.5,
  },
  itemInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  voidBadge: {
    backgroundColor: '#334155',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  voidBadgeText: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
  },
  voidedText: {
    textDecorationLine: 'line-through',
  },
  itemSub: {
    fontSize: 12,
    color: '#94A3B8',
  },
  itemAmountCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itemAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
});
