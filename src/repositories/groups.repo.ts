import { getDatabase } from '../db/client';
import type { Group, GroupMember } from '../types/models';

export const GroupsRepo = {
  listActiveGroups(): Group[] {
    const db = getDatabase();
    const rows = db.getAllSync<Group>(
      `SELECT * FROM local_groups WHERE is_archived = 0 ORDER BY updated_at DESC`,
    );
    return rows.map((r) => ({ ...r, is_archived: Boolean(r.is_archived) }));
  },

  getGroupById(id: string): Group | null {
    const db = getDatabase();
    const row = db.getFirstSync<Group>(`SELECT * FROM local_groups WHERE id = ?`, [id]);
    return row ? { ...row, is_archived: Boolean(row.is_archived) } : null;
  },

  upsertGroup(group: Group): void {
    const db = getDatabase();
    db.runSync(
      `INSERT INTO local_groups (id, name, description, invite_code, is_archived, created_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         name = excluded.name,
         description = excluded.description,
         invite_code = excluded.invite_code,
         is_archived = excluded.is_archived,
         updated_at = excluded.updated_at`,
      [
        group.id,
        group.name,
        group.description ?? null,
        group.invite_code,
        group.is_archived ? 1 : 0,
        group.created_by,
        group.updated_at,
      ],
    );
  },

  listMembers(groupId: string): GroupMember[] {
    const db = getDatabase();
    return db.getAllSync<GroupMember>(
      `SELECT * FROM local_members WHERE group_id = ? AND status = 'active' ORDER BY role ASC, joined_at ASC`,
      [groupId],
    );
  },

  upsertMember(member: GroupMember): void {
    const db = getDatabase();
    db.runSync(
      `INSERT INTO local_members (id, group_id, user_id, role, status, display_name, email, joined_at, revoked_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (group_id, user_id) DO UPDATE SET
         role = excluded.role,
         status = excluded.status,
         display_name = excluded.display_name,
         email = excluded.email,
         revoked_at = excluded.revoked_at`,
      [
        member.id,
        member.group_id,
        member.user_id,
        member.role,
        member.status,
        member.display_name ?? null,
        member.email ?? null,
        member.joined_at,
        member.revoked_at ?? null,
      ],
    );
  },
};
