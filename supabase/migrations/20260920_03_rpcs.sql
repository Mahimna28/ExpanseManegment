-- ============================================================
-- Migration 03: Application RPCs
-- All functions use SECURITY INVOKER (default in Postgres 15+).
-- auth.uid() identifies the caller from their JWT.
-- RLS on all tables applies inside each function body.
-- Run AFTER 01 and 02.
-- ============================================================

-- ── Rate limit tracking for invite redemption ─────────────────
CREATE TABLE IF NOT EXISTS public.join_rate_limits (
  user_id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  failed_attempts INT NOT NULL DEFAULT 0,
  locked_until    TIMESTAMPTZ
);
ALTER TABLE public.join_rate_limits ENABLE ROW LEVEL SECURITY;

-- ── Utility: cryptographically secure invite code ─────────────

CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS CHAR(10)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- 32 unambiguous chars
  bytes BYTEA := gen_random_bytes(10);             -- Cryptographically secure
  code  TEXT := '';
  i     INT;
BEGIN
  FOR i IN 0..9 LOOP
    code := code || substr(chars, (get_byte(bytes, i) % length(chars)) + 1, 1);
  END LOOP;
  RETURN code;
END;
$$;

-- ── Utility: guard active membership ─────────────────────────

CREATE OR REPLACE FUNCTION public.assert_active_member(p_group_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id AND user_id = p_user_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'not_member' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

-- ── RPC: create_group ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_group(
  p_name        TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_group_id UUID;
  v_code     CHAR(10);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001';
  END IF;

  IF char_length(trim(p_name)) < 1 OR char_length(trim(p_name)) > 80 THEN
    RAISE EXCEPTION 'invalid_group_name' USING ERRCODE = 'P0003';
  END IF;

  -- Generate unique invite code with cryptographically secure random bytes
  LOOP
    v_code := public.generate_invite_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.groups WHERE invite_code = v_code);
  END LOOP;

  INSERT INTO public.groups (name, description, created_by, invite_code)
  VALUES (trim(p_name), trim(p_description), v_uid, v_code)
  RETURNING id INTO v_group_id;

  INSERT INTO public.group_members (group_id, user_id, role, status, invited_by)
  VALUES (v_group_id, v_uid, 'owner', 'active', v_uid);

  RETURN jsonb_build_object('group_id', v_group_id, 'invite_code', v_code);
END;
$$;

-- ── RPC: join_group ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.join_group(p_invite_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_uid         UUID := auth.uid();
  v_group_id    UUID;
  v_expires_at  TIMESTAMPTZ;
  v_existing    TEXT;
  v_rl          RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001';
  END IF;

  -- Abuse protection / Rate limiting check
  SELECT * INTO v_rl FROM public.join_rate_limits WHERE user_id = v_uid;
  IF v_rl.locked_until IS NOT NULL AND v_rl.locked_until > now() THEN
    RAISE EXCEPTION 'too_many_failed_attempts' USING ERRCODE = 'P0024';
  END IF;

  -- Find group by invite code
  SELECT id, invite_expires_at INTO v_group_id, v_expires_at
  FROM public.groups
  WHERE invite_code = upper(trim(p_invite_code))
    AND is_archived = false;

  IF v_group_id IS NULL THEN
    -- Increment failure count
    INSERT INTO public.join_rate_limits (user_id, failed_attempts)
    VALUES (v_uid, 1)
    ON CONFLICT (user_id) DO UPDATE SET
      failed_attempts = public.join_rate_limits.failed_attempts + 1,
      locked_until = CASE
        WHEN public.join_rate_limits.failed_attempts + 1 >= 5 THEN now() + INTERVAL '15 minutes'
        ELSE NULL
      END;

    RAISE EXCEPTION 'invalid_invite_code' USING ERRCODE = 'P0004';
  END IF;

  -- Enforce expiry if configured
  IF v_expires_at IS NOT NULL AND v_expires_at < now() THEN
    RAISE EXCEPTION 'invite_code_expired' USING ERRCODE = 'P0022';
  END IF;

  -- Check existing membership
  SELECT status INTO v_existing
  FROM public.group_members
  WHERE group_id = v_group_id AND user_id = v_uid;

  IF v_existing = 'active' THEN
    RAISE EXCEPTION 'already_member' USING ERRCODE = 'P0005';
  ELSIF v_existing IN ('revoked', 'left') THEN
    RAISE EXCEPTION 'membership_revoked' USING ERRCODE = 'P0006';
  END IF;

  -- Successful join: reset rate limit
  DELETE FROM public.join_rate_limits WHERE user_id = v_uid;

  INSERT INTO public.group_members (group_id, user_id, role, status)
  VALUES (v_group_id, v_uid, 'member', 'active');

  RETURN jsonb_build_object('group_id', v_group_id);
END;
$$;

-- ── RPC: revoke_member ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.revoke_member(
  p_group_id   UUID,
  p_target_uid UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_caller_role TEXT;
  v_target_role TEXT;
BEGIN
  PERFORM public.assert_active_member(p_group_id, v_uid);

  SELECT role INTO v_caller_role
  FROM public.group_members WHERE group_id = p_group_id AND user_id = v_uid AND status = 'active';

  IF v_caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'insufficient_role' USING ERRCODE = 'P0007';
  END IF;

  SELECT role INTO v_target_role
  FROM public.group_members WHERE group_id = p_group_id AND user_id = p_target_uid AND status = 'active';

  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'target_not_active_member' USING ERRCODE = 'P0008';
  END IF;

  IF v_target_role = 'owner' THEN
    RAISE EXCEPTION 'cannot_revoke_owner' USING ERRCODE = 'P0009';
  END IF;

  IF v_target_role = 'admin' AND v_caller_role <> 'owner' THEN
    RAISE EXCEPTION 'insufficient_role' USING ERRCODE = 'P0007';
  END IF;

  UPDATE public.group_members
  SET status = 'revoked', revoked_at = now()
  WHERE group_id = p_group_id AND user_id = p_target_uid;
END;
$$;

-- ── RPC: rotate_invite_code ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.rotate_invite_code(
  p_group_id   UUID,
  p_expires_in INTERVAL DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_caller_role TEXT;
  v_code       CHAR(10);
  v_expires_at TIMESTAMPTZ := NULL;
BEGIN
  PERFORM public.assert_active_member(p_group_id, v_uid);

  SELECT role INTO v_caller_role
  FROM public.group_members WHERE group_id = p_group_id AND user_id = v_uid AND status = 'active';

  IF v_caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'insufficient_role' USING ERRCODE = 'P0007';
  END IF;

  IF p_expires_in IS NOT NULL THEN
    v_expires_at := now() + p_expires_in;
  END IF;

  LOOP
    v_code := public.generate_invite_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.groups WHERE invite_code = v_code);
  END LOOP;

  UPDATE public.groups
  SET invite_code = v_code,
      invite_expires_at = v_expires_at,
      updated_at = now()
  WHERE id = p_group_id;

  RETURN v_code;
END;
$$;

-- ── RPC: create_expense ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_expense(
  p_mutation_id  UUID,
  p_expense_id   UUID,
  p_group_id     UUID,
  p_category_id  UUID,
  p_title        TEXT,
  p_notes        TEXT,
  p_total_paise  BIGINT,
  p_paid_by      UUID,
  p_split_type   TEXT,
  p_expense_date DATE,
  p_splits       JSONB  -- [{participant_id, owed_paise}, ...]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_uid          UUID := auth.uid();
  v_split        JSONB;
  v_split_sum    BIGINT := 0;
  v_participant  UUID;
  v_owed         BIGINT;
  v_cached_resp  JSONB;
BEGIN
  -- Idempotency check
  SELECT response_json INTO v_cached_resp
  FROM public.outbox_idempotency
  WHERE mutation_id = p_mutation_id AND actor_id = v_uid;

  IF v_cached_resp IS NOT NULL THEN
    RETURN v_cached_resp;
  END IF;

  -- Authorization
  PERFORM public.assert_active_member(p_group_id, v_uid);

  -- Validate title
  IF char_length(trim(p_title)) < 1 OR char_length(trim(p_title)) > 200 THEN
    RAISE EXCEPTION 'invalid_title' USING ERRCODE = 'P0025';
  END IF;

  -- Validate paid_by is an active member
  IF NOT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id AND user_id = p_paid_by AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'payer_not_member' USING ERRCODE = 'P0010';
  END IF;

  -- Validate amount (integer paise, > 0 and <= ₹1 Crore)
  IF p_total_paise <= 0 OR p_total_paise > 1000000000 THEN
    RAISE EXCEPTION 'invalid_amount' USING ERRCODE = 'P0011';
  END IF;

  -- Validate split type
  IF p_split_type NOT IN ('equal','custom') THEN
    RAISE EXCEPTION 'invalid_split_type' USING ERRCODE = 'P0012';
  END IF;

  -- Check non-empty splits
  IF p_splits IS NULL OR jsonb_array_length(p_splits) = 0 THEN
    RAISE EXCEPTION 'empty_splits' USING ERRCODE = 'P0026';
  END IF;

  -- Reject duplicate participant IDs in splits
  IF (
    SELECT COUNT(*) FROM jsonb_array_elements(p_splits)
  ) <> (
    SELECT COUNT(DISTINCT split->>'participant_id') FROM jsonb_array_elements(p_splits) split
  ) THEN
    RAISE EXCEPTION 'duplicate_participant_split' USING ERRCODE = 'P0023';
  END IF;

  -- Validate each participant is an active member and compute split sum
  FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits) LOOP
    v_participant := (v_split->>'participant_id')::UUID;
    v_owed        := (v_split->>'owed_paise')::BIGINT;

    IF v_owed < 0 THEN
      RAISE EXCEPTION 'negative_split' USING ERRCODE = 'P0013';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = p_group_id AND user_id = v_participant AND status = 'active'
    ) THEN
      RAISE EXCEPTION 'participant_not_member' USING ERRCODE = 'P0014';
    END IF;

    v_split_sum := v_split_sum + v_owed;
  END LOOP;

  -- Enforce exact split sum conservation
  IF v_split_sum <> p_total_paise THEN
    RAISE EXCEPTION 'split_sum_mismatch: sum=% total=%', v_split_sum, p_total_paise
      USING ERRCODE = 'P0015';
  END IF;

  -- Insert expense
  INSERT INTO public.expenses (
    id, group_id, category_id, title, notes,
    total_paise, paid_by, split_type, expense_date,
    server_version, created_by, created_at, updated_at
  ) VALUES (
    p_expense_id, p_group_id, p_category_id, trim(p_title), p_notes,
    p_total_paise, p_paid_by, p_split_type, p_expense_date,
    1, v_uid, now(), now()
  )
  ON CONFLICT (id) DO NOTHING;

  -- Insert splits
  FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits) LOOP
    INSERT INTO public.expense_splits (expense_id, participant_id, owed_paise)
    VALUES (
      p_expense_id,
      (v_split->>'participant_id')::UUID,
      (v_split->>'owed_paise')::BIGINT
    )
    ON CONFLICT (expense_id, participant_id) DO NOTHING;
  END LOOP;

  DECLARE
    v_response JSONB := jsonb_build_object('expense_id', p_expense_id, 'server_version', 1);
  BEGIN
    INSERT INTO public.outbox_idempotency (mutation_id, group_id, actor_id, entity_type, operation, response_json)
    VALUES (p_mutation_id, p_group_id, v_uid, 'expense', 'CREATE', v_response)
    ON CONFLICT (mutation_id) DO NOTHING;
    RETURN v_response;
  END;
END;
$$;

-- ── RPC: update_expense ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_expense(
  p_mutation_id   UUID,
  p_expense_id    UUID,
  p_base_version  INT,
  p_category_id   UUID,
  p_title         TEXT,
  p_notes         TEXT,
  p_total_paise   BIGINT,
  p_paid_by       UUID,
  p_split_type    TEXT,
  p_expense_date  DATE,
  p_splits        JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_uid          UUID := auth.uid();
  v_group_id     UUID;
  v_cur_version  INT;
  v_split        JSONB;
  v_split_sum    BIGINT := 0;
  v_participant  UUID;
  v_owed         BIGINT;
  v_cached_resp  JSONB;
  v_new_version  INT;
BEGIN
  SELECT response_json INTO v_cached_resp
  FROM public.outbox_idempotency
  WHERE mutation_id = p_mutation_id AND actor_id = v_uid;

  IF v_cached_resp IS NOT NULL THEN RETURN v_cached_resp; END IF;

  SELECT group_id, server_version INTO v_group_id, v_cur_version
  FROM public.expenses WHERE id = p_expense_id AND is_voided = false;

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'expense_not_found' USING ERRCODE = 'P0016';
  END IF;

  PERFORM public.assert_active_member(v_group_id, v_uid);

  -- Optimistic concurrency check
  IF v_cur_version <> p_base_version THEN
    RETURN jsonb_build_object(
      'conflict', true,
      'current', (SELECT row_to_json(e) FROM public.expenses e WHERE id = p_expense_id)
    );
  END IF;

  IF p_total_paise <= 0 OR p_total_paise > 1000000000 THEN
    RAISE EXCEPTION 'invalid_amount' USING ERRCODE = 'P0011';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = v_group_id AND user_id = p_paid_by AND status = 'active') THEN
    RAISE EXCEPTION 'payer_not_member' USING ERRCODE = 'P0010';
  END IF;

  -- Reject duplicate participant IDs in splits
  IF (
    SELECT COUNT(*) FROM jsonb_array_elements(p_splits)
  ) <> (
    SELECT COUNT(DISTINCT split->>'participant_id') FROM jsonb_array_elements(p_splits) split
  ) THEN
    RAISE EXCEPTION 'duplicate_participant_split' USING ERRCODE = 'P0023';
  END IF;

  FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits) LOOP
    v_participant := (v_split->>'participant_id')::UUID;
    v_owed        := (v_split->>'owed_paise')::BIGINT;
    IF v_owed < 0 THEN RAISE EXCEPTION 'negative_split' USING ERRCODE = 'P0013'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = v_group_id AND user_id = v_participant AND status = 'active') THEN
      RAISE EXCEPTION 'participant_not_member' USING ERRCODE = 'P0014';
    END IF;
    v_split_sum := v_split_sum + v_owed;
  END LOOP;

  IF v_split_sum <> p_total_paise THEN
    RAISE EXCEPTION 'split_sum_mismatch' USING ERRCODE = 'P0015';
  END IF;

  v_new_version := v_cur_version + 1;

  UPDATE public.expenses SET
    category_id    = p_category_id,
    title          = trim(p_title),
    notes          = p_notes,
    total_paise    = p_total_paise,
    paid_by        = p_paid_by,
    split_type     = p_split_type,
    expense_date   = p_expense_date,
    server_version = v_new_version,
    updated_at     = now()
  WHERE id = p_expense_id;

  DELETE FROM public.expense_splits WHERE expense_id = p_expense_id;
  FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits) LOOP
    INSERT INTO public.expense_splits (expense_id, participant_id, owed_paise)
    VALUES (p_expense_id, (v_split->>'participant_id')::UUID, (v_split->>'owed_paise')::BIGINT);
  END LOOP;

  DECLARE
    v_response JSONB := jsonb_build_object('expense_id', p_expense_id, 'server_version', v_new_version);
  BEGIN
    INSERT INTO public.outbox_idempotency (mutation_id, group_id, actor_id, entity_type, operation, response_json)
    VALUES (p_mutation_id, v_group_id, v_uid, 'expense', 'UPDATE', v_response)
    ON CONFLICT (mutation_id) DO NOTHING;
    RETURN v_response;
  END;
