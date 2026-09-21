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
import { supabase } from '../../src/services/supabase';
import { GroupsRepo } from '../../src/repositories/groups.repo';
import { useAuthStore } from '../../src/stores/auth.store';
import { useSyncStore } from '../../src/stores/sync.store';
import { createGroupSchema } from '../../src/engine/validation';
import * as Crypto from 'expo-crypto';

export default function NewGroupScreen() {
  const router = useRouter();
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
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.formCard}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Group Name</Text>
            <TextInput
              style={[styles.input, error && styles.inputError]}
              value={name}
              onChangeText={(t) => {
                setError(null);
                setName(t);
              }}
              placeholder="e.g. Goa Trip 2026"
              placeholderTextColor="#64748B"
              maxLength={80}
              autoFocus
            />
            {error && <Text style={styles.errorText}>{error}</Text>}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description (Optional)</Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              value={description}
              onChangeText={setDescription}
              placeholder="What is this group for?"
              placeholderTextColor="#64748B"
              multiline
              numberOfLines={3}
              maxLength={500}
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleCreate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Create Group</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  container: {
    padding: 20,
  },
  formCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E2E8F0',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#F8FAFC',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#334155',
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 5,
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
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
