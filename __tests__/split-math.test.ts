import { equalSplit, customSplit, calculateSplits } from '../src/engine/split-math';
import { MAX_EXPENSE_PAISE } from '../src/engine/currency';

// ── equalSplit ────────────────────────────────────────────────

describe('equalSplit', () => {
  test('exact divisor — no remainder', () => {
    const splits = equalSplit(30000, ['alice', 'bob', 'charlie']);
    expect(splits).toHaveLength(3);
    expect(splits.every((s) => s.owed_paise === 10000)).toBe(true);
    expect(splits.reduce((a, s) => a + s.owed_paise, 0)).toBe(30000);
  });

  test('remainder 1 — first sorted member gets extra paisa', () => {
    // sorted: alice, bob, charlie → alice gets 3334
    const splits = equalSplit(10000, ['charlie', 'alice', 'bob']);
    const byId = Object.fromEntries(splits.map((s) => [s.participant_id, s.owed_paise]));
    expect(byId['alice']).toBe(3334);
    expect(byId['bob']).toBe(3333);
    expect(byId['charlie']).toBe(3333);
    expect(splits.reduce((a, s) => a + s.owed_paise, 0)).toBe(10000);
  });

  test('remainder 2', () => {
    // 10001 / 3: base=3333, remainder=2 → first 2 sorted get 3334
    const splits = equalSplit(10001, ['charlie', 'alice', 'bob']);
    const byId = Object.fromEntries(splits.map((s) => [s.participant_id, s.owed_paise]));
    expect(byId['alice']).toBe(3334);
    expect(byId['bob']).toBe(3334);
    expect(byId['charlie']).toBe(3333);
    expect(splits.reduce((a, s) => a + s.owed_paise, 0)).toBe(10001);
  });

  test('7 members — ₹10 total', () => {
    const ids = ['m1','m2','m3','m4','m5','m6','m7'];
    const splits = equalSplit(1000, ids);
    // base=142, remainder=6 → first 6 get 143, last gets 142
    expect(splits.filter((s) => s.owed_paise === 143)).toHaveLength(6);
    expect(splits.filter((s) => s.owed_paise === 142)).toHaveLength(1);
    expect(splits.reduce((a, s) => a + s.owed_paise, 0)).toBe(1000);
  });

  test('prime total — conservation', () => {
    const ids = ['a','b','c','d'];
    const splits = equalSplit(9973, ids);
    expect(splits.reduce((a, s) => a + s.owed_paise, 0)).toBe(9973);
  });

  test('single participant gets everything', () => {
    const splits = equalSplit(5000, ['only']);
    expect(splits).toHaveLength(1);
    expect(splits[0].owed_paise).toBe(5000);
  });

  test('1 paise split among 3 — one person gets it', () => {
    const splits = equalSplit(1, ['a','b','c']);
    const sum = splits.reduce((a, s) => a + s.owed_paise, 0);
    expect(sum).toBe(1);
    const nonZero = splits.filter((s) => s.owed_paise > 0);
    expect(nonZero).toHaveLength(1);
    expect(nonZero[0].owed_paise).toBe(1);
  });

  test('deterministic — same input always gives same output', () => {
    const a = equalSplit(10000, ['c','b','a']);
    const b = equalSplit(10000, ['a','b','c']);
    expect(a).toEqual(b);
  });

  // ── Error cases
  test('zero total throws', () => {
    expect(() => equalSplit(0, ['a','b'])).toThrow('greater than zero');
  });
  test('negative total throws', () => {
    expect(() => equalSplit(-100, ['a'])).toThrow('greater than zero');
  });
  test('exceeds max throws', () => {
    expect(() => equalSplit(MAX_EXPENSE_PAISE + 1, ['a'])).toThrow('maximum');
  });
  test('empty participants throws', () => {
    expect(() => equalSplit(10000, [])).toThrow('empty');
  });
});

// ── customSplit ───────────────────────────────────────────────

describe('customSplit', () => {
  test('valid allocations summing to total', () => {
    const splits = customSplit(10000, [
      { participant_id: 'alice', owed_paise: 6000 },
      { participant_id: 'bob', owed_paise: 4000 },
    ]);
    expect(splits).toHaveLength(2);
    expect(splits.find((s) => s.participant_id === 'alice')?.owed_paise).toBe(6000);
  });

  test('zero-allocation participant is valid', () => {
    const splits = customSplit(10000, [
      { participant_id: 'alice', owed_paise: 10000 },
      { participant_id: 'bob', owed_paise: 0 },
    ]);
    expect(splits).toHaveLength(2);
    expect(splits.reduce((a, s) => a + s.owed_paise, 0)).toBe(10000);
  });

  test('sum short of total throws with amount', () => {
    expect(() =>
      customSplit(10000, [
        { participant_id: 'alice', owed_paise: 6000 },
        { participant_id: 'bob', owed_paise: 3000 },
      ]),
    ).toThrow('short by 1000 paise');
  });

  test('sum exceeds total throws with amount', () => {
    expect(() =>
      customSplit(10000, [
        { participant_id: 'alice', owed_paise: 7000 },
        { participant_id: 'bob', owed_paise: 4000 },
      ]),
    ).toThrow('exceed total by 1000 paise');
  });

  test('negative allocation throws', () => {
    expect(() =>
      customSplit(10000, [
        { participant_id: 'alice', owed_paise: -100 },
        { participant_id: 'bob', owed_paise: 10100 },
      ]),
    ).toThrow('cannot be negative');
  });

  test('empty allocations throws', () => {
    expect(() => customSplit(10000, [])).toThrow('empty');
  });
});

// ── calculateSplits dispatcher ────────────────────────────────

describe('calculateSplits', () => {
  test('dispatches equal split', () => {
    const splits = calculateSplits(10000, 'equal', ['a','b']);
    expect(splits.reduce((s, x) => s + x.owed_paise, 0)).toBe(10000);
  });

  test('dispatches custom split', () => {
    const splits = calculateSplits(
      5000,
      'custom',
      ['a','b'],
      [{ participant_id: 'a', owed_paise: 3000 }, { participant_id: 'b', owed_paise: 2000 }],
    );
    expect(splits.reduce((s, x) => s + x.owed_paise, 0)).toBe(5000);
  });

  test('custom without allocations throws', () => {
    expect(() => calculateSplits(5000, 'custom', ['a','b'])).toThrow();
  });
});
