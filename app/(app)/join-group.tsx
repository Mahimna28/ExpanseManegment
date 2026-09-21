import React, { useState, useEffect } from 'react';
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../src/services/supabase';
import { pullGroupChanges } from '../../src/sync/pull';
import { useSyncStore } from '../../src/stores/sync.store';
import { inviteCodeSchema } from '../../src/engine/validation';
import { AppHeader, PrimaryButton } from '../../src/components/ui';
import { colors, spacing, typography, radii, shadows } from '../../src/theme';
import { KeyRound, ShieldCheck, HelpCircle } from 'lucide-react-native';

export default function JoinGroupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ code?: string }>();

  const [code, setCode] = useState(
    params.code ? params.code.trim().toUpperCase() : '',
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Automatically update code if params change (e.g. via deep link)
  useEffect(() => {
    if (params.code) {
      setCode(params.code.trim().toUpperCase());
      setError(null);
    }
  }, [params.code]);

  const handleJoin = async () => {
    setError(null);
    const cleanCode = code.trim().toUpperCase();

    const validation = inviteCodeSchema.safeParse(cleanCode);
    if (!validation.success) {
      setError(validation.error.errors[0]?.message || 'Enter a valid 10-character code');
      return;
    }

    setLoading(true);
    try {
      const { data, error: rpcErr } = await supabase.rpc('join_group', {
        p_invite_code: cleanCode,
      });

      if (rpcErr) {
        if (rpcErr.message.includes('already_member') || rpcErr.code === 'P0005') {
          throw new Error('You are already an active member of this group.');
        } else if (rpcErr.message.includes('invalid_invite_code') || rpcErr.code === 'P0004') {
          throw new Error('This invite code is invalid or has expired. Please ask the group owner for a new code.');
        } else if (rpcErr.message.includes('too_many_failed_attempts') || rpcErr.code === 'P0024') {
          throw new Error('Too many failed attempts. Please wait 15 minutes before trying again.');
        }
        throw rpcErr;
      }

      const groupId = data?.group_id;
      if (!groupId) {
        throw new Error('Could not retrieve group information.');
      }

      // Pull down the group and its existing expenses/members into local SQLite
      try {
        await pullGroupChanges(groupId);
      } catch (pullErr) {
        console.warn('Initial group pull warning:', pullErr);
      }
      useSyncStore.getState().incrementDbVersion();

      // Navigate to the newly joined group
      router.replace(`/(app)/group/${groupId}` as any);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid invite code';
      setError(msg);
      Alert.alert('Could Not Join Group', msg);
    } finally {
      setLoading(false);
    }
  };

  const isCodeComplete = code.trim().length === 10;

  return (
    <View style={styles.container}>
      {/* Top Navigation Header */}
      <AppHeader
        title="Join Group"
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
          {/* Hero Icon */}
          <View style={[styles.iconCircle, shadows.subtle]}>
            <KeyRound size={28} color={colors.primary} />
          </View>

          <Text style={styles.title}>Enter Invite Code</Text>
          <Text style={styles.subtitle}>
            Enter the 10-character code shared by your group owner or member to join and split expenses.
          </Text>

          {/* Code Input Card */}
          <View style={[styles.card, shadows.card]}>
            <Text style={styles.inputLabel}>GROUP INVITE CODE</Text>

            <View style={[styles.inputWrapper, error ? styles.inputWrapperError : null]}>
              <TextInput
                style={styles.codeInput}
                value={code}
                onChangeText={(text) => {
                  setError(null);
                  setCode(text.toUpperCase());
                }}
                placeholder="ABCDEF1234"
                placeholderTextColor={colors.textDim}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={10}
                autoFocus={!params.code}
                selectTextOnFocus
              />
            </View>

            {/* Character counter & error */}
            <View style={styles.counterRow}>
              {error ? (
                <Text style={styles.errorText} numberOfLines={2}>
                  {error}
                </Text>
              ) : (
                <Text style={styles.hintText}>
                  {isCodeComplete ? 'Ready to join' : 'Code must be 10 characters'}
                </Text>
              )}
              <Text style={styles.counterText}>{code.length}/10</Text>
            </View>

            {/* Primary Join Button */}
            <PrimaryButton
              label={loading ? 'Joining Group...' : 'Join Group'}
              icon={
                loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <ShieldCheck size={18} color="#FFFFFF" />
                )
              }
              onPress={handleJoin}
              disabled={loading || code.trim().length === 0}
              style={styles.joinBtn}
            />
          </View>

          {/* Guidance Info Card */}
          <View style={styles.infoCard}>
            <HelpCircle size={18} color={colors.textMuted} style={styles.infoIcon} />
            <View style={styles.infoTextWrapper}>
              <Text style={styles.infoTitle}>How it works</Text>
              <Text style={styles.infoDescription}>
                Each group has a unique 10-character invite code and link. When you join, your account connects securely and all balances sync offline-first to your device.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    alignItems: 'center',
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  title: {
    ...typography.largeTitle,
    fontSize: 22,
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.sm,
  },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  inputLabel: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  inputWrapper: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginBottom: spacing.xs,
  },
  inputWrapperError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerBg,
  },
  codeInput: {
    ...typography.display,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 4,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    color: colors.text,
  },
  counterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: 2,
  },
  hintText: {
    ...typography.secondary,
    fontSize: 12,
    color: colors.textMuted,
  },
  errorText: {
    ...typography.secondary,
    fontSize: 12,
    color: colors.danger,
    flex: 1,
    marginRight: spacing.sm,
  },
  counterText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textDim,
  },
  joinBtn: {
    height: 48,
    borderRadius: radii.pill,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    width: '100%',
  },
  infoIcon: {
    marginTop: 2,
  },
  infoTextWrapper: {
    flex: 1,
    gap: 2,
  },
  infoTitle: {
    ...typography.secondarySemibold,
    fontSize: 13,
    color: colors.text,
  },
  infoDescription: {
    ...typography.secondary,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
  },
});
