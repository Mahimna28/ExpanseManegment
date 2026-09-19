-- ============================================================
-- Migration 02: Row Level Security Policies
-- Run AFTER 01_init_schema.sql
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_splits    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbox_idempotency ENABLE ROW LEVEL SECURITY;

-- ── Helper: is the caller an active member of a given group? ──
-- Used inline in policies to avoid function-call overhead.
-- Postgres partial indexes on (user_id) WHERE status='active' make this fast.

-- ── Profiles ─────────────────────────────────────────────────

-- A user can read their own profile and profiles of co-members in shared active groups
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM public.group_members gm1
      JOIN public.group_members gm2 ON gm1.group_id = gm2.group_id
      WHERE gm1.user_id = auth.uid()  AND gm1.status = 'active'
        AND gm2.user_id = profiles.id AND gm2.status = 'active'
    )
  );

-- Users may only update their own profile (display_name, avatar_url)
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- No direct INSERT — handled by handle_new_user trigger
-- No DELETE — handled by auth.users cascade

-- ── Groups ───────────────────────────────────────────────────

CREATE POLICY "groups_select_member" ON public.groups
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = groups.id AND user_id = auth.uid() AND status = 'active'
    )
  );

-- No direct INSERT/UPDATE — only via create_group / update_group RPCs

-- ── Group Members ─────────────────────────────────────────────

CREATE POLICY "members_select_same_group" ON public.group_members
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_members.group_id
        AND gm.user_id = auth.uid()
        AND gm.status = 'active'
    )
  );

-- No direct INSERT/UPDATE — only via join_group / revoke_member RPCs

-- ── Categories ────────────────────────────────────────────────

CREATE POLICY "categories_select_member" ON public.categories
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = categories.group_id AND user_id = auth.uid() AND status = 'active'
    )
  );

-- Active members may insert categories directly (RPC normalizes name)
CREATE POLICY "categories_insert_member" ON public.categories
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = categories.group_id AND user_id = auth.uid() AND status = 'active'
    )
  );

-- No direct UPDATE/DELETE — only via update_category / archive_category RPCs

-- ── Expenses ─────────────────────────────────────────────────

CREATE POLICY "expenses_select_member" ON public.expenses
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = expenses.group_id AND user_id = auth.uid() AND status = 'active'
    )
  );

-- No direct INSERT/UPDATE — only via create_expense / update_expense / void_expense RPCs

-- ── Expense Splits ────────────────────────────────────────────

CREATE POLICY "splits_select_member" ON public.expense_splits
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expenses e
      JOIN public.group_members gm ON gm.group_id = e.group_id
      WHERE e.id = expense_splits.expense_id
        AND gm.user_id = auth.uid()
        AND gm.status = 'active'
    )
  );

-- No direct INSERT/UPDATE/DELETE — only via create_expense RPC

-- ── Settlements ───────────────────────────────────────────────

CREATE POLICY "settlements_select_member" ON public.settlements
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = settlements.group_id AND user_id = auth.uid() AND status = 'active'
    )
  );

-- No direct INSERT/UPDATE — only via create_settlement / void_settlement RPCs

-- ── Change Log ────────────────────────────────────────────────

CREATE POLICY "change_log_select_member" ON public.change_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = change_log.group_id AND user_id = auth.uid() AND status = 'active'
    )
  );

-- No direct INSERT — written by triggers only

-- ── Outbox Idempotency ────────────────────────────────────────

CREATE POLICY "idempotency_own_rows" ON public.outbox_idempotency
  FOR SELECT TO authenticated
  USING (actor_id = auth.uid());

-- INSERT via RPCs only (RPC checks membership before inserting)
