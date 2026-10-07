-- Kinika · Step 3 (Vault credentials, free-trial credits) — paste into Supabase → SQL Editor → Run.
-- ORDER: deploy the functions FIRST (supabase functions deploy run-step connector-action), then run this.
-- Safe to run more than once.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 3 — connector credentials in Vault, and the free-trial grant
--
-- 1. Connector credentials (API tokens, app passwords) move from a plain jsonb
--    column into Supabase Vault, encrypted at rest. The table keeps only the
--    vault id. Browsers still cannot read the table at all; edge functions
--    read the secret through get_connection_secret(), service role only.
--    Deploy the functions first: they fall back to the old column until this
--    runs, so nothing breaks in between.
-- 2. The Free plan promised 50 credits; nothing ever granted them.
--    claim_trial_credits() gives them once to a wallet that has never earned
--    a credit and has no subscription. The amount lives in platform_settings.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF to_regnamespace('vault') IS NULL THEN
    RAISE EXCEPTION 'Supabase Vault is not enabled on this project. Enable it under Database → Extensions, then run this again.';
  END IF;
END $$;

-- ── 1. Vault ────────────────────────────────────────────────────────────────

ALTER TABLE public.tool_connection_secrets ADD COLUMN IF NOT EXISTS vault_secret_id uuid;
ALTER TABLE public.tool_connection_secrets ALTER COLUMN secret DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.set_connection_secret(p_connection_id uuid, p_secret jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_vid uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tool_connections WHERE id = p_connection_id AND user_id = auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_OWNER');
  END IF;

  SELECT vault_secret_id INTO v_vid FROM public.tool_connection_secrets WHERE connection_id = p_connection_id;
  IF v_vid IS NULL THEN
    -- A leftover secret with this name (from a deleted row) would collide.
    DELETE FROM vault.secrets WHERE name = 'connection:' || p_connection_id::text;
    v_vid := vault.create_secret(p_secret::text, 'connection:' || p_connection_id::text, 'Kinika connector credentials');
    INSERT INTO public.tool_connection_secrets (connection_id, vault_secret_id, secret)
    VALUES (p_connection_id, v_vid, NULL)
    ON CONFLICT (connection_id) DO UPDATE SET vault_secret_id = EXCLUDED.vault_secret_id, secret = NULL, updated_at = now();
  ELSE
    PERFORM vault.update_secret(v_vid, p_secret::text);
    UPDATE public.tool_connection_secrets SET secret = NULL, updated_at = now() WHERE connection_id = p_connection_id;
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.set_connection_secret(uuid, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.set_connection_secret(uuid, jsonb) TO authenticated;

-- Edge functions only (service role). Returns NULL when there is nothing in Vault.
CREATE OR REPLACE FUNCTION public.get_connection_secret(p_connection_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_vid uuid;
  v_text text;
BEGIN
  SELECT vault_secret_id INTO v_vid FROM public.tool_connection_secrets WHERE connection_id = p_connection_id;
  IF v_vid IS NULL THEN RETURN NULL; END IF;
  SELECT decrypted_secret INTO v_text FROM vault.decrypted_secrets WHERE id = v_vid;
  RETURN v_text::jsonb;
END;
$$;
REVOKE ALL ON FUNCTION public.get_connection_secret(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_connection_secret(uuid) TO service_role;

-- Removing a connection removes its vault secret too.
CREATE OR REPLACE FUNCTION public.drop_connection_vault_secret()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.vault_secret_id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = OLD.vault_secret_id;
  END IF;
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS tool_connection_secrets_drop_vault ON public.tool_connection_secrets;
CREATE TRIGGER tool_connection_secrets_drop_vault BEFORE DELETE ON public.tool_connection_secrets
  FOR EACH ROW EXECUTE FUNCTION public.drop_connection_vault_secret();

-- Move what is already stored, then clear the plain copy.
DO $$
DECLARE
  r record;
  v uuid;
  v_moved integer := 0;
BEGIN
  FOR r IN SELECT connection_id, secret FROM public.tool_connection_secrets WHERE vault_secret_id IS NULL AND secret IS NOT NULL LOOP
    DELETE FROM vault.secrets WHERE name = 'connection:' || r.connection_id::text;
    v := vault.create_secret(r.secret::text, 'connection:' || r.connection_id::text, 'Kinika connector credentials');
    UPDATE public.tool_connection_secrets SET vault_secret_id = v, secret = NULL WHERE connection_id = r.connection_id;
    v_moved := v_moved + 1;
  END LOOP;
  RAISE NOTICE 'Moved % connection credential(s) into Vault.', v_moved;
END $$;

-- ── 2. Free-trial credits ───────────────────────────────────────────────────

ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS trial_granted_at timestamptz;

INSERT INTO public.platform_settings (setting_key, setting_value, description)
VALUES ('trial_credits', '{"credits": 50}'::jsonb, 'Credits given once to a new Free Trial account.')
ON CONFLICT (setting_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.claim_trial_credits()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_wallet public.wallets%ROWTYPE;
  v_amount integer;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'NOT_SIGNED_IN'); END IF;

  INSERT INTO public.wallets (user_id, balance, reserved_balance, lifetime_earned, lifetime_spent, lifetime_refunded)
  VALUES (v_uid, 0, 0, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_uid FOR UPDATE;

  IF v_wallet.trial_granted_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'granted', 0, 'reason', 'ALREADY_CLAIMED');
  END IF;

  -- Only a wallet that has never received anything, on no paid plan.
  IF v_wallet.lifetime_earned > 0 OR EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id = v_uid) THEN
    UPDATE public.wallets SET trial_granted_at = now() WHERE id = v_wallet.id;
    RETURN jsonb_build_object('success', true, 'granted', 0, 'reason', 'NOT_ELIGIBLE');
  END IF;

  SELECT COALESCE((setting_value ->> 'credits')::integer, 50) INTO v_amount FROM public.platform_settings WHERE setting_key = 'trial_credits';
  v_amount := COALESCE(v_amount, 50);
  IF v_amount <= 0 THEN
    UPDATE public.wallets SET trial_granted_at = now() WHERE id = v_wallet.id;
    RETURN jsonb_build_object('success', true, 'granted', 0, 'reason', 'DISABLED');
  END IF;

  v_result := public.add_credits(v_uid, v_amount, 'bonus', 'Free trial credits', NULL, 'trial');
  IF COALESCE((v_result ->> 'success')::boolean, false) THEN
    UPDATE public.wallets SET trial_granted_at = now() WHERE id = v_wallet.id;
    RETURN jsonb_build_object('success', true, 'granted', v_amount);
  END IF;
  RETURN jsonb_build_object('success', false, 'error', COALESCE(v_result ->> 'error', 'GRANT_FAILED'));
END;
$$;
REVOKE ALL ON FUNCTION public.claim_trial_credits() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_trial_credits() TO authenticated;

INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES
  ('20260714000000', 'step3_vault_and_trial')
ON CONFLICT (version) DO NOTHING;

COMMIT;
