-- ============================================================
-- Migration 01: Initial schema
-- Run in Supabase SQL editor (Settings → SQL Editor)
-- ============================================================

-- Enable UUID extension (already enabled on Supabase by default)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Profiles ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 64),
  email         TEXT NOT NULL,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create profile row when a new auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Groups ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.groups (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  description       TEXT CHECK (char_length(description) <= 500),
  currency_code     CHAR(3) NOT NULL DEFAULT 'INR' CHECK (currency_code = 'INR'),
  created_by        UUID NOT NULL REFERENCES public.profiles(id),
  invite_code       CHAR(10) NOT NULL UNIQUE,
  invite_expires_at TIMESTAMPTZ,
  is_archived       BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_groups_invite ON public.groups (invite_code) WHERE is_archived = false;

-- ── Group Members ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.group_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'member'
                CHECK (role IN ('owner','admin','member')),
  status      TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','revoked','left')),
  invited_by  UUID REFERENCES public.profiles(id),
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

-- Hot path: RLS queries this index on every request
CREATE INDEX IF NOT EXISTS idx_gm_user_active ON public.group_members (user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_gm_group_active ON public.group_members (group_id) WHERE status = 'active';

-- ── Categories ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  name        TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_by  UUID NOT NULL REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Enforce case-insensitive uniqueness via normalized name (handled in RPC)
  UNIQUE (group_id, name)
);

CREATE INDEX IF NOT EXISTS idx_cat_group_active ON public.categories (group_id) WHERE is_archived = false;

-- ── Expenses ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.expenses (
  id              UUID PRIMARY KEY,  -- Client-generated UUID v4
  group_id        UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  category_id     UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  title           TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  notes           TEXT CHECK (char_length(notes) <= 2000),
  total_paise     BIGINT NOT NULL CHECK (total_paise > 0 AND total_paise <= 1000000000),
  paid_by         UUID NOT NULL REFERENCES public.profiles(id),
  split_type      TEXT NOT NULL CHECK (split_type IN ('equal','custom')),
  expense_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  is_voided       BOOLEAN NOT NULL DEFAULT false,
  voided_by       UUID REFERENCES public.profiles(id),
  voided_at       TIMESTAMPTZ,
  server_version  INTEGER NOT NULL DEFAULT 1,
  created_by      UUID NOT NULL REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exp_group_active ON public.expenses (group_id, expense_date DESC)
  WHERE is_voided = false;
CREATE INDEX IF NOT EXISTS idx_exp_group_all ON public.expenses (group_id, updated_at DESC);

-- ── Expense Splits ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.expense_splits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id      UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  participant_id  UUID NOT NULL REFERENCES public.profiles(id),
  owed_paise      BIGINT NOT NULL CHECK (owed_paise >= 0),
  UNIQUE (expense_id, participant_id)
);

CREATE INDEX IF NOT EXISTS idx_splits_expense ON public.expense_splits (expense_id);

-- ── Settlements ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.settlements (
  id              UUID PRIMARY KEY,  -- Client-generated UUID v4
  group_id        UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  from_user_id    UUID NOT NULL REFERENCES public.profiles(id),
  to_user_id      UUID NOT NULL REFERENCES public.profiles(id),
  amount_paise    BIGINT NOT NULL CHECK (amount_paise > 0 AND amount_paise <= 1000000000),
  payment_method  TEXT NOT NULL DEFAULT 'cash'
                    CHECK (payment_method IN ('cash','upi','bank_transfer','other')),
  note            TEXT CHECK (char_length(note) <= 200),
  is_voided       BOOLEAN NOT NULL DEFAULT false,
  voided_by       UUID REFERENCES public.profiles(id),
  voided_at       TIMESTAMPTZ,
  created_by      UUID NOT NULL REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (from_user_id <> to_user_id)
);

CREATE INDEX IF NOT EXISTS idx_settle_group_active ON public.settlements (group_id, created_at DESC)
  WHERE is_voided = false;

-- ── Change Log (sync cursor backbone) ────────────────────────

CREATE TABLE IF NOT EXISTS public.change_log (
  seq           BIGSERIAL PRIMARY KEY,
  group_id      UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  entity_type   TEXT NOT NULL CHECK (entity_type IN
                  ('expense','expense_split','settlement','member','category','group')),
  entity_id     UUID NOT NULL,
  operation     TEXT NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
  actor_id      UUID REFERENCES public.profiles(id),
  payload       JSONB NOT NULL,  -- Full row snapshot after the change
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Clients pull WHERE group_id = $1 AND seq > $2
CREATE INDEX IF NOT EXISTS idx_cl_group_seq ON public.change_log (group_id, seq ASC);

-- ── Outbox Idempotency ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.outbox_idempotency (
  mutation_id   UUID PRIMARY KEY,
  group_id      UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  actor_id      UUID NOT NULL REFERENCES public.profiles(id),
  entity_type   TEXT NOT NULL,
  operation     TEXT NOT NULL,
  response_json JSONB,           -- Cached response to return on duplicate calls
  accepted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '30 days'
);

CREATE INDEX IF NOT EXISTS idx_idempotency_expire ON public.outbox_idempotency (expires_at);
CREATE INDEX IF NOT EXISTS idx_idempotency_actor ON public.outbox_idempotency (actor_id, accepted_at DESC);
