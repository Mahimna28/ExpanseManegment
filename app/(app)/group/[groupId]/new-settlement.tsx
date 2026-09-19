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
import { SettlementsRepo } from '../../../../src/repositories/settlements.repo';
import { useAuthStore } from '../../../../src/stores/auth.store';
import { rupeesToPaise } from '../../../../src/engine/currency';
import { triggerSync } from '../../../../src/sync/engine';
import type { PaymentMethod } from '../../../../src/types/models';

const PAYMENT_METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'upi', label: 'UPI' },
  { id: 'cash', label: 'Cash' },
  { id: 'bank_transfer', label: 'Bank Transfer' },
  { id: 'other', label: 'Other' },
];

export default function NewSettlementScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const currentUserId = useAuthStore((s) => s.userId);

  const members = GroupsRepo.listMembers(groupId);

  const [fromUserId, setFromUserId] = useState(currentUserId || members[0]?.user_id || '');
  const [toUserId, setToUserId] = useState(
    members.find((m) => m.user_id !== fromUserId)?.user_id || '',
  );
  const [amountStr, setAmountStr] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi');
  const [note, setNote] = useState('');

  const handleSave = () => {
    if (!fromUserId || !toUserId) {
      Alert.alert('Error', 'Please select both payer and recipient');
      return;
    }
    if (fromUserId === toUserId) {
      Alert.alert('Error', 'Payer and recipient cannot be the same person');
      return;
    }

    let amountPaise = 0;
    try {
      amountPaise = rupeesToPaise(amountStr);
    } catch (err: unknown) {
      Alert.alert('Validation Error', err instanceof Error ? err.message : 'Invalid amount');
      return;
    }

    try {
      const settlementId = Crypto.randomUUID();
      SettlementsRepo.createSettlementAtomic(
        {
          id: settlementId,
          group_id: groupId,
          from_user_id: fromUserId,
          to_user_id: toUserId,
          amount_paise: amountPaise,
          payment_method: paymentMethod,
          note: note.trim() || undefined,
          created_by: currentUserId || fromUserId,
        },
        currentUserId || fromUserId,
      );

      triggerSync().catch(console.warn);
      router.back();
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not save settlement');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        {/* Payer (Who sent the money) */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Payer (Who Paid)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
            {members.map((m) => {
              const isSelected = fromUserId === m.user_id;
              const name = m.display_name || m.email?.split('@')[0] || 'Member';
              return (
                <TouchableOpacity
                  key={m.user_id}
                  style={[styles.pill, isSelected && styles.pillSelected]}
                  onPress={() => {
                    setFromUserId(m.user_id);
                    if (toUserId === m.user_id) {
                      const next = members.find((x) => x.user_id !== m.user_id);
                      if (next) setToUserId(next.user_id);
                    }
                  }}
                >
                  <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                    {name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Recipient (Who received the money) */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Recipient (Who Received)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
            {members
              .filter((m) => m.user_id !== fromUserId)
              .map((m) => {
                const isSelected = toUserId === m.user_id;
                const name = m.display_name || m.email?.split('@')[0] || 'Member';
                return (
                  <TouchableOpacity
                    key={m.user_id}
                    style={[styles.pill, isSelected && styles.pillSelected]}
                    onPress={() => setToUserId(m.user_id)}
                  >
                    <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                      {name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
          </ScrollView>
        </View>

        {/* Amount & Method */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Settlement Details</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Amount (₹)</Text>
            <TextInput
              style={[styles.input, styles.amountInput]}
              value={amountStr}
              onChangeText={setAmountStr}
              placeholder="0.00"
              placeholderTextColor="#64748B"
              keyboardType="decimal-pad"
              autoFocus
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Payment Method</Text>
            <View style={styles.methodRow}>
              {PAYMENT_METHODS.map((pm) => (
                <TouchableOpacity
                  key={pm.id}
                  style={[
                    styles.methodButton,
                    paymentMethod === pm.id && styles.methodButtonSelected,
                  ]}
                  onPress={() => setPaymentMethod(pm.id)}
                >
                  <Text
                    style={[
                      styles.methodButtonText,
                      paymentMethod === pm.id && styles.methodButtonTextSelected,
                    ]}
                  >
                    {pm.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Reference Note (Optional)</Text>
            <TextInput
              style={styles.input}
              value={note}
              onChangeText={setNote}
              placeholder="e.g. GPay ref #849204"
              placeholderTextColor="#64748B"
              maxLength={200}
            />
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Record Settlement</Text>
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
    fontSize: 22,
    fontWeight: '700',
    color: '#10B981',
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
  methodRow: {
    flexDirection: 'row',
    gap: 8,
  },
  methodButton: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  methodButtonSelected: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  methodButtonText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  methodButtonTextSelected: {
    color: '#FFFFFF',
  },
  saveButton: {
    backgroundColor: '#10B981',
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
