import { useAuthStore } from '../src/stores/auth.store';
import { createGroupSchema } from '../src/engine/validation';

describe('Data Integrity & Architecture Guards', () => {
  describe('Auth Store Invariants', () => {
    beforeEach(() => {
      useAuthStore.getState().signOut();
    });

    test('setting null user enforces isAuthenticated = false', () => {
      useAuthStore.getState().setUser(null, null);
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.userId).toBeNull();
      expect(state.profile).toBeNull();
    });

    test('setting valid authenticated user sets isAuthenticated = true', () => {
      const realUserId = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
      useAuthStore.getState().setUser(realUserId, {
        id: realUserId,
        email: 'user@example.com',
        display_name: 'Real User',
        updated_at: new Date().toISOString(),
      });

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.userId).toBe(realUserId);
      expect(state.profile?.display_name).toBe('Real User');
    });

    test('signOut completely resets auth state and locks down app', () => {
      useAuthStore.getState().setUser('some-user-id', {
        id: 'some-user-id',
        email: 'test@example.com',
        display_name: 'Test',
        updated_at: new Date().toISOString(),
      });

      useAuthStore.getState().signOut();
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.userId).toBeNull();
      expect(state.profile).toBeNull();
      expect(state.appLockStatus).toBe('disabled');
    });
  });

  describe('Group Creation Validation', () => {
    test('validates group name within bounds (1-80 characters)', () => {
      const valid = createGroupSchema.safeParse({
        name: 'Road Trip to Ladakh',
        description: 'July 2026',
      });
      expect(valid.success).toBe(true);
    });

    test('rejects empty group name', () => {
      const invalid = createGroupSchema.safeParse({
        name: '',
      });
      expect(invalid.success).toBe(false);
      if (!invalid.success) {
        expect(invalid.error.errors[0].message).toBe('Group name is required');
      }
    });

    test('rejects group name exceeding 80 characters', () => {
      const longName = 'A'.repeat(81);
      const invalid = createGroupSchema.safeParse({
        name: longName,
      });
      expect(invalid.success).toBe(false);
      if (!invalid.success) {
        expect(invalid.error.errors[0].message).toBe('Group name must be 80 characters or less');
      }
    });

    test('formats network error into clear user-facing guidance', () => {
      function getFriendlyErrorMessage(err: unknown): string {
        let msg = 'Could not create group.';
        if (err instanceof Error) {
          msg = err.message;
        }
        if (
          msg.toLowerCase().includes('network') ||
          msg.toLowerCase().includes('fetch') ||
          msg.toLowerCase().includes('connection')
        ) {
          return 'Internet connection required: Creating a new shared group requires an active internet connection so an official invite code can be registered. Please check your connection and try again.';
        }
        return msg;
      }

      const netErr = new Error('Network request failed: fetch error');
      const friendly = getFriendlyErrorMessage(netErr);
      expect(friendly).toContain('Internet connection required');
      expect(friendly).toContain('official invite code can be registered');
    });
  });
});
