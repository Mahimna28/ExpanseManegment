import React, { useState, useMemo } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Crypto from 'expo-crypto';
import { GroupsRepo } from '../../../../src/repositories/groups.repo';
import { CategoriesRepo } from '../../../../src/repositories/categories.repo';
import { ExpensesRepo } from '../../../../src/repositories/expenses.repo';
import { useAuthStore } from '../../../../src/stores/auth.store';
import { rupeesToPaise, paiseToRupees } from '../../../../src/engine/currency';
import { equalSplit, customSplit } from '../../../../src/engine/split-math';
import { SplitTypeSelector } from '../../../../src/components/expenses/SplitTypeSelector';
import { triggerSync } from '../../../../src/sync/engine';
import { AppHeader, PrimaryButton, Avatar } from '../../../../src/components/ui';
import { colors, spacing, typography, radii, shadows } from '../../../../src/theme';
import type { SplitType } from '../../../../src/types/models';
import { Check, Calendar, Receipt, Tag, AlertCircle, CheckCircle2 } from 'lucide-react-native';

export default function NewExpenseScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  // Parsed total paise
  const totalPaise = useMemo(() => {
    try {
      return amountStr.trim() ? rupeesToPaise(amountStr) : 0;
    } catch {
      return 0;
    }
  }, [amountStr]);

  // Equal split per person estimate
  const equalSplitPerPersonPaise = useMemo(() => {
    if (totalPaise <= 0 || selectedParticipants.length === 0) return 0;
    return Math.floor(totalPaise / selectedParticipants.length);
  }, [totalPaise, selectedParticipants.length]);

  // Custom split remainder tracker
  const customSumPaise = useMemo(() => {
    return members.reduce((sum, m) => {
      const valStr = customAllocations[m.user_id] || '';
      try {
        return sum + (valStr.trim() ? rupeesToPaise(valStr) : 0);
      } catch {
        return sum;
      }
    }, 0);
  }, [customAllocations, members]);

  const customDiffPaise = totalPaise - customSumPaise;

  const handleSave = () => {
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Please enter an expense title');
      return;
    }

    if (totalPaise <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid amount greater than ₹0');
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
    <View style={styles.root}>
      <AppHeader
        title="New Expense"
        showBack
        onBack={() => router.back()}
      />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 24) + 80 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero Amount Input Card */}
          <View style={[styles.card, styles.heroCard, shadows.subtle]}>
            <Text style={styles.cardLabel}>Amount</Text>
            <View style={styles.amountInputRow}>
              <Text style={styles.currencySymbol}>₹</Text>
              <TextInput
                style={styles.amountInput}
                value={amountStr}
                onChangeText={setAmountStr}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                autoFocus
              />
            </View>

            {/* Title Input */}
            <View style={styles.inputDivider} />
            <View style={styles.titleInputRow}>
              <Receipt size={18} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.titleInput}
                value={title}
                onChangeText={setTitle}
                placeholder="What was this expense for?"
                placeholderTextColor={colors.textMuted}
                maxLength={200}
              />
            </View>

            {/* Date Input */}
            <View style={styles.inputDivider} />
            <View style={styles.titleInputRow}>
              <Calendar size={18} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.titleInput}
                value={expenseDate}
                onChangeText={setExpenseDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>

          {/* Paid By Selector */}
          <View style={[styles.card, shadows.subtle]}>
            <Text style={styles.cardTitle}>Paid By</Text>
            <Text style={styles.cardSubtitle}>Select who paid for this expense</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.payerRow}
            >
              {members.map((m) => {
                const isSelected = paidBy === m.user_id;
                const name = m.display_name || m.email?.split('@')[0] || 'Member';
                return (
                  <TouchableOpacity
                    key={m.user_id}
                    style={[
                      styles.payerPill,
                      isSelected && styles.payerPillSelected,
                    ]}
                    onPress={() => setPaidBy(m.user_id)}
                  >
                    <Avatar name={name} size={28} />
                    <Text
                      style={[
                        styles.payerText,
                        isSelected && styles.payerTextSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {name}
                    </Text>
                    {isSelected && (
                      <View style={styles.payerCheckCircle}>
                        <Check size={10} color="#FFFFFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Split Method & Participants */}
          <View style={[styles.card, shadows.subtle]}>
            <Text style={styles.cardTitle}>Split Method</Text>
            <Text style={styles.cardSubtitle}>How should this bill be divided?</Text>

            <View style={styles.splitSelectorWrapper}>
              <SplitTypeSelector value={splitType} onChange={setSplitType} />
            </View>

            {splitType === 'equal' ? (
              <View style={styles.splitContent}>
                <View style={styles.splitHeaderRow}>
                  <Text style={styles.splitSectionLabel}>
                    Participants ({selectedParticipants.length} of {members.length})
                  </Text>
                  {totalPaise > 0 && selectedParticipants.length > 0 && (
                    <Text style={styles.splitLiveEstimate}>
                      ~{paiseToRupees(equalSplitPerPersonPaise)} / person
                    </Text>
                  )}
                </View>

                {members.map((m) => {
                  const isChecked = selectedParticipants.includes(m.user_id);
                  const name = m.display_name || m.email?.split('@')[0] || 'Member';
                  return (
                    <TouchableOpacity
                      key={m.user_id}
                      style={[
                        styles.participantRow,
                        isChecked && styles.participantRowChecked,
                      ]}
                      onPress={() => toggleParticipant(m.user_id)}
                    >
                      <View style={styles.participantLeft}>
                        <View
                          style={[
                            styles.checkbox,
                            isChecked && styles.checkboxChecked,
                          ]}
                        >
                          {isChecked && <Check size={12} color="#FFFFFF" />}
                        </View>
                        <Avatar name={name} size={30} />
                        <Text style={styles.participantName}>{name}</Text>
                      </View>
                      {isChecked && totalPaise > 0 && (
                        <Text style={styles.participantShare}>
                          {paiseToRupees(equalSplitPerPersonPaise)}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View style={styles.splitContent}>
                {/* Custom Split Remainder Status Banner */}
                <View
                  style={[
                    styles.remainderBanner,
                    customDiffPaise === 0
                      ? styles.remainderBannerBalanced
                      : customDiffPaise > 0
                      ? styles.remainderBannerPending
                      : styles.remainderBannerOver,
                  ]}
                >
                  {customDiffPaise === 0 ? (
                    <>
                      <CheckCircle2 size={16} color={colors.success[600]} />
                      <Text style={styles.remainderTextBalanced}>
                        Exact amounts balanced ({paiseToRupees(totalPaise)})
                      </Text>
                    </>
                  ) : customDiffPaise > 0 ? (
                    <>
                      <AlertCircle size={16} color={colors.warning[600]} />
                      <Text style={styles.remainderTextPending}>
                        {paiseToRupees(customDiffPaise)} remaining to allocate
                      </Text>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={16} color={colors.danger[600]} />
                      <Text style={styles.remainderTextOver}>
                        Allocations exceed total by {paiseToRupees(-customDiffPaise)}
                      </Text>
                    </>
                  )}
                </View>

                {members.map((m) => {
                  const name = m.display_name || m.email?.split('@')[0] || 'Member';
                  return (
                    <View key={m.user_id} style={styles.customMemberRow}>
                      <View style={styles.customMemberLeft}>
                        <Avatar name={name} size={32} />
                        <Text style={styles.customMemberName}>{name}</Text>
                      </View>
                      <View style={styles.customInputWrapper}>
                        <Text style={styles.customRupeeSymbol}>₹</Text>
                        <TextInput
                          style={styles.customAmountInput}
                          value={customAllocations[m.user_id] || ''}
                          onChangeText={(val) =>
                            setCustomAllocations({
                              ...customAllocations,
                              [m.user_id]: val,
                            })
                          }
                          placeholder="0.00"
                          placeholderTextColor={colors.textMuted}
                          keyboardType="decimal-pad"
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Category Picker (if any) */}
          {categories.length > 0 && (
            <View style={[styles.card, shadows.subtle]}>
              <Text style={styles.cardTitle}>Category</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryRow}
              >
                <TouchableOpacity
                  style={[
                    styles.categoryPill,
                    categoryId === null && styles.categoryPillSelected,
                  ]}
                  onPress={() => setCategoryId(null)}
                >
                  <Tag size={13} color={categoryId === null ? colors.primary[600] : colors.textSecondary} />
                  <Text
                    style={[
                      styles.categoryPillText,
                      categoryId === null && styles.categoryPillTextSelected,
                    ]}
                  >
                    General
                  </Text>
                </TouchableOpacity>
                {categories.map((c) => {
                  const isSelected = categoryId === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[
                        styles.categoryPill,
                        isSelected && styles.categoryPillSelected,
                      ]}
                      onPress={() => setCategoryId(c.id)}
                    >
                      <Tag size={13} color={isSelected ? colors.primary[600] : colors.textSecondary} />
                      <Text
                        style={[
                          styles.categoryPillText,
                          isSelected && styles.categoryPillTextSelected,
                        ]}
                      >
                        {c.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Optional Notes */}
          <View style={[styles.card, shadows.subtle]}>
            <Text style={styles.cardTitle}>Notes (Optional)</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add any details, receipt notes, etc."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={2}
              maxLength={300}
            />
          </View>
        </ScrollView>

        {/* Floating Bottom Save Dock */}
        <View
          style={[
            styles.bottomDock,
            { paddingBottom: Math.max(insets.bottom, 16) },
            shadows.card,
          ]}
        >
          <PrimaryButton
            label={`Save Expense ${totalPaise > 0 ? `(${paiseToRupees(totalPaise)})` : ''}`}
            onPress={handleSave}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  heroCard: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xs,
  },
  currencySymbol: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary[600],
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 36,
    fontWeight: '700',
    color: colors.textPrimary,
    padding: 0,
  },
  inputDivider: {
    height: 1,
    backgroundColor: colors.borderSubtle,
    marginVertical: spacing.sm,
  },
  titleInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  titleInput: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    padding: 0,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cardSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  payerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: 2,
  },
  payerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceElevated,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  payerPillSelected: {
    backgroundColor: colors.surfaceSelected,
    borderColor: colors.primary[600],
  },
  payerText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  payerTextSelected: {
    color: colors.primary[600],
  },
  payerCheckCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitSelectorWrapper: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  splitContent: {
    gap: spacing.xs,
  },
  splitHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  splitSectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  splitLiveEstimate: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary[600],
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
  },
  participantRowChecked: {
    backgroundColor: colors.surfaceSelected,
  },
  participantLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkboxChecked: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  participantName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  participantShare: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  remainderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
  },
  remainderBannerBalanced: {
    backgroundColor: colors.successLight,
  },
  remainderTextBalanced: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.success[600],
  },
  remainderBannerPending: {
    backgroundColor: colors.warningLight,
  },
  remainderTextPending: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.warning[600],
  },
  remainderBannerOver: {
    backgroundColor: colors.dangerLight,
  },
  remainderTextOver: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.danger[600],
  },
  customMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  customMemberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  customMemberName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  customInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    width: 110,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  customRupeeSymbol: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginRight: 4,
  },
  customAmountInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    padding: 0,
    textAlign: 'right',
  },
  categoryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  categoryPillSelected: {
    backgroundColor: colors.surfaceSelected,
    borderColor: colors.primary[600],
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  categoryPillTextSelected: {
    fontWeight: '600',
    color: colors.primary[600],
  },
  notesInput: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 13,
    color: colors.textPrimary,
    minHeight: 60,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginTop: spacing.xs,
  },
  bottomDock: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
});
