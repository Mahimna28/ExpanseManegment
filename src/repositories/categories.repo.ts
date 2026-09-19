import { getDatabase } from '../db/client';
import type { Category } from '../types/models';

export const CategoriesRepo = {
  listActiveCategories(groupId: string): Category[] {
    const db = getDatabase();
    return db.getAllSync<Category>(
      `SELECT * FROM local_categories WHERE group_id = ? AND is_archived = 0 ORDER BY name ASC`,
      [groupId],
    );
  },

  getAllCategories(groupId: string): Category[] {
    const db = getDatabase();
    return db.getAllSync<Category>(
      `SELECT * FROM local_categories WHERE group_id = ? ORDER BY name ASC`,
      [groupId],
    );
  },

  upsertCategory(category: Category): void {
    const db = getDatabase();
    db.runSync(
      `INSERT INTO local_categories (id, group_id, name, is_archived, created_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         name = excluded.name,
         is_archived = excluded.is_archived,
         updated_at = excluded.updated_at`,
      [
        category.id,
        category.group_id,
        category.name,
        category.is_archived ? 1 : 0,
        category.created_by,
        category.updated_at,
      ],
    );
  },
};
