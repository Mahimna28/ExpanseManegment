/**
 * Sync Engine — Pull Phase (Change Log Cursor)
 *
 * Fetches server change_log rows after the client's last known seq.
 * Uses a monotonic BIGSERIAL seq — immune to clock skew and timestamp collision.
 * Paginates in batches of 200.
 */

import { supabase } from '../services/supabase';
import { getDatabase } from '../db/client';
import { useSyncStore } from '../stores/sync.store';
import type { ChangeLogRow } from '../types/models';

const PAGE_SIZE = 200;

export interface PullResult {
  /** Group was not accessible (membership revoked or expired) */
  revoked?: boolean;
  error?: string;
}

/**
 * Pulls all new changes for a given group since the last stored seq.
 * Applies them to local SQLite in one transaction per page.
 */
export async function pullGroupChanges(groupId: string): Promise<PullResult> {
  const db = getDatabase();

  const cursor = db.getFirstSync<{ last_seq: number }>(
    `SELECT last_seq FROM local_sync_cursors WHERE group_id = ?`,
    [groupId],
  );
  let afterSeq = cursor?.last_seq ?? 0;

  while (true) {
    const { data, error } = await supabase.rpc('pull_changes', {
      p_group_id: groupId,
      p_after_seq: afterSeq,
    });

    if (error) {
      const code = error.code ?? '';
      if (code === 'P0002' || error.message.includes('not_member')) {
        // Membership revoked — wipe local group data
        wipeLocalGroupData(db, groupId);
        return { revoked: true };
      }
      return { error: error.message };
    }

    const rows: ChangeLogRow[] = data?.rows ?? [];
    const maxSeq: number = data?.max_seq ?? afterSeq;

    if (rows.length === 0) break;

    // Apply all rows in one SQLite transaction
    db.withTransactionSync(() => {
      for (const row of rows) {
        applyChangeLogRow(db, row);
      }
      // Advance cursor
      db.runSync(
        `INSERT INTO local_sync_cursors (group_id, last_seq, last_synced_at)
         VALUES (?, ?, ?)
         ON CONFLICT (group_id) DO UPDATE SET last_seq = excluded.last_seq, last_synced_at = excluded.last_synced_at`,
        [groupId, maxSeq, new Date().toISOString()],
      );
    });

    afterSeq = maxSeq;

    if (rows.length < PAGE_SIZE) break; // Last page
  }

  return {};
}

// ── Apply a single change_log row to local SQLite ─────────────

function applyChangeLogRow(
  db: ReturnType<typeof getDatabase>,
  row: ChangeLogRow,
): void {
  const p = row.payload as Record<string, unknown>;

  switch (row.entity_type) {
    case 'expense':
      upsertExpense(db, p, row.operation);
      break;
    case 'expense_split':
      upsertSplit(db, p, row.operation);
      break;
    case 'settlement':
      upsertSettlement(db, p, row.operation);
      break;
    case 'member':
      upsertMember(db, p, row.operation);
      break;
    case 'category':
      upsertCategory(db, p, row.operation);
      break;
    case 'group':
      upsertGroup(db, p, row.operation);
      break;
  }
}

function upsertExpense(db: ReturnType<typeof getDatabase>, p: any, op: string): void {
  if (op === 'DELETE') {
    db.runSync(`UPDATE local_expenses SET is_voided = 1 WHERE id = ?`, [p.id]);
    return;
  }
  db.runSync(
    `INSERT INTO local_expenses (
       id, group_id, category_id, title, notes, total_paise, paid_by,
       split_type, expense_date, is_voided, voided_by, voided_at,
       server_version, sync_status, created_by, created_at, updated_at
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'synced',?,?,?)
     ON CONFLICT (id) DO UPDATE SET
       category_id = excluded.category_id, title = excluded.title,
       notes = excluded.notes, total_paise = excluded.total_paise,
       paid_by = excluded.paid_by, split_type = excluded.split_type,
       expense_date = excluded.expense_date, is_voided = excluded.is_voided,
       voided_by = excluded.voided_by, voided_at = excluded.voided_at,
       server_version = excluded.server_version, sync_status = 'synced',
       updated_at = excluded.updated_at`,
    [
      p.id, p.group_id, p.category_id ?? null, p.title, p.notes ?? null,
      p.total_paise, p.paid_by, p.split_type, p.expense_date,
      p.is_voided ? 1 : 0, p.voided_by ?? null, p.voided_at ?? null,
      p.server_version, p.created_by, p.created_at, p.updated_at,
    ],
  );
}

