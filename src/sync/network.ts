/**
 * Network Listener — triggers sync on connectivity change.
 * Initialize once at app startup.
 */

import NetInfo from '@react-native-community/netinfo';
import { AppState, AppStateStatus } from 'react-native';
import { triggerSync } from './engine';

let netInfoUnsubscribe: (() => void) | null = null;
let appStateSubscription: { remove: () => void } | null = null;

export function startNetworkListener(): void {
  if (netInfoUnsubscribe) return; // Already started

  // Sync on network reconnect
  netInfoUnsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable) {
      triggerSync().catch(console.warn);
    }
  });

  // Sync when app comes to foreground (catches silent background revocations)
  appStateSubscription = AppState.addEventListener(
    'change',
    (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        triggerSync().catch(console.warn);
      }
    },
  );
}

export function stopNetworkListener(): void {
  netInfoUnsubscribe?.();
  netInfoUnsubscribe = null;
  appStateSubscription?.remove();
  appStateSubscription = null;
}
