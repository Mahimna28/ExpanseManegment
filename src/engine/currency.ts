/**
 * Currency Utilities — Integer Paise
 *
 * Rule: All financial values are stored and computed as integer paise.
 * 1 Rupee = 100 Paise.
 * Never use floating-point arithmetic for financial calculations.
 */

/** Maximum allowed expense amount: ₹1,00,00,000 (one crore) in paise. */
export const MAX_EXPENSE_PAISE = 1_000_000_000;

/**
 * Converts a user-typed rupee string to integer paise.
 *
 * Examples:
 *   "100"      → 10000
 *   "100.50"   → 10050
 *   "100.5"    → 10050
 *   "100.505"  → throws ('Amount cannot have more than 2 decimal places')
 *   "1,250.00" → 125000
 *   ""         → throws
 *   "-1"       → throws (use absolute values; sign is expressed by context)
 *   "0"        → throws (zero not a valid expense amount)
 *
 * @throws {Error} if the input is not a valid positive rupee amount
 */
export function rupeesToPaise(input: string): number {
  const clean = input.trim().replace(/,/g, '');
  if (!clean) throw new Error('Amount is required');

  if (clean.includes('.')) {
    const decParts = clean.split('.');
    if (decParts.length > 2 || decParts[1].length > 2) {
      throw new Error('Amount cannot have more than 2 decimal places');
    }
  }

  // Must be a valid non-negative decimal number
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) {
    throw new Error(`Invalid amount: "${input}"`);
  }

  const parts = clean.split('.');
  const wholePart = parseInt(parts[0], 10);
  let fracPart = 0;

  if (parts.length === 2) {
    // Pad to exactly 2 digits (e.g. "5" → "50")
    const fracStr = (parts[1] + '0').substring(0, 2);
    fracPart = parseInt(fracStr, 10);
  }

  const paise = wholePart * 100 + fracPart;

  if (paise <= 0) throw new Error('Amount must be greater than zero');
  if (paise > MAX_EXPENSE_PAISE) {
    throw new Error(`Amount exceeds maximum of ₹${MAX_EXPENSE_PAISE / 100}`);
  }

  return paise;
}

/**
 * Converts integer paise to a display string.
 *
 * Examples:
 *   10000  → "₹100.00"
 *   10050  → "₹100.50"
 *   5      → "₹0.05"
 *   -2550  → "-₹25.50"
 */
export function paiseToRupees(paise: number, includeSymbol = true): string {
  const isNegative = paise < 0;
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const cents = abs % 100;

  const formatted = rupees.toLocaleString('en-IN');
  const symbol = includeSymbol ? '₹' : '';
  const sign = isNegative ? '-' : '';

  return `${sign}${symbol}${formatted}.${String(cents).padStart(2, '0')}`;
}

/**
 * Returns a balance status label and color for display.
 *
 * Positive paise = member is owed money (creditor).
 * Negative paise = member owes money (debtor).
 */
export function formatNetBalance(netPaise: number): { label: string; color: string } {
  if (netPaise === 0) return { label: 'Settled up', color: '#64748B' };
  if (netPaise > 0)
    return { label: `gets back ${paiseToRupees(netPaise)}`, color: '#10B981' };
  return { label: `owes ${paiseToRupees(Math.abs(netPaise))}`, color: '#EF4444' };
}
