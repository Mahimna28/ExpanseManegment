// Mock react-native
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

import {
  savePendingInviteCode,
  getPendingInviteCode,
  clearPendingInviteCode,
  redeemPendingInvite,
} from '../src/services/invites';
import { supabase } from '../src/services/supabase';
import { pullGroupChanges } from '../src/sync/pull';

// Mock expo-secure-store
let mockStorage: Record<string, string> = {};
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockStorage[key] ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockStorage[key] = value;
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    delete mockStorage[key];
  }),
}));

// Mock supabase client
jest.mock('../src/services/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    rpc: jest.fn(),
  },
}));

// Mock sync/pull
jest.mock('../src/sync/pull', () => ({
  pullGroupChanges: jest.fn(),
}));

// Mock sync store
jest.mock('../src/stores/sync.store', () => ({
  useSyncStore: {
    getState: () => ({
      incrementDbVersion: jest.fn(),
    }),
  },
}));

describe('Pending Invite Code Lifecycle & Auto-Redemption', () => {
  beforeEach(() => {
    mockStorage = {};
    jest.clearAllMocks();
  });

  describe('Storage Management', () => {
    test('saves and normalizes invite code to uppercase', async () => {
      await savePendingInviteCode('ab23cd45ef');
      const retrieved = await getPendingInviteCode();
      expect(retrieved).toBe('AB23CD45EF');
    });

    test('ignores empty or whitespace-only code', async () => {
      await savePendingInviteCode('   ');
      const retrieved = await getPendingInviteCode();
      expect(retrieved).toBeNull();
    });

    test('clears saved invite code', async () => {
      await savePendingInviteCode('AB23CD45EF');
      expect(await getPendingInviteCode()).toBe('AB23CD45EF');

      await clearPendingInviteCode();
      expect(await getPendingInviteCode()).toBeNull();
    });
  });

  describe('Redemption Flow', () => {
    test('returns null when no invite code is stored', async () => {
      const result = await redeemPendingInvite();
      expect(result).toBeNull();
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    test('returns null and preserves stored code when user is unauthenticated', async () => {
      await savePendingInviteCode('GRP1234567');
      (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: null },
      });

      const result = await redeemPendingInvite();
      expect(result).toBeNull();
      expect(supabase.rpc).not.toHaveBeenCalled();
      // Verify code is still in storage waiting for session
      expect(await getPendingInviteCode()).toBe('GRP1234567');
    });

    test('successfully redeems invite, clears storage, and pulls group changes', async () => {
      await savePendingInviteCode('GRP1234567');
      (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
      });
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: { group_id: 'group-real-uuid' },
        error: null,
      });

      const result = await redeemPendingInvite();
      expect(result).toEqual({ success: true, groupId: 'group-real-uuid' });
      expect(supabase.rpc).toHaveBeenCalledWith('join_group', {
        p_invite_code: 'GRP1234567',
      });
      expect(pullGroupChanges).toHaveBeenCalledWith('group-real-uuid');
      // Storage should be cleared after successful redemption
      expect(await getPendingInviteCode()).toBeNull();
    });

    test('handles already_member (P0005) cleanly and clears storage', async () => {
      await savePendingInviteCode('GRP1234567');
      (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
      });
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { code: 'P0005', message: 'already_member' },
      });

      const result = await redeemPendingInvite();
      expect(result).toEqual({ success: true, alreadyMember: true });
      expect(await getPendingInviteCode()).toBeNull();
    });

    test('clears storage and does not retry for permanent invalid invite code (P0004)', async () => {
      await savePendingInviteCode('BADCODE123');
      (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
      });
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { code: 'P0004', message: 'invalid_invite_code' },
      });

      const result = await redeemPendingInvite();
      expect(result?.success).toBe(false);
      expect(result?.shouldRetryLater).toBe(false);
      expect(await getPendingInviteCode()).toBeNull();
    });

    test('preserves storage for retry on network failure', async () => {
      await savePendingInviteCode('GRP1234567');
      (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
      });
      (supabase.rpc as jest.Mock).mockRejectedValueOnce(
        new Error('Network request failed'),
      );

      const result = await redeemPendingInvite();
      expect(result?.success).toBe(false);
      expect(result?.shouldRetryLater).toBe(true);
      // Storage should NOT be cleared so it can retry later
      expect(await getPendingInviteCode()).toBe('GRP1234567');
    });
  });
});
