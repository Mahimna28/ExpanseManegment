import { rupeesToPaise, paiseToRupees, MAX_EXPENSE_PAISE } from '../src/engine/currency';

describe('rupeesToPaise', () => {
  // ── Happy path ──────────────────────────────────────────────
  test('integer string', () => expect(rupeesToPaise('100')).toBe(10000));
  test('decimal string — 2 decimal places', () => expect(rupeesToPaise('19.99')).toBe(1999));
  test('decimal string — 1 decimal place', () => expect(rupeesToPaise('100.5')).toBe(10050));
  test('comma-formatted', () => expect(rupeesToPaise('1,250.50')).toBe(125050));
  test('sub-rupee', () => expect(rupeesToPaise('0.05')).toBe(5));
  test('zero paise coin', () => expect(rupeesToPaise('0.01')).toBe(1));
  test('exact maximum', () => expect(rupeesToPaise('10000000')).toBe(MAX_EXPENSE_PAISE));

  // ── No float imprecision ────────────────────────────────────
  test('does not use float multiplication internally', () => {
    // 19.99 * 100 in JS = 1998.9999999999998 — our implementation avoids this
    expect(rupeesToPaise('19.99')).toBe(1999);
    expect(rupeesToPaise('0.10')).toBe(10);
    expect(rupeesToPaise('333.33')).toBe(33333);
  });

  // ── Error cases ─────────────────────────────────────────────
  test('empty string throws', () => expect(() => rupeesToPaise('')).toThrow());
  test('zero throws', () => expect(() => rupeesToPaise('0')).toThrow('greater than zero'));
  test('zero decimal throws', () => expect(() => rupeesToPaise('0.00')).toThrow('greater than zero'));
  test('negative throws', () => expect(() => rupeesToPaise('-100')).toThrow());
  test('exceeds max throws', () => expect(() => rupeesToPaise('10000001')).toThrow('maximum'));
  test('text throws', () => expect(() => rupeesToPaise('abc')).toThrow('Invalid amount'));
  test('too many decimals throws', () => expect(() => rupeesToPaise('1.234')).toThrow('Invalid amount'));
});

describe('paiseToRupees', () => {
  test('round rupees', () => expect(paiseToRupees(10000)).toBe('₹100.00'));
  test('with paise', () => expect(paiseToRupees(1999)).toBe('₹19.99'));
  test('sub-rupee', () => expect(paiseToRupees(5)).toBe('₹0.05'));
  test('negative', () => expect(paiseToRupees(-2550)).toBe('-₹25.50'));
  test('zero', () => expect(paiseToRupees(0)).toBe('₹0.00'));
  test('without symbol', () => expect(paiseToRupees(10000, false)).toBe('100.00'));
  test('large value formatted with Indian commas', () => {
    // 1 crore = ₹1,00,00,000.00 in Indian locale
    const result = paiseToRupees(MAX_EXPENSE_PAISE);
    expect(result).toContain('₹');
    expect(result).toContain('.00');
  });
});
