import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { GroupsRepo } from '../../../../src/repositories/groups.repo';
import { useAuthStore } from '../../../../src/stores/auth.store';
import { supabase } from '../../../../src/services/supabase';
import { triggerSync } from '../../../../src/sync/engine';
import { Share2, UserX, Crown, Shield } from 'lucide-react-native';

export default function GroupMembersScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const currentUserId = useAuthStore((s) => s.userId);

  const group = GroupsRepo.getGroupById(groupId);
  const members = GroupsRepo.listMembers(groupId);

  const currentMember = members.find((m) => m.user_id === currentUserId);
  const isOwnerOrAdmin = currentMember?.role === 'owner' || currentMember?.role === 'admin';

  const handleShareInvite = () => {
    if (!group) return;
    Alert.alert(
      'Invite Code',
      `Share this invite code with trusted members:\n\n${group.invite_code}`,
      [{ text: 'OK' }],
    );
  };

  const handleRevoke = (targetUserId: string, targetName: string) => {
    Alert.alert(
      'Revoke Member',
      `Are you sure you want to remove ${targetName} from the group? They will lose access to all group data upon next sync.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.rpc('revoke_member', {
                p_group_id: groupId,
                p_target_uid: targetUserId,
              });

              if (error) throw error;

              Alert.alert('Success', `${targetName} has been removed.`);
              triggerSync().catch(console.warn);
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Could not revoke member';
              Alert.alert('Error', msg);
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Invite Code Box */}
      <View style={styles.inviteCard}>
        <View>
          <Text style={styles.inviteTitle}>Group Invite Code</Text>
          <Text style={styles.inviteCode}>{group?.invite_code}</Text>
        </View>
        <TouchableOpacity style={styles.shareButton} onPress={handleShareInvite}>
          <Share2 size={16} color="#FFFFFF" />
          <Text style={styles.shareButtonText}>Share</Text>
        </TouchableOpacity>
      </View>

      {/* Members List */}
      <Text style={styles.sectionTitle}>Active Members ({members.length})</Text>
      <View style={styles.listCard}>
        {members.map((m) => {
          const name = m.display_name || m.email?.split('@')[0] || 'Member';
          const isCurrentUser = m.user_id === currentUserId;
          const canRevoke =
            isOwnerOrAdmin &&
            !isCurrentUser &&
            m.role !== 'owner' &&
            !(currentMember?.role === 'admin' && m.role === 'admin');

          return (
            <View key={m.id} style={styles.memberRow}>
              <View style={styles.memberInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.memberName}>{name}</Text>
                  {isCurrentUser && <Text style={styles.youBadge}>(You)</Text>}
                </View>
                <View style={styles.roleRow}>
                  {m.role === 'owner' && <Crown size={12} color="#F59E0B" />}
                  {m.role === 'admin' && <Shield size={12} color="#3B82F6" />}
                  <Text style={styles.roleText}>{m.role.toUpperCase()}</Text>
                </View>
              </View>

              {canRevoke && (
                <TouchableOpacity
                  style={styles.revokeButton}
                  onPress={() => handleRevoke(m.user_id, name)}
                >
                  <UserX size={16} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>
          );
        })}
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
  inviteCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  inviteTitle: {
    fontSize: 12,
    color: '#94A3B8',
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 4,
  },
  inviteCode: {
    fontSize: 22,
    fontWeight: '800',
    color: '#3B82F6',
    letterSpacing: 2,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
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
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#0F172A',
  },
  memberInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  youBadge: {
    fontSize: 12,
    color: '#64748B',
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  revokeButton: {
    padding: 8,
  },
});