END;
$$;

-- ── RPC: void_expense ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.void_expense(
  p_mutation_id UUID,
  p_expense_id  UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_group_id  UUID;
  v_cached    JSONB;
BEGIN
  SELECT response_json INTO v_cached FROM public.outbox_idempotency
  WHERE mutation_id = p_mutation_id AND actor_id = v_uid;
  IF v_cached IS NOT NULL THEN RETURN v_cached; END IF;

  SELECT group_id INTO v_group_id FROM public.expenses WHERE id = p_expense_id AND is_voided = false;
  IF v_group_id IS NULL THEN RAISE EXCEPTION 'expense_not_found_or_already_voided' USING ERRCODE = 'P0016'; END IF;

  PERFORM public.assert_active_member(v_group_id, v_uid);

  UPDATE public.expenses
  SET is_voided = true, voided_by = v_uid, voided_at = now(),
      server_version = server_version + 1, updated_at = now()
  WHERE id = p_expense_id;

  DECLARE
    v_response JSONB := jsonb_build_object('expense_id', p_expense_id, 'voided', true);
  BEGIN
    INSERT INTO public.outbox_idempotency (mutation_id, group_id, actor_id, entity_type, operation, response_json)
    VALUES (p_mutation_id, v_group_id, v_uid, 'expense', 'VOID', v_response)
    ON CONFLICT (mutation_id) DO NOTHING;
    RETURN v_response;
  END;
END;
$$;

-- ── RPC: create_settlement ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_settlement(
  p_mutation_id    UUID,
  p_settlement_id  UUID,
  p_group_id       UUID,
  p_from_user_id   UUID,
  p_to_user_id     UUID,
  p_amount_paise   BIGINT,
  p_payment_method TEXT,
  p_note           TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_cached   JSONB;
BEGIN
  SELECT response_json INTO v_cached FROM public.outbox_idempotency
  WHERE mutation_id = p_mutation_id AND actor_id = v_uid;
  IF v_cached IS NOT NULL THEN RETURN v_cached; END IF;

  PERFORM public.assert_active_member(p_group_id, v_uid);

  -- Only the payer can record the settlement
  IF p_from_user_id <> v_uid THEN
    RAISE EXCEPTION 'only_payer_can_record_settlement' USING ERRCODE = 'P0017';
  END IF;

  IF p_to_user_id = p_from_user_id THEN
    RAISE EXCEPTION 'self_settlement' USING ERRCODE = 'P0018';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id AND user_id = p_to_user_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'recipient_not_member' USING ERRCODE = 'P0019';
  END IF;

  IF p_amount_paise <= 0 OR p_amount_paise > 1000000000 THEN
    RAISE EXCEPTION 'invalid_amount' USING ERRCODE = 'P0011';
  END IF;

  INSERT INTO public.settlements (
    id, group_id, from_user_id, to_user_id, amount_paise,
    payment_method, note, created_by, created_at, updated_at
  ) VALUES (
    p_settlement_id, p_group_id, p_from_user_id, p_to_user_id, p_amount_paise,
    p_payment_method, p_note, v_uid, now(), now()
  )
  ON CONFLICT (id) DO NOTHING;

  DECLARE
    v_response JSONB := jsonb_build_object('settlement_id', p_settlement_id);
  BEGIN
    INSERT INTO public.outbox_idempotency (mutation_id, group_id, actor_id, entity_type, operation, response_json)
    VALUES (p_mutation_id, p_group_id, v_uid, 'settlement', 'CREATE', v_response)
    ON CONFLICT (mutation_id) DO NOTHING;
    RETURN v_response;
  END;
END;
$$;

-- ── RPC: void_settlement ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.void_settlement(
  p_mutation_id   UUID,
  p_settlement_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_group_id UUID;
  v_cached   JSONB;
BEGIN
  SELECT response_json INTO v_cached FROM public.outbox_idempotency
  WHERE mutation_id = p_mutation_id AND actor_id = v_uid;
  IF v_cached IS NOT NULL THEN RETURN v_cached; END IF;

  SELECT group_id INTO v_group_id
  FROM public.settlements WHERE id = p_settlement_id AND is_voided = false;

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'settlement_not_found_or_already_voided' USING ERRCODE = 'P0020';
  END IF;

  PERFORM public.assert_active_member(v_group_id, v_uid);

  UPDATE public.settlements
  SET is_voided = true, voided_by = v_uid, voided_at = now(), updated_at = now()
  WHERE id = p_settlement_id;

  DECLARE
    v_response JSONB := jsonb_build_object('settlement_id', p_settlement_id, 'voided', true);
  BEGIN
    INSERT INTO public.outbox_idempotency (mutation_id, group_id, actor_id, entity_type, operation, response_json)
    VALUES (p_mutation_id, v_group_id, v_uid, 'settlement', 'VOID', v_response)
    ON CONFLICT (mutation_id) DO NOTHING;
    RETURN v_response;
  END;
END;
$$;

-- ── RPC: pull_changes ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.pull_changes(
  p_group_id UUID,
  p_after_seq BIGINT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  PERFORM public.assert_active_member(p_group_id, v_uid);

  RETURN jsonb_build_object(
    'rows', (
      SELECT jsonb_agg(row_to_json(cl.*) ORDER BY cl.seq ASC)
      FROM public.change_log cl
      WHERE cl.group_id = p_group_id
        AND cl.seq > p_after_seq
      LIMIT 200
    ),
    'max_seq', (
      SELECT COALESCE(MAX(seq), p_after_seq)
      FROM public.change_log
      WHERE group_id = p_group_id AND seq > p_after_seq
    )
  );
END;
$$;

-- ── RPC: archive_category ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.archive_category(
  p_group_id    UUID,
  p_category_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  PERFORM public.assert_active_member(p_group_id, auth.uid());

  UPDATE public.categories
  SET is_archived = true, updated_at = now()
  WHERE id = p_category_id AND group_id = p_group_id;
END;
$$;

-- ── RPC: rename_category ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rename_category(
  p_group_id    UUID,
  p_category_id UUID,
  p_new_name    TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_normalized TEXT;
BEGIN
  PERFORM public.assert_active_member(p_group_id, auth.uid());

  v_normalized := initcap(trim(p_new_name));

  IF char_length(v_normalized) < 1 OR char_length(v_normalized) > 50 THEN
    RAISE EXCEPTION 'invalid_category_name' USING ERRCODE = 'P0021';
  END IF;

  UPDATE public.categories
  SET name = v_normalized, updated_at = now()
  WHERE id = p_category_id AND group_id = p_group_id;
END;
$$;

-- ── Explicit Permissions & Grants ─────────────────────────────
-- Ensure authenticated users can execute the RPCs, while anon and public cannot.

REVOKE ALL ON FUNCTION public.generate_invite_code() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assert_active_member(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_group(TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.join_group(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_member(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rotate_invite_code(UUID, INTERVAL) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_expense(UUID, UUID, UUID, UUID, TEXT, TEXT, BIGINT, UUID, TEXT, DATE, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_expense(UUID, UUID, INT, UUID, TEXT, TEXT, BIGINT, UUID, TEXT, DATE, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.void_expense(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_settlement(UUID, UUID, UUID, UUID, UUID, BIGINT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.void_settlement(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pull_changes(UUID, BIGINT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.archive_category(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rename_category(UUID, UUID, TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_group(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_group(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_invite_code(UUID, INTERVAL) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_expense(UUID, UUID, UUID, UUID, TEXT, TEXT, BIGINT, UUID, TEXT, DATE, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_expense(UUID, UUID, INT, UUID, TEXT, TEXT, BIGINT, UUID, TEXT, DATE, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_expense(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_settlement(UUID, UUID, UUID, UUID, UUID, BIGINT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_settlement(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pull_changes(UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_category(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rename_category(UUID, UUID, TEXT) TO authenticated;
