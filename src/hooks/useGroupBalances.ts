import { useState, useEffect, useCallback } from 'react';
import { ExpensesRepo } from '../repositories/expenses.repo';
import { SettlementsRepo } from '../repositories/settlements.repo';
import { GroupsRepo } from '../repositories/groups.repo';
import { calculateNetBalances, getSortedBalances, simplifyDebts } from '../engine/debt-graph';
import { useSyncStore } from '../stores/sync.store';
import type { MemberBalance, DebtSuggestion } from '../types/models';

export function useGroupBalances(groupId: string) {
  const [balances, setBalances] = useState<MemberBalance[]>([]);
  const [suggestions, setSuggestions] = useState<DebtSuggestion[]>([]);
  const [netMap, setNetMap] = useState<Map<string, number>>(new Map());
  const dbVersion = useSyncStore((state) => state.dbVersion);

  const calculate = useCallback(() => {
    try {
      const members = GroupsRepo.listMembers(groupId);
      const memberIds = members.map((m) => m.user_id);
      const expenses = ExpensesRepo.listExpenses(groupId, false); // non-voided only
      const settlements = SettlementsRepo.listSettlements(groupId, false); // non-voided only

      const computedNetMap = calculateNetBalances(memberIds, expenses, settlements);
      const sortedBalances = getSortedBalances(computedNetMap);
      const simplified = simplifyDebts(computedNetMap);

      setNetMap(computedNetMap);
      setBalances(sortedBalances);
      setSuggestions(simplified);
    } catch {
      setNetMap(new Map());
      setBalances([]);
      setSuggestions([]);
    }
  }, [groupId]);

  useEffect(() => {
    calculate();
  }, [calculate, dbVersion]);

  return { balances, suggestions, netMap, refresh: calculate };
}
