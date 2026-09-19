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
import { useGroupBalances } from '../../../../src/hooks/useGroupBalances';
import { SettlementsRepo } from '../../../../src/repositories/settlements.repo';
import { GroupsRepo } from '../../../../src/repositories/groups.repo';
import { useAuthStore } from '../../../../src/stores/auth.store';
import { paiseToRupees } from '../../../../src/engine/currency';
import { triggerSync } from '../../../../src/sync/engine';
import { ArrowRight, Plus, Trash2, CheckCircle } from 'lucide-react-native';

export default function GroupSettlementsScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const currentUserId = useAuthStore((s) => s.userId);

  const members = GroupsRepo.listMembers(groupId);
  const { suggestions } = useGroupBalances(groupId);
  const settlements = SettlementsRepo.listSettlements(groupId, false);

  const memberNameMap = new Map<string, string>();
  members.forEach((m) => {
    memberNameMap.set(m.user_id, m.display_name || m.email?.split('@')[0] || 'Member');
  });

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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Debt Simplification / Suggested Transfers */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Suggested Settlements</Text>
        <Text style={styles.sectionSubtitle}>
          Minimum number of transfers to clear all debts in the group.
        </Text>

        <View style={styles.card}>
          {suggestions.map((s, idx) => {
            const debtorName = memberNameMap.get(s.from_user_id) || 'Debtor';
            const creditorName = memberNameMap.get(s.to_user_id) || 'Creditor';
            return (
              <View key={idx} style={styles.suggestionRow}>
                <View style={styles.parties}>
                  <Text style={styles.debtorText}>{debtorName}</Text>
                  <ArrowRight size={14} color="#94A3B8" />
                  <Text style={styles.creditorText}>{creditorName}</Text>
                </View>
                <Text style={styles.suggestionAmount}>
                  {paiseToRupees(s.amount_paise)}
                </Text>
              </View>
            );
          })}

          {suggestions.length === 0 && (
            <View style={styles.allSettled}>
              <CheckCircle size={24} color="#10B981" />
              <Text style={styles.allSettledText}>All group balances are settled!</Text>
            </View>
          )}
        </View>
      </View>

      {/* Record Settlement Button */}
      <TouchableOpacity
        style={styles.recordButton}
        onPress={() => router.push(`/(app)/group/${groupId}/new-settlement` as any)}
      >
        <Plus size={18} color="#FFFFFF" />
        <Text style={styles.recordButtonText}>Record a Settlement</Text>
      </TouchableOpacity>

      {/* Past Recorded Settlements */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Settlement History</Text>
        {settlements.map((s) => {
          const fromName = memberNameMap.get(s.from_user_id) || 'Debtor';
          const toName = memberNameMap.get(s.to_user_id) || 'Creditor';
          return (
            <View key={s.id} style={styles.historyCard}>
              <View style={styles.historyInfo}>
                <Text style={styles.historyTitle}>
                  {fromName} paid {toName}
                </Text>
                <Text style={styles.historyMethod}>
                  Method: {s.payment_method.toUpperCase()}
                  {s.note ? ` • "${s.note}"` : ''}
                </Text>
              </View>
              <View style={styles.historyRight}>
                <Text style={styles.historyAmount}>{paiseToRupees(s.amount_paise)}</Text>
                <TouchableOpacity
                  onPress={() => handleVoidSettlement(s.id)}
                  style={styles.voidIconBtn}
                >
                  <Trash2 size={16} color="#64748B" />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {settlements.length === 0 && (
          <View style={styles.emptyHistory}>
            <Text style={styles.emptyHistoryText}>No settlements recorded yet.</Text>
          </View>
        )}
      </View>
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
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  suggestionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#0F172A',
  },
  parties: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  debtorText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  creditorText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  suggestionAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#3B82F6',
  },
  allSettled: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  allSettledText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 24,
  },
  recordButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
  historyCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  historyInfo: {
    flex: 1,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F8FAFC',
    marginBottom: 2,
  },
  historyMethod: {
    fontSize: 12,
    color: '#94A3B8',
  },
  historyRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  historyAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#10B981',
  },
  voidIconBtn: {
    padding: 4,
  },
  emptyHistory: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyHistoryText: {
    color: '#64748B',
    fontSize: 14,
  },
});
