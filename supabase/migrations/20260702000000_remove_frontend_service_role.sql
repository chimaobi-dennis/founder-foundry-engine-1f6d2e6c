-- ─────────────────────────────────────────────────────────────────────────────
-- Remove the service-role key from the frontend
--
-- Until now the admin UI used a second Supabase client built from
-- VITE_SUPABASE_SERVICE_ROLE_KEY. Any VITE_ variable is inlined into the
-- browser bundle, so that key (which bypasses RLS entirely) was readable by
-- every visitor of any deployment that set it.
--
-- This migration makes every admin operation possible through the normal
-- anon-key client:
--
--   1. public.is_admin()            — same definition as the Phase 0 migration
--                                     (CREATE OR REPLACE, so either order works)
--   2. Admin RLS policies           — on every table the admin UI reads/writes
--   3. grant_credits_internal()     — privileged grant, not callable by clients
--      grant_credits_admin()        — now checks is_admin() (or service role)
--      claim_free_trial_credits()   — self-service welcome credits, replaces
--                                     the service-role grant done at onboarding
--
-- Policies are created only when the table exists and the policy does not,
-- so this is safe to run against both the managed and the external project.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. is_admin() ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ── 2. Admin RLS policies ────────────────────────────────────────────────────

-- Each policy is created only if its table exists and it is not there yet.

-- profiles: admin reads every profile (users list, dashboard counts, joins)
-- and updates any profile (role changes, creator approval).
DO $$ BEGIN
  IF to_regclass('public.profiles') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Admins read all profiles') THEN
    CREATE POLICY "Admins read all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_admin());
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.profiles') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Admins update all profiles') THEN
    CREATE POLICY "Admins update all profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
  END IF;
END $$;

-- creator_applications: admin review queue.
DO $$ BEGIN
  IF to_regclass('public.creator_applications') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'creator_applications' AND policyname = 'Admins read all creator applications') THEN
    CREATE POLICY "Admins read all creator applications" ON public.creator_applications FOR SELECT TO authenticated USING (public.is_admin());
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.creator_applications') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'creator_applications' AND policyname = 'Admins update creator applications') THEN
    CREATE POLICY "Admins update creator applications" ON public.creator_applications FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
  END IF;
END $$;

-- creator_profiles: created/updated by the admin when approving an application.
DO $$ BEGIN
  IF to_regclass('public.creator_profiles') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'creator_profiles' AND policyname = 'Admins manage creator profiles') THEN
    CREATE POLICY "Admins manage creator profiles" ON public.creator_profiles FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
  END IF;
END $$;

-- prostudio_templates + preview images: template review.
DO $$ BEGIN
  IF to_regclass('public.prostudio_templates') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'prostudio_templates' AND policyname = 'Admins read all templates') THEN
    CREATE POLICY "Admins read all templates" ON public.prostudio_templates FOR SELECT TO authenticated USING (public.is_admin());
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.prostudio_templates') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'prostudio_templates' AND policyname = 'Admins update all templates') THEN
    CREATE POLICY "Admins update all templates" ON public.prostudio_templates FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.template_preview_images') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'template_preview_images' AND policyname = 'Admins read all template preview images') THEN
    CREATE POLICY "Admins read all template preview images" ON public.template_preview_images FOR SELECT TO authenticated USING (public.is_admin());
  END IF;
END $$;

-- brands: dashboard counts and recent activity.
DO $$ BEGIN
  IF to_regclass('public.brands') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'brands' AND policyname = 'Admins read all brands') THEN
    CREATE POLICY "Admins read all brands" ON public.brands FOR SELECT TO authenticated USING (public.is_admin());
  END IF;
END $$;

-- Billing tables.
DO $$ BEGIN
  IF to_regclass('public.credit_packages') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'credit_packages' AND policyname = 'Admins manage credit packages') THEN
    CREATE POLICY "Admins manage credit packages" ON public.credit_packages FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.credit_purchases') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'credit_purchases' AND policyname = 'Admins read all purchases') THEN
    CREATE POLICY "Admins read all purchases" ON public.credit_purchases FOR SELECT TO authenticated USING (public.is_admin());
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.wallets') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'wallets' AND policyname = 'Admins read all wallets') THEN
    CREATE POLICY "Admins read all wallets" ON public.wallets FOR SELECT TO authenticated USING (public.is_admin());
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.wallet_transactions') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'wallet_transactions' AND policyname = 'Admins read all transactions') THEN
    CREATE POLICY "Admins read all transactions" ON public.wallet_transactions FOR SELECT TO authenticated USING (public.is_admin());
  END IF;
END $$;

-- Pricing rules (same policy name as the Phase 0 migration; whichever runs
-- first creates it).
DO $$ BEGIN
  IF to_regclass('public.ai_generation_pricing') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ai_generation_pricing' AND policyname = 'Admins manage pricing rules') THEN
    CREATE POLICY "Admins manage pricing rules" ON public.ai_generation_pricing FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
  END IF;
END $$;

-- Error log: admins triage, users may report.
DO $$ BEGIN
  IF to_regclass('public.app_errors') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'app_errors' AND policyname = 'Admins read all errors') THEN
    CREATE POLICY "Admins read all errors" ON public.app_errors FOR SELECT TO authenticated USING (public.is_admin());
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.app_errors') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'app_errors' AND policyname = 'Admins update errors') THEN
    CREATE POLICY "Admins update errors" ON public.app_errors FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.app_errors') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'app_errors' AND policyname = 'Users insert own errors') THEN
    CREATE POLICY "Users insert own errors" ON public.app_errors FOR INSERT TO authenticated WITH CHECK (user_id IS NULL OR user_id = auth.uid());
  END IF;
