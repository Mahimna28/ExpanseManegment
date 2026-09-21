import { calculateNetBalances, simplifyDebts, assertBalanceConservation } from '../src/engine/debt-graph';
import { equalSplit, customSplit, calculateSplits, SplitAllocation } from '../src/engine/split-math';
import { rupeesToPaise, paiseToRupees, formatNetBalance, MAX_EXPENSE_PAISE } from '../src/engine/currency';
import {
  expenseSchema,
  settlementSchema,
  inviteCodeSchema,
  createGroupSchema,
} from '../src/engine/validation';
import type { Expense, Settlement } from '../src/types/models';

describe('Phase 3 — End-to-End User Workflows & System Verification', () => {
  const userA = '00000000-0000-0000-0000-000000000001';
  const userB = '00000000-0000-0000-0000-000000000002';
  const userC = '00000000-0000-0000-0000-000000000003';
  const groupId = '00000000-0000-0000-0000-000000000010';
  const members = [userA, userB, userC];

  // Helper to create test expense
  function createExpenseRecord(
    id: string,
    paidBy: string,
    totalPaise: number,
    splits: { participant_id: string; owed_paise: number }[],
    isVoided = false,
  ): Expense {
    return {
      id,
      group_id: groupId,
      category_id: undefined,
      title: `Expense ${id}`,
      notes: undefined,
      split_type: 'equal',
      expense_date: '2026-09-21',
      total_paise: totalPaise,
      paid_by: paidBy,
      is_voided: isVoided,
      server_version: 1,
      sync_status: 'synced',
      created_by: paidBy,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      splits: splits.map((s, idx) => ({
        id: `split-${id}-${idx}`,
        expense_id: id,
        participant_id: s.participant_id,
        owed_paise: s.owed_paise,
      })),
    };
  }

  // Helper to create test settlement
  function createSettlementRecord(
    id: string,
    fromUserId: string,
    toUserId: string,
    amountPaise: number,
    isVoided = false,
  ): Settlement {
    return {
      id,
      group_id: groupId,
      from_user_id: fromUserId,
      to_user_id: toUserId,
      amount_paise: amountPaise,
      payment_method: 'upi',
      note: 'Settling bill',
      is_voided: isVoided,
      sync_status: 'synced',
      created_by: fromUserId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  describe('Scenario 1: Complete Multi-User Expense & Settlement Lifecycle', () => {
    test('User A, B, C travel flow: expense creation -> equal split -> custom split -> debt simplification -> full settlement', () => {
      // Step 1: User A creates Group
      const groupValidation = createGroupSchema.safeParse({
        name: 'Goa Trip 2026',
        description: 'Friends vacation',
      });
      expect(groupValidation.success).toBe(true);

      // Step 2: User B & C join with valid invite codes
      const inviteValidation = inviteCodeSchema.safeParse('GOA2026ABC');
      expect(inviteValidation.success).toBe(true);

      // Initially all balances are 0
      const expenses: Expense[] = [];
      const settlements: Settlement[] = [];
      let netBalances = calculateNetBalances(members, expenses, settlements);
      expect(() => assertBalanceConservation(netBalances)).not.toThrow();
      expect(netBalances.get(userA)).toBe(0);
      expect(netBalances.get(userB)).toBe(0);
      expect(netBalances.get(userC)).toBe(0);

      // Step 3: User A pays ₹1500 (150,000 paise) for Hotel (split equally among A, B, C)
      const hotelPaise = rupeesToPaise('1500.00');
      expect(hotelPaise).toBe(150000);

      const hotelSplits = equalSplit(hotelPaise, members);
      expect(hotelSplits).toHaveLength(3);
      // 150000 / 3 = 50000 paise (₹500.00) each
      expect(hotelSplits.every((s: SplitAllocation) => s.owed_paise === 50000)).toBe(true);
      expect(hotelSplits.reduce((acc: number, s: SplitAllocation) => acc + s.owed_paise, 0)).toBe(hotelPaise);

      expenses.push(createExpenseRecord('exp-hotel', userA, hotelPaise, hotelSplits));
      netBalances = calculateNetBalances(members, expenses, settlements);
      expect(() => assertBalanceConservation(netBalances)).not.toThrow();
      // User A paid 1500, owes 500 -> net +1000
      expect(netBalances.get(userA)).toBe(100000);
      // User B owes 500 -> net -500
      expect(netBalances.get(userB)).toBe(-50000);
      // User C owes 500 -> net -500
      expect(netBalances.get(userC)).toBe(-50000);

      // Step 4: User B pays ₹600 (60,000 paise) for Dinner with custom split:
      // A ate ₹100 (10,000 paise), B ate ₹200 (20,000 paise), C ate ₹300 (30,000 paise)
      const dinnerPaise = 60000;
      const dinnerCustomSplits = [
        { participant_id: userA, owed_paise: 10000 },
        { participant_id: userB, owed_paise: 20000 },
        { participant_id: userC, owed_paise: 30000 },
      ];
      const validatedDinnerSplits = customSplit(dinnerPaise, dinnerCustomSplits);
      expect(validatedDinnerSplits).toHaveLength(3);

      expenses.push(createExpenseRecord('exp-dinner', userB, dinnerPaise, validatedDinnerSplits));
      netBalances = calculateNetBalances(members, expenses, settlements);
      expect(() => assertBalanceConservation(netBalances)).not.toThrow();
      // User A: was +1000, now owes 100 -> +900 (+90,000 paise)
      expect(netBalances.get(userA)).toBe(90000);
      // User B: was -500, paid 600, owes 200 -> -500 + 400 = -100 (-10,000 paise)
      expect(netBalances.get(userB)).toBe(-10000);
      // User C: was -500, owes 300 -> -800 (-80,000 paise)
      expect(netBalances.get(userC)).toBe(-80000);

      // Step 5: Debt Simplification Graph
      const suggestions = simplifyDebts(netBalances);
      // Optimal transfers:
      // User B owes User A ₹100 (10,000 paise)
      // User C owes User A ₹800 (80,000 paise)
      expect(suggestions).toHaveLength(2);
      expect(suggestions).toContainEqual({
        from_user_id: userB,
        to_user_id: userA,
        amount_paise: 10000,
      });
      expect(suggestions).toContainEqual({
        from_user_id: userC,
        to_user_id: userA,
        amount_paise: 80000,
      });

      // Step 6: User B records settlement of ₹100 to User A via UPI
      settlements.push(createSettlementRecord('stl-1', userB, userA, 10000));
      netBalances = calculateNetBalances(members, expenses, settlements);
      expect(() => assertBalanceConservation(netBalances)).not.toThrow();
      expect(netBalances.get(userB)).toBe(0); // User B completely settled!
      expect(netBalances.get(userA)).toBe(80000); // User A still owed 800
      expect(netBalances.get(userC)).toBe(-80000); // User C still owes 800

      // Step 7: User C records settlement of ₹800 to User A
      settlements.push(createSettlementRecord('stl-2', userC, userA, 80000));
      netBalances = calculateNetBalances(members, expenses, settlements);
      expect(() => assertBalanceConservation(netBalances)).not.toThrow();
      expect(netBalances.get(userA)).toBe(0);
      expect(netBalances.get(userB)).toBe(0);
      expect(netBalances.get(userC)).toBe(0); // ALL BALANCES CLEARED TO EXACT 0!

      // Suggestions should now be empty
      const finalSuggestions = simplifyDebts(netBalances);
      expect(finalSuggestions).toHaveLength(0);
    });
  });

  describe('Scenario 2: Voiding Lifecycle & Balance Recalculation', () => {
    test('voiding an expense accurately removes it from debt calculations without deleting records', () => {
      const expenses = [
        createExpenseRecord('exp-1', userA, 30000, [
          { participant_id: userA, owed_paise: 15000 },
          { participant_id: userB, owed_paise: 15000 },
        ]),
      ];
      let netBalances = calculateNetBalances([userA, userB], expenses, []);
      expect(netBalances.get(userA)).toBe(15000);
      expect(netBalances.get(userB)).toBe(-15000);

      // Void the expense
      expenses[0].is_voided = true;
      expenses[0].voided_by = userA;
      expenses[0].voided_at = new Date().toISOString();

      netBalances = calculateNetBalances([userA, userB], expenses, []);
      expect(() => assertBalanceConservation(netBalances)).not.toThrow();
      expect(netBalances.get(userA)).toBe(0);
      expect(netBalances.get(userB)).toBe(0);
    });

    test('voiding a settlement restores the original debt balance', () => {
      const expenses = [
        createExpenseRecord('exp-1', userA, 40000, [
          { participant_id: userA, owed_paise: 20000 },
          { participant_id: userB, owed_paise: 20000 },
        ]),
      ];
      const settlements = [
        createSettlementRecord('stl-1', userB, userA, 20000),
      ];

      // With settlement active, net balance is 0
      let netBalances = calculateNetBalances([userA, userB], expenses, settlements);
      expect(netBalances.get(userA)).toBe(0);
      expect(netBalances.get(userB)).toBe(0);

      // Void the settlement (e.g. payment bounced or logged by mistake)
      settlements[0].is_voided = true;
      settlements[0].voided_by = userB;

      netBalances = calculateNetBalances([userA, userB], expenses, settlements);
      expect(() => assertBalanceConservation(netBalances)).not.toThrow();
      // Original debt restored
      expect(netBalances.get(userA)).toBe(20000);
      expect(netBalances.get(userB)).toBe(-20000);
    });
  });

  describe('Scenario 3: Remainder & Integer Paise Conservation Under Division', () => {
    test('odd amount division preserves exact total with no fractional paise loss', () => {
      // ₹10.00 = 1000 paise split between 3 people -> 334, 333, 333
      const totalPaise = 1000;
      const splits = equalSplit(totalPaise, [userA, userB, userC]);
      const sum = splits.reduce((acc: number, s: SplitAllocation) => acc + s.owed_paise, 0);
      expect(sum).toBe(totalPaise);
      expect(splits[0].owed_paise).toBe(334);
      expect(splits[1].owed_paise).toBe(333);
      expect(splits[2].owed_paise).toBe(333);
    });

    test('1 paise split between 3 people allocates 1 paise to first member and 0 to others', () => {
      const splits = equalSplit(1, [userA, userB, userC]);
      const sum = splits.reduce((acc: number, s: SplitAllocation) => acc + s.owed_paise, 0);
      expect(sum).toBe(1);
      expect(splits[0].owed_paise).toBe(1);
      expect(splits[1].owed_paise).toBe(0);
      expect(splits[2].owed_paise).toBe(0);
    });

    test('rejection of amounts exceeding MAX_EXPENSE_PAISE (₹1,00,00,000.00 / 1 Crore)', () => {
      expect(() => {
        rupeesToPaise('10000000.01');
      }).toThrow('exceeds maximum');
    });

    test('currency formatting handles zero, positive, negative, and net balance labels', () => {
      expect(paiseToRupees(0, false)).toBe('0.00');
      expect(paiseToRupees(50, false)).toBe('0.50');
      expect(paiseToRupees(150000, true)).toBe('₹1,500.00');
      expect(paiseToRupees(-50000, true)).toBe('-₹500.00');

      const zeroStatus = formatNetBalance(0);
      expect(zeroStatus.label).toBe('Settled up');

      const positiveStatus = formatNetBalance(50000);
      expect(positiveStatus.label).toContain('gets back');

      const negativeStatus = formatNetBalance(-50000);
      expect(negativeStatus.label).toContain('owes');
    });
  });

  describe('Scenario 4: Circular Debt Resolution (Debt Minimization)', () => {
    test('resolves circular chain (A -> B -> C -> A) to minimal net transfers', () => {
      // User A owes B ₹100 (10,000)
      // User B owes C ₹100 (10,000)
      // User C owes A ₹100 (10,000)
      // Mathematically, all net balances are 0! No transfers needed.
      const expenses = [
        // B paid 100 for A
        createExpenseRecord('e1', userB, 10000, [{ participant_id: userA, owed_paise: 10000 }]),
        // C paid 100 for B
        createExpenseRecord('e2', userC, 10000, [{ participant_id: userB, owed_paise: 10000 }]),
        // A paid 100 for C
        createExpenseRecord('e3', userA, 10000, [{ participant_id: userC, owed_paise: 10000 }]),
      ];

      const netBalances = calculateNetBalances(members, expenses, []);
      expect(netBalances.get(userA)).toBe(0);
      expect(netBalances.get(userB)).toBe(0);
      expect(netBalances.get(userC)).toBe(0);

      const transfers = simplifyDebts(netBalances);
      expect(transfers).toHaveLength(0);
    });

    test('resolves 4-party asymmetrical debts to minimal transactions', () => {
      const userD = '00000000-0000-0000-0000-000000000004';

      // Net balances:
      // A: +30000 (creditor)
      // B: +20000 (creditor)
      // C: -40000 (debtor)
      // D: -10000 (debtor)
      const balances = new Map<string, number>([
        [userA, 30000],
        [userB, 20000],
        [userC, -40000],
        [userD, -10000],
      ]);
      expect(() => assertBalanceConservation(balances)).not.toThrow();

      const transfers = simplifyDebts(balances);
      // Optimal minimal transfers: 3 transfers instead of all-to-all
      expect(transfers).toHaveLength(3);

      const totalTransferred = transfers.reduce((sum, t) => sum + t.amount_paise, 0);
      expect(totalTransferred).toBe(50000); // 30000 + 10000 + 10000 = 50000
    });
  });

  describe('Scenario 5: Input Validation & Edge Case Rejections', () => {
    test('settlement validation rejects 0 or negative amounts', () => {
      const zeroAmount = settlementSchema.safeParse({
        group_id: groupId,
        from_user_id: userA,
        to_user_id: userB,
        amount_paise: 0,
        payment_method: 'upi',
      });
      expect(zeroAmount.success).toBe(false);

      const negativeAmount = settlementSchema.safeParse({
        group_id: groupId,
        from_user_id: userA,
        to_user_id: userB,
        amount_paise: -500,
        payment_method: 'upi',
      });
      expect(negativeAmount.success).toBe(false);
    });

    test('settlement validation rejects paying oneself', () => {
      const selfPay = settlementSchema.safeParse({
        group_id: groupId,
        from_user_id: userA,
        to_user_id: userA,
        amount_paise: 5000,
        payment_method: 'upi',
      });
      expect(selfPay.success).toBe(false);
    });

    test('expense validation enforces valid equal and custom split schema', () => {
      // Valid equal split
      const validEqual = expenseSchema.safeParse({
        group_id: groupId,
        title: 'Snacks',
        total_paise: 1000,
        paid_by: userA,
        split_type: 'equal',
        expense_date: '2026-09-21',
        participant_ids: [userA, userB],
      });
      expect(validEqual.success).toBe(true);

      // Rejects empty participants
      const noParticipants = expenseSchema.safeParse({
        group_id: groupId,
        title: 'Snacks',
        total_paise: 1000,
        paid_by: userA,
        split_type: 'equal',
        expense_date: '2026-09-21',
        participant_ids: [],
      });
      expect(noParticipants.success).toBe(false);

      // Valid custom split
      const validCustom = expenseSchema.safeParse({
        group_id: groupId,
        title: 'Taxi',
        total_paise: 1000,
        paid_by: userA,
        split_type: 'custom',
        expense_date: '2026-09-21',
        allocations: [
          { participant_id: userA, owed_paise: 600 },
          { participant_id: userB, owed_paise: 400 },
        ],
      });
      expect(validCustom.success).toBe(true);
    });

    test('invite code validation rejects invalid characters or length', () => {
      expect(inviteCodeSchema.safeParse('').success).toBe(false);
      expect(inviteCodeSchema.safeParse('12345678901').success).toBe(false); // 11 chars
      expect(inviteCodeSchema.safeParse('VALID123').success).toBe(true);
    });
  });
});
