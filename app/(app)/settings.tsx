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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signOut } from '../../src/services/auth';
import { useAuthStore } from '../../src/stores/auth.store';
import { useSyncStore } from '../../src/stores/sync.store';
import { useAppLock } from '../../src/hooks/useAppLock';
import { triggerSync } from '../../src/sync/engine';
import { getDatabase } from '../../src/db/client';
import { AppHeader, Avatar } from '../../src/components/ui';
import { colors, spacing, typography, radii, shadows } from '../../src/theme';
import { Lock, RefreshCw, LogOut, ShieldCheck, Mail, User } from 'lucide-react-native';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  const displayName = profile?.display_name || 'Member';
  const email = profile?.email || 'No email';

  return (
    <View style={styles.root}>
      <AppHeader
        title="Settings"
        showBack
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 24) + 24 },
        ]}
      >
        {/* Profile Card */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Account</Text>
          <View style={[styles.profileCard, shadows.subtle]}>
            <Avatar name={displayName} size={52} />
            <View style={styles.profileDetails}>
              <Text style={styles.profileName}>{displayName}</Text>
              <View style={styles.profileEmailRow}>
                <Mail size={13} color={colors.textSecondary} />
                <Text style={styles.profileEmail}>{email}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Security Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Security</Text>
          <View style={[styles.card, shadows.subtle]}>
            <View style={styles.settingRow}>
              <View style={styles.settingIconWrapper}>
                <Lock size={18} color={colors.primary} />
              </View>
              <View style={styles.settingTextGroup}>
                <Text style={styles.settingTitle}>App Lock (PIN)</Text>
                <Text style={styles.settingSubtitle}>
                  Require PIN to view expenses when reopening the app
                </Text>
              </View>
              <Switch
                value={appLockEnabled}
                onValueChange={handleToggleAppLock}
                trackColor={{ false: colors.borderSubtle, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </View>

        {/* Offline Synchronization Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Offline Synchronization</Text>
          <View style={[styles.card, shadows.subtle]}>
            <View style={styles.syncInfoRow}>
              <Text style={styles.syncLabel}>Pending Changes</Text>
              <View style={[styles.pendingPill, pendingCount > 0 && styles.pendingPillActive]}>
                <Text style={[styles.pendingPillText, pendingCount > 0 && styles.pendingPillTextActive]}>
                  {pendingCount} {pendingCount === 1 ? 'item' : 'items'}
                </Text>
              </View>
            </View>

            <View style={styles.syncDivider} />

            <View style={styles.syncInfoRow}>
              <Text style={styles.syncLabel}>Last Synced</Text>
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

        {/* Sign Out Button */}
        <TouchableOpacity
          style={[styles.signOutButton, shadows.subtle]}
          onPress={handleSignOut}
          activeOpacity={0.8}
        >
          <LogOut size={18} color={colors.danger} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* PIN Setup Modal */}
      <Modal visible={pinModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, shadows.floating]}>
            <View style={styles.modalIconWrap}>
              <ShieldCheck size={28} color={colors.primary} />
            </View>
            <Text style={styles.modalTitle}>Set App Lock PIN</Text>
            <Text style={styles.modalSubtitle}>
              Choose a 4 to 6-digit numeric PIN to secure your local expense data.
            </Text>

            <TextInput
              style={styles.modalPinInput}
              value={newPin}
              onChangeText={setNewPin}
              placeholder="New PIN (4-6 digits)"
              placeholderTextColor={colors.textDim}
              keyboardType="numeric"
              secureTextEntry
              maxLength={6}
            />

            <TextInput
              style={styles.modalPinInput}
              value={confirmPin}
              onChangeText={setConfirmPin}
              placeholder="Confirm PIN"
              placeholderTextColor={colors.textDim}
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.xs,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: spacing.xs,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  profileDetails: {
    flex: 1,
    gap: 3,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  profileEmailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  profileEmail: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  settingIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    backgroundColor: colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingTextGroup: {
    flex: 1,
    gap: 2,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  settingSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  syncInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  syncDivider: {
    height: 1,
    backgroundColor: colors.borderSubtle,
    marginVertical: spacing.sm,
  },
  syncLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  syncValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  pendingPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceSubtle,
  },
  pendingPillActive: {
    backgroundColor: colors.warningBg,
  },
  pendingPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  pendingPillTextActive: {
    color: colors.warning,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: radii.md,
    marginTop: spacing.md,
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
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.danger,
    marginTop: spacing.xs,
  },
  signOutText: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
  },
  modalIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 20,
    lineHeight: 18,
    textAlign: 'center',
  },
  modalPinInput: {
    width: '100%',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalError: {
    color: colors.danger,
    fontSize: 12,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    width: '100%',
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCancelText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  modalSaveButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.primary,
  },
  modalSaveText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
