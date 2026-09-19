/**
 * Sync Engine — Push Phase (Outbox Drain)
 *
 * Processes pending_mutations one-by-one in FIFO order.
 * Never marks a record synced until the server acknowledges.
 */

import { supabase } from '../services/supabase';
import { getDatabase } from '../db/client';
import { useSyncStore } from '../stores/sync.store';
import type { OutboxEntry } from '../types/models';

// ── Retry configuration ───────────────────────────────────────

const MAX_RETRIES = 5;
/** Backoff delays in milliseconds */
const RETRY_DELAYS_MS = [5_000, 30_000, 120_000, 600_000, 1_800_000];

/** Error codes that should NOT be retried (auth/validation failures) */
const NO_RETRY_CODES = new Set([
  'P0001', // not_authenticated
  'P0002', // not_member
  'P0007', // insufficient_role
  'P0010', // payer_not_member
  'P0011', // invalid_amount
  'P0012', // invalid_split_type
  'P0013', // negative_split
  'P0014', // participant_not_member
  'P0015', // split_sum_mismatch
  'P0017', // only_payer_can_record_settlement
  'P0018', // self_settlement
  'P0019', // recipient_not_member
  'P0021', // invalid_category_name
]);

// ── Outbox push ───────────────────────────────────────────────

export async function drainOutbox(): Promise<void> {
  const db = getDatabase();

  // Read all pending mutations ordered by creation time (FIFO)
  const pending = db.getAllSync<OutboxEntry>(
    `SELECT * FROM local_outbox WHERE status = 'pending' ORDER BY created_at ASC`,
  );

  for (const entry of pending) {
    await processMutation(db, entry);
  }

  // Update counts in sync store
  refreshPendingCount(db);
}

async function processMutation(
  db: ReturnType<typeof getDatabase>,
  entry: OutboxEntry,
): Promise<void> {
  // Mark as syncing
  db.runSync(
    `UPDATE local_outbox SET status = 'syncing' WHERE id = ?`,
    [entry.id!],
  );

  try {
    const payload = JSON.parse(entry.payload_json);
    const rpcName = getRpcName(entry.entity_type, entry.operation);

    const { data, error } = await supabase.rpc(rpcName, payload);

    if (error) {
      const errorCode = error.code || '';
      const shouldRetry = !NO_RETRY_CODES.has(errorCode);
      const newRetryCount = entry.retry_count + 1;

      if (!shouldRetry || newRetryCount >= MAX_RETRIES) {
        // Permanently failed
        db.runSync(
          `UPDATE local_outbox SET status = 'failed', last_error = ?, retry_count = ? WHERE id = ?`,
          [error.message, newRetryCount, entry.id!],
        );
        // Mirror failed status on the entity
        markEntityFailed(db, entry, error.message);
      } else {
        // Back to pending for retry
        db.runSync(
          `UPDATE local_outbox SET status = 'pending', retry_count = ?, last_error = ? WHERE id = ?`,
          [newRetryCount, error.message, entry.id!],
        );
      }
      return;
    }

    // Check for conflict response (update_expense returns {conflict: true, current: ...})
    if (data && data.conflict === true) {
      db.runSync(
        `UPDATE local_outbox SET status = 'conflict', last_error = 'Version conflict — resolve manually' WHERE id = ?`,
        [entry.id!],
      );
      markEntityConflict(db, entry, data.current);
      return;
    }

    // Success — mark synced
    markEntitySynced(db, entry, data);
    db.runSync(
      `UPDATE local_outbox SET status = 'synced' WHERE id = ?`,
      [entry.id!],
    );
  } catch (networkErr: unknown) {
    const msg = networkErr instanceof Error ? networkErr.message : String(networkErr);
    const newRetryCount = entry.retry_count + 1;

    if (newRetryCount >= MAX_RETRIES) {
      db.runSync(
        `UPDATE local_outbox SET status = 'failed', last_error = ?, retry_count = ? WHERE id = ?`,
        [msg, newRetryCount, entry.id!],
      );
      markEntityFailed(db, entry, msg);
    } else {
      db.runSync(
        `UPDATE local_outbox SET status = 'pending', retry_count = ?, last_error = ? WHERE id = ?`,
        [newRetryCount, msg, entry.id!],
      );
    }
  }
}

// ── Entity status updates ─────────────────────────────────────

function markEntitySynced(
  db: ReturnType<typeof getDatabase>,
  entry: OutboxEntry,
  serverData: Record<string, unknown>,
): void {
  if (entry.entity_type === 'expense') {
    const serverVersion = (serverData?.server_version as number) ?? 1;
    db.runSync(
      `UPDATE local_expenses SET sync_status = 'synced', server_version = ? WHERE id = ?`,
      [serverVersion, entry.entity_id],
    );
  } else if (entry.entity_type === 'settlement') {
    db.runSync(
      `UPDATE local_settlements SET sync_status = 'synced' WHERE id = ?`,
      [entry.entity_id],
    );
  }
}

function markEntityFailed(
  db: ReturnType<typeof getDatabase>,
  entry: OutboxEntry,
  error: string,
): void {
  if (entry.entity_type === 'expense') {
    db.runSync(
      `UPDATE local_expenses SET sync_status = 'failed' WHERE id = ?`,
      [entry.entity_id],
    );
  } else if (entry.entity_type === 'settlement') {
    db.runSync(
      `UPDATE local_settlements SET sync_status = 'failed' WHERE id = ?`,
      [entry.entity_id],
    );
  }
}

function markEntityConflict(
  db: ReturnType<typeof getDatabase>,
  entry: OutboxEntry,
  serverRow: unknown,
): void {
  if (entry.entity_type === 'expense') {
    db.runSync(
      `UPDATE local_expenses SET sync_status = 'conflict' WHERE id = ?`,
      [entry.entity_id],
    );
  }
  // Emit to sync store for UI — will be handled by conflict screen
  useSyncStore.getState().setPendingCount(
    ...readPendingCounts(getDatabase()),
  );
}

// ── Helpers ───────────────────────────────────────────────────

function getRpcName(entityType: string, operation: string): string {
  if (entityType === 'expense') {
    if (operation === 'CREATE') return 'create_expense';
    if (operation === 'UPDATE') return 'update_expense';
    if (operation === 'VOID') return 'void_expense';
  }
  if (entityType === 'settlement') {
    if (operation === 'CREATE') return 'create_settlement';
    if (operation === 'VOID') return 'void_settlement';
  }
  throw new Error(`Unknown RPC for ${entityType}/${operation}`);
}

function refreshPendingCount(db: ReturnType<typeof getDatabase>): void {
  const counts = readPendingCounts(db);
  useSyncStore.getState().setPendingCount(...counts);
  useSyncStore.getState().incrementDbVersion();
}

function readPendingCounts(
  db: ReturnType<typeof getDatabase>,
): [number, number, number] {
  const row = db.getFirstSync<{ pending: number; failed: number; conflict: number }>(
    `SELECT
      SUM(CASE WHEN status IN ('pending','syncing') THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
      SUM(CASE WHEN status = 'conflict' THEN 1 ELSE 0 END) AS conflict
    FROM local_outbox`,
  );
  return [row?.pending ?? 0, row?.failed ?? 0, row?.conflict ?? 0];
}

/** Returns delay in ms for a given retry count (0-indexed). */
export function getRetryDelay(retryCount: number): number {
  return RETRY_DELAYS_MS[Math.min(retryCount, RETRY_DELAYS_MS.length - 1)];
}
