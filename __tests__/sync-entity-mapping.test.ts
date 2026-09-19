jest.mock('../src/services/supabase', () => ({
  supabase: {},
}));

jest.mock('../src/db/client', () => ({
  getDatabase: jest.fn(),
}));

import { normalizeEntityType } from '../src/sync/pull';

describe('Change-log Entity Mapping', () => {
  test('maps singular canonical entities correctly', () => {
    expect(normalizeEntityType('expense')).toBe('expense');
    expect(normalizeEntityType('expense_split')).toBe('expense_split');
    expect(normalizeEntityType('settlement')).toBe('settlement');
    expect(normalizeEntityType('member')).toBe('member');
    expect(normalizeEntityType('category')).toBe('category');
    expect(normalizeEntityType('group')).toBe('group');
  });

  test('maps legacy plural table names defense-in-depth', () => {
    expect(normalizeEntityType('expenses')).toBe('expense');
    expect(normalizeEntityType('expense_splits')).toBe('expense_split');
    expect(normalizeEntityType('settlements')).toBe('settlement');
    expect(normalizeEntityType('group_members')).toBe('member');
    expect(normalizeEntityType('categories')).toBe('category');
    expect(normalizeEntityType('groups')).toBe('group');
  });

  test('returns null for unknown entities', () => {
    expect(normalizeEntityType('unknown_table')).toBeNull();
    expect(normalizeEntityType('')).toBeNull();
    expect(normalizeEntityType('users')).toBeNull();
  });
});
