import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { GroupsRepo } from '../../src/repositories/groups.repo';
import { useAuthStore } from '../../src/stores/auth.store';
import { useSyncStore } from '../../src/stores/sync.store';
import { triggerSync } from '../../src/sync/engine';
import { SyncStatusChip } from '../../src/components/sync/SyncStatusChip';
import { Users, Plus, KeyRound, Settings, ChevronRight } from 'lucide-react-native';
import type { Group } from '../../src/types/models';

export default function GroupsScreen() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const dbVersion = useSyncStore((s) => s.dbVersion);
  const [groups, setGroups] = useState<Group[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadGroups = useCallback(() => {
    try {
      const active = GroupsRepo.listActiveGroups();
      setGroups(active);
    } catch {
      setGroups([]);
    }
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups, dbVersion]);

  const onRefresh = async () => {
    setRefreshing(true);
    await triggerSync().catch(console.warn);
    loadGroups();
    setRefreshing(false);
  };

  const renderGroupItem = ({ item }: { item: Group }) => (
    <TouchableOpacity
      style={styles.groupCard}
      onPress={() => router.push(`/(app)/group/${item.id}` as any)}
    >
      <View style={styles.groupIconWrapper}>
        <Users size={22} color="#3B82F6" />
      </View>
      <View style={styles.groupInfo}>
        <Text style={styles.groupName}>{item.name}</Text>
        {item.description ? (
          <Text style={styles.groupDescription} numberOfLines={1}>
            {item.description}
          </Text>
        ) : null}
        <Text style={styles.groupCode}>Code: {item.invite_code}</Text>
      </View>
      <ChevronRight size={20} color="#64748B" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.topBar}>
          <View>
            <Text style={styles.welcomeText}>Hello,</Text>
            <Text style={styles.userName}>{profile?.display_name || 'Member'}</Text>
          </View>
          <View style={styles.topBarActions}>
            <SyncStatusChip />
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => router.push('/(app)/settings')}
            >
              <Settings size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick action buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.createButton]}
            onPress={() => router.push('/(app)/new-group')}
          >
            <Plus size={18} color="#FFFFFF" />
            <Text style={styles.createButtonText}>Create Group</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.joinButton]}
            onPress={() => router.push('/(app)/join-group')}
          >
            <KeyRound size={18} color="#93C5FD" />
            <Text style={styles.joinButtonText}>Join with Code</Text>
          </TouchableOpacity>
        </View>

        {/* Section title */}
        <Text style={styles.sectionTitle}>Your Groups ({groups.length})</Text>

        {/* Groups List */}
        <FlatList
          data={groups}
          keyExtractor={(item) => item.id}
          renderItem={renderGroupItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#3B82F6"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                <Users size={36} color="#475569" />
              </View>
              <Text style={styles.emptyTitle}>No groups yet</Text>
              <Text style={styles.emptySubtitle}>
                Create a new group for your trip or outing, or enter an invite code to join one.
              </Text>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
  },
  createButton: {
    backgroundColor: '#2563EB',
  },
  createButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  joinButton: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  joinButtonText: {
    color: '#93C5FD',
    fontWeight: '600',
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  listContent: {
    paddingBottom: 24,
    flexGrow: 1,
  },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  groupIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F8FAFC',
    marginBottom: 2,
  },
  groupDescription: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 3,
  },
  groupCode: {
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
});
