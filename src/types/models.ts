// ============================================================
// Domain Types — Single source of truth for all data shapes
// Matches the database schema exactly (server + local SQLite).
// ============================================================

// ── Enumerations ─────────────────────────────────────────────

export type MemberRole = 'owner' | 'admin' | 'member';
export type MemberStatus = 'active' | 'revoked' | 'left';
export type SplitType = 'equal' | 'custom';
export type PaymentMethod = 'cash' | 'upi' | 'bank_transfer' | 'other';
/** Local outbox mutation states */
export type OutboxStatus = 'pending' | 'syncing' | 'synced' | 'conflict' | 'failed';
/** Sync status mirrored onto local expense/settlement rows */
export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'conflict' | 'failed';
export type ChangeLogOperation = 'INSERT' | 'UPDATE' | 'DELETE';
export type ChangeLogEntityType =
  | 'expense'
  | 'expense_split'
  | 'settlement'
  | 'member'
  | 'category'
  | 'group';

// ── Core domain objects ───────────────────────────────────────

export interface Profile {
  id: string;
  display_name: string;
  email: string;
  avatar_url?: string;
  updated_at: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  currency_code: 'INR';
  created_by: string;
  invite_code: string;
  invite_expires_at?: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: MemberRole;
  status: MemberStatus;
  invited_by?: string;
  joined_at: string;
  revoked_at?: string;
  created_at: string;
  /** Denormalized from profiles for display purposes */
  display_name?: string;
  email?: string;
}

export interface Category {
  id: string;
  group_id: string;
  name: string;
  is_archived: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  participant_id: string;
  /** Integer paise. Must be >= 0. Sum across all splits = expense.total_paise. */
  owed_paise: number;
}

export interface Expense {
  id: string;
  group_id: string;
  category_id?: string;
  title: string;
  notes?: string;
  /** Integer paise. Must be > 0 and <= MAX_EXPENSE_PAISE. */
  total_paise: number;
  paid_by: string;
  split_type: SplitType;
  expense_date: string; // ISO date string "YYYY-MM-DD"
  is_voided: boolean;
  voided_by?: string;
  voided_at?: string;
  server_version: number; // 0 = not yet pushed to server
  sync_status: SyncStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  /** Populated from local_splits on read */
  splits?: ExpenseSplit[];
}

export interface Settlement {
  id: string;
  group_id: string;
  from_user_id: string; // the debtor who paid
  to_user_id: string;   // the creditor who received
  /** Integer paise. Must be > 0 and <= MAX_EXPENSE_PAISE. */
  amount_paise: number;
  payment_method: PaymentMethod;
  note?: string;
  is_voided: boolean;
  voided_by?: string;
  voided_at?: string;
  sync_status: SyncStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ── Ledger / balance types ────────────────────────────────────

/** Net balance for a member in a group. Positive = is owed, Negative = owes. */
export interface MemberBalance {
  user_id: string;
  net_paise: number;
}

/** A suggested transfer that would clear two balances. Display-only. */
export interface DebtSuggestion {
  from_user_id: string;
  to_user_id: string;
  amount_paise: number;
}

// ── Sync / outbox types ───────────────────────────────────────

export interface OutboxEntry {
  id?: number;          // SQLite AUTOINCREMENT
  mutation_id: string;  // UUID v4 — sent to server for idempotency
  group_id: string;
  entity_type: ChangeLogEntityType;
  operation: 'CREATE' | 'UPDATE' | 'VOID';
  entity_id: string;
  payload_json: string; // JSON snapshot to send to server RPC
  base_version?: number; // server_version the UPDATE was based on (for optimistic locking)
  status: OutboxStatus;
  retry_count: number;
  last_error?: string;
  created_at: number;   // Unix ms timestamp for FIFO ordering
}

export interface SyncCursor {
  group_id: string;
  last_seq: number;     // last change_log seq successfully pulled
  last_synced_at?: string;
}

export interface ChangeLogRow {
  seq: number;
  group_id: string;
  entity_type: ChangeLogEntityType;
  entity_id: string;
  operation: ChangeLogOperation;
  actor_id?: string;
  payload: Record<string, unknown>;
  occurred_at: string;
}

// ── Engine input types ────────────────────────────────────────

export interface EqualSplitInput {
  totalPaise: number;
  participantIds: string[];
}

export interface CustomSplitInput {
  totalPaise: number;
  allocations: Array<{ participant_id: string; owed_paise: number }>;
}

export interface SplitResult {
  splits: Array<{ participant_id: string; owed_paise: number }>;
}
