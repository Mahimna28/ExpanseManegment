/**
 * Debt Graph Engine — Pure Functions
 *
 * Computes per-member net balances in integer paise and produces
 * a minimum-cash-flow suggestion set for clearing them.
 *
 * Accounting identity (zero-sum conservation):
 *   SUM(balance, all members) = 0  always.
 *
 * Ledger equation for member u:
 *   balance(u) =
 *     + SUM(expense.total_paise WHERE paid_by = u AND NOT is_voided)
 *     - SUM(split.owed_paise  WHERE participant_id = u AND expense NOT voided)
 *     + SUM(settlement.amount_paise WHERE from_user_id = u AND NOT is_voided)
 *     - SUM(settlement.amount_paise WHERE to_user_id   = u AND NOT is_voided)
 *
 * Positive balance → member is owed money (creditor).
 * Negative balance → member owes money (debtor).
 */

import type { Expense, Settlement, MemberBalance, DebtSuggestion } from '../types/models';

// ── Net balance calculation ───────────────────────────────────

/**
 * Calculates net paise balance for every member.
 *
 * @param memberIds   - All member IDs to initialize in the map (even those with zero balance)
 * @param expenses    - Must include their `splits` array populated
 * @param settlements - Settlement records
 */
export function calculateNetBalances(
  memberIds: string[],
  expenses: Expense[],
  settlements: Settlement[],
): Map<string, number> {
  const net = new Map<string, number>();
  for (const id of memberIds) net.set(id, 0);

  // ── Expenses ──────────────────────────────────────────────
  for (const exp of expenses) {
    if (exp.is_voided) continue; // voided expenses excluded

    // Credit the payer
    net.set(exp.paid_by, (net.get(exp.paid_by) ?? 0) + exp.total_paise);

    // Debit each participant their share
    for (const split of exp.splits ?? []) {
      net.set(
        split.participant_id,
        (net.get(split.participant_id) ?? 0) - split.owed_paise,
      );
    }
  }

  // ── Settlements ───────────────────────────────────────────
  for (const s of settlements) {
    if (s.is_voided) continue; // voided settlements excluded

    // Debtor (from_user_id) paid money out → their balance increases (less debt)
    net.set(s.from_user_id, (net.get(s.from_user_id) ?? 0) + s.amount_paise);

    // Creditor (to_user_id) received money → their balance decreases (credit collected)
    net.set(s.to_user_id, (net.get(s.to_user_id) ?? 0) - s.amount_paise);
  }

  return net;
}

/**
 * Returns balances as a sorted array (largest creditor first).
 */
export function getSortedBalances(
  netMap: Map<string, number>,
): MemberBalance[] {
  const list: MemberBalance[] = [];
  netMap.forEach((net_paise, user_id) => list.push({ user_id, net_paise }));
  return list.sort((a, b) => b.net_paise - a.net_paise);
}

// ── Debt simplification ───────────────────────────────────────

/**
 * Produces the minimum number of transfers that would clear all balances.
 * Uses greedy two-pointer (minimum cash flow).
 *
 * DISPLAY ONLY — does not create settlement records.
 * The result is recomputed from current balances on every render.
 */
export function simplifyDebts(netMap: Map<string, number>): DebtSuggestion[] {
  const creditors: { id: string; balance: number }[] = [];
  const debtors: { id: string; balance: number }[] = [];

  netMap.forEach((balance, id) => {
    if (balance > 0) creditors.push({ id, balance });
    else if (balance < 0) debtors.push({ id, balance: -balance }); // store as positive
  });

  // Sort descending so largest amounts are matched first
  creditors.sort((a, b) => b.balance - a.balance);
  debtors.sort((a, b) => b.balance - a.balance);

  const suggestions: DebtSuggestion[] = [];
  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci];
    const debtor = debtors[di];
    const amount = Math.min(creditor.balance, debtor.balance);

    if (amount > 0) {
      suggestions.push({
        from_user_id: debtor.id,
        to_user_id: creditor.id,
        amount_paise: amount,
      });
    }

    creditor.balance -= amount;
    debtor.balance -= amount;

    if (creditor.balance === 0) ci++;
    if (debtor.balance === 0) di++;
  }

  return suggestions;
}

// ── Conservation check (for testing / debug builds) ──────────

/**
 * Asserts the zero-sum invariant.
 * Throws in development; logs warning in production.
 */
export function assertBalanceConservation(netMap: Map<string, number>): void {
  const sum = Array.from(netMap.values()).reduce((acc, v) => acc + v, 0);
  if (sum !== 0) {
    const msg = `Balance conservation violated: SUM = ${sum}. This is a data integrity bug.`;
    const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';
    if (isDev) throw new Error(msg);
    else console.warn(msg);
  }
}
