import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { CategoriesRepo } from '../../../../src/repositories/categories.repo';
import { useAuthStore } from '../../../../src/stores/auth.store';
import { useSyncStore } from '../../../../src/stores/sync.store';
import { supabase } from '../../../../src/services/supabase';
import { categoryNameSchema } from '../../../../src/engine/validation';
import { triggerSync } from '../../../../src/sync/engine';
import { Plus, Archive, Tag } from 'lucide-react-native';

export default function GroupCategoriesScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const currentUserId = useAuthStore((s) => s.userId);

  const categories = CategoriesRepo.listActiveCategories(groupId);
  const [newCatName, setNewCatName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateCategory = async () => {
    const trimmed = newCatName.trim();
    const validation = categoryNameSchema.safeParse(trimmed);
    if (!validation.success) {
      Alert.alert('Validation Error', validation.error.errors[0].message);
      return;
    }

    if (!currentUserId) return;

    setLoading(true);
    try {
      const catId = Crypto.randomUUID();
      const now = new Date().toISOString();

      // 1. Insert locally first
      CategoriesRepo.upsertCategory({
        id: catId,
        group_id: groupId,
        name: trimmed,
        is_archived: false,
        created_by: currentUserId,
        updated_at: now,
        created_at: now,
      });

      setNewCatName('');
      useSyncStore.getState().incrementDbVersion();

      // 2. Insert to Supabase directly (categories table has RLS policy for active members)
      await supabase.from('categories').insert({
        id: catId,
        group_id: groupId,
        name: trimmed,
        created_by: currentUserId,
      });

      triggerSync().catch(console.warn);
    } catch (err: unknown) {
      console.warn(err);
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = (catId: string, catName: string) => {
    Alert.alert(
      'Archive Category',
      `Archive "${catName}"? Past expenses with this category will keep their tag, but it won't appear for new expenses.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            try {
              const cat = categories.find((c) => c.id === catId);
              if (cat) {
                CategoriesRepo.upsertCategory({ ...cat, is_archived: true });
                useSyncStore.getState().incrementDbVersion();
              }

              await supabase.rpc('archive_category', {
                p_group_id: groupId,
                p_category_id: catId,
              });

              triggerSync().catch(console.warn);
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
      {/* Create Category Form */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>Add New Category</Text>
        <View style={styles.addRow}>
          <TextInput
            style={styles.input}
            value={newCatName}
            onChangeText={setNewCatName}
            placeholder="e.g. Groceries, Fuel, Hotel"
            placeholderTextColor="#64748B"
            maxLength={50}
          />
          <TouchableOpacity
            style={[styles.addButton, loading && styles.buttonDisabled]}
            onPress={handleCreateCategory}
            disabled={loading}
          >
            <Plus size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Category List */}
      <Text style={styles.sectionTitle}>Active Categories ({categories.length})</Text>
      <View style={styles.listCard}>
        {categories.map((cat) => (
          <View key={cat.id} style={styles.catRow}>
            <View style={styles.catNameGroup}>
              <Tag size={16} color="#3B82F6" />
              <Text style={styles.catName}>{cat.name}</Text>
            </View>
            <TouchableOpacity
              style={styles.archiveBtn}
              onPress={() => handleArchive(cat.id, cat.name)}
            >
              <Archive size={16} color="#64748B" />
            </TouchableOpacity>
          </View>
        ))}

        {categories.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              No custom categories created yet. Expenses default to "General".
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  addRow: {
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#F8FAFC',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#334155',
  },
  addButton: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  listCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  catRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#0F172A',
  },
  catNameGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  catName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#F8FAFC',
  },
  archiveBtn: {
    padding: 6,
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
  },
});
