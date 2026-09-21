import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Share,
  Platform,
  StatusBar,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { GroupsRepo } from '../../../../src/repositories/groups.repo';
import { useAuthStore } from '../../../../src/stores/auth.store';
import { useSyncStore } from '../../../../src/stores/sync.store';
import { supabase } from '../../../../src/services/supabase';
import { triggerSync } from '../../../../src/sync/engine';
import {
  Avatar,
  AppHeader,
  PrimaryButton,
  SecondaryButton,
} from '../../../../src/components/ui';
import { colors, spacing, typography, radii, shadows } from '../../../../src/theme';
import {
  Share2,
  Copy,
  Crown,
  Shield,
  UserX,
  Check,
  Users,
} from 'lucide-react-native';

export default function GroupMembersScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const currentUserId = useAuthStore((s) => s.userId);
  const dbVersion = useSyncStore((s) => s.dbVersion);

  const [copied, setCopied] = useState(false);

  const group = GroupsRepo.getGroupById(groupId);
  const members = GroupsRepo.listMembers(groupId);

  const currentMember = members.find((m) => m.user_id === currentUserId);
  const isOwnerOrAdmin = currentMember?.role === 'owner' || currentMember?.role === 'admin';

  const inviteCode = group?.invite_code || '';

  // Generate shareable universal deep link
  const getInviteLink = () => {
    return Linking.createURL('/join-group', {
      queryParams: { code: inviteCode },
    });
  };

  const handleShareInvite = async () => {
    if (!group) return;
    const inviteLink = getInviteLink();
    try {
      await Share.share({
        title: `Join "${group.name}" on ExpenseShare`,
        message: `Join our group "${group.name}" on ExpenseShare!\n\nInvite Code: ${inviteCode}\n\nOr open this link directly:\n${inviteLink}`,
        url: inviteLink,
      });
    } catch (err: unknown) {
      console.warn('Share dismissed or failed:', err);
    }
  };

  const handleCopyCode = async () => {
    if (!inviteCode) return;

    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(inviteCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
        return;
      } catch {
        // Fallback below
      }
    }

    // Native mobile: show confirmation alert with option to share
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    Alert.alert(
      'Invite Code',
      `Code: ${inviteCode}\n\nShare this code with your friends to let them join "${group?.name || 'the group'}".`,
      [
        { text: 'Share', onPress: handleShareInvite },
        { text: 'OK' },
      ],
    );
  };

  const handleRevoke = (targetUserId: string, targetName: string) => {
    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${targetName} from "${group?.name || 'this group'}"? They will lose access to all expenses.`,
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

              Alert.alert('Member Removed', `${targetName} has been removed from the group.`);
              triggerSync().catch(console.warn);
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Could not remove member';
              Alert.alert('Error', msg);
            }
          },
        },
      ],
    );
  };

  if (!group) {
    return (
      <View style={styles.container}>
        <AppHeader title="Members" showBack onBack={() => router.back()} />
        <View style={styles.notFoundContainer}>
          <Text style={styles.notFoundText}>Group not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <AppHeader
        title={group.name}
        subtitle={`${members.length} active ${members.length === 1 ? 'member' : 'members'}`}
        showBack
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 24) + 16 },
        ]}
      >
        {/* ── 1. HERO INVITE CARD (Code & Link Only) ── */}
        <View style={[styles.inviteCard, shadows.card]}>
          <View style={styles.inviteHeader}>
            <View style={styles.inviteBadge}>
              <Text style={styles.inviteBadgeText}>INVITE CODE & LINK</Text>
            </View>
            <View style={styles.activeTag}>
              <View style={styles.activeDot} />
              <Text style={styles.activeText}>Active</Text>
            </View>
          </View>

          <Text style={styles.inviteDescription}>
            Friends can join this group instantly using this 10-character code or by tapping your shareable invite link.
          </Text>

          {/* Monospace Code Pill */}
          <View style={styles.codeContainer}>
            <Text style={styles.codeText}>{inviteCode}</Text>
          </View>

          {/* Actions: Share Link & Copy */}
          <View style={styles.inviteActions}>
            <PrimaryButton
              label="Share Invite Link"
              icon={<Share2 size={16} color="#FFFFFF" />}
              onPress={handleShareInvite}
              style={styles.actionBtn}
            />
            <SecondaryButton
              label={copied ? 'Code Copied!' : 'Copy Code'}
              icon={
                copied ? (
                  <Check size={16} color={colors.moneyPositive} />
                ) : (
                  <Copy size={16} color={colors.primary} />
                )
              }
              onPress={handleCopyCode}
              style={styles.actionBtn}
            />
          </View>
        </View>

        {/* ── 2. ACTIVE MEMBERS ROSTER ── */}
        <View style={styles.rosterHeader}>
          <Text style={styles.rosterTitle}>
            GROUP MEMBERS ({members.length})
          </Text>
          <Text style={styles.rosterSub}>
            Only members with verified accounts can view and split expenses.
          </Text>
        </View>

        <View style={[styles.membersCard, shadows.card]}>
          {members.map((m, index) => {
            const name = m.display_name || m.email?.split('@')[0] || 'Member';
            const isCurrentUser = m.user_id === currentUserId;
            const canRevoke =
              isOwnerOrAdmin &&
              !isCurrentUser &&
              m.role !== 'owner' &&
              !(currentMember?.role === 'admin' && m.role === 'admin');

            const isLast = index === members.length - 1;

            return (
              <View
                key={m.id}
                style={[
                  styles.memberRow,
                  !isLast && styles.memberRowBorder,
                ]}
              >
                {/* Member Avatar */}
                <Avatar name={name} size={42} />

                {/* Member Info */}
                <View style={styles.memberInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.memberName} numberOfLines={1}>
                      {name}
                    </Text>
                    {isCurrentUser && (
                      <View style={styles.youBadge}>
                        <Text style={styles.youBadgeText}>You</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.metaRow}>
                    {m.role === 'owner' ? (
                      <View style={[styles.rolePill, { backgroundColor: '#FEF3C7' }]}>
                        <Crown size={11} color="#D97706" />
                        <Text style={[styles.roleText, { color: '#D97706' }]}>Owner</Text>
                      </View>
                    ) : m.role === 'admin' ? (
                      <View style={[styles.rolePill, { backgroundColor: '#EEF2FF' }]}>
                        <Shield size={11} color="#4F46E5" />
                        <Text style={[styles.roleText, { color: '#4F46E5' }]}>Admin</Text>
                      </View>
                    ) : (
                      <View style={[styles.rolePill, { backgroundColor: colors.surfaceSubtle }]}>
                        <Text style={[styles.roleText, { color: colors.textMuted }]}>Member</Text>
                      </View>
                    )}

                    {m.email ? (
                      <Text style={styles.emailText} numberOfLines={1}>
                        • {m.email}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {/* Revoke Action for Owner/Admin */}
                {canRevoke ? (
                  <TouchableOpacity
                    style={styles.revokeBtn}
                    onPress={() => handleRevoke(m.user_id, name)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel={`Remove ${name} from group`}
                    accessibilityRole="button"
                  >
                    <UserX size={17} color={colors.danger} />
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })}
        </View>

        {/* ── 3. HELPER NOTE ── */}
        <View style={styles.helperBox}>
          <Users size={16} color={colors.textMuted} />
          <Text style={styles.helperText}>
            Invite new members by sharing your group's invite code or link. When they open the app and enter the code, they will be joined automatically.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  notFoundContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  notFoundText: {
    ...typography.title,
    color: colors.textMuted,
  },
  inviteCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  inviteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  inviteBadge: {
    backgroundColor: colors.primarySubtle,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  inviteBadgeText: {
    ...typography.caption,
    color: colors.primary,
    fontSize: 10,
  },
  activeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.moneyPositive,
  },
  activeText: {
    ...typography.caption,
    color: colors.moneyPositive,
    fontSize: 11,
  },
  inviteDescription: {
    ...typography.secondary,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  codeContainer: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    marginBottom: spacing.md,
  },
  codeText: {
    ...typography.display,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 4,
    color: colors.primary,
  },
  inviteActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    height: 44,
  },
  rosterHeader: {
    marginBottom: spacing.sm,
  },
  rosterTitle: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 2,
  },
  rosterSub: {
    ...typography.secondary,
    fontSize: 12,
    color: colors.textMuted,
  },
  membersCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  memberRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  memberInfo: {
    flex: 1,
    marginLeft: spacing.md,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  memberName: {
    ...typography.bodySemibold,
    fontSize: 15,
    color: colors.text,
  },
  youBadge: {
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  youBadgeText: {
    ...typography.caption,
    fontSize: 10,
    color: colors.textMuted,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.pill,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emailText: {
    ...typography.secondary,
    fontSize: 12,
    color: colors.textMuted,
    flex: 1,
  },
  revokeBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  helperBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  helperText: {
    ...typography.secondary,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
  },
});
