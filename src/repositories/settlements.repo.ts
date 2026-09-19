import * as Crypto from 'expo-crypto';
import { getDatabase } from '../db/client';
import type { Settlement } from '../types/models';
import { useSyncStore } from '../stores/sync.store';

export const SettlementsRepo = {
  listSettlements(groupId: string, includeVoided = false): Settlement[] {
    const db = getDatabase();
    const query = includeVoided
      ? `SELECT * FROM local_settlements WHERE group_id = ? ORDER BY created_at DESC`
      : `SELECT * FROM local_settlements WHERE group_id = ? AND is_voided = 0 ORDER BY created_at DESC`;

    const rows = db.getAllSync<Settlement>(query, [groupId]);
    return rows.map((r) => ({ ...r, is_voided: Boolean(r.is_voided) }));
  },

  getSettlementById(id: string): Settlement | null {
    const db = getDatabase();
    const row = db.getFirstSync<Settlement>(
      `SELECT * FROM local_settlements WHERE id = ?`,
      [id],
    );
    if (!row) return null;
    return { ...row, is_voided: Boolean(row.is_voided) };
  },

  /**
   * Creates a settlement locally and queues a CREATE mutation
   * in the outbox in a single atomic transaction.
   */
  createSettlementAtomic(
    settlement: Omit<Settlement, 'is_voided' | 'sync_status' | 'created_at' | 'updated_at'>,
    actorId: string,
  ): Settlement {
    const db = getDatabase();
    const now = new Date().toISOString();
    const mutationId = Crypto.randomUUID();

    const created: Settlement = {
      ...settlement,
      is_voided: false,
      sync_status: 'pending',
      created_at: now,
      updated_at: now,
    };

    const outboxPayload = {
      p_mutation_id: mutationId,
      p_settlement_id: created.id,
      p_group_id: created.group_id,
      p_from_user_id: created.from_user_id,
      p_to_user_id: created.to_user_id,
      p_amount_paise: created.amount_paise,
      p_payment_method: created.payment_method,
      p_note: created.note ?? null,
    };

    db.withTransactionSync(() => {
      db.runSync(
        `INSERT INTO local_settlements (
           id, group_id, from_user_id, to_user_id, amount_paise, payment_method,
           note, is_voided, sync_status, created_by, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'pending', ?, ?, ?)`,
        [
          created.id,
          created.group_id,
          created.from_user_id,
          created.to_user_id,
          created.amount_paise,
          created.payment_method,
          created.note ?? null,
          actorId,
          created.created_at,
          created.updated_at,
        ],
      );

      db.runSync(
        `INSERT INTO local_outbox (
           mutation_id, group_id, entity_type, operation, entity_id,
           payload_json, status, retry_count, created_at
         ) VALUES (?, ?, 'settlement', 'CREATE', ?, ?, 'pending', 0, ?)`,
        [
          mutationId,
          created.group_id,
          created.id,
          JSON.stringify(outboxPayload),
          Date.now(),
        ],
      );
    });

    useSyncStore.getState().incrementDbVersion();
    return created;
  },

  /**
   * Voids a settlement locally and queues a VOID mutation in the outbox atomically.
   */
  voidSettlementAtomic(settlementId: string, actorId: string): void {
    const db = getDatabase();
    const s = this.getSettlementById(settlementId);
    if (!s) throw new Error('Settlement not found');
    if (s.is_voided) return;

    const mutationId = Crypto.randomUUID();
    const now = new Date().toISOString();

    const outboxPayload = {
      p_mutation_id: mutationId,
      p_settlement_id: settlementId,
    };

    db.withTransactionSync(() => {
      db.runSync(
        `UPDATE local_settlements
         SET is_voided = 1, voided_by = ?, voided_at = ?, sync_status = 'pending', updated_at = ?
         WHERE id = ?`,
        [actorId, now, now, settlementId],
      );

      db.runSync(
        `INSERT INTO local_outbox (
           mutation_id, group_id, entity_type, operation, entity_id,
           payload_json, status, retry_count, created_at
         ) VALUES (?, ?, 'settlement', 'VOID', ?, ?, 'pending', 0, ?)`,
        [
          mutationId,
          s.group_id,
          settlementId,
          JSON.stringify(outboxPayload),
          Date.now(),
        ],
      );
    });

    useSyncStore.getState().incrementDbVersion();
  },
};
