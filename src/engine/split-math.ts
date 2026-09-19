/**
 * Split Math Engine — Pure Functions
 *
 * Rules:
 * 1. All values are integer paise.
 * 2. SUM(split.owed_paise) === expense.total_paise — strictly enforced.
 * 3. Remainder allocation is deterministic (sort by participant_id ASC).
 * 4. MVP split types: 'equal' and 'custom' only.
 */

import { MAX_EXPENSE_PAISE } from './currency';

export interface SplitAllocation {
  participant_id: string;
  owed_paise: number;
}

// ── Validation helpers ────────────────────────────────────────

function assertPositivePaise(paise: number, label = 'Amount'): void {
  if (!Number.isInteger(paise)) throw new Error(`${label} must be an integer`);
  if (paise <= 0) throw new Error(`${label} must be greater than zero`);
  if (paise > MAX_EXPENSE_PAISE)
    throw new Error(`${label} exceeds maximum of ₹${MAX_EXPENSE_PAISE / 100}`);
}

function assertNonEmpty(ids: string[], label = 'Participants'): void {
  if (!Array.isArray(ids) || ids.length === 0)
    throw new Error(`${label} list cannot be empty`);
}

// ── Equal split ───────────────────────────────────────────────

/**
 * Splits `totalPaise` equally among `participantIds`.
 *
 * Remainder (totalPaise % n) is distributed 1 paisa each to the first
 * `remainder` participants, ordered by participant_id ASC (deterministic).
 *
 * Invariant: SUM(owed_paise) === totalPaise — always.
 *
 * Examples:
 *   equalSplit(10000, ['c','a','b'])
 *     sorted → ['a','b','c']
 *     base=3333, remainder=1
 *     → [{a:3334},{b:3333},{c:3333}]  SUM=10000 ✓
 *
 *   equalSplit(1000, ['m1','m2','m3','m4','m5','m6','m7'])
 *     base=142, remainder=6
 *     → first 6 get 143, last gets 142  SUM=1000 ✓
 *
 *   equalSplit(1, ['a','b','c'])
 *     base=0, remainder=1
 *     → [{a:1},{b:0},{c:0}]  SUM=1 ✓
 */
export function equalSplit(
  totalPaise: number,
  participantIds: string[],
): SplitAllocation[] {
  assertPositivePaise(totalPaise, 'Total');
  assertNonEmpty(participantIds, 'Participants');

  const sorted = [...participantIds].sort(); // lexicographic, deterministic
  const n = sorted.length;
  const base = Math.trunc(totalPaise / n);
  const remainder = totalPaise % n;

  const splits = sorted.map((id, idx): SplitAllocation => ({
    participant_id: id,
    owed_paise: base + (idx < remainder ? 1 : 0),
  }));

  // Invariant assertion (belt-and-suspenders)
  const sum = splits.reduce((acc, s) => acc + s.owed_paise, 0);
  if (sum !== totalPaise) {
    throw new Error(`Equal split invariant violated: sum=${sum}, total=${totalPaise}`);
  }

  return splits;
}

// ── Custom split ──────────────────────────────────────────────

/**
 * Validates and returns a custom split where each participant's owed_paise
 * is specified explicitly.
 *
 * Validation rules:
 * - Every owed_paise >= 0 (zero is allowed — "included but owes nothing")
 * - SUM(owed_paise) === totalPaise (exact integer equality)
 *
 * Examples:
 *   customSplit(10000, [{id:'a', owed:6000},{id:'b', owed:4000}]) → valid ✓
 *   customSplit(10000, [{id:'a', owed:6000},{id:'b', owed:3000}]) → throws "short by 1000 paise"
 *   customSplit(10000, [{id:'a', owed:-100},{id:'b', owed:10100}]) → throws "cannot be negative"
 */
export function customSplit(
  totalPaise: number,
  allocations: Array<{ participant_id: string; owed_paise: number }>,
): SplitAllocation[] {
  assertPositivePaise(totalPaise, 'Total');
  assertNonEmpty(
    allocations.map((a) => a.participant_id),
    'Allocations',
  );

  for (const a of allocations) {
    if (!Number.isInteger(a.owed_paise)) {
      throw new Error(`Allocation for ${a.participant_id} must be an integer`);
    }
    if (a.owed_paise < 0) {
      throw new Error(`Allocation for ${a.participant_id} cannot be negative`);
    }
  }

  const sum = allocations.reduce((acc, a) => acc + a.owed_paise, 0);

  if (sum < totalPaise) {
    const diff = totalPaise - sum;
    throw new Error(
      `Splits are short by ${diff} paise (₹${(diff / 100).toFixed(2)})`,
    );
  }
  if (sum > totalPaise) {
    const diff = sum - totalPaise;
    throw new Error(
      `Splits exceed total by ${diff} paise (₹${(diff / 100).toFixed(2)})`,
    );
  }

  return allocations.map((a) => ({
    participant_id: a.participant_id,
    owed_paise: a.owed_paise,
  }));
}

// ── Dispatch ─────────────────────────────────────────────────

/**
 * Master split dispatcher. Returns validated SplitAllocation[].
 * Throws a descriptive error if validation fails.
 */
export function calculateSplits(
  totalPaise: number,
  splitType: 'equal' | 'custom',
  participantIds: string[],
  customAllocations?: Array<{ participant_id: string; owed_paise: number }>,
): SplitAllocation[] {
  if (splitType === 'equal') {
    return equalSplit(totalPaise, participantIds);
  }
  if (splitType === 'custom') {
    if (!customAllocations || customAllocations.length === 0) {
      throw new Error('Custom split requires explicit allocations');
    }
    return customSplit(totalPaise, customAllocations);
  }
  throw new Error(`Unsupported split type: ${splitType}`);
}
