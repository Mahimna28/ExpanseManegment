import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
  ScrollView,
  TextInput,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { signOut } from '../../src/services/auth';
import { useAuthStore } from '../../src/stores/auth.store';
import { useSyncStore } from '../../src/stores/sync.store';
import { useAppLock } from '../../src/hooks/useAppLock';
import { triggerSync } from '../../src/sync/engine';
import { getDatabase } from '../../src/db/client';
import { User, Lock, RefreshCw, LogOut } from 'lucide-react-native';

export default function SettingsScreen() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const { pendingCount, lastSyncedAt } = useSyncStore();
  const { appLockEnabled, setupPin, disableAppLock } = useAppLock();

  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const handleToggleAppLock = (value: boolean) => {
    if (value) {
      setNewPin('');
      setConfirmPin('');
      setPinError(null);
      setPinModalVisible(true);
    } else {
      Alert.alert(
        'Disable App Lock',
        'Are you sure you want to remove PIN protection?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disable',
            style: 'destructive',
            onPress: () => disableAppLock(),
          },
        ],
      );
    }
  };

  const handleSavePin = async () => {
    if (newPin.length < 4) {
      setPinError('PIN must be at least 4 digits');
      return;
    }
    if (newPin !== confirmPin) {
      setPinError("PINs don't match");
      return;
    }
    await setupPin(newPin);
    setPinModalVisible(false);
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    await triggerSync().catch(console.warn);
    setSyncing(false);
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      pendingCount > 0
        ? `You have ${pendingCount} unsynced changes. Signing out will clear local data and these changes will be lost!`
        : 'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              // 1. Clear local SQLite data
              const db = getDatabase();
              db.withTransactionSync(() => {
                db.runSync(`DELETE FROM local_outbox`);
                db.runSync(`DELETE FROM local_splits`);
                db.runSync(`DELETE FROM local_expenses`);
                db.runSync(`DELETE FROM local_settlements`);
                db.runSync(`DELETE FROM local_members`);
                db.runSync(`DELETE FROM local_categories`);
                db.runSync(`DELETE FROM local_sync_cursors`);
                db.runSync(`DELETE FROM local_groups`);
              });

              // 2. Sign out of Supabase
              await signOut();
            } catch (err: unknown) {
              console.warn(err);
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Section */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Profile</Text>
        <View style={styles.card}>
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <User size={24} color="#94A3B8" />
            </View>
            <View style={styles.profileDetails}>
              <Text style={styles.profileName}>{profile?.display_name || 'Member'}</Text>
              <Text style={styles.profileEmail}>{profile?.email || 'No email'}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Security Section */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Security</Text>
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingLabelGroup}>
              <Lock size={18} color="#94A3B8" />
              <View>
                <Text style={styles.settingTitle}>App Lock (PIN / Biometrics)</Text>
                <Text style={styles.settingSubtitle}>
                  Require PIN to view expenses when reopening the app
                </Text>
              </View>
            </View>
            <Switch
              value={appLockEnabled}
              onValueChange={handleToggleAppLock}
              trackColor={{ false: '#334155', true: '#2563EB' }}
              thumbColor={appLockEnabled ? '#FFFFFF' : '#94A3B8'}
            />
          </View>
        </View>
      </View>

      {/* Sync Section */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Offline Synchronization</Text>
        <View style={styles.card}>
          <View style={styles.syncInfoRow}>
            <Text style={styles.syncLabel}>Pending Changes:</Text>
            <Text style={styles.syncValue}>{pendingCount} items</Text>
          </View>
          <View style={styles.syncInfoRow}>
            <Text style={styles.syncLabel}>Last Synced:</Text>
            <Text style={styles.syncValue}>
              {lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString() : 'Never'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.syncButton, syncing && styles.buttonDisabled]}
            onPress={handleSyncNow}
            disabled={syncing}
          >
            <RefreshCw size={16} color="#FFFFFF" />
            <Text style={styles.syncButtonText}>
              {syncing ? 'Syncing...' : 'Sync Now'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Sign Out */}
      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <LogOut size={18} color="#EF4444" />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      {/* PIN Setup Modal */}
      <Modal visible={pinModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Set App Lock PIN</Text>
            <Text style={styles.modalSubtitle}>
              Choose a 4 to 6-digit numeric PIN to secure your local expense data.
            </Text>

            <TextInput
              style={styles.modalPinInput}
              value={newPin}
              onChangeText={setNewPin}
              placeholder="New PIN (4-6 digits)"
              placeholderTextColor="#64748B"
              keyboardType="numeric"
              secureTextEntry
              maxLength={6}
            />

            <TextInput
              style={styles.modalPinInput}
              value={confirmPin}
              onChangeText={setConfirmPin}
              placeholder="Confirm PIN"
              placeholderTextColor="#64748B"
              keyboardType="numeric"
              secureTextEntry
              maxLength={6}
            />

            {pinError && <Text style={styles.modalError}>{pinError}</Text>}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setPinModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={handleSavePin}
              >
                <Text style={styles.modalSaveText}>Enable Lock</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  profileDetails: {
    flex: 1,
  },
  profileName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#F8FAFC',
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 13,
    color: '#94A3B8',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 10,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#F8FAFC',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 12,
    color: '#64748B',
  },
  syncInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  syncLabel: {
    fontSize: 14,
    color: '#94A3B8',
  },
  syncValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    paddingVertical: 11,
    borderRadius: 10,
    marginTop: 8,
  },
  syncButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#EF4444',
    marginTop: 8,
    marginBottom: 40,
  },
  signOutText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 20,
    lineHeight: 18,
  },
  modalPinInput: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#F8FAFC',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalError: {
    color: '#EF4444',
    fontSize: 12,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#0F172A',
  },
  modalCancelText: {
    color: '#94A3B8',
    fontWeight: '600',
  },
  modalSaveButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#2563EB',
  },
  modalSaveText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
