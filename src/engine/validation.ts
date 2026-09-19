/**
 * Input Validation — Zod schemas for all financial and group inputs.
 *
 * These schemas run on the CLIENT before any local write or RPC call.
 * The server validates independently — never trust client-side validation alone.
 */

import { z } from 'zod';
import { MAX_EXPENSE_PAISE } from './currency';

// ── Primitives ────────────────────────────────────────────────

export const uuidSchema = z.string().uuid('Must be a valid UUID');

/** Integer paise: positive, non-zero, within limit */
export const paiseSchema = z
  .number()
  .int('Must be an integer')
  .positive('Must be greater than zero')
  .max(MAX_EXPENSE_PAISE, `Exceeds maximum of ₹${MAX_EXPENSE_PAISE / 100}`);

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(64, 'Name must be 64 characters or less');

export const groupNameSchema = z
  .string()
  .trim()
  .min(1, 'Group name is required')
  .max(80, 'Group name must be 80 characters or less');

export const inviteCodeSchema = z
  .string()
  .trim()
  .min(1, 'Invite code is required')
  .max(10, 'Invalid invite code');

export const categoryNameSchema = z
  .string()
  .trim()
  .min(1, 'Category name is required')
  .max(50, 'Category name must be 50 characters or less');

// ── Authentication ────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z
  .object({
    email: z.string().trim().email('Enter a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
    display_name: displayNameSchema,
    invite_code: inviteCodeSchema,
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export const resetPasswordSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
});

// ── Group management ──────────────────────────────────────────

export const createGroupSchema = z.object({
  name: groupNameSchema,
  description: z.string().trim().max(500).optional(),
});

export const updateGroupSchema = z.object({
  name: groupNameSchema.optional(),
  description: z.string().trim().max(500).optional(),
});

// ── Categories ────────────────────────────────────────────────

export const createCategorySchema = z.object({
  group_id: uuidSchema,
  name: categoryNameSchema,
});

export const updateCategorySchema = z.object({
  category_id: uuidSchema,
  name: categoryNameSchema,
});

// ── Expense ───────────────────────────────────────────────────

export const equalSplitExpenseSchema = z.object({
  group_id: uuidSchema,
  category_id: uuidSchema.nullable().optional(),
  title: z.string().trim().min(1, 'Title is required').max(200, 'Title too long'),
  notes: z.string().trim().max(2000).optional(),
  total_paise: paiseSchema,
  paid_by: uuidSchema,
  split_type: z.literal('equal'),
  expense_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  participant_ids: z
    .array(uuidSchema)
    .min(1, 'At least one participant required')
    .refine((ids) => new Set(ids).size === ids.length, {
      message: 'Duplicate participants are not allowed',
    }),
});

export const customSplitExpenseSchema = z.object({
  group_id: uuidSchema,
  category_id: uuidSchema.nullable().optional(),
  title: z.string().trim().min(1, 'Title is required').max(200, 'Title too long'),
  notes: z.string().trim().max(2000).optional(),
  total_paise: paiseSchema,
  paid_by: uuidSchema,
  split_type: z.literal('custom'),
  expense_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  allocations: z
    .array(
      z.object({
        participant_id: uuidSchema,
        owed_paise: z
          .number()
          .int('Must be an integer')
          .min(0, 'Cannot be negative'),
      }),
    )
    .min(1, 'At least one allocation required')
    .refine((allocs) => new Set(allocs.map((a) => a.participant_id)).size === allocs.length, {
      message: 'Duplicate participants are not allowed',
    }),
});

export const expenseSchema = z.discriminatedUnion('split_type', [
  equalSplitExpenseSchema,
  customSplitExpenseSchema,
]);

export type EqualSplitExpenseInput = z.infer<typeof equalSplitExpenseSchema>;
export type CustomSplitExpenseInput = z.infer<typeof customSplitExpenseSchema>;
export type ExpenseInput = z.infer<typeof expenseSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

// ── Settlement ────────────────────────────────────────────────

export const settlementSchema = z.object({
  group_id: uuidSchema,
  from_user_id: uuidSchema,
  to_user_id: uuidSchema,
  amount_paise: paiseSchema,
  payment_method: z.enum(['cash', 'upi', 'bank_transfer', 'other']),
  note: z.string().trim().max(200).optional(),
}).refine(
  (data) => data.from_user_id !== data.to_user_id,
  { message: 'Payer and recipient cannot be the same person', path: ['to_user_id'] },
);

export type SettlementInput = z.infer<typeof settlementSchema>;