END $$;

-- platform_settings: every signed-in user reads (render engine, billing
-- defaults); only admins write. Same names as the Phase 0 migration.
DO $$ BEGIN
  IF to_regclass('public.platform_settings') IS NOT NULL THEN
    ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.platform_settings') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'platform_settings' AND policyname = 'Authenticated users read platform settings') THEN
    CREATE POLICY "Authenticated users read platform settings" ON public.platform_settings FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.platform_settings') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'platform_settings' AND policyname = 'Admins manage platform settings') THEN
    CREATE POLICY "Admins manage platform settings" ON public.platform_settings FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
  END IF;
END $$;

-- ── 3. Credit grant RPCs ─────────────────────────────────────────────────────

-- Privileged grant. Not executable by clients; only called from the two
-- SECURITY DEFINER wrappers below.
CREATE OR REPLACE FUNCTION public.grant_credits_internal(
  p_user_id UUID,
  p_amount NUMERIC,
  p_type TEXT DEFAULT 'bonus',
  p_description TEXT DEFAULT 'Admin credit grant',
  p_admin_user_id UUID DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet RECORD;
  v_bal_before NUMERIC;
  v_bal_after NUMERIC;
  v_txn_id UUID;
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  -- Idempotency
  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.wallet_transactions WHERE metadata->>'idempotency_key' = p_idempotency_key) THEN
      RETURN jsonb_build_object('success', true, 'already_granted', true);
    END IF;
  END IF;

  INSERT INTO public.wallets (user_id, balance, reserved_balance, lifetime_earned, lifetime_spent, lifetime_refunded)
  VALUES (p_user_id, 0, 0, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;

  v_bal_before := v_wallet.balance;
  v_bal_after := v_wallet.balance + p_amount;

  UPDATE public.wallets
  SET balance = v_bal_after, lifetime_earned = lifetime_earned + p_amount, updated_at = now()
  WHERE id = v_wallet.id;

  INSERT INTO public.wallet_transactions (
    wallet_id, user_id, transaction_type, amount,
    balance_before, balance_after,
    reserved_before, reserved_after,
    reference_type, metadata
  ) VALUES (
    v_wallet.id, p_user_id, p_type, p_amount,
    v_bal_before, v_bal_after,
    v_wallet.reserved_balance, v_wallet.reserved_balance,
    'admin_grant',
    jsonb_build_object('description', p_description, 'admin_user_id', p_admin_user_id, 'idempotency_key', p_idempotency_key)
  ) RETURNING id INTO v_txn_id;

  RETURN jsonb_build_object(
    'success', true,
    'already_granted', false,
    'transaction_id', v_txn_id,
    'credits_granted', p_amount,
    'balance_after', v_bal_after
  );
END;
$$;

REVOKE ALL ON FUNCTION public.grant_credits_internal(UUID, NUMERIC, TEXT, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- Admin grant: same signature and result shape as before, now gated.
-- The service role (edge functions) is still allowed through.
CREATE OR REPLACE FUNCTION public.grant_credits_admin(
  p_user_id UUID,
  p_amount NUMERIC,
  p_type TEXT DEFAULT 'bonus',
  p_description TEXT DEFAULT 'Admin credit grant',
  p_admin_user_id UUID DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_admin() OR coalesce(auth.role(), '') = 'service_role') THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_ADMIN');
  END IF;

  RETURN public.grant_credits_internal(
    p_user_id, p_amount, p_type, p_description,
    coalesce(p_admin_user_id, auth.uid()), p_idempotency_key
  );
END;
$$;

REVOKE ALL ON FUNCTION public.grant_credits_admin(UUID, NUMERIC, TEXT, TEXT, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grant_credits_admin(UUID, NUMERIC, TEXT, TEXT, UUID, TEXT) TO authenticated, service_role;

-- Self-service welcome credits, called once after onboarding. Mirrors the
-- previous frontend logic: amount from platform_settings.billing
-- (default 10), granted once per user as a 'topup' whose description
-- contains "free trial".
CREATE OR REPLACE FUNCTION public.claim_free_trial_credits()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_amount NUMERIC := 10;
  v_setting JSONB;
  v_result JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.wallet_transactions
    WHERE user_id = v_user_id
      AND transaction_type = 'topup'
      AND metadata->>'description' ILIKE '%free trial%'
  ) THEN
    RETURN jsonb_build_object('success', true, 'already_granted', true, 'credits_granted', 0);
  END IF;

  IF to_regclass('public.platform_settings') IS NOT NULL THEN
    SELECT CASE
             WHEN jsonb_typeof(setting_value) = 'string' THEN (setting_value #>> '{}')::jsonb
             ELSE setting_value
           END
    INTO v_setting
    FROM public.platform_settings
    WHERE setting_key = 'billing';

    IF v_setting IS NOT NULL AND (v_setting ? 'free_trial_credits') THEN
      BEGIN
        v_amount := (v_setting->>'free_trial_credits')::NUMERIC;
      EXCEPTION WHEN others THEN
        v_amount := 10;
      END;
    END IF;
  END IF;

  IF v_amount IS NULL OR v_amount <= 0 THEN
    RETURN jsonb_build_object('success', true, 'already_granted', false, 'credits_granted', 0);
  END IF;

  v_result := public.grant_credits_internal(
    v_user_id,
    v_amount,
    'topup',
    'Free trial credits (' || v_amount::text || ' credits)',
    NULL,
    'free_trial_' || v_user_id::text
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_free_trial_credits() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_free_trial_credits() TO authenticated;
