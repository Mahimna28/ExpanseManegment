import { useEffect } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { useAuthStore } from '../stores/auth.store';

const APP_LOCK_PIN_KEY = 'app_lock_pin_hash';
const APP_LOCK_ENABLED_KEY = 'app_lock_enabled';

export function useAppLock() {
  const {
    appLockStatus,
    appLockEnabled,
    setAppLockStatus,
    setAppLockEnabled,
  } = useAuthStore();

  // Load initial lock configuration from SecureStore
  useEffect(() => {
    async function loadConfig() {
      try {
        if (Platform.OS === 'web') {
          const enabled = typeof localStorage !== 'undefined' ? localStorage.getItem(APP_LOCK_ENABLED_KEY) : null;
          if (enabled === 'true') {
            setAppLockEnabled(true);
            setAppLockStatus('locked');
          } else {
            setAppLockEnabled(false);
            setAppLockStatus('disabled');
          }
          return;
        }
        const enabled = await SecureStore.getItemAsync(APP_LOCK_ENABLED_KEY);
        if (enabled === 'true') {
          setAppLockEnabled(true);
          setAppLockStatus('locked');
        } else {
          setAppLockEnabled(false);
          setAppLockStatus('disabled');
        }
      } catch {
        setAppLockEnabled(false);
        setAppLockStatus('disabled');
      }
    }
    loadConfig();
  }, []);

  // Lock when app goes to background
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState === 'background' && appLockEnabled) {
          setAppLockStatus('locked');
        }
      },
    );
    return () => subscription.remove();
  }, [appLockEnabled]);

  /**
   * Attempts biometric authentication (fingerprint / face recognition).
   */
  async function authenticateWithBiometrics(): Promise<boolean> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) return false;

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock ExpenseShare',
        fallbackLabel: 'Use PIN',
      });

      if (result.success) {
        setAppLockStatus('unlocked');
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  const safeStore = {
    getItem: async (key: string) => {
      if (Platform.OS === 'web') {
        return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
      }
      return SecureStore.getItemAsync(key);
    },
    setItem: async (key: string, value: string) => {
      if (Platform.OS === 'web') {
        if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
        return;
      }
      return SecureStore.setItemAsync(key, value);
    },
    deleteItem: async (key: string) => {
      if (Platform.OS === 'web') {
        if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
        return;
      }
      return SecureStore.deleteItemAsync(key);
    },
  };

  /**
   * Verifies the user-entered PIN against the stored SHA-256 hash.
   */
  async function verifyPin(pin: string): Promise<boolean> {
    try {
      const storedHash = await safeStore.getItem(APP_LOCK_PIN_KEY);
      if (!storedHash) return false;

      const inputHash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        pin,
      );

      if (inputHash === storedHash) {
        setAppLockStatus('unlocked');
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Sets up a new PIN and enables app lock.
   */
  async function setupPin(pin: string): Promise<void> {
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      pin,
    );
    await safeStore.setItem(APP_LOCK_PIN_KEY, hash);
    await safeStore.setItem(APP_LOCK_ENABLED_KEY, 'true');
    setAppLockEnabled(true);
    setAppLockStatus('unlocked');
  }

  /**
   * Disables app lock.
   */
  async function disableAppLock(): Promise<void> {
    await safeStore.deleteItem(APP_LOCK_PIN_KEY);
    await safeStore.setItem(APP_LOCK_ENABLED_KEY, 'false');
    setAppLockEnabled(false);
    setAppLockStatus('disabled');
  }

  return {
    appLockStatus,
    appLockEnabled,
    authenticateWithBiometrics,
    verifyPin,
    setupPin,
    disableAppLock,
  };
}
