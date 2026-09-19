/**
 * Sync Engine — Orchestrator
 *
 * Coordinates push and pull phases. Called by:
 * - The NetInfo listener on reconnect
 * - The AppState listener on app foreground
 * - A manual "Sync now" trigger from the UI
 */

import { drainOutbox } from './push';
import { pullGroupChanges } from './pull';
import { getDatabase } from '../db/client';
import { useSyncStore } from '../stores/sync.store';

let syncInProgress = false;

/**
 * Triggers a full sync cycle: push pending mutations, then pull changes.
 * Re-entrant safe — concurrent calls are no-ops.
 */
export async function triggerSync(): Promise<void> {
  if (syncInProgress) return;
  syncInProgress = true;

  const store = useSyncStore.getState();
  store.setStatus('pushing');

  try {
    // Phase 1: Push — drain the outbox
    await drainOutbox();

    // Phase 2: Pull — fetch changes for all groups user is in
    store.setStatus('pulling');
    const db = getDatabase();
    const groups = db.getAllSync<{ group_id: string }>(
      `SELECT DISTINCT group_id FROM local_sync_cursors`,
    );

    // Also pull for any groups that have expenses/settlements but no cursor yet
    const allGroupIds = db
      .getAllSync<{ id: string }>(`SELECT id FROM local_groups WHERE is_archived = 0`)
      .map((g) => g.id);

    const groupSet = new Set([
      ...groups.map((g) => g.group_id),
      ...allGroupIds,
    ]);

    const revokedGroups: string[] = [];

    for (const groupId of groupSet) {
      const result = await pullGroupChanges(groupId);
      if (result.revoked) revokedGroups.push(groupId);
    }

    store.setLastSyncedAt(new Date().toISOString());
    store.setStatus('idle');

    if (revokedGroups.length > 0) {
      // Notify UI about revoked groups (navigation handled in root layout)
      store.setStatus('idle', undefined);
      store.incrementDbVersion();
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    useSyncStore.getState().setStatus('error', msg);
  } finally {
    syncInProgress = false;
  }
}
