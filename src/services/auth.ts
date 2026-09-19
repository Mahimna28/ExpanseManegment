import { supabase } from './supabase';
import type { Profile } from '../types/models';

// ── Sign up ───────────────────────────────────────────────────

/**
 * Creates a new Supabase Auth user with email and password.
 * Returns the session. The profile row is created by a Postgres trigger.
 *
 * @throws Supabase AuthError on failure (email already in use, weak password, etc.)
 */
export async function signUp(
  email: string,
  password: string,
  displayName: string,
): Promise<void> {
  const { error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: { display_name: displayName.trim() },
    },
  });
  if (error) throw error;
}

// ── Sign in ───────────────────────────────────────────────────

/**
 * Signs in with email and password.
 * Returns the session on success.
 *
 * @throws AuthApiError if credentials are invalid.
 */
export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw error;
}

// ── Password reset ────────────────────────────────────────────

/**
 * Sends a password-reset email.
 * The email contains a link that deep-links back to the app.
 *
 * @throws AuthApiError if the request fails.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    {
      redirectTo: 'expenseshare://reset-password',
    },
  );
  if (error) throw error;
}

/**
 * Called after the user arrives via the reset-password deep link.
 * Updates the password using the active session established by the link.
 */
export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

// ── Session ───────────────────────────────────────────────────

/**
 * Returns the current authenticated user or null.
 */
export async function getCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Fetches the current user's profile from the server.
 * Falls back to a minimal profile derived from auth metadata if the
 * profile row doesn't exist yet (e.g., between signup and trigger execution).
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error || !data) {
    // Profile trigger may not have fired yet — return minimal shape
    return {
      id: user.id,
      display_name:
        user.user_metadata?.display_name ?? user.email?.split('@')[0] ?? 'User',
      email: user.email ?? '',
      updated_at: user.created_at,
    };
  }

  return data as Profile;
}

// ── Sign out ──────────────────────────────────────────────────

/**
 * Signs out the current user.
 * The caller is responsible for clearing local SQLite data before
 * or immediately after calling this function.
 *
 * @throws AuthApiError if the network request fails.
 */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
