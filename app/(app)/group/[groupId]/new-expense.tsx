import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { GroupsRepo } from '../../../../src/repositories/groups.repo';
import { CategoriesRepo } from '../../../../src/repositories/categories.repo';
import { ExpensesRepo } from '../../../../src/repositories/expenses.repo';
import { useAuthStore } from '../../../../src/stores/auth.store';
import { rupeesToPaise, paiseToRupees } from '../../../../src/engine/currency';
import { equalSplit, customSplit } from '../../../../src/engine/split-math';
import { SplitTypeSelector } from '../../../../src/components/expenses/SplitTypeSelector';
import { triggerSync } from '../../../../src/sync/engine';
import type { SplitType } from '../../../../src/types/models';
import { Check, Calendar } from 'lucide-react-native';

export default function NewExpenseScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const currentUserId = useAuthStore((s) => s.userId);

  const members = GroupsRepo.listMembers(groupId);
  const categories = CategoriesRepo.listActiveCategories(groupId);

  const [title, setTitle] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [paidBy, setPaidBy] = useState(currentUserId || members[0]?.user_id || '');
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);

  // Selected participants for equal split (default all)
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>(
    members.map((m) => m.user_id),
  );

  // Custom split allocations map (user_id -> string amount)
  const [customAllocations, setCustomAllocations] = useState<Record<string, string>>({});

  const toggleParticipant = (userId: string) => {
    if (selectedParticipants.includes(userId)) {
      if (selectedParticipants.length === 1) {
        Alert.alert('Error', 'At least one participant must be included');
        return;
      }
      setSelectedParticipants(selectedParticipants.filter((id) => id !== userId));
    } else {
      setSelectedParticipants([...selectedParticipants, userId]);
    }
  };

  const handleSave = () => {
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Please enter an expense title');
      return;
    }

    let totalPaise = 0;
    try {
      totalPaise = rupeesToPaise(amountStr);
    } catch (err: unknown) {
      Alert.alert('Validation Error', err instanceof Error ? err.message : 'Invalid amount');
      return;
    }

    let splits: Array<{ participant_id: string; owed_paise: number }> = [];

    try {
      if (splitType === 'equal') {
        if (selectedParticipants.length === 0) {
          Alert.alert('Validation Error', 'Select at least one participant');
          return;
        }
        splits = equalSplit(totalPaise, selectedParticipants);
      } else {
        // Custom split
        const allocations = members.map((m) => {
          const valStr = customAllocations[m.user_id] || '0';
          const owedPaise = valStr.trim() ? rupeesToPaise(valStr) : 0;
          return { participant_id: m.user_id, owed_paise: owedPaise };
        });

        splits = customSplit(totalPaise, allocations);
      }
    } catch (err: unknown) {
      Alert.alert('Split Error', err instanceof Error ? err.message : 'Invalid split configuration');
      return;
    }

    try {
      const expenseId = Crypto.randomUUID();
      ExpensesRepo.createExpenseAtomic(
        {
          id: expenseId,
          group_id: groupId,
          category_id: categoryId || undefined,
          title: title.trim(),
          notes: notes.trim() || undefined,
          total_paise: totalPaise,
          paid_by: paidBy,
          split_type: splitType,
          expense_date: expenseDate,
          created_by: currentUserId || paidBy,
        },
        splits,
        currentUserId || paidBy,
      );

      // Trigger sync in background
      triggerSync().catch(console.warn);

      router.back();
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save expense');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        {/* Title and Amount */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Expense Details</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Dinner at Fisherman's Wharf"
              placeholderTextColor="#64748B"
              maxLength={200}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Total Amount (₹)</Text>
            <TextInput
              style={[styles.input, styles.amountInput]}
              value={amountStr}
              onChangeText={setAmountStr}
              placeholder="0.00"
              placeholderTextColor="#64748B"
              keyboardType="decimal-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Date</Text>
            <View style={styles.dateInputWrapper}>
              <Calendar size={16} color="#64748B" />
              <TextInput
                style={styles.dateInput}
                value={expenseDate}
                onChangeText={setExpenseDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#64748B"
              />
            </View>
          </View>
        </View>

        {/* Payer Selection */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Paid By</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
            {members.map((m) => {
              const isSelected = paidBy === m.user_id;
              const name = m.display_name || m.email?.split('@')[0] || 'Member';
              return (
                <TouchableOpacity
                  key={m.user_id}
                  style={[styles.pill, isSelected && styles.pillSelected]}
                  onPress={() => setPaidBy(m.user_id)}
                >
                  <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                    {name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Split Type and Configuration */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Split Method</Text>
          <SplitTypeSelector value={splitType} onChange={setSplitType} />

          {splitType === 'equal' ? (
            <View style={styles.splitList}>
              <Text style={styles.subHeader}>Select participants to split equally:</Text>
              {members.map((m) => {
                const isChecked = selectedParticipants.includes(m.user_id);
                const name = m.display_name || m.email?.split('@')[0] || 'Member';
                return (
                  <TouchableOpacity
                    key={m.user_id}
                    style={styles.checkboxRow}
                    onPress={() => toggleParticipant(m.user_id)}
                  >
                    <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                      {isChecked && <Check size={14} color="#FFFFFF" />}
                    </View>
                    <Text style={styles.participantName}>{name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.splitList}>
              <Text style={styles.subHeader}>Specify exact amount per person (₹):</Text>
              {members.map((m) => {
                const name = m.display_name || m.email?.split('@')[0] || 'Member';
                return (
                  <View key={m.user_id} style={styles.customSplitRow}>
                    <Text style={styles.customMemberName}>{name}</Text>
                    <TextInput
                      style={styles.customAmountInput}
                      value={customAllocations[m.user_id] || ''}
                      onChangeText={(val) =>
                        setCustomAllocations({ ...customAllocations, [m.user_id]: val })
                      }
                      placeholder="0.00"
                      placeholderTextColor="#64748B"
                      keyboardType="decimal-pad"
                    />
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Category Picker (if any) */}
        {categories.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardHeader}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
              <TouchableOpacity
                style={[styles.pill, categoryId === null && styles.pillSelected]}
                onPress={() => setCategoryId(null)}
              >
                <Text style={[styles.pillText, categoryId === null && styles.pillTextSelected]}>
                  General
                </Text>
              </TouchableOpacity>
              {categories.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.pill, categoryId === c.id && styles.pillSelected]}
                  onPress={() => setCategoryId(c.id)}
                >
                  <Text style={[styles.pillText, categoryId === c.id && styles.pillTextSelected]}>
                    {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Save Button */}
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save Expense</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: '#E2E8F0',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#F8FAFC',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#334155',
  },
  amountInput: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3B82F6',
  },
  dateInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  dateInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 15,
  },
  pillRow: {
    gap: 8,
    paddingVertical: 4,
  },
  pill: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  pillSelected: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  pillText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
  },
  pillTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  splitList: {
    marginTop: 14,
  },
  subHeader: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 10,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#0F172A',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#64748B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  participantName: {
    fontSize: 15,
    color: '#F8FAFC',
    fontWeight: '500',
  },
  customSplitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  customMemberName: {
    fontSize: 15,
    color: '#F8FAFC',
    flex: 1,
  },
  customAmountInput: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#F8FAFC',
    fontSize: 15,
    width: 120,
    textAlign: 'right',
    borderWidth: 1,
    borderColor: '#334155',
  },
  saveButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
