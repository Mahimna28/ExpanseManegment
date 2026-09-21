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
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signUp } from '../../src/services/auth';
import {
  savePendingInviteCode,
  getPendingInviteCode,
  redeemPendingInvite,
} from '../../src/services/invites';
import { registerSchema } from '../../src/engine/validation';
import { colors, spacing, typography, radii, shadows } from '../../src/theme';
import { User, Lock, Mail, KeyRound } from 'lucide-react-native';

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Auto-fill invite code if previously preserved (e.g. from an invite deep link)
  useEffect(() => {
    getPendingInviteCode().then((code) => {
      if (code && !inviteCode) {
        setInviteCode(code);
      }
    });
  }, []);

  const handleRegister = async () => {
    setErrors({});
    const validation = registerSchema.safeParse({
      email,
      password,
      confirmPassword,
      display_name: displayName,
      invite_code: inviteCode.trim() ? inviteCode.trim() : undefined,
    });

    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.errors.forEach((e) => {
        fieldErrors[String(e.path[0])] = e.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    try {
      // 1. If invite code was supplied, save it so it survives email verification
      if (inviteCode.trim()) {
        await savePendingInviteCode(inviteCode.trim());
      }

      // 2. Register user
      await signUp(email, password, displayName);

      // 3. Attempt immediate redemption in case session was established without email confirmation
      try {
        await redeemPendingInvite();
      } catch {
        // Non-blocking: will auto-redeem upon user's first login
      }

      const alertMsg = inviteCode.trim()
        ? 'Your account has been created! If email verification is required, please verify your email and sign in. Your group invite has been saved and will activate automatically.'
        : 'Please check your email if verification is required, then sign in.';

      Alert.alert(
        'Account Created',
        alertMsg,
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }],
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      Alert.alert('Registration Failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: Math.max(insets.top, 24) + 20,
            paddingBottom: Math.max(insets.bottom, 24) + 24,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Join ExpenseShare</Text>
          <Text style={styles.subtitle}>Enter your details and group invite code</Text>
        </View>

        <View style={[styles.formCard, shadows.card]}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Your Name</Text>
            <View style={[styles.inputWrapper, errors.display_name && styles.inputError]}>
              <User size={18} color={colors.textSecondary} />
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="e.g. Mahimna"
                placeholderTextColor={colors.textDim}
              />
            </View>
            {errors.display_name && <Text style={styles.errorText}>{errors.display_name}</Text>}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
            <View style={[styles.inputWrapper, errors.email && styles.inputError]}>
              <Mail size={18} color={colors.textSecondary} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="name@example.com"
                placeholderTextColor={colors.textDim}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Group Invite Code</Text>
              <Text style={styles.optionalBadge}>Optional</Text>
            </View>
            <View style={[styles.inputWrapper, errors.invite_code && styles.inputError]}>
              <KeyRound size={18} color={colors.textSecondary} />
              <TextInput
                style={styles.input}
                value={inviteCode}
                onChangeText={(t) => setInviteCode(t.toUpperCase())}
                placeholder="Leave blank to create a new group"
                placeholderTextColor={colors.textDim}
                autoCapitalize="characters"
                maxLength={10}
              />
            </View>
            {errors.invite_code ? (
              <Text style={styles.errorText}>{errors.invite_code}</Text>
            ) : (
              <Text style={styles.helpText}>Only needed if joining a friend's existing group.</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password (min 8 chars)</Text>
            <View style={[styles.inputWrapper, errors.password && styles.inputError]}>
              <Lock size={18} color={colors.textSecondary} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.textDim}
                secureTextEntry
              />
            </View>
            {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm Password</Text>
            <View style={[styles.inputWrapper, errors.confirmPassword && styles.inputError]}>
              <Lock size={18} color={colors.textSecondary} />
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.textDim}
                secureTextEntry
              />
            </View>
            {errors.confirmPassword && (
              <Text style={styles.errorText}>{errors.confirmPassword}</Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Create Account</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
            <Text style={styles.footerLink}> Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginBottom: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
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
    marginBottom: 6,
  },
  optionalBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 15,
    padding: 0,
  },
  inputError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerBg,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    marginTop: 4,
  },
  helpText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radii.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  footerLink: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
});