function upsertSplit(db: ReturnType<typeof getDatabase>, p: any, op: string): void {
  if (op === 'DELETE') {
    db.runSync(`DELETE FROM local_splits WHERE id = ?`, [p.id]);
    return;
  }
  db.runSync(
    `INSERT INTO local_splits (id, expense_id, participant_id, owed_paise)
     VALUES (?,?,?,?)
     ON CONFLICT (expense_id, participant_id) DO UPDATE SET
       owed_paise = excluded.owed_paise`,
    [p.id, p.expense_id, p.participant_id, p.owed_paise],
  );
}

function upsertSettlement(db: ReturnType<typeof getDatabase>, p: any, op: string): void {
  if (op === 'DELETE') {
    db.runSync(`UPDATE local_settlements SET is_voided = 1 WHERE id = ?`, [p.id]);
    return;
  }
  db.runSync(
    `INSERT INTO local_settlements (
       id, group_id, from_user_id, to_user_id, amount_paise, payment_method,
       note, is_voided, voided_by, voided_at, sync_status, created_by, created_at, updated_at
     ) VALUES (?,?,?,?,?,?,?,?,?,?,'synced',?,?,?)
     ON CONFLICT (id) DO UPDATE SET
       is_voided = excluded.is_voided, voided_by = excluded.voided_by,
       voided_at = excluded.voided_at, sync_status = 'synced',
       updated_at = excluded.updated_at`,
    [
      p.id, p.group_id, p.from_user_id, p.to_user_id, p.amount_paise,
      p.payment_method, p.note ?? null, p.is_voided ? 1 : 0,
      p.voided_by ?? null, p.voided_at ?? null, p.created_by, p.created_at, p.updated_at,
    ],
  );
}

function upsertMember(db: ReturnType<typeof getDatabase>, p: any, op: string): void {
  db.runSync(
    `INSERT INTO local_members (id, group_id, user_id, role, status, joined_at, revoked_at)
     VALUES (?,?,?,?,?,?,?)
     ON CONFLICT (group_id, user_id) DO UPDATE SET
       role = excluded.role, status = excluded.status,
       revoked_at = excluded.revoked_at`,
    [p.id, p.group_id, p.user_id, p.role, p.status, p.joined_at ?? null, p.revoked_at ?? null],
  );
}

function upsertCategory(db: ReturnType<typeof getDatabase>, p: any, op: string): void {
  db.runSync(
    `INSERT INTO local_categories (id, group_id, name, is_archived, created_by, updated_at)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT (id) DO UPDATE SET
       name = excluded.name, is_archived = excluded.is_archived,
       updated_at = excluded.updated_at`,
    [p.id, p.group_id, p.name, p.is_archived ? 1 : 0, p.created_by, p.updated_at],
  );
}

function upsertGroup(db: ReturnType<typeof getDatabase>, p: any, op: string): void {
  db.runSync(
    `INSERT INTO local_groups (id, name, description, invite_code, is_archived, created_by, updated_at)
     VALUES (?,?,?,?,?,?,?)
     ON CONFLICT (id) DO UPDATE SET
       name = excluded.name, description = excluded.description,
       invite_code = excluded.invite_code, is_archived = excluded.is_archived,
       updated_at = excluded.updated_at`,
    [p.id, p.name, p.description ?? null, p.invite_code, p.is_archived ? 1 : 0, p.created_by, p.updated_at],
  );
}

// ── Revocation handler ────────────────────────────────────────

/**
 * Called when the server returns a membership error for a group.
 * Deletes all local data for that group in a single transaction.
 */
function wipeLocalGroupData(db: ReturnType<typeof getDatabase>, groupId: string): void {
  db.withTransactionSync(() => {
    // Delete outbox entries for this group first (don't push revoked mutations)
    db.runSync(`DELETE FROM local_outbox WHERE group_id = ?`, [groupId]);
    // Child tables cascade via FK, but explicit is safer
    db.runSync(`DELETE FROM local_splits WHERE expense_id IN (SELECT id FROM local_expenses WHERE group_id = ?)`, [groupId]);
    db.runSync(`DELETE FROM local_expenses WHERE group_id = ?`, [groupId]);
    db.runSync(`DELETE FROM local_settlements WHERE group_id = ?`, [groupId]);
    db.runSync(`DELETE FROM local_members WHERE group_id = ?`, [groupId]);
    db.runSync(`DELETE FROM local_categories WHERE group_id = ?`, [groupId]);
    db.runSync(`DELETE FROM local_sync_cursors WHERE group_id = ?`, [groupId]);
    db.runSync(`DELETE FROM local_groups WHERE id = ?`, [groupId]);
  });

  useSyncStore.getState().incrementDbVersion();
}
