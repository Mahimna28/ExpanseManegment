-- ============================================================
-- Migration 04: Change Log Triggers
-- Appends a row to change_log after every write to financial tables.
-- Uses SECURITY DEFINER because triggers run as the table owner.
-- Hardened: SET search_path = public, pg_temp
-- Run AFTER 01, 02, 03.
-- ============================================================

-- ── Generic trigger function ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.log_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payload     JSONB;
  v_entity_id   UUID;
  v_group_id    UUID;
  v_operation   TEXT;
  v_actor_id    UUID;
  v_entity_type TEXT;
BEGIN
  -- Determine operation
  v_operation := TG_OP;  -- 'INSERT', 'UPDATE', 'DELETE'

  -- Extract payload and entity info
  IF TG_OP = 'DELETE' THEN
    v_payload   := to_jsonb(OLD);
    v_entity_id := OLD.id;
    -- group_id may be directly on the row or via expense FK
    IF TG_TABLE_NAME = 'expense_splits' THEN
      SELECT group_id INTO v_group_id FROM public.expenses WHERE id = OLD.expense_id;
    ELSE
      v_group_id := OLD.group_id;
    END IF;
  ELSE
    v_payload   := to_jsonb(NEW);
    v_entity_id := NEW.id;
    IF TG_TABLE_NAME = 'expense_splits' THEN
      SELECT group_id INTO v_group_id FROM public.expenses WHERE id = NEW.expense_id;
    ELSE
      v_group_id := NEW.group_id;
    END IF;
  END IF;

  -- Try to get actor from session (may be NULL for trigger-generated writes)
  v_actor_id := auth.uid();

  -- Map table name to canonical singular entity_type
  CASE TG_TABLE_NAME
    WHEN 'expenses' THEN v_entity_type := 'expense';
    WHEN 'expense_splits' THEN v_entity_type := 'expense_split';
    WHEN 'settlements' THEN v_entity_type := 'settlement';
    WHEN 'group_members' THEN v_entity_type := 'member';
    WHEN 'categories' THEN v_entity_type := 'category';
    WHEN 'groups' THEN v_entity_type := 'group';
    ELSE v_entity_type := TG_TABLE_NAME;
  END CASE;

  INSERT INTO public.change_log (group_id, entity_type, entity_id, operation, actor_id, payload)
  VALUES (
    v_group_id,
    v_entity_type,
    v_entity_id,
    v_operation,
    v_actor_id,
    v_payload
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- ── Attach trigger to each financial table ────────────────────

-- Expenses
DROP TRIGGER IF EXISTS trg_cl_expenses ON public.expenses;
CREATE TRIGGER trg_cl_expenses
  AFTER INSERT OR UPDATE OR DELETE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.log_change();

-- Expense Splits
DROP TRIGGER IF EXISTS trg_cl_expense_splits ON public.expense_splits;
CREATE TRIGGER trg_cl_expense_splits
  AFTER INSERT OR UPDATE OR DELETE ON public.expense_splits
  FOR EACH ROW EXECUTE FUNCTION public.log_change();

-- Settlements
DROP TRIGGER IF EXISTS trg_cl_settlements ON public.settlements;
CREATE TRIGGER trg_cl_settlements
  AFTER INSERT OR UPDATE OR DELETE ON public.settlements
  FOR EACH ROW EXECUTE FUNCTION public.log_change();

-- Group Members
DROP TRIGGER IF EXISTS trg_cl_group_members ON public.group_members;
CREATE TRIGGER trg_cl_group_members
  AFTER INSERT OR UPDATE OR DELETE ON public.group_members
  FOR EACH ROW EXECUTE FUNCTION public.log_change();

-- Categories
DROP TRIGGER IF EXISTS trg_cl_categories ON public.categories;
CREATE TRIGGER trg_cl_categories
  AFTER INSERT OR UPDATE OR DELETE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.log_change();

-- Groups
DROP TRIGGER IF EXISTS trg_cl_groups ON public.groups;
CREATE TRIGGER trg_cl_groups
  AFTER INSERT OR UPDATE OR DELETE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.log_change();
