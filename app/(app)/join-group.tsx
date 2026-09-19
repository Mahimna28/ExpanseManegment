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
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/services/supabase';
import { pullGroupChanges } from '../../src/sync/pull';
import { useSyncStore } from '../../src/stores/sync.store';
import { inviteCodeSchema } from '../../src/engine/validation';
import { KeyRound } from 'lucide-react-native';

export default function JoinGroupScreen() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async () => {
    setError(null);
    const cleanCode = code.trim().toUpperCase();
    const validation = inviteCodeSchema.safeParse(cleanCode);
    if (!validation.success) {
      setError(validation.error.errors[0].message);
      return;
    }

    setLoading(true);
    try {
      const { data, error: rpcErr } = await supabase.rpc('join_group', {
        p_invite_code: cleanCode,
      });

      if (rpcErr) throw rpcErr;

      const groupId = data.group_id;

      // Pull down the group and its existing expenses/members into local SQLite
      await pullGroupChanges(groupId);
      useSyncStore.getState().incrementDbVersion();

      router.replace(`/(app)/group/${groupId}` as any);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid invite code';
      Alert.alert('Could Not Join Group', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        <View style={styles.iconCircle}>
          <KeyRound size={28} color="#3B82F6" />
        </View>

        <Text style={styles.title}>Enter Invite Code</Text>
        <Text style={styles.subtitle}>
          Ask the group owner or member for the 10-character invite code.
        </Text>

        <View style={styles.formCard}>
          <TextInput
            style={[styles.codeInput, error && styles.inputError]}
            value={code}
            onChangeText={(t) => {
              setError(null);
              setCode(t.toUpperCase());
            }}
            placeholder="ABCDEF1234"
            placeholderTextColor="#64748B"
            autoCapitalize="characters"
            maxLength={10}
            autoFocus
          />
          {error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleJoin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Join Group</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  container: {
    padding: 24,
    alignItems: 'center',
    paddingTop: 40,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  formCard: {
    width: '100%',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  codeInput: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 4,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginBottom: 12,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
