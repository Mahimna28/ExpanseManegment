import { getDatabase } from '../db/client';
import type { OutboxEntry } from '../types/models';
import { useSyncStore } from '../stores/sync.store';

export const SyncRepo = {
  getPendingMutations(): OutboxEntry[] {
    const db = getDatabase();
    return db.getAllSync<OutboxEntry>(
      `SELECT * FROM local_outbox WHERE status IN ('pending', 'syncing') ORDER BY created_at ASC`,
    );
  },

  getFailedMutations(): OutboxEntry[] {
    const db = getDatabase();
    return db.getAllSync<OutboxEntry>(
      `SELECT * FROM local_outbox WHERE status = 'failed' ORDER BY created_at DESC`,
    );
  },

  getConflictMutations(): OutboxEntry[] {
    const db = getDatabase();
    return db.getAllSync<OutboxEntry>(
      `SELECT * FROM local_outbox WHERE status = 'conflict' ORDER BY created_at DESC`,
    );
  },

  /**
   * Resets a mutation to 'pending' with retry_count = 0.
   * Preserves `last_error` for diagnostic review until a sync attempt succeeds.
   */
  retryMutation(id: number): void {
    const db = getDatabase();
    db.runSync(
      `UPDATE local_outbox SET status = 'pending', retry_count = 0 WHERE id = ?`,
      [id],
    );
    useSyncStore.getState().incrementDbVersion();
  },

  /**
   * Recovers any mutations left in 'syncing' state (e.g. after a crash or app kill)
   * by safely reverting them to 'pending'.
   */
  recoverStaleSyncingMutations(): number {
    const db = getDatabase();
    const result = db.runSync(
      `UPDATE local_outbox SET status = 'pending' WHERE status = 'syncing'`,
    );
    if (result.changes > 0) {
      useSyncStore.getState().incrementDbVersion();
    }
    return result.changes;
  },

  /**
   * Safely discards an outbox mutation and rolls back or removes any uncommitted
   * local data and dependent mutations so that unsynced phantom data does not poison the ledger.
   */
  discardMutation(id: number): void {
    const db = getDatabase();
    const entry = db.getFirstSync<OutboxEntry>(
      `SELECT * FROM local_outbox WHERE id = ?`,
      [id],
    );
    if (!entry) return;

    db.withTransactionSync(() => {
      // 1. Rollback or remove entity based on operation
      if (entry.entity_type === 'expense') {
        if (entry.operation === 'CREATE') {
          // Cascade remove dependent mutations for this uncommitted expense
          db.runSync(
            `DELETE FROM local_outbox WHERE entity_type = 'expense' AND entity_id = ?`,
            [entry.entity_id],
          );
          db.runSync(`DELETE FROM local_splits WHERE expense_id = ?`, [entry.entity_id]);
          db.runSync(`DELETE FROM local_expenses WHERE id = ?`, [entry.entity_id]);
        } else if (entry.operation === 'VOID') {
          // Revert void
          db.runSync(
            `UPDATE local_expenses SET is_voided = 0, voided_by = NULL, voided_at = NULL, sync_status = 'synced' WHERE id = ?`,
            [entry.entity_id],
          );
        } else if (entry.operation === 'UPDATE') {
          db.runSync(
            `UPDATE local_expenses SET sync_status = 'synced' WHERE id = ?`,
            [entry.entity_id],
          );
        }
      } else if (entry.entity_type === 'settlement') {
        if (entry.operation === 'CREATE') {
          db.runSync(
            `DELETE FROM local_outbox WHERE entity_type = 'settlement' AND entity_id = ?`,
            [entry.entity_id],
          );
          db.runSync(`DELETE FROM local_settlements WHERE id = ?`, [entry.entity_id]);
        } else if (entry.operation === 'VOID') {
          // Revert void
          db.runSync(
            `UPDATE local_settlements SET is_voided = 0, voided_by = NULL, voided_at = NULL, sync_status = 'synced' WHERE id = ?`,
            [entry.entity_id],
          );
        }
      }

      // 2. Delete the mutation itself
      db.runSync(`DELETE FROM local_outbox WHERE id = ?`, [id]);
    });

    useSyncStore.getState().incrementDbVersion();
  },
};
