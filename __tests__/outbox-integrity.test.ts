import { SyncRepo } from '../src/repositories/sync.repo';
import { getDatabase } from '../src/db/client';

// Mock getDatabase
jest.mock('../src/db/client', () => {
  const executedStatements: { sql: string; params?: any[] }[] = [];
  let queryResults: any[] = [];
  let firstResult: any = null;

  return {
    getDatabase: jest.fn(() => ({
      withTransactionSync: (fn: () => void) => fn(),
      runSync: (sql: string, params?: any[]) => {
        executedStatements.push({ sql, params });
        return { changes: 1 };
      },
      getAllSync: () => queryResults,
      getFirstSync: () => firstResult,
      _executedStatements: executedStatements,
      _setFirstResult: (res: any) => { firstResult = res; },
      _setQueryResults: (res: any[]) => { queryResults = res; },
      _clear: () => {
        executedStatements.length = 0;
        firstResult = null;
        queryResults = [];
      },
    })),
  };
});

describe('Outbox Integrity & Recovery', () => {
  const db = (getDatabase as any)();

  beforeEach(() => {
    db._clear();
  });

  describe('recoverStaleSyncingMutations', () => {
    test('executes UPDATE reverting syncing to pending', () => {
      SyncRepo.recoverStaleSyncingMutations();
      expect(db._executedStatements).toContainEqual(
        expect.objectContaining({
          sql: `UPDATE local_outbox SET status = 'pending' WHERE status = 'syncing'`,
        }),
      );
    });
  });

  describe('retryMutation', () => {
    test('resets status to pending and retry_count to 0 while preserving last_error', () => {
      SyncRepo.retryMutation(42);
      expect(db._executedStatements).toContainEqual(
        expect.objectContaining({
          sql: `UPDATE local_outbox SET status = 'pending', retry_count = 0 WHERE id = ?`,
          params: [42],
        }),
      );
    });
  });

  describe('discardMutation', () => {
    test('discards CREATE expense: deletes splits, expenses, and dependent outbox mutations', () => {
      db._setFirstResult({
        id: 10,
        entity_type: 'expense',
        operation: 'CREATE',
        entity_id: 'exp-123',
      });

      SyncRepo.discardMutation(10);

      const sqls = db._executedStatements.map((s: any) => s.sql);

      // Should delete dependent mutations
      expect(sqls).toContain(
        `DELETE FROM local_outbox WHERE entity_type = 'expense' AND entity_id = ?`,
      );
      // Should delete splits
      expect(sqls).toContain(`DELETE FROM local_splits WHERE expense_id = ?`);
      // Should delete expense row
      expect(sqls).toContain(`DELETE FROM local_expenses WHERE id = ?`);
      // Should delete the outbox mutation itself
      expect(sqls).toContain(`DELETE FROM local_outbox WHERE id = ?`);
    });

    test('discards VOID expense: reverts is_voided to 0', () => {
      db._setFirstResult({
        id: 11,
        entity_type: 'expense',
        operation: 'VOID',
        entity_id: 'exp-456',
      });

      SyncRepo.discardMutation(11);

      const revertStmt = db._executedStatements.find((s: any) =>
        s.sql.includes('UPDATE local_expenses SET is_voided = 0'),
      );
      expect(revertStmt).toBeDefined();
      expect(revertStmt.params).toEqual(['exp-456']);
    });

    test('discards CREATE settlement: deletes settlements and outbox', () => {
      db._setFirstResult({
        id: 12,
        entity_type: 'settlement',
        operation: 'CREATE',
        entity_id: 'set-789',
      });

      SyncRepo.discardMutation(12);

      const sqls = db._executedStatements.map((s: any) => s.sql);
      expect(sqls).toContain(`DELETE FROM local_settlements WHERE id = ?`);
      expect(sqls).toContain(`DELETE FROM local_outbox WHERE id = ?`);
    });

    test('discards VOID settlement: reverts is_voided to 0', () => {
      db._setFirstResult({
        id: 13,
        entity_type: 'settlement',
        operation: 'VOID',
        entity_id: 'set-999',
      });

      SyncRepo.discardMutation(13);

      const revertStmt = db._executedStatements.find((s: any) =>
        s.sql.includes('UPDATE local_settlements SET is_voided = 0'),
      );
      expect(revertStmt).toBeDefined();
      expect(revertStmt.params).toEqual(['set-999']);
    });
  });
});
