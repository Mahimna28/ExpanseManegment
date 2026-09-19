import { create } from 'zustand';

export type SyncEngineStatus = 'idle' | 'pushing' | 'pulling' | 'error';

interface SyncState {
  status: SyncEngineStatus;
  pendingCount: number;
  failedCount: number;
  conflictCount: number;
  lastSyncedAt: string | null;
  errorMessage: string | null;
  /** Incremented on every SQLite write — components depend on this to re-query */
  dbVersion: number;
}

interface SyncActions {
  setStatus: (status: SyncEngineStatus, errorMessage?: string | null) => void;
  setPendingCount: (pending: number, failed: number, conflict: number) => void;
  setLastSyncedAt: (iso: string) => void;
  incrementDbVersion: () => void;
}

export const useSyncStore = create<SyncState & SyncActions>((set) => ({
  status: 'idle',
  pendingCount: 0,
  failedCount: 0,
  conflictCount: 0,
  lastSyncedAt: null,
  errorMessage: null,
  dbVersion: 0,

  setStatus: (status, errorMessage = null) => set({ status, errorMessage }),

  setPendingCount: (pending, failed, conflict) =>
    set({ pendingCount: pending, failedCount: failed, conflictCount: conflict }),

  setLastSyncedAt: (iso) => set({ lastSyncedAt: iso, errorMessage: null }),

  incrementDbVersion: () => set((state) => ({ dbVersion: state.dbVersion + 1 })),
}));
