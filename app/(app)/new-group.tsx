import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../src/services/supabase';
import { GroupsRepo } from '../../src/repositories/groups.repo';
import { useAuthStore } from '../../src/stores/auth.store';
import { useSyncStore } from '../../src/stores/sync.store';
import { createGroupSchema } from '../../src/engine/validation';
import { AppHeader, PrimaryButton } from '../../src/components/ui';
import { colors, spacing, typography, radii, shadows } from '../../src/theme';
import { Users, FileText, ShieldCheck } from 'lucide-react-native';
import * as Crypto from 'expo-crypto';

export default function NewGroupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.userId);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setError(null);
    const validation = createGroupSchema.safeParse({ name, description });
    if (!validation.success) {
      setError(validation.error.errors[0].message);
      return;
    }

    if (!userId) return;

    setLoading(true);
    try {
      const { data, error: rpcErr } = await supabase.rpc('create_group', {
        p_name: name.trim(),
        p_description: description.trim() || null,
      });

      if (rpcErr) {
        if (rpcErr.code === 'P0003' || rpcErr.message.includes('invalid_group_name')) {
          throw new Error('Group name must be between 1 and 80 characters.');
        }
        if (rpcErr.code === 'P0001' || rpcErr.message.includes('not_authenticated')) {
          throw new Error('Your session has expired. Please sign in again.');
        }
        throw rpcErr;
      }

      const groupId = data?.group_id;
      const inviteCode = data?.invite_code;

      if (!groupId || !inviteCode) {
        throw new Error('Server did not return group information.');
      }

      // Cache the verified group in local SQLite
      const now = new Date().toISOString();
      GroupsRepo.upsertGroup({
        id: groupId,
        name: name.trim(),
        description: description.trim() || undefined,
        currency_code: 'INR',
        created_by: userId,
        invite_code: inviteCode,
        is_archived: false,
        created_at: now,
        updated_at: now,
      });

      GroupsRepo.upsertMember({
        id: Crypto.randomUUID(),
        group_id: groupId,
        user_id: userId,
        role: 'owner',
        status: 'active',
        joined_at: now,
        created_at: now,
      });

      useSyncStore.getState().incrementDbVersion();
      router.replace(`/(app)/group/${groupId}` as any);
    } catch (err: unknown) {
      let msg = 'Could not create group.';
      if (err instanceof Error) {
        msg = err.message;
      } else if (typeof err === 'object' && err !== null && 'message' in err) {
        msg = String((err as any).message);
      }

      // Network / offline specific guidance
      if (
        msg.toLowerCase().includes('network') ||
        msg.toLowerCase().includes('fetch') ||
        msg.toLowerCase().includes('failed to fetch') ||
        msg.toLowerCase().includes('connection')
      ) {
        msg =
          'Internet connection required: Creating a new shared group requires an active internet connection so an official invite code can be registered. Please check your connection and try again.';
      }

      setError(msg);
      Alert.alert('Group Creation Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <AppHeader
        title="Create Group"
        showBack
        onBack={() => router.back()}
      />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 24) + 16 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Visual Hero */}
          <View style={styles.heroSection}>
            <View style={[styles.heroIconCircle, shadows.subtle]}>
              <Users size={32} color={colors.primary[600]} />
            </View>
            <Text style={styles.heroTitle}>Start a New Group</Text>
            <Text style={styles.heroSubtitle}>
              Create a shared workspace for roommates, trips, or friends.
            </Text>
          </View>

          {/* Form Card */}
          <View style={[styles.card, shadows.subtle]}>
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Group Name</Text>
                <Text style={styles.charCount}>{name.length}/80</Text>
              </View>
              <View style={[styles.inputWrapper, error && styles.inputError]}>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={(t) => {
                    setError(null);
                    setName(t);
                  }}
                  placeholder="e.g. Goa Trip 2026, Flat 402"
                  placeholderTextColor={colors.textMuted}
                  maxLength={80}
                  autoFocus
                />
              </View>
              {error && <Text style={styles.errorText}>{error}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description (Optional)</Text>
              <View style={styles.multilineWrapper}>
                <TextInput
                  style={styles.multilineInput}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="What will this group share? (trips, groceries, dinners)"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={3}
                  maxLength={500}
                />
              </View>
            </View>

            <PrimaryButton
              label="Create Group"
              onPress={handleCreate}
              loading={loading}
            />
          </View>

          {/* Security & Offline Notice */}
          <View style={styles.infoRow}>
            <ShieldCheck size={16} color={colors.textSecondary} />
            <Text style={styles.infoText}>
              All group expenses are private and invite-only.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.lg,
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  heroIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.surfaceSelected,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  heroSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 280,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: spacing.lg,
  },
  inputGroup: {},
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  charCount: {
    fontSize: 11,
    color: colors.textMuted,
  },
  inputWrapper: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },
  inputError: {
    borderColor: colors.danger[600],
  },
  input: {
    fontSize: 15,
    color: colors.textPrimary,
    padding: 0,
  },
  multilineWrapper: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 80,
  },
  multilineInput: {
    fontSize: 14,
    color: colors.textPrimary,
    textAlignVertical: 'top',
    padding: 0,
    minHeight: 64,
  },
  errorText: {
    fontSize: 12,
    color: colors.danger[600],
    marginTop: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.xs,
  },
  infoText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});
