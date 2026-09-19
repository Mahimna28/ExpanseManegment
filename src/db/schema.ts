import { getDatabase } from './client';

/**
 * Current local schema version.
 * Increment this whenever a migration is added.
 */
const CURRENT_VERSION = 1;

/**
 * Initializes the local SQLite database and applies all pending migrations.
 * Safe to call on every app startup — migrations are idempotent.
 */
export function initLocalDatabase(): void {
  const db = getDatabase();

  // Enable WAL mode and foreign keys on every connection
  db.execSync(`PRAGMA journal_mode = WAL;`);
  db.execSync(`PRAGMA foreign_keys = ON;`);

  // Create the migration log table first (bootstrap)
  db.execSync(`
    CREATE TABLE IF NOT EXISTS migration_log (
      version    INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = getAppliedVersions(db);

  if (!applied.has(1)) {
    applyV1(db);
    logMigration(db, 1);
  }

  // Future migrations: if (!applied.has(2)) { applyV2(db); logMigration(db, 2); }
}

function getAppliedVersions(db: ReturnType<typeof getDatabase>): Set<number> {
  const rows = db.getAllSync<{ version: number }>(
    'SELECT version FROM migration_log',
  );
  return new Set(rows.map((r) => r.version));
}

function logMigration(db: ReturnType<typeof getDatabase>, version: number): void {
  db.runSync(
    `INSERT OR IGNORE INTO migration_log (version, applied_at) VALUES (?, ?)`,
    [version, new Date().toISOString()],
  );
}

// ── V1: Initial schema ────────────────────────────────────────

function applyV1(db: ReturnType<typeof getDatabase>): void {
  db.execSync(`
    -- ── Profiles ──────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS local_profiles (
      id            TEXT PRIMARY KEY,
      display_name  TEXT NOT NULL,
      email         TEXT NOT NULL,
      avatar_url    TEXT,
      updated_at    TEXT NOT NULL
    );

    -- ── Groups ────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS local_groups (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      description   TEXT,
      invite_code   TEXT NOT NULL,
      is_archived   INTEGER NOT NULL DEFAULT 0,
      created_by    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    );

    -- ── Group Members ─────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS local_members (
      id            TEXT PRIMARY KEY,
      group_id      TEXT NOT NULL,
      user_id       TEXT NOT NULL,
      role          TEXT NOT NULL CHECK (role IN ('owner','admin','member')),
      status        TEXT NOT NULL CHECK (status IN ('active','revoked','left')),
      display_name  TEXT,
      email         TEXT,
      joined_at     TEXT,
      revoked_at    TEXT,
      FOREIGN KEY (group_id) REFERENCES local_groups(id) ON DELETE CASCADE,
      UNIQUE (group_id, user_id)
    );

    -- ── Categories ────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS local_categories (
      id            TEXT PRIMARY KEY,
      group_id      TEXT NOT NULL,
      name          TEXT NOT NULL,
      is_archived   INTEGER NOT NULL DEFAULT 0,
      created_by    TEXT NOT NULL,
      updated_at    TEXT NOT NULL,
      FOREIGN KEY (group_id) REFERENCES local_groups(id) ON DELETE CASCADE,
      UNIQUE (group_id, name)
    );

    -- ── Expenses ──────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS local_expenses (
      id              TEXT PRIMARY KEY,
      group_id        TEXT NOT NULL,
      category_id     TEXT,
      title           TEXT NOT NULL,
      notes           TEXT,
      total_paise     INTEGER NOT NULL CHECK (total_paise > 0 AND total_paise <= 1000000000),
      paid_by         TEXT NOT NULL,
      split_type      TEXT NOT NULL CHECK (split_type IN ('equal','custom')),
      expense_date    TEXT NOT NULL,
      is_voided       INTEGER NOT NULL DEFAULT 0,
      voided_by       TEXT,
      voided_at       TEXT,
      server_version  INTEGER NOT NULL DEFAULT 0,
      sync_status     TEXT NOT NULL DEFAULT 'pending'
                        CHECK (sync_status IN ('pending','syncing','synced','conflict','failed')),
      created_by      TEXT NOT NULL,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL,
      FOREIGN KEY (group_id) REFERENCES local_groups(id) ON DELETE CASCADE
    );

    -- ── Expense Splits ────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS local_splits (
      id              TEXT PRIMARY KEY,
      expense_id      TEXT NOT NULL,
      participant_id  TEXT NOT NULL,
      owed_paise      INTEGER NOT NULL CHECK (owed_paise >= 0),
      FOREIGN KEY (expense_id) REFERENCES local_expenses(id) ON DELETE CASCADE,
      UNIQUE (expense_id, participant_id)
    );

    -- ── Settlements ───────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS local_settlements (
      id              TEXT PRIMARY KEY,
      group_id        TEXT NOT NULL,
      from_user_id    TEXT NOT NULL,
      to_user_id      TEXT NOT NULL,
      amount_paise    INTEGER NOT NULL CHECK (amount_paise > 0 AND amount_paise <= 1000000000),
      payment_method  TEXT NOT NULL DEFAULT 'cash'
                        CHECK (payment_method IN ('cash','upi','bank_transfer','other')),
      note            TEXT,
      is_voided       INTEGER NOT NULL DEFAULT 0,
      voided_by       TEXT,
      voided_at       TEXT,
      sync_status     TEXT NOT NULL DEFAULT 'pending'
                        CHECK (sync_status IN ('pending','syncing','synced','conflict','failed')),
      created_by      TEXT NOT NULL,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL,
      FOREIGN KEY (group_id) REFERENCES local_groups(id) ON DELETE CASCADE,
      CHECK (from_user_id != to_user_id)
    );

    -- ── Sync Cursors ──────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS local_sync_cursors (
      group_id        TEXT PRIMARY KEY,
      last_seq        INTEGER NOT NULL DEFAULT 0,
      last_synced_at  TEXT
    );

    -- ── Outbox ────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS local_outbox (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      mutation_id   TEXT UNIQUE NOT NULL,
      group_id      TEXT NOT NULL,
      entity_type   TEXT NOT NULL,
      operation     TEXT NOT NULL CHECK (operation IN ('CREATE','UPDATE','VOID')),
      entity_id     TEXT NOT NULL,
      payload_json  TEXT NOT NULL,
      base_version  INTEGER,
      status        TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','syncing','synced','conflict','failed')),
      retry_count   INTEGER NOT NULL DEFAULT 0,
      last_error    TEXT,
      created_at    INTEGER NOT NULL
    );

    -- ── Indexes ───────────────────────────────────────────────
    CREATE INDEX IF NOT EXISTS idx_members_group     ON local_members (group_id);
    CREATE INDEX IF NOT EXISTS idx_members_user      ON local_members (user_id, status);
    CREATE INDEX IF NOT EXISTS idx_categories_group  ON local_categories (group_id, is_archived);
    CREATE INDEX IF NOT EXISTS idx_expenses_group    ON local_expenses (group_id, is_voided, expense_date DESC);
    CREATE INDEX IF NOT EXISTS idx_splits_expense    ON local_splits (expense_id);
    CREATE INDEX IF NOT EXISTS idx_settlements_group ON local_settlements (group_id, is_voided);
    CREATE INDEX IF NOT EXISTS idx_outbox_status     ON local_outbox (status, created_at ASC);
  `);
}
