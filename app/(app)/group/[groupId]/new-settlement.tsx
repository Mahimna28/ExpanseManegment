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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Crypto from 'expo-crypto';
import { GroupsRepo } from '../../../../src/repositories/groups.repo';
import { SettlementsRepo } from '../../../../src/repositories/settlements.repo';
import { useAuthStore } from '../../../../src/stores/auth.store';
import { rupeesToPaise, paiseToRupees } from '../../../../src/engine/currency';
import { triggerSync } from '../../../../src/sync/engine';
import { AppHeader, PrimaryButton, Avatar } from '../../../../src/components/ui';
import { colors, spacing, typography, radii, shadows } from '../../../../src/theme';
import type { PaymentMethod } from '../../../../src/types/models';
import { ArrowRight, Check, ArrowRightLeft, Receipt, CheckCircle2, HelpCircle } from 'lucide-react-native';

const PAYMENT_METHODS: { id: PaymentMethod; label: string; icon: any }[] = [
  { id: 'upi', label: 'UPI', icon: ArrowRightLeft },
  { id: 'cash', label: 'Cash', icon: Receipt },
  { id: 'bank_transfer', label: 'Bank Transfer', icon: CheckCircle2 },
  { id: 'other', label: 'Other', icon: HelpCircle },
];

export default function NewSettlementScreen() {
  const { groupId, fromUserId: queryFrom, toUserId: queryTo, amountPaise: queryPaise } =
    useLocalSearchParams<{
      groupId: string;
      fromUserId?: string;
      toUserId?: string;
      amountPaise?: string;
    }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const currentUserId = useAuthStore((s) => s.userId);

  const members = GroupsRepo.listMembers(groupId);

  const defaultFrom = queryFrom || currentUserId || members[0]?.user_id || '';
  const defaultTo = queryTo || members.find((m) => m.user_id !== defaultFrom)?.user_id || '';
  const defaultAmountStr = queryPaise ? paiseToRupees(parseInt(queryPaise, 10)).replace('₹', '').trim() : '';

  const [fromUserId, setFromUserId] = useState(defaultFrom);
  const [toUserId, setToUserId] = useState(defaultTo);
  const [amountStr, setAmountStr] = useState(defaultAmountStr);
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
      if (amountPaise <= 0) throw new Error('Amount must be greater than ₹0');
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

  const payerName = members.find((m) => m.user_id === fromUserId)?.display_name || 'Payer';
  const recipientName = members.find((m) => m.user_id === toUserId)?.display_name || 'Recipient';

  return (
    <View style={styles.root}>
      <AppHeader
        title="Record Payment"
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
          {/* Transfer Summary Visual Banner */}
          <View style={[styles.transferFlowCard, shadows.subtle]}>
            <View style={styles.transferPartyCol}>
              <Avatar name={payerName} size={44} />
              <Text style={styles.transferPartyName} numberOfLines={1}>
                {payerName}
              </Text>
              <Text style={styles.transferPartySub}>Paid</Text>
            </View>

            <View style={styles.transferArrowWrapper}>
              <View style={styles.transferArrowCircle}>
                <ArrowRight size={18} color={colors.primary[600]} />
              </View>
              <Text style={styles.transferArrowLabel}>Transfers to</Text>
            </View>

            <View style={styles.transferPartyCol}>
              <Avatar name={recipientName} size={44} />
              <Text style={styles.transferPartyName} numberOfLines={1}>
                {recipientName}
              </Text>
              <Text style={styles.transferPartySub}>Received</Text>
            </View>
          </View>

          {/* Amount Input Card */}
          <View style={[styles.card, shadows.subtle]}>
            <Text style={styles.cardLabel}>Amount Settled</Text>
            <View style={styles.amountInputRow}>
              <Text style={styles.currencySymbol}>₹</Text>
              <TextInput
                style={styles.amountInput}
                value={amountStr}
                onChangeText={setAmountStr}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                autoFocus={!defaultAmountStr}
              />
            </View>
          </View>

          {/* Payer Selector */}
          <View style={[styles.card, shadows.subtle]}>
            <Text style={styles.cardTitle}>Who Paid?</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.memberPillRow}
            >
              {members.map((m) => {
                const isSelected = fromUserId === m.user_id;
                const name = m.display_name || m.email?.split('@')[0] || 'Member';
                return (
                  <TouchableOpacity
                    key={m.user_id}
                    style={[
                      styles.memberPill,
                      isSelected && styles.memberPillSelected,
                    ]}
                    onPress={() => {
                      setFromUserId(m.user_id);
                      if (toUserId === m.user_id) {
                        const next = members.find((x) => x.user_id !== m.user_id);
                        if (next) setToUserId(next.user_id);
                      }
                    }}
                  >
                    <Avatar name={name} size={26} />
                    <Text
                      style={[
                        styles.memberPillText,
                        isSelected && styles.memberPillTextSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {name}
                    </Text>
                    {isSelected && (
                      <View style={styles.checkCircle}>
                        <Check size={10} color="#FFFFFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Recipient Selector */}
          <View style={[styles.card, shadows.subtle]}>
            <Text style={styles.cardTitle}>Who Received?</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.memberPillRow}
            >
              {members.map((m) => {
                const isSelected = toUserId === m.user_id;
                const isPayer = fromUserId === m.user_id;
                const name = m.display_name || m.email?.split('@')[0] || 'Member';
                return (
                  <TouchableOpacity
                    key={m.user_id}
                    disabled={isPayer}
                    style={[
                      styles.memberPill,
                      isSelected && styles.memberPillSelected,
                      isPayer && styles.memberPillDisabled,
                    ]}
                    onPress={() => setToUserId(m.user_id)}
                  >
                    <Avatar name={name} size={26} />
                    <Text
                      style={[
                        styles.memberPillText,
                        isSelected && styles.memberPillTextSelected,
                        isPayer && styles.memberPillTextDisabled,
                      ]}
                      numberOfLines={1}
                    >
                      {name}
                    </Text>
                    {isSelected && (
                      <View style={styles.checkCircle}>
                        <Check size={10} color="#FFFFFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Payment Method Selector */}
          <View style={[styles.card, shadows.subtle]}>
            <Text style={styles.cardTitle}>Payment Method</Text>
            <View style={styles.methodGrid}>
              {PAYMENT_METHODS.map((pm) => {
                const isSelected = paymentMethod === pm.id;
                const IconComponent = pm.icon;
                return (
                  <TouchableOpacity
                    key={pm.id}
                    style={[
                      styles.methodCard,
                      isSelected && styles.methodCardSelected,
                    ]}
                    onPress={() => setPaymentMethod(pm.id)}
                  >
                    <IconComponent
                      size={20}
                      color={isSelected ? colors.primary[600] : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.methodLabel,
                        isSelected && styles.methodLabelSelected,
                      ]}
                    >
                      {pm.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Optional Note */}
          <View style={[styles.card, shadows.subtle]}>
            <Text style={styles.cardTitle}>Reference / Note (Optional)</Text>
            <TextInput
              style={styles.notesInput}
              value={note}
              onChangeText={setNote}
              placeholder="e.g. Google Pay transaction ID, cash handover"
              placeholderTextColor={colors.textMuted}
              maxLength={200}
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
            label={`Confirm Settlement ${amountStr.trim() ? `(₹${amountStr})` : ''}`}
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
  transferFlowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  transferPartyCol: {
    alignItems: 'center',
    flex: 1,
  },
  transferPartyName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 6,
    textAlign: 'center',
  },
  transferPartySub: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  transferArrowWrapper: {
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  transferArrowCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceSelected,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  transferArrowLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
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
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  memberPillRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: 2,
  },
  memberPill: {
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
  memberPillSelected: {
    backgroundColor: colors.surfaceSelected,
    borderColor: colors.primary[600],
  },
  memberPillDisabled: {
    opacity: 0.4,
  },
  memberPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  memberPillTextSelected: {
    color: colors.primary[600],
  },
  memberPillTextDisabled: {
    color: colors.textMuted,
  },
  checkCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  methodCard: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surfaceElevated,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  methodCardSelected: {
    backgroundColor: colors.surfaceSelected,
    borderColor: colors.primary[600],
  },
  methodLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  methodLabelSelected: {
    color: colors.primary[600],
  },
  notesInput: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
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
