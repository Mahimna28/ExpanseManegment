import { useState, useEffect, useCallback } from 'react';
import { ExpensesRepo } from '../repositories/expenses.repo';
import { useSyncStore } from '../stores/sync.store';
import type { Expense } from '../types/models';

export function useGroupExpenses(groupId: string, includeVoided = false) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const dbVersion = useSyncStore((state) => state.dbVersion);

  const loadExpenses = useCallback(() => {
    try {
      const data = ExpensesRepo.listExpenses(groupId, includeVoided);
      setExpenses(data);
    } catch {
      setExpenses([]);
    }
  }, [groupId, includeVoided]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses, dbVersion]);

  return { expenses, refresh: loadExpenses };
}
