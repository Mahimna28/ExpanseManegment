import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Crypto from 'expo-crypto';
import { CategoriesRepo } from '../../../../src/repositories/categories.repo';
import { useAuthStore } from '../../../../src/stores/auth.store';
import { useSyncStore } from '../../../../src/stores/sync.store';
import { supabase } from '../../../../src/services/supabase';
import { categoryNameSchema } from '../../../../src/engine/validation';
import { triggerSync } from '../../../../src/sync/engine';
import { AppHeader, CategoryBadge } from '../../../../src/components/ui';
import { colors, spacing, typography, radii, shadows } from '../../../../src/theme';
import { Plus, Archive, Tag, HelpCircle } from 'lucide-react-native';

export default function GroupCategoriesScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const currentUserId = useAuthStore((s) => s.userId);

  const categories = CategoriesRepo.listActiveCategories(groupId);
  const [newCatName, setNewCatName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateCategory = async () => {
    setError(null);
    const trimmed = newCatName.trim();
    const validation = categoryNameSchema.safeParse(trimmed);
    if (!validation.success) {
      setError(validation.error.errors[0].message);
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

      // 2. Insert to Supabase directly
      await supabase.from('categories').insert({
        id: catId,
        group_id: groupId,
        name: trimmed,
        created_by: currentUserId,
      });

      triggerSync().catch(console.warn);
    } catch (err: unknown) {
      console.warn('Category creation sync error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = (catId: string, catName: string) => {
    Alert.alert(
      'Archive Category',
      `Archive "${catName}"? Past expenses will retain this category, but it will be hidden for future expenses.`,
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
              console.warn('Category archive sync error:', err);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.root}>
      <AppHeader
        title="Categories"
        showBack
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 16 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Add New Category Card */}
        <View style={[styles.card, shadows.subtle]}>
          <Text style={styles.cardTitle}>Add Category</Text>
          <View style={styles.inputRow}>
            <View style={[styles.inputWrapper, error && styles.inputError]}>
              <Tag size={16} color={colors.textSecondary} />
              <TextInput
                style={styles.input}
                value={newCatName}
                onChangeText={(t) => {
                  setError(null);
                  setNewCatName(t);
                }}
                placeholder="e.g. Groceries, Fuel, Hotel"
                placeholderTextColor={colors.textMuted}
                maxLength={50}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.addBtn,
                (!newCatName.trim() || loading) && styles.addBtnDisabled,
              ]}
              onPress={handleCreateCategory}
              disabled={!newCatName.trim() || loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Plus size={20} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
          {error && <Text style={styles.errorText}>{error}</Text>}
        </View>

        {/* Existing Categories List */}
        <View style={[styles.card, shadows.subtle]}>
          <Text style={styles.cardTitle}>Active Categories ({categories.length + 1})</Text>

          {/* Default General Category (Cannot be deleted) */}
          <View style={styles.categoryItemRow}>
            <CategoryBadge categoryName="General" size={32} />
            <Text style={styles.defaultLabel}>Default</Text>
          </View>

          {categories.map((cat) => (
            <View key={cat.id} style={styles.categoryItemRow}>
              <CategoryBadge categoryName={cat.name} size={32} />
              <TouchableOpacity
                style={styles.archiveBtn}
                onPress={() => handleArchive(cat.id, cat.name)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Archive size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Informational Card */}
        <View style={styles.infoCard}>
          <HelpCircle size={16} color={colors.textSecondary} />
          <Text style={styles.infoText}>
            Categories help group and summarize spending. You can add custom categories for this group at any time.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: spacing.sm,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  inputError: {
    borderColor: colors.danger[600],
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    padding: 0,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: {
    opacity: 0.5,
  },
  errorText: {
    fontSize: 12,
    color: colors.danger[600],
  },
  categoryItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  defaultLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.sm,
  },
  archiveBtn: {
    padding: 4,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
});
