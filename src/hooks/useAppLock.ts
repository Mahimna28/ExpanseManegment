import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
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

  /**
   * Verifies the user-entered PIN against the stored SHA-256 hash.
   */
  async function verifyPin(pin: string): Promise<boolean> {
    try {
      const storedHash = await SecureStore.getItemAsync(APP_LOCK_PIN_KEY);
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
    await SecureStore.setItemAsync(APP_LOCK_PIN_KEY, hash);
    await SecureStore.setItemAsync(APP_LOCK_ENABLED_KEY, 'true');
    setAppLockEnabled(true);
    setAppLockStatus('unlocked');
  }

  /**
   * Disables app lock.
   */
  async function disableAppLock(): Promise<void> {
    await SecureStore.deleteItemAsync(APP_LOCK_PIN_KEY);
    await SecureStore.setItemAsync(APP_LOCK_ENABLED_KEY, 'false');
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
