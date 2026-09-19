import { getDatabase } from '../db/client';
import type { OutboxEntry } from '../types/models';

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

  retryMutation(id: number): void {
    const db = getDatabase();
    db.runSync(
      `UPDATE local_outbox SET status = 'pending', retry_count = 0, last_error = NULL WHERE id = ?`,
      [id],
    );
  },

  discardMutation(id: number): void {
    const db = getDatabase();
    db.runSync(`DELETE FROM local_outbox WHERE id = ?`, [id]);
  },
};
