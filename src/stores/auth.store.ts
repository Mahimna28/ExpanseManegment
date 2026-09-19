import { create } from 'zustand';
import type { Profile } from '../types/models';

export type AppLockStatus = 'unlocked' | 'locked' | 'disabled';

interface AuthState {
  /** null = not authenticated */
  userId: string | null;
  profile: Profile | null;
  /** Whether the user's session is known to be valid */
  isAuthenticated: boolean;
  /** Whether the initial session check has completed */
  isBootstrapped: boolean;
  /** App lock state */
  appLockStatus: AppLockStatus;
  /** Whether app lock is configured by the user */
  appLockEnabled: boolean;
}

interface AuthActions {
  setUser: (userId: string | null, profile: Profile | null) => void;
  setProfile: (profile: Profile) => void;
  setBootstrapped: () => void;
  setAppLockEnabled: (enabled: boolean) => void;
  setAppLockStatus: (status: AppLockStatus) => void;
  signOut: () => void;
}

export const useAuthStore = create<AuthState & AuthActions>((set) => ({
  // ── Initial state ────────────────────────────────────────────
  userId: null,
  profile: null,
  isAuthenticated: false,
  isBootstrapped: false,
  appLockStatus: 'disabled',
  appLockEnabled: false,

  // ── Actions ──────────────────────────────────────────────────
  setUser: (userId, profile) =>
    set({ userId, profile, isAuthenticated: userId !== null }),

  setProfile: (profile) => set({ profile }),

  setBootstrapped: () => set({ isBootstrapped: true }),

  setAppLockEnabled: (enabled) =>
    set({
      appLockEnabled: enabled,
      appLockStatus: enabled ? 'locked' : 'disabled',
    }),

  setAppLockStatus: (status) => set({ appLockStatus: status }),

  signOut: () =>
    set({
      userId: null,
      profile: null,
      isAuthenticated: false,
      appLockStatus: 'disabled',
    }),
}));
