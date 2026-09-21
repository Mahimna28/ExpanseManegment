import React, { useMemo } from 'react';
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
import { useGroupBalances } from '../../../../src/hooks/useGroupBalances';
import { SettlementsRepo } from '../../../../src/repositories/settlements.repo';
import { GroupsRepo } from '../../../../src/repositories/groups.repo';
import { useAuthStore } from '../../../../src/stores/auth.store';
import { paiseToRupees } from '../../../../src/engine/currency';
import { triggerSync } from '../../../../src/sync/engine';
import { AppHeader, DebtFlowCard, EmptyState, Avatar } from '../../../../src/components/ui';
import { colors, spacing, typography, radii, shadows } from '../../../../src/theme';
import { Plus, ArrowRight, Trash2, CheckCircle2, ArrowRightLeft } from 'lucide-react-native';

export default function GroupSettlementsScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const currentUserId = useAuthStore((s) => s.userId);

  const members = GroupsRepo.listMembers(groupId);
  const { suggestions } = useGroupBalances(groupId);
  const settlements = SettlementsRepo.listSettlements(groupId, false);

  const memberNameMap = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((m) => {
      map.set(m.user_id, m.display_name || m.email?.split('@')[0] || 'Member');
    });
    return map;
  }, [members]);

  const handleVoidSettlement = (settlementId: string) => {
    Alert.alert(
      'Void Settlement',
      'Are you sure you want to void this settlement? Balances will be recalculated.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Void Settlement',
          style: 'destructive',
          onPress: () => {
            try {
              SettlementsRepo.voidSettlementAtomic(settlementId, currentUserId || '');
              triggerSync().catch(console.warn);
            } catch (err: unknown) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Could not void settlement');
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.root}>
      <AppHeader
        title="Settlements"
        showBack
        onBack={() => router.back()}
        rightAction={
          <TouchableOpacity
            onPress={() =>
              router.push(`/(app)/group/${groupId}/new-settlement` as any)
            }
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Plus size={22} color={colors.primary[600]} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 16 },
        ]}
      >
        {/* Section 1: Suggested Debt Transfers */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Suggested Settlements</Text>
          <Text style={styles.sectionSubtitle}>
            Minimum transfers to clear all group debts.
          </Text>
        </View>

        {suggestions.length > 0 ? (
          <View style={styles.cardsList}>
            {suggestions.map((s, idx) => {
              const fromName = memberNameMap.get(s.from_user_id) || 'Debtor';
              const toName = memberNameMap.get(s.to_user_id) || 'Creditor';
              const isMeFrom = s.from_user_id === currentUserId;
              const isMeTo = s.to_user_id === currentUserId;

              return (
                <DebtFlowCard
                  key={idx}
                  fromName={fromName}
                  toName={toName}
                  amountPaise={s.amount_paise}
                  isMeFrom={isMeFrom}
                  isMeTo={isMeTo}
                  onSettle={() =>
                    router.push({
                      pathname: `/(app)/group/${groupId}/new-settlement` as any,
                      params: {
                        fromUserId: s.from_user_id,
                        toUserId: s.to_user_id,
                        amountPaise: s.amount_paise.toString(),
                      },
                    })
                  }
                />
              );
            })}
          </View>
        ) : (
          <View style={[styles.allSettledCard, shadows.subtle]}>
            <CheckCircle2 size={32} color={colors.moneyPositive} />
            <Text style={styles.allSettledTitle}>All Balances Settled</Text>
            <Text style={styles.allSettledSub}>
              Nobody in this group owes anything right now!
            </Text>
          </View>
        )}

        {/* Section 2: Historical Settlements */}
        <View style={[styles.sectionHeader, { marginTop: spacing.md }]}>
          <Text style={styles.sectionTitle}>Settlement History</Text>
          <Text style={styles.sectionSubtitle}>
            Past payments recorded between group members.
          </Text>
        </View>

        {settlements.length > 0 ? (
          <View style={styles.historyList}>
            {settlements.map((item) => {
              const payerName = memberNameMap.get(item.from_user_id) || 'Payer';
              const recipientName = memberNameMap.get(item.to_user_id) || 'Recipient';
              return (
                <View key={item.id} style={[styles.historyCard, shadows.subtle]}>
                  <View style={styles.historyMainRow}>
                    <View style={styles.partiesCol}>
                      <View style={styles.partyRow}>
                        <Avatar name={payerName} size={24} />
                        <Text style={styles.partyName}>{payerName}</Text>
                        <ArrowRight size={14} color={colors.textSecondary} />
                        <Avatar name={recipientName} size={24} />
                        <Text style={styles.partyName}>{recipientName}</Text>
                      </View>
                      <View style={styles.historySubRow}>
                        <Text style={styles.methodBadge}>{item.payment_method.toUpperCase()}</Text>
                        <Text style={styles.historyDate}>
                          {new Date(item.created_at).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.historyRightCol}>
                      <Text style={styles.historyAmount}>
                        {paiseToRupees(item.amount_paise)}
                      </Text>
                      <TouchableOpacity
                        style={styles.voidIconBtn}
                        onPress={() => handleVoidSettlement(item.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Trash2 size={16} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {item.note && (
                    <Text style={styles.historyNote}>"{item.note}"</Text>
                  )}
                </View>
              );
            })}
          </View>
        ) : (
          <EmptyState
            icon={<ArrowRightLeft size={32} color={colors.textMuted} />}
            title="No Settlements Recorded"
            description="When members pay each other back, tap '+ Record Payment' above to log the settlement."
          />
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
    gap: spacing.sm,
  },
  sectionHeader: {
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  cardsList: {
    gap: spacing.sm,
  },
  allSettledCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: 6,
  },
  allSettledTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 6,
  },
  allSettledSub: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  historyList: {
    gap: spacing.sm,
  },
  historyCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: spacing.xs,
  },
  historyMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  partiesCol: {
    flex: 1,
    gap: 6,
  },
  partyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  partyName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  historySubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  methodBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary[600],
    backgroundColor: colors.surfaceSelected,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  historyDate: {
    fontSize: 11,
    color: colors.textMuted,
  },
  historyRightCol: {
    alignItems: 'flex-end',
    gap: 6,
  },
  historyAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.moneyPositive,
  },
  voidIconBtn: {
    padding: 2,
  },
  historyNote: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
});
