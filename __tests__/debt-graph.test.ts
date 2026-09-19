import { calculateNetBalances, simplifyDebts, assertBalanceConservation } from '../src/engine/debt-graph';
import type { Expense, Settlement } from '../src/types/models';

// ── Helpers ───────────────────────────────────────────────────

function makeExpense(overrides: Partial<Expense> & { id: string; paid_by: string; total_paise: number; splits: Expense['splits'] }): Expense {
  return {
    group_id: 'g1',
    category_id: undefined,
    title: 'Test expense',
    notes: undefined,
    split_type: 'equal',
    expense_date: '2026-09-20',
    is_voided: false,
    voided_by: undefined,
    voided_at: undefined,
    server_version: 1,
    sync_status: 'synced',
    created_by: overrides.paid_by,
    created_at: '2026-09-20T00:00:00Z',
    updated_at: '2026-09-20T00:00:00Z',
    ...overrides,
  };
}

function makeSettlement(overrides: Partial<Settlement> & { id: string; from_user_id: string; to_user_id: string; amount_paise: number }): Settlement {
  return {
    group_id: 'g1',
    payment_method: 'cash',
    note: undefined,
    is_voided: false,
    voided_by: undefined,
    voided_at: undefined,
    sync_status: 'synced',
    created_by: overrides.from_user_id,
    created_at: '2026-09-20T00:00:00Z',
    updated_at: '2026-09-20T00:00:00Z',
    ...overrides,
  };
}

// ── calculateNetBalances ──────────────────────────────────────

describe('calculateNetBalances', () => {
  const members = ['alice', 'bob', 'charlie'];

  test('basic 3-person dinner — correct balances', () => {
    const expenses = [
      makeExpense({
        id: 'e1',
        paid_by: 'alice',
        total_paise: 30000, // ₹300
        splits: [
          { id: 's1', expense_id: 'e1', participant_id: 'alice', owed_paise: 10000 },
          { id: 's2', expense_id: 'e1', participant_id: 'bob', owed_paise: 10000 },
          { id: 's3', expense_id: 'e1', participant_id: 'charlie', owed_paise: 10000 },
        ],
      }),
    ];

    const net = calculateNetBalances(members, expenses, []);

    expect(net.get('alice')).toBe(20000);   // paid 30000, owes 10000 → +20000
    expect(net.get('bob')).toBe(-10000);    // owes 10000
    expect(net.get('charlie')).toBe(-10000);

    // Conservation invariant
    const sum = Array.from(net.values()).reduce((a, v) => a + v, 0);
    expect(sum).toBe(0);
  });

  test('settlement correctly reduces balances', () => {
    const expenses = [
      makeExpense({
        id: 'e1',
        paid_by: 'alice',
        total_paise: 20000,
        splits: [
          { id: 's1', expense_id: 'e1', participant_id: 'alice', owed_paise: 10000 },
          { id: 's2', expense_id: 'e1', participant_id: 'bob', owed_paise: 10000 },
        ],
      }),
    ];

    const settlements = [
      makeSettlement({
        id: 'st1',
        from_user_id: 'bob',   // debtor
        to_user_id: 'alice',   // creditor
        amount_paise: 10000,
      }),
    ];

    const net = calculateNetBalances(['alice', 'bob'], expenses, settlements);

    expect(net.get('alice')).toBe(0);  // +10000 (paid) -10000 (own share) -10000 (received) = 0
    expect(net.get('bob')).toBe(0);    // -10000 (share) +10000 (paid settlement) = 0

    const sum = Array.from(net.values()).reduce((a, v) => a + v, 0);
    expect(sum).toBe(0);
  });

  test('voided expense is excluded from balances', () => {
    const expenses = [
      makeExpense({
        id: 'e1',
        paid_by: 'alice',
        total_paise: 30000,
        is_voided: true,  // VOIDED
        splits: [
          { id: 's1', expense_id: 'e1', participant_id: 'alice', owed_paise: 10000 },
          { id: 's2', expense_id: 'e1', participant_id: 'bob', owed_paise: 10000 },
          { id: 's3', expense_id: 'e1', participant_id: 'charlie', owed_paise: 10000 },
        ],
      }),
    ];

    const net = calculateNetBalances(members, expenses, []);

    expect(net.get('alice')).toBe(0);
    expect(net.get('bob')).toBe(0);
    expect(net.get('charlie')).toBe(0);
  });

  test('voided settlement is excluded from balances', () => {
    // Alice is owed ₹100 from Bob
    const expenses = [
      makeExpense({
        id: 'e1',
        paid_by: 'alice',
        total_paise: 20000,
        splits: [
          { id: 's1', expense_id: 'e1', participant_id: 'alice', owed_paise: 10000 },
          { id: 's2', expense_id: 'e1', participant_id: 'bob', owed_paise: 10000 },
        ],
      }),
    ];

    const settlements = [
      makeSettlement({
        id: 'st1',
        from_user_id: 'bob',
        to_user_id: 'alice',
        amount_paise: 10000,
        is_voided: true,  // VOIDED — should NOT affect balances
      }),
    ];

    const net = calculateNetBalances(['alice', 'bob'], expenses, settlements);

    // Voided settlement not counted → original balances
    expect(net.get('alice')).toBe(10000);
    expect(net.get('bob')).toBe(-10000);
  });

  test('balance conservation holds across complex scenario', () => {
    const members2 = ['alice', 'bob', 'charlie', 'dave'];
    const expenses = [
      makeExpense({ id: 'e1', paid_by: 'alice', total_paise: 40000, splits: [
        { id: 's1', expense_id: 'e1', participant_id: 'alice', owed_paise: 10000 },
        { id: 's2', expense_id: 'e1', participant_id: 'bob', owed_paise: 10000 },
        { id: 's3', expense_id: 'e1', participant_id: 'charlie', owed_paise: 10000 },
        { id: 's4', expense_id: 'e1', participant_id: 'dave', owed_paise: 10000 },
      ]}),
      makeExpense({ id: 'e2', paid_by: 'bob', total_paise: 30000, splits: [
        { id: 's5', expense_id: 'e2', participant_id: 'alice', owed_paise: 15000 },
        { id: 's6', expense_id: 'e2', participant_id: 'bob', owed_paise: 15000 },
      ]}),
    ];
    const settlements = [
      makeSettlement({ id: 'st1', from_user_id: 'charlie', to_user_id: 'alice', amount_paise: 5000 }),
    ];

    const net = calculateNetBalances(members2, expenses, settlements);
    const sum = Array.from(net.values()).reduce((a, v) => a + v, 0);
    expect(sum).toBe(0);
  });

  test('member initialized even if they have no expenses or settlements', () => {
    const net = calculateNetBalances(['alice', 'bob'], [], []);
    expect(net.get('alice')).toBe(0);
    expect(net.get('bob')).toBe(0);
  });
});

