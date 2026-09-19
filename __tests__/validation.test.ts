import {
  equalSplitExpenseSchema,
  customSplitExpenseSchema,
  settlementSchema,
  loginSchema,
  registerSchema,
  categoryNameSchema,
  groupNameSchema,
} from '../src/engine/validation';
import { MAX_EXPENSE_PAISE } from '../src/engine/currency';

describe('Validation Schemas', () => {
  describe('group and category validation', () => {
    test('valid group name', () => {
      expect(groupNameSchema.parse('Goa Trip 2026')).toBe('Goa Trip 2026');
    });

    test('empty group name throws', () => {
      expect(() => groupNameSchema.parse('   ')).toThrow();
    });

    test('valid category name', () => {
      expect(categoryNameSchema.parse('Groceries')).toBe('Groceries');
    });

    test('overly long category name throws', () => {
      expect(() => categoryNameSchema.parse('a'.repeat(51))).toThrow();
    });
  });

  describe('auth validation', () => {
    test('valid login credentials', () => {
      const parsed = loginSchema.parse({
        email: 'user@example.com',
        password: 'secretPassword123',
      });
      expect(parsed.email).toBe('user@example.com');
    });

    test('invalid email throws', () => {
      expect(() =>
        loginSchema.parse({
          email: 'not-an-email',
          password: 'pass',
        }),
      ).toThrow();
    });

    test('matching passwords on register passes', () => {
      const parsed = registerSchema.parse({
        email: 'test@example.com',
        password: 'password123',
        confirmPassword: 'password123',
        display_name: 'Tester',
        invite_code: 'CODE123456',
      });
      expect(parsed.display_name).toBe('Tester');
    });

    test('mismatched passwords on register throws', () => {
      expect(() =>
        registerSchema.parse({
          email: 'test@example.com',
          password: 'password123',
          confirmPassword: 'differentPassword',
          display_name: 'Tester',
          invite_code: 'CODE123456',
        }),
      ).toThrow("Passwords don't match");
    });
  });

  describe('expense validation', () => {
    const validGroupId = '11111111-1111-4111-8111-111111111111';
    const validUserId1 = '22222222-2222-4222-8222-222222222222';
    const validUserId2 = '33333333-3333-4333-8333-333333333333';

    test('valid equal split expense', () => {
      const payload = {
        group_id: validGroupId,
        title: 'Dinner buffet',
        total_paise: 250000,
        paid_by: validUserId1,
        split_type: 'equal' as const,
        expense_date: '2026-09-20',
        participant_ids: [validUserId1, validUserId2],
      };
      const parsed = equalSplitExpenseSchema.parse(payload);
      expect(parsed.total_paise).toBe(250000);
    });

    test('equal split without participants throws', () => {
      expect(() =>
        equalSplitExpenseSchema.parse({
          group_id: validGroupId,
          title: 'Dinner buffet',
          total_paise: 250000,
          paid_by: validUserId1,
          split_type: 'equal',
          expense_date: '2026-09-20',
          participant_ids: [],
        }),
      ).toThrow();
    });

    test('valid custom split expense', () => {
      const payload = {
        group_id: validGroupId,
        title: 'Snacks',
        total_paise: 15000,
        paid_by: validUserId1,
        split_type: 'custom' as const,
        expense_date: '2026-09-20',
        allocations: [
          { participant_id: validUserId1, owed_paise: 10000 },
          { participant_id: validUserId2, owed_paise: 5000 },
        ],
      };
      const parsed = customSplitExpenseSchema.parse(payload);
      expect(parsed.allocations).toHaveLength(2);
    });

    test('negative allocation in custom split throws', () => {
      expect(() =>
        customSplitExpenseSchema.parse({
          group_id: validGroupId,
          title: 'Snacks',
          total_paise: 15000,
          paid_by: validUserId1,
          split_type: 'custom',
          expense_date: '2026-09-20',
          allocations: [
            { participant_id: validUserId1, owed_paise: -500 },
            { participant_id: validUserId2, owed_paise: 15500 },
          ],
        }),
      ).toThrow('Cannot be negative');
    });

    test('duplicate participant in equal split throws', () => {
      expect(() =>
        equalSplitExpenseSchema.parse({
          group_id: validGroupId,
          title: 'Dinner buffet',
          total_paise: 250000,
          paid_by: validUserId1,
          split_type: 'equal',
          expense_date: '2026-09-20',
          participant_ids: [validUserId1, validUserId1],
        }),
      ).toThrow('Duplicate participants are not allowed');
    });

    test('duplicate participant in custom split throws', () => {
      expect(() =>
        customSplitExpenseSchema.parse({
          group_id: validGroupId,
          title: 'Snacks',
          total_paise: 15000,
          paid_by: validUserId1,
          split_type: 'custom',
          expense_date: '2026-09-20',
          allocations: [
            { participant_id: validUserId1, owed_paise: 10000 },
            { participant_id: validUserId1, owed_paise: 5000 },
          ],
        }),
      ).toThrow('Duplicate participants are not allowed');
    });

    test('total_paise exceeding max throws', () => {
      expect(() =>
        equalSplitExpenseSchema.parse({
          group_id: validGroupId,
          title: 'Too big',
          total_paise: MAX_EXPENSE_PAISE + 1,
          paid_by: validUserId1,
          split_type: 'equal',
          expense_date: '2026-09-20',
          participant_ids: [validUserId1],
        }),
      ).toThrow('Exceeds maximum');
    });
  });

  describe('settlement validation', () => {
    const validGroupId = '11111111-1111-4111-8111-111111111111';
    const validPayer = '22222222-2222-4222-8222-222222222222';
    const validRecipient = '33333333-3333-4333-8333-333333333333';

    test('valid settlement', () => {
      const parsed = settlementSchema.parse({
        group_id: validGroupId,
        from_user_id: validPayer,
        to_user_id: validRecipient,
        amount_paise: 50000,
        payment_method: 'upi',
        note: 'UPI ref 12345',
      });
      expect(parsed.amount_paise).toBe(50000);
    });

    test('self settlement throws', () => {
      expect(() =>
        settlementSchema.parse({
          group_id: validGroupId,
          from_user_id: validPayer,
          to_user_id: validPayer,
          amount_paise: 50000,
          payment_method: 'cash',
        }),
      ).toThrow('Payer and recipient cannot be the same person');
    });
  });
});
