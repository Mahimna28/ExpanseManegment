import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { pullGroupChanges } from '../sync/pull';
import { useSyncStore } from '../stores/sync.store';

const STORAGE_KEY = '@expenseshare/pending_invite_code';

/**
 * Saves a pending invite code to persistent storage (SecureStore on mobile, localStorage on web).
 */
export async function savePendingInviteCode(code: string): Promise<void> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return;

  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(STORAGE_KEY, normalized);
    } else {
      await SecureStore.setItemAsync(STORAGE_KEY, normalized);
    }
  } catch (err) {
    console.warn('Failed to save pending invite code:', err);
  }
}

/**
 * Retrieves the currently saved pending invite code, if any.
 */
export async function getPendingInviteCode(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return localStorage.getItem(STORAGE_KEY);
    }
    return await SecureStore.getItemAsync(STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to get pending invite code:', err);
    return null;
  }
}

/**
 * Clears any stored pending invite code.
 */
export async function clearPendingInviteCode(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      await SecureStore.deleteItemAsync(STORAGE_KEY);
    }
  } catch (err) {
    console.warn('Failed to clear pending invite code:', err);
  }
}

export interface RedeemResult {
  success: boolean;
  groupId?: string;
  alreadyMember?: boolean;
  error?: string;
  shouldRetryLater?: boolean;
}

/**
 * Attempts to redeem the pending invite code using the current authenticated session.
 *
 * Rules:
 * - If no pending code is found: returns null.
 * - If user is not authenticated: returns null and keeps the code stored for when the session arrives.
 * - If redemption succeeds: clears storage, pulls group changes, and increments DB version.
 * - If user is already a member (P0005): clears storage and returns success.
 * - If code is permanently invalid/expired (P0004, P0022, P0006): clears storage and returns error.
 * - If network error: retains code in storage so it can be retried later.
 */
export async function redeemPendingInvite(): Promise<RedeemResult | null> {
  const code = await getPendingInviteCode();
  if (!code) return null;

  try {
    const authRes = await supabase.auth.getUser();
    const user = authRes?.data?.user;
    if (!user) {
      // Cannot redeem without an authenticated session; preserve code
      return null;
    }
  } catch {
    return null;
  }

  try {
    const { data, error } = await supabase.rpc('join_group', {
      p_invite_code: code,
    });

    if (error) {
      const codeStr = error.code || '';
      const msg = error.message || '';

      // User is already a member - consider resolved
      if (codeStr === 'P0005' || msg.includes('already_member')) {
        await clearPendingInviteCode();
        return { success: true, alreadyMember: true };
      }

      // Permanent failures: invalid code, expired, or revoked
      if (
        codeStr === 'P0004' ||
        codeStr === 'P0022' ||
        codeStr === 'P0006' ||
        msg.includes('invalid_invite_code') ||
        msg.includes('invite_code_expired') ||
        msg.includes('membership_revoked')
      ) {
        await clearPendingInviteCode();
        return { success: false, error: msg, shouldRetryLater: false };
      }

      // Other RPC error (e.g. rate limit, or unexpected)
      // If locked out, keep for later retry
      if (codeStr === 'P0024' || msg.includes('too_many_failed_attempts')) {
        return { success: false, error: 'Rate limited. Will retry later.', shouldRetryLater: true };
      }

      // Temporary error / network failure
      return { success: false, error: msg, shouldRetryLater: true };
    }

    const groupId = data?.group_id;
    await clearPendingInviteCode();

    if (groupId) {
      try {
        await pullGroupChanges(groupId);
      } catch (pullErr) {
        console.warn('Post-join group pull failed (will sync on next cycle):', pullErr);
      }
      useSyncStore.getState().incrementDbVersion();
    }

    return { success: true, groupId };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network error';
    return { success: false, error: message, shouldRetryLater: true };
  }
}
