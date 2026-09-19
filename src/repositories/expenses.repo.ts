import * as Crypto from 'expo-crypto';
import { getDatabase } from '../db/client';
import type { Expense, ExpenseSplit } from '../types/models';
import { useSyncStore } from '../stores/sync.store';

export const ExpensesRepo = {
  listExpenses(groupId: string, includeVoided = false): Expense[] {
    const db = getDatabase();
    const query = includeVoided
      ? `SELECT * FROM local_expenses WHERE group_id = ? ORDER BY expense_date DESC, created_at DESC`
      : `SELECT * FROM local_expenses WHERE group_id = ? AND is_voided = 0 ORDER BY expense_date DESC, created_at DESC`;

    const expenses = db.getAllSync<Expense>(query, [groupId]);

    // Attach splits
    for (const exp of expenses) {
      exp.is_voided = Boolean(exp.is_voided);
      exp.splits = db.getAllSync<ExpenseSplit>(
        `SELECT * FROM local_splits WHERE expense_id = ?`,
        [exp.id],
      );
    }
    return expenses;
  },

  getExpenseById(id: string): Expense | null {
    const db = getDatabase();
    const exp = db.getFirstSync<Expense>(
      `SELECT * FROM local_expenses WHERE id = ?`,
      [id],
    );
    if (!exp) return null;

    exp.is_voided = Boolean(exp.is_voided);
    exp.splits = db.getAllSync<ExpenseSplit>(
      `SELECT * FROM local_splits WHERE expense_id = ?`,
      [id],
    );
    return exp;
  },

  /**
   * Creates an expense and its splits locally and writes a CREATE mutation
   * to local_outbox in a single atomic transaction.
   */
  createExpenseAtomic(
    expense: Omit<Expense, 'is_voided' | 'server_version' | 'sync_status' | 'created_at' | 'updated_at'>,
    splits: Array<{ participant_id: string; owed_paise: number }>,
    actorId: string,
  ): Expense {
    const db = getDatabase();
    const now = new Date().toISOString();
    const mutationId = Crypto.randomUUID();

    const createdExpense: Expense = {
      ...expense,
      is_voided: false,
      server_version: 0,
      sync_status: 'pending',
      created_at: now,
      updated_at: now,
      splits: splits.map((s) => ({
        id: Crypto.randomUUID(),
        expense_id: expense.id,
        participant_id: s.participant_id,
        owed_paise: s.owed_paise,
      })),
    };

    const outboxPayload = {
      p_mutation_id: mutationId,
      p_expense_id: expense.id,
      p_group_id: expense.group_id,
      p_category_id: expense.category_id ?? null,
      p_title: expense.title,
      p_notes: expense.notes ?? null,
      p_total_paise: expense.total_paise,
      p_paid_by: expense.paid_by,
      p_split_type: expense.split_type,
      p_expense_date: expense.expense_date,
      p_splits: createdExpense.splits,
    };

    db.withTransactionSync(() => {
      // 1. Insert local expense
      db.runSync(
        `INSERT INTO local_expenses (
           id, group_id, category_id, title, notes, total_paise, paid_by,
           split_type, expense_date, is_voided, server_version, sync_status,
           created_by, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'pending', ?, ?, ?)`,
        [
          createdExpense.id,
          createdExpense.group_id,
          createdExpense.category_id ?? null,
          createdExpense.title,
          createdExpense.notes ?? null,
          createdExpense.total_paise,
          createdExpense.paid_by,
          createdExpense.split_type,
          createdExpense.expense_date,
          actorId,
          createdExpense.created_at,
          createdExpense.updated_at,
        ],
      );

      // 2. Insert splits
      for (const split of createdExpense.splits!) {
        db.runSync(
          `INSERT INTO local_splits (id, expense_id, participant_id, owed_paise)
           VALUES (?, ?, ?, ?)`,
          [split.id, split.expense_id, split.participant_id, split.owed_paise],
        );
      }

      // 3. Insert into outbox
      db.runSync(
        `INSERT INTO local_outbox (
           mutation_id, group_id, entity_type, operation, entity_id,
           payload_json, base_version, status, retry_count, created_at
         ) VALUES (?, ?, 'expense', 'CREATE', ?, ?, 0, 'pending', 0, ?)`,
        [
          mutationId,
          createdExpense.group_id,
          createdExpense.id,
          JSON.stringify(outboxPayload),
          Date.now(),
        ],
      );
    });

    useSyncStore.getState().incrementDbVersion();
    return createdExpense;
  },

  /**
   * Voids an expense locally and queues a VOID mutation in the outbox atomically.
   */
  voidExpenseAtomic(expenseId: string, actorId: string): void {
    const db = getDatabase();
    const exp = this.getExpenseById(expenseId);
    if (!exp) throw new Error('Expense not found');
    if (exp.is_voided) return;

    const mutationId = Crypto.randomUUID();
    const now = new Date().toISOString();

    const outboxPayload = {
      p_mutation_id: mutationId,
      p_expense_id: expenseId,
    };

    db.withTransactionSync(() => {
      db.runSync(
        `UPDATE local_expenses
         SET is_voided = 1, voided_by = ?, voided_at = ?, sync_status = 'pending', updated_at = ?
         WHERE id = ?`,
        [actorId, now, now, expenseId],
      );

      db.runSync(
        `INSERT INTO local_outbox (
           mutation_id, group_id, entity_type, operation, entity_id,
           payload_json, base_version, status, retry_count, created_at
         ) VALUES (?, ?, 'expense', 'VOID', ?, ?, ?, 'pending', 0, ?)`,
        [
          mutationId,
          exp.group_id,
          expenseId,
          JSON.stringify(outboxPayload),
          exp.server_version,
          Date.now(),
        ],
      );
    });

    useSyncStore.getState().incrementDbVersion();
  },
};