// ── simplifyDebts ─────────────────────────────────────────────

describe('simplifyDebts', () => {
  test('single debtor, single creditor', () => {
    const net = new Map([['alice', 10000], ['bob', -10000]]);
    const suggestions = simplifyDebts(net);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].from_user_id).toBe('bob');
    expect(suggestions[0].to_user_id).toBe('alice');
    expect(suggestions[0].amount_paise).toBe(10000);
  });

  test('two debtors, one creditor', () => {
    const net = new Map([['alice', 20000], ['bob', -10000], ['charlie', -10000]]);
    const suggestions = simplifyDebts(net);
    expect(suggestions).toHaveLength(2);
    const total = suggestions.reduce((a, s) => a + s.amount_paise, 0);
    expect(total).toBe(20000); // conservation: all debts resolved
  });

  test('all zero balances — no suggestions', () => {
    const net = new Map([['a', 0], ['b', 0], ['c', 0]]);
    expect(simplifyDebts(net)).toHaveLength(0);
  });

  test('circular debts sum to zero — no suggestions', () => {
    // A owes B 100, B owes C 100, C owes A 100 → all cancel out
    const net = new Map([['alice', 0], ['bob', 0], ['charlie', 0]]);
    expect(simplifyDebts(net)).toHaveLength(0);
  });
});

// ── assertBalanceConservation ─────────────────────────────────

describe('assertBalanceConservation', () => {
  test('passes when sum is zero', () => {
    const net = new Map([['alice', 10000], ['bob', -10000]]);
    expect(() => assertBalanceConservation(net)).not.toThrow();
  });

  test('throws in dev when sum is non-zero', () => {
    const net = new Map([['alice', 10000], ['bob', -5000]]);
    // __DEV__ is true in jest environment
    expect(() => assertBalanceConservation(net)).toThrow('conservation violated');
  });
});
