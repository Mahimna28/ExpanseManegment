import { initLocalDatabase } from '../src/db/schema';
import { getDatabase } from '../src/db/client';

jest.mock('../src/db/client', () => {
  const executedStatements: string[] = [];
  const appliedVersions = new Set<number>();

  return {
    getDatabase: jest.fn(() => ({
      execSync: (sql: string) => {
        executedStatements.push(sql);
      },
      withTransactionSync: (fn: () => void) => fn(),
      runSync: (sql: string, params?: any[]) => {
        if (sql.includes('INSERT OR IGNORE INTO migration_log')) {
          appliedVersions.add(params?.[0]);
        }
        executedStatements.push(sql);
        return { changes: 1 };
      },
      getAllSync: (sql: string) => {
        if (sql.includes('FROM migration_log')) {
          return Array.from(appliedVersions).map((v) => ({ version: v }));
        }
        return [];
      },
      getFirstSync: () => null,
      _executedStatements: executedStatements,
      _appliedVersions: appliedVersions,
      _clear: () => {
        executedStatements.length = 0;
        appliedVersions.clear();
      },
    })),
  };
});

describe('Database Migrations', () => {
  const db = (getDatabase as any)();

  beforeEach(() => {
    db._clear();
  });

  test('applies v1 and v2 sequentially on clean database', () => {
    initLocalDatabase();

    expect(db._appliedVersions.has(1)).toBe(true);
    expect(db._appliedVersions.has(2)).toBe(true);

    const v1Sql = db._executedStatements.find((s: string) => s.includes('local_expenses'));
    expect(v1Sql).toBeDefined();

    const v2Sql = db._executedStatements.find((s: string) => s.includes('idx_outbox_entity'));
    expect(v2Sql).toBeDefined();
  });

  test('is idempotent when already at version 2', () => {
    initLocalDatabase();
    const countAfterFirst = db._executedStatements.length;

    // Run again
    initLocalDatabase();

    // No new tables or migrations should be run
    expect(db._appliedVersions.size).toBe(2);
    // Only PRAGMAs and stale recovery run on subsequent starts
    const newMigrations = db._executedStatements
      .slice(countAfterFirst)
      .filter((s: string) => s.includes('CREATE TABLE IF NOT EXISTS local_expenses'));
    expect(newMigrations.length).toBe(0);
  });

  test('recovers stale syncing mutations on every startup', () => {
    initLocalDatabase();
    expect(db._executedStatements).toContainEqual(
      expect.stringContaining("UPDATE local_outbox SET status = 'pending' WHERE status = 'syncing'"),
    );
  });
});
