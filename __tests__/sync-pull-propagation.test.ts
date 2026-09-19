import { triggerSync } from '../src/sync/engine';
import { useSyncStore } from '../src/stores/sync.store';
import * as pullModule from '../src/sync/pull';
import * as pushModule from '../src/sync/push';
import { getDatabase } from '../src/db/client';

// Mock DB client
jest.mock('../src/db/client', () => ({
  getDatabase: jest.fn(() => ({
    runSync: jest.fn(),
    getAllSync: jest.fn((sql: string) => {
      if (sql.includes('local_sync_cursors')) {
        return [{ group_id: 'grp-test' }];
      }
      if (sql.includes('local_groups')) {
        return [{ id: 'grp-test' }];
      }
      return [];
    }),
    getFirstSync: jest.fn(),
  })),
}));

// Mock push
jest.mock('../src/sync/push', () => ({
  drainOutbox: jest.fn(async () => {}),
}));

// Mock pull
jest.mock('../src/sync/pull', () => ({
  pullGroupChanges: jest.fn(),
  normalizeEntityType: jest.fn(),
}));

describe('Sync Pull Failure Propagation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSyncStore.getState().setStatus('idle');
  });

  test('propagates pull failure to sync store status and errorMessage', async () => {
    (pullModule.pullGroupChanges as jest.Mock).mockResolvedValueOnce({
      error: 'Network connection lost during pull',
    });

    await triggerSync();

    const state = useSyncStore.getState();
    expect(state.status).toBe('error');
    expect(state.errorMessage).toContain('Network connection lost during pull');
  });

  test('recovers and marks idle upon clean pull', async () => {
    (pullModule.pullGroupChanges as jest.Mock).mockResolvedValueOnce({});

    await triggerSync();

    const state = useSyncStore.getState();
    expect(state.status).toBe('idle');
    expect(state.errorMessage).toBeNull();
    expect(state.lastSyncedAt).not.toBeNull();
  });
});
