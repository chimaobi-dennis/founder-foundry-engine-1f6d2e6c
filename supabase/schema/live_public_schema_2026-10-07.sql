


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."annotation_type" AS ENUM (
    'note',
    'tag',
    'bookmark'
);


ALTER TYPE "public"."annotation_type" OWNER TO "postgres";


CREATE TYPE "public"."creative_version_type" AS ENUM (
    'manual',
    'auto',
    'named',
    'system',
    'restore'
);


ALTER TYPE "public"."creative_version_type" OWNER TO "postgres";


CREATE TYPE "public"."snapshot_reason_type" AS ENUM (
    'periodic',
    'pre_mutation',
    'post_mutation',
    'user_request',
    'compression',
    'restore_point'
);


ALTER TYPE "public"."snapshot_reason_type" OWNER TO "postgres";


CREATE TYPE "public"."snapshot_storage_type" AS ENUM (
    'full',
    'patch',
    'reference'
);


ALTER TYPE "public"."snapshot_storage_type" OWNER TO "postgres";


CREATE TYPE "public"."version_source_type" AS ENUM (
    'initial_generation',
    'ai_regenerate',
    'ai_rewrite',
    'user_edit',
    'user_mutation',
    'manual_save',
    'auto_snapshot',
    'pre_export',
    'pre_delete',
    'restore',
    'platform_switch',
    'layout_change',
    'style_change',
    'node_add',
    'node_delete',
    'node_modify',
    'copy_edit',
    'visual_edit',
    'batch_operation'
);


ALTER TYPE "public"."version_source_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_credits"("p_user_id" "uuid", "p_amount" numeric, "p_type" "text" DEFAULT 'topup'::"text", "p_description" "text" DEFAULT 'Credit top-up'::"text", "p_reference_id" "uuid" DEFAULT NULL::"uuid", "p_reference_type" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_wallet RECORD;
  v_txn_id UUID;
  v_bal_before NUMERIC;
  v_bal_after NUMERIC;
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_AMOUNT');
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
    reference_id, reference_type,
    metadata
  ) VALUES (
    v_wallet.id, p_user_id, p_type, p_amount,
    v_bal_before, v_bal_after,
    v_wallet.reserved_balance, v_wallet.reserved_balance,
    p_reference_id, p_reference_type,
    jsonb_build_object('description', p_description)
  ) RETURNING id INTO v_txn_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_txn_id,
    'amount', p_amount,
    'balance_before', v_bal_before,
    'balance_after', v_bal_after
  );
END;
$$;


ALTER FUNCTION "public"."add_credits"("p_user_id" "uuid", "p_amount" numeric, "p_type" "text", "p_description" "text", "p_reference_id" "uuid", "p_reference_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_generation_provider_cost"("p_generation_id" "uuid", "p_cost_usd" numeric, "p_provider" "text" DEFAULT NULL::"text", "p_model" "text" DEFAULT NULL::"text", "p_usage" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.generations
  SET provider_cost_usd = COALESCE(provider_cost_usd, 0) + COALESCE(p_cost_usd, 0),
      provider          = COALESCE(p_provider, provider),
      provider_model    = COALESCE(p_model, provider_model),
      metadata          = COALESCE(metadata, '{}'::jsonb)
                          || jsonb_build_object('last_usage', p_usage),
      updated_at        = now()
  WHERE id = p_generation_id;
END;
$$;


ALTER FUNCTION "public"."add_generation_provider_cost"("p_generation_id" "uuid", "p_cost_usd" numeric, "p_provider" "text", "p_model" "text", "p_usage" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_cogs_daily"("p_days" integer DEFAULT 30) RETURNS TABLE("day" "date", "calls" bigint, "cost_usd" numeric, "credits_equivalent" numeric, "credits_captured" numeric, "retail_usd" numeric)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH days AS (
    SELECT generate_series((now() - make_interval(days => p_days - 1))::date, now()::date, '1 day')::date AS day
  ),
  usage AS (
    SELECT created_at::date AS day, count(*) AS calls, sum(cost_usd) AS cost_usd, sum(credits_equivalent) AS credits_equivalent
    FROM public.ai_usage_log
    WHERE created_at >= now() - make_interval(days => p_days)
    GROUP BY 1
  ),
  captured AS (
    SELECT created_at::date AS day, sum(-amount) AS credits_captured
    FROM public.wallet_transactions
    WHERE transaction_type IN ('reservation_capture', 'charge', 'capture', 'deduction')
      AND created_at >= now() - make_interval(days => p_days)
    GROUP BY 1
  ),
  econ AS (
    SELECT COALESCE((setting_value->>'retail_usd_per_credit')::numeric, 0.02) AS retail
    FROM public.platform_settings WHERE setting_key = 'credit_economics'
  )
  SELECT d.day,
         COALESCE(u.calls, 0),
         COALESCE(u.cost_usd, 0),
         COALESCE(u.credits_equivalent, 0),
         COALESCE(c.credits_captured, 0),
         COALESCE(c.credits_captured, 0) * (SELECT retail FROM econ)
  FROM days d
  LEFT JOIN usage u ON u.day = d.day
  LEFT JOIN captured c ON c.day = d.day
  WHERE public.is_admin()
  ORDER BY d.day;
$$;


ALTER FUNCTION "public"."admin_cogs_daily"("p_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_provider_key_status"() RETURNS TABLE("provider_id" "uuid", "has_key" boolean, "key_hint" "text", "updated_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT p.id,
         s.provider_id IS NOT NULL,
         CASE WHEN s.provider_id IS NULL THEN NULL
              ELSE '••••' || right(s.api_key, 4) END,
         s.updated_at
  FROM public.ai_providers p
  LEFT JOIN public.ai_provider_secrets s ON s.provider_id = p.id
  WHERE public.is_admin();
$$;


ALTER FUNCTION "public"."admin_provider_key_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_set_provider_api_key"("p_provider_id" "uuid", "p_api_key" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_ADMIN');
  END IF;

  IF p_api_key IS NULL OR length(trim(p_api_key)) = 0 THEN
    DELETE FROM public.ai_provider_secrets WHERE provider_id = p_provider_id;
    RETURN jsonb_build_object('success', true, 'has_key', false);
  END IF;

  INSERT INTO public.ai_provider_secrets (provider_id, api_key, updated_by)
  VALUES (p_provider_id, trim(p_api_key), auth.uid())
  ON CONFLICT (provider_id) DO UPDATE
    SET api_key = EXCLUDED.api_key, updated_by = EXCLUDED.updated_by, updated_at = now();

  RETURN jsonb_build_object('success', true, 'has_key', true);
END;
$$;


ALTER FUNCTION "public"."admin_set_provider_api_key"("p_provider_id" "uuid", "p_api_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_creator"("application_id" "uuid", "admin_notes" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  applicant_id uuid;
begin
  -- Get the applicant's user_id
  select user_id into applicant_id
  from creator_applications
  where id = application_id;

  -- Update the application status
  update creator_applications
  set 
    status = 'approved',
    reviewed_at = now(),
    reviewer_notes = admin_notes
  where id = application_id;

  -- Upgrade the user's role to creator
  update profiles
  set 
    role = 'creator',
    updated_at = now()
  where id = applicant_id;

  -- Create or update their creator_profile
  insert into creator_profiles (id, display_name, is_approved, approved_at)
  select 
    applicant_id,
    full_name,
    true,
    now()
  from profiles
  where id = applicant_id
  on conflict (id) do update
  set 
    is_approved = true,
    approved_at = now();
end;
$$;


ALTER FUNCTION "public"."approve_creator"("application_id" "uuid", "admin_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."block_api_key_on_ai_providers"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.api_key IS NOT NULL THEN
    RAISE EXCEPTION 'ai_providers.api_key is retired. Use admin_set_provider_api_key().';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."block_api_key_on_ai_providers"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_version_diff"("p_from_version_id" "uuid", "p_to_version_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_from_scene JSONB;
  v_to_scene JSONB;
  v_result JSONB;
BEGIN
  SELECT scene_json INTO v_from_scene
  FROM creative_versions
  WHERE id = p_from_version_id;
  
  SELECT scene_json INTO v_to_scene
  FROM creative_versions
  WHERE id = p_to_version_id;
  
  -- Return structural diff
  SELECT jsonb_build_object(
    'added_nodes', (
      SELECT jsonb_agg(node->>'id')
      FROM jsonb_array_elements(v_to_scene->'nodes') AS node
      WHERE (node->>'id') NOT IN (
        SELECT (n->>'id') FROM jsonb_array_elements(v_from_scene->'nodes') AS n
      )
    ),
    'removed_nodes', (
      SELECT jsonb_agg(node->>'id')
      FROM jsonb_array_elements(v_from_scene->'nodes') AS node
      WHERE (node->>'id') NOT IN (
        SELECT (n->>'id') FROM jsonb_array_elements(v_to_scene->'nodes') AS n
      )
    ),
    'from_hash', MD5(v_from_scene::text),
    'to_hash', MD5(v_to_scene::text)
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."calculate_version_diff"("p_from_version_id" "uuid", "p_to_version_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."capture_reserved_credits"("p_generation_id" "uuid", "p_capture_amount" numeric DEFAULT NULL::numeric, "p_ai_provider" "text" DEFAULT NULL::"text", "p_ai_model" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_gen RECORD;
  v_wallet RECORD;
  v_capture NUMERIC;
  v_txn_id UUID;
  v_bal_before NUMERIC;
  v_bal_after NUMERIC;
  v_res_before NUMERIC;
  v_res_after NUMERIC;
BEGIN
  SELECT * INTO v_gen FROM public.generations WHERE id = p_generation_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'GENERATION_NOT_FOUND');
  END IF;

  IF v_gen.status NOT IN ('reserved', 'queued', 'processing') THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_STATE', 'current_status', v_gen.status);
  END IF;

  IF v_gen.credits_captured >= v_gen.credits_reserved THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_CAPTURED');
  END IF;

  v_capture := COALESCE(p_capture_amount, v_gen.credits_reserved - v_gen.credits_captured);
  IF v_capture > (v_gen.credits_reserved - v_gen.credits_captured) THEN
    v_capture := v_gen.credits_reserved - v_gen.credits_captured;
  END IF;
  IF v_capture <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOTHING_TO_CAPTURE');
  END IF;

  -- Lock wallet
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_gen.user_id FOR UPDATE;

  v_bal_before := v_wallet.balance;
  v_bal_after := v_wallet.balance - v_capture;
  v_res_before := v_wallet.reserved_balance;
  v_res_after := v_wallet.reserved_balance - v_capture;

  -- Deduct from balance AND release from reserved
  UPDATE public.wallets
  SET balance = v_bal_after,
      reserved_balance = v_res_after,
      lifetime_spent = lifetime_spent + v_capture,
      updated_at = now()
  WHERE id = v_wallet.id;

  -- Update generation
  UPDATE public.generations
  SET credits_captured = credits_captured + v_capture,
      status = 'ai_called',
      ai_started_at = COALESCE(ai_started_at, now()),
      provider = COALESCE(p_ai_provider, provider),
      provider_model = COALESCE(p_ai_model, provider_model),
      updated_at = now()
  WHERE id = p_generation_id;

  -- Immutable transaction
  INSERT INTO public.wallet_transactions (
    wallet_id, user_id, transaction_type, amount,
    balance_before, balance_after,
    reserved_before, reserved_after,
    reference_id, reference_type, metadata
  ) VALUES (
    v_wallet.id, v_gen.user_id, 'capture', -v_capture,
    v_bal_before, v_bal_after,
    v_res_before, v_res_after,
    p_generation_id, 'generation',
    jsonb_build_object('capture_amount', v_capture, 'ai_provider', p_ai_provider, 'ai_model', p_ai_model)
  ) RETURNING id INTO v_txn_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_txn_id,
    'credits_captured', v_capture,
    'total_captured', v_gen.credits_captured + v_capture,
    'balance_before', v_bal_before,
    'balance_after', v_bal_after
  );
END;
$$;


ALTER FUNCTION "public"."capture_reserved_credits"("p_generation_id" "uuid", "p_capture_amount" numeric, "p_ai_provider" "text", "p_ai_model" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_free_trial_credits"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."claim_free_trial_credits"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_due_automations"("p_limit" integer DEFAULT 20) RETURNS SETOF "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  a RECORD;
  v_run_id uuid;
BEGIN
  FOR a IN
    SELECT * FROM public.automations
    WHERE status = 'active' AND trigger_type = 'schedule'
      AND next_run_at IS NOT NULL AND next_run_at <= now()
    ORDER BY next_run_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    INSERT INTO public.automation_runs (automation_id, brand_id, user_id, agent_id, name, trigger_type, input, policy, budget)
    VALUES (a.id, a.brand_id, a.user_id, a.agent_id, a.name, 'schedule', a.task_input, a.policy, a.budget)
    RETURNING id INTO v_run_id;

    UPDATE public.automations
    SET last_run_at = now(),
        next_run_at = CASE a.schedule_interval
          WHEN 'daily' THEN now() + interval '1 day'
          WHEN 'weekly' THEN now() + interval '7 days'
          WHEN 'biweekly' THEN now() + interval '14 days'
          WHEN 'monthly' THEN now() + interval '1 month'
          ELSE NULL END
    WHERE id = a.id;

    RETURN NEXT v_run_id;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."enqueue_due_automations"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."expire_stale_reservations"("p_max_age_minutes" integer DEFAULT 30) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_expired RECORD;
  v_count INT := 0;
BEGIN
  FOR v_expired IN
    SELECT id
    FROM public.generations
    WHERE status = 'reserved'
      AND created_at < now() - (p_max_age_minutes || ' minutes')::INTERVAL
    FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM public.release_reserved_credits(v_expired.id, 'Reservation expired');
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."expire_stale_reservations"("p_max_age_minutes" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finalize_generation_billing"("p_generation_id" "uuid", "p_status" "text" DEFAULT 'completed'::"text", "p_provider_cost_usd" numeric DEFAULT NULL::numeric, "p_metadata" "jsonb" DEFAULT NULL::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_gen RECORD;
  v_wallet RECORD;
  v_unreleased NUMERIC;
  v_final_status TEXT;
BEGIN
  SELECT * INTO v_gen FROM public.generations WHERE id = p_generation_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'GENERATION_NOT_FOUND');
  END IF;

  v_unreleased := v_gen.credits_reserved - v_gen.credits_captured;

  -- Release any leftover reservation
  IF v_unreleased > 0 THEN
    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_gen.user_id FOR UPDATE;

    UPDATE public.wallets
    SET reserved_balance = GREATEST(reserved_balance - v_unreleased, 0), updated_at = now()
    WHERE id = v_wallet.id;

    INSERT INTO public.wallet_transactions (
      wallet_id, user_id, transaction_type, amount,
      balance_before, balance_after,
      reserved_before, reserved_after,
      reference_id, reference_type, metadata
    ) VALUES (
      v_wallet.id, v_gen.user_id, 'release', 0,
      v_wallet.balance, v_wallet.balance,
      v_wallet.reserved_balance, GREATEST(v_wallet.reserved_balance - v_unreleased, 0),
      p_generation_id, 'generation',
      jsonb_build_object('released_amount', v_unreleased, 'reason', 'finalization')
    );
  END IF;

  -- Determine final status
  IF p_status IS NOT NULL AND p_status != '' THEN
    v_final_status := p_status;
  ELSIF v_gen.credits_captured > 0 THEN
    v_final_status := 'completed';
  ELSE
    v_final_status := 'failed_pre_cost';
  END IF;

  UPDATE public.generations
  SET status = v_final_status,
      provider_cost_usd = COALESCE(p_provider_cost_usd, provider_cost_usd),
      ai_completed_at = CASE WHEN v_gen.ai_started_at IS NOT NULL THEN COALESCE(ai_completed_at, now()) ELSE NULL END,
      completed_at = now(),
      metadata = CASE WHEN p_metadata IS NOT NULL THEN COALESCE(metadata, '{}') || p_metadata ELSE metadata END,
      updated_at = now()
  WHERE id = p_generation_id;

  RETURN jsonb_build_object(
    'success', true,
    'generation_id', p_generation_id,
    'final_status', v_final_status,
    'credits_captured', v_gen.credits_captured,
    'credits_released', v_unreleased,
    'net_cost', v_gen.credits_captured
  );
END;
$$;


ALTER FUNCTION "public"."finalize_generation_billing"("p_generation_id" "uuid", "p_status" "text", "p_provider_cost_usd" numeric, "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finalize_generation_billing"("p_generation_id" "uuid", "p_status" "text" DEFAULT 'completed'::"text", "p_provider_cost_usd" numeric DEFAULT NULL::numeric, "p_credits_finalized" integer DEFAULT NULL::integer, "p_ai_metadata" "jsonb" DEFAULT NULL::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_event RECORD;
  v_result JSONB;
BEGIN
  -- Get and lock the billing event
  SELECT * INTO v_event
  FROM public.billing_events
  WHERE id = p_generation_id
  FOR UPDATE;
  
  IF v_event IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Billing event not found',
      'generation_id', p_generation_id
    );
  END IF;
  
  -- Calculate final amounts
  DECLARE
    v_credits_released INTEGER := v_event.credits_reserved - COALESCE(v_event.credits_captured, 0);
    v_final_status TEXT := COALESCE(p_status, 'completed');
  BEGIN
    -- Release any remaining reserved credits
    IF v_credits_released > 0 THEN
      UPDATE public.user_credit_wallets
      SET 
        reserved_balance = reserved_balance - v_credits_released,
        updated_at = NOW()
      WHERE user_id = v_event.user_id;
    END IF;
    
    -- Update billing event
    UPDATE public.billing_events
    SET
      status = v_final_status,
      credits_released = v_credits_released,
      credits_finalized = COALESCE(p_credits_finalized, v_event.credits_captured),
      provider_cost_usd = COALESCE(p_provider_cost_usd, v_event.provider_cost_usd),
      ai_metadata = COALESCE(p_ai_metadata, v_event.ai_metadata),
      completed_at = COALESCE(v_event.completed_at, NOW()),
      updated_at = NOW()
    WHERE id = p_generation_id;
    
    v_result := jsonb_build_object(
      'success', true,
      'generation_id', p_generation_id,
      'status', v_final_status,
      'credits_released', v_credits_released,
      'credits_finalized', COALESCE(p_credits_finalized, v_event.credits_captured)
    );
  END;
  
  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."finalize_generation_billing"("p_generation_id" "uuid", "p_status" "text", "p_provider_cost_usd" numeric, "p_credits_finalized" integer, "p_ai_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fulfill_credit_purchase"("p_purchase_id" "uuid", "p_user_id" "uuid", "p_credits_amount" numeric, "p_stripe_payment_intent_id" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_wallet RECORD;
  v_bal_before NUMERIC;
  v_bal_after NUMERIC;
  v_txn_id UUID;
  v_existing RECORD;
BEGIN
  -- Idempotency: check if already fulfilled
  SELECT id, status INTO v_existing FROM public.credit_purchases WHERE id = p_purchase_id;
  IF v_existing.status = 'completed' THEN
    RETURN jsonb_build_object('success', true, 'already_fulfilled', true, 'purchase_id', p_purchase_id);
  END IF;

  -- Ensure wallet exists
  INSERT INTO public.wallets (user_id, balance, reserved_balance, lifetime_earned, lifetime_spent, lifetime_refunded)
  VALUES (p_user_id, 0, 0, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;

  v_bal_before := v_wallet.balance;
  v_bal_after := v_wallet.balance + p_credits_amount;

  UPDATE public.wallets
  SET balance = v_bal_after, lifetime_earned = lifetime_earned + p_credits_amount, updated_at = now()
  WHERE id = v_wallet.id;

  INSERT INTO public.wallet_transactions (
    wallet_id, user_id, transaction_type, amount,
    balance_before, balance_after,
    reserved_before, reserved_after,
    reference_id, reference_type,
    metadata
  ) VALUES (
    v_wallet.id, p_user_id, 'topup', p_credits_amount,
    v_bal_before, v_bal_after,
    v_wallet.reserved_balance, v_wallet.reserved_balance,
    p_purchase_id, 'purchase',
    jsonb_build_object('stripe_payment_intent_id', p_stripe_payment_intent_id)
  ) RETURNING id INTO v_txn_id;

  UPDATE public.credit_purchases
  SET status = 'completed',
      stripe_payment_intent_id = COALESCE(p_stripe_payment_intent_id, stripe_payment_intent_id),
      metadata = COALESCE(metadata, '{}') || jsonb_build_object('fulfilled_at', now(), 'transaction_id', v_txn_id)
  WHERE id = p_purchase_id;

  RETURN jsonb_build_object(
    'success', true,
    'already_fulfilled', false,
    'purchase_id', p_purchase_id,
    'transaction_id', v_txn_id,
    'credits_granted', p_credits_amount,
    'balance_before', v_bal_before,
    'balance_after', v_bal_after
  );
END;
$$;


ALTER FUNCTION "public"."fulfill_credit_purchase"("p_purchase_id" "uuid", "p_user_id" "uuid", "p_credits_amount" numeric, "p_stripe_payment_intent_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_current_version"("p_creative_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  v_version_id UUID;
BEGIN
  SELECT id INTO v_version_id
  FROM creative_versions
  WHERE creative_id = p_creative_id
  AND is_current = TRUE
  ORDER BY created_at DESC
  LIMIT 1;
  
  RETURN v_version_id;
END;
$$;


ALTER FUNCTION "public"."get_current_version"("p_creative_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_next_version_number"("p_creative_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_max_number INTEGER;
BEGIN
  SELECT COALESCE(MAX(version_number), 0) + 1
  INTO v_max_number
  FROM creative_versions
  WHERE creative_id = p_creative_id;
  
  RETURN v_max_number;
END;
$$;


ALTER FUNCTION "public"."get_next_version_number"("p_creative_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_version_lineage"("p_version_id" "uuid") RETURNS TABLE("version_id" "uuid", "version_number" integer, "version_name" character varying, "created_at" timestamp with time zone, "depth" integer)
    LANGUAGE "sql" STABLE
    AS $$
WITH RECURSIVE lineage AS (
  -- Base case: start from given version
  SELECT 
    cv.id,
    cv.version_number,
    cv.version_name,
    cv.created_at,
    cv.parent_version_id,
    0 as depth
  FROM creative_versions cv
  WHERE cv.id = p_version_id
  
  UNION ALL
  
  -- Recursive case: get parent
  SELECT 
    cv.id,
    cv.version_number,
    cv.version_name,
    cv.created_at,
    cv.parent_version_id,
    l.depth + 1
  FROM creative_versions cv
  INNER JOIN lineage l ON cv.id = l.parent_version_id
)
SELECT 
  l.id as version_id,
  l.version_number,
  l.version_name,
  l.created_at,
  l.depth
FROM lineage l
ORDER BY l.depth;
$$;


ALTER FUNCTION "public"."get_version_lineage"("p_version_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_wallet_balance"("p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_wallet RECORD;
BEGIN
  SELECT * INTO v_wallet
  FROM public.wallets
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.wallets (user_id, balance, reserved_balance, lifetime_earned, lifetime_spent, lifetime_refunded)
    VALUES (p_user_id, 0, 0, 0, 0, 0)
    RETURNING * INTO v_wallet;
  END IF;

  RETURN jsonb_build_object(
    'balance', v_wallet.balance,
    'reserved_balance', v_wallet.reserved_balance,
    'available_balance', v_wallet.balance - v_wallet.reserved_balance,
    'lifetime_earned', v_wallet.lifetime_earned,
    'lifetime_spent', v_wallet.lifetime_spent,
    'lifetime_refunded', v_wallet.lifetime_refunded,
    'wallet_id', v_wallet.id
  );
END;
$$;


ALTER FUNCTION "public"."get_wallet_balance"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."grant_credits_admin"("p_user_id" "uuid", "p_amount" numeric, "p_type" "text" DEFAULT 'bonus'::"text", "p_description" "text" DEFAULT 'Admin credit grant'::"text", "p_admin_user_id" "uuid" DEFAULT NULL::"uuid", "p_idempotency_key" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."grant_credits_admin"("p_user_id" "uuid", "p_amount" numeric, "p_type" "text", "p_description" "text", "p_admin_user_id" "uuid", "p_idempotency_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."grant_credits_internal"("p_user_id" "uuid", "p_amount" numeric, "p_type" "text" DEFAULT 'bonus'::"text", "p_description" "text" DEFAULT 'Admin credit grant'::"text", "p_admin_user_id" "uuid" DEFAULT NULL::"uuid", "p_idempotency_key" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."grant_credits_internal"("p_user_id" "uuid", "p_amount" numeric, "p_type" "text", "p_description" "text", "p_admin_user_id" "uuid", "p_idempotency_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name', 
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment"("x" integer) RETURNS integer
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select x + 1;
$$;


ALTER FUNCTION "public"."increment"("x" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_previous_versions_not_current"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE creative_versions
  SET is_current = FALSE
  WHERE creative_id = NEW.creative_id
  AND id != NEW.id;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."mark_previous_versions_not_current"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prune_old_versions"("p_creative_id" "uuid", "p_keep_count" integer DEFAULT 50) RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_deleted_count INTEGER := 0;
BEGIN
  WITH versions_to_keep AS (
    SELECT id
    FROM creative_versions
    WHERE creative_id = p_creative_id
    AND (version_type IN ('manual', 'named') OR is_restored_version = TRUE)
    
    UNION
    
    SELECT id
    FROM (
      SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) as rn
      FROM creative_versions
      WHERE creative_id = p_creative_id
    ) ranked
    WHERE rn <= p_keep_count
  )
  DELETE FROM creative_versions
  WHERE creative_id = p_creative_id
  AND id NOT IN (SELECT id FROM versions_to_keep)
  AND is_current = FALSE;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN v_deleted_count;
END;
$$;


ALTER FUNCTION "public"."prune_old_versions"("p_creative_id" "uuid", "p_keep_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reject_creator"("application_id" "uuid", "admin_notes" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  update creator_applications
  set 
    status = 'rejected',
    reviewed_at = now(),
    reviewer_notes = admin_notes
  where id = application_id;
end;
$$;


ALTER FUNCTION "public"."reject_creator"("application_id" "uuid", "admin_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."release_reserved_credits"("p_generation_id" "uuid", "p_reason" "text" DEFAULT 'Pre-cost failure — reservation released'::"text", "p_release_amount" numeric DEFAULT NULL::numeric) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_gen RECORD;
  v_wallet RECORD;
  v_release NUMERIC;
  v_txn_id UUID;
  v_new_status TEXT;
  v_res_before NUMERIC;
  v_res_after NUMERIC;
BEGIN
  SELECT * INTO v_gen FROM public.generations WHERE id = p_generation_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'GENERATION_NOT_FOUND');
  END IF;

  v_release := COALESCE(p_release_amount, v_gen.credits_reserved - v_gen.credits_captured);
  IF v_release > (v_gen.credits_reserved - v_gen.credits_captured) THEN
    v_release := v_gen.credits_reserved - v_gen.credits_captured;
  END IF;
  IF v_release <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOTHING_TO_RELEASE');
  END IF;

  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_gen.user_id FOR UPDATE;

  v_res_before := v_wallet.reserved_balance;
  v_res_after := GREATEST(v_wallet.reserved_balance - v_release, 0);

  UPDATE public.wallets
  SET reserved_balance = v_res_after, updated_at = now()
  WHERE id = v_wallet.id;

  IF v_gen.credits_captured > 0 THEN
    v_new_status := 'partially_completed';
  ELSE
    v_new_status := 'failed_pre_cost';
  END IF;

  UPDATE public.generations
  SET status = v_new_status, metadata = COALESCE(metadata, '{}') || jsonb_build_object('release_reason', p_reason), updated_at = now()
  WHERE id = p_generation_id;

  INSERT INTO public.wallet_transactions (
    wallet_id, user_id, transaction_type, amount,
    balance_before, balance_after,
    reserved_before, reserved_after,
    reference_id, reference_type, metadata
  ) VALUES (
    v_wallet.id, v_gen.user_id, 'release', 0,
    v_wallet.balance, v_wallet.balance,
    v_res_before, v_res_after,
    p_generation_id, 'generation',
    jsonb_build_object('released_amount', v_release, 'reason', p_reason, 'new_status', v_new_status)
  ) RETURNING id INTO v_txn_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_txn_id,
    'credits_released', v_release,
    'new_status', v_new_status,
    'balance', v_wallet.balance,
    'available_after', v_wallet.balance - v_res_after
  );
END;
$$;


ALTER FUNCTION "public"."release_reserved_credits"("p_generation_id" "uuid", "p_reason" "text", "p_release_amount" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reserve_generation_credits"("p_user_id" "uuid", "p_credits" numeric, "p_generation_id" "uuid" DEFAULT NULL::"uuid", "p_platform" "text" DEFAULT NULL::"text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_wallet RECORD;
  v_gen_id UUID;
  v_txn_id UUID;
  v_available NUMERIC;
BEGIN
  -- Ensure wallet exists
  INSERT INTO public.wallets (user_id, balance, reserved_balance, lifetime_earned, lifetime_spent, lifetime_refunded)
  VALUES (p_user_id, 0, 0, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Lock wallet row
  SELECT * INTO v_wallet
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'WALLET_NOT_FOUND');
  END IF;

  v_available := v_wallet.balance - v_wallet.reserved_balance;

  IF v_available < p_credits THEN
    RETURN jsonb_build_object(
      'success', false, 'error', 'INSUFFICIENT_BALANCE',
      'balance', v_wallet.balance,
      'reserved', v_wallet.reserved_balance,
      'available', v_available,
      'required', p_credits
    );
  END IF;

  -- Move credits to reserved
  UPDATE public.wallets
  SET reserved_balance = reserved_balance + p_credits, updated_at = now()
  WHERE id = v_wallet.id;

  -- Create or update generation record
  IF p_generation_id IS NOT NULL THEN
    v_gen_id := p_generation_id;
    UPDATE public.generations
    SET credits_reserved = p_credits, status = 'reserved', updated_at = now()
    WHERE id = v_gen_id;
  ELSE
    INSERT INTO public.generations (user_id, credits_reserved, credits_captured, status, platform, metadata)
    VALUES (p_user_id, p_credits, 0, 'reserved', p_platform, p_metadata)
    RETURNING id INTO v_gen_id;
  END IF;

  -- Immutable transaction
  INSERT INTO public.wallet_transactions (
    wallet_id, user_id, transaction_type, amount,
    balance_before, balance_after,
    reserved_before, reserved_after,
    reference_id, reference_type, metadata
  ) VALUES (
    v_wallet.id, p_user_id, 'reservation', 0,
    v_wallet.balance, v_wallet.balance,
    v_wallet.reserved_balance, v_wallet.reserved_balance + p_credits,
    v_gen_id, 'generation',
    jsonb_build_object('credits_reserved', p_credits)
  ) RETURNING id INTO v_txn_id;

  RETURN jsonb_build_object(
    'success', true,
    'generation_id', v_gen_id,
    'transaction_id', v_txn_id,
    'credits_reserved', p_credits,
    'balance', v_wallet.balance,
    'available_after', v_available - p_credits
  );
END;
$$;


ALTER FUNCTION "public"."reserve_generation_credits"("p_user_id" "uuid", "p_credits" numeric, "p_generation_id" "uuid", "p_platform" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_template_variants_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_template_variants_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_creator_flag"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.is_creator = (new.role in ('creator', 'admin'));
  return new;
end;
$$;


ALTER FUNCTION "public"."sync_creator_flag"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_generation_status"("p_generation_id" "uuid", "p_new_status" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.generations
  SET status = p_new_status, updated_at = now()
  WHERE id = p_generation_id;
  RETURN jsonb_build_object('success', true, 'status', p_new_status);
END;
$$;


ALTER FUNCTION "public"."update_generation_status"("p_generation_id" "uuid", "p_new_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."agent_hires" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "monthly_budget_credits" integer,
    "nickname" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "agent_hires_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'paused'::"text"])))
);


ALTER TABLE "public"."agent_hires" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "role" "text" NOT NULL,
    "tagline" "text",
    "description" "text",
    "system_prompt" "text" NOT NULL,
    "model_tier" "text" DEFAULT 'standard'::"text" NOT NULL,
    "allowed_tools" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "action_type" "text" NOT NULL,
    "unit_label" "text" DEFAULT 'item'::"text" NOT NULL,
    "per_run_credit_ceiling" integer DEFAULT 200 NOT NULL,
    "cost_indicator" smallint DEFAULT 2 NOT NULL,
    "output_spec" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "suited_stages" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "agents_cost_indicator_check" CHECK ((("cost_indicator" >= 1) AND ("cost_indicator" <= 3))),
    CONSTRAINT "agents_tier_check" CHECK (("model_tier" = ANY (ARRAY['fast'::"text", 'standard'::"text", 'reasoning'::"text"])))
);


ALTER TABLE "public"."agents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_generation_pricing" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pricing_key" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "base_cost" numeric(8,2) DEFAULT 1 NOT NULL,
    "model_multipliers" "jsonb" DEFAULT '{}'::"jsonb",
    "feature_multipliers" "jsonb" DEFAULT '{}'::"jsonb",
    "per_platform_cost" numeric(8,2) DEFAULT 1 NOT NULL,
    "complexity_multipliers" "jsonb" DEFAULT '{"simple": 0.75, "advanced": 1.5, "balanced": 1, "experimental": 2}'::"jsonb",
    "is_active" boolean DEFAULT true NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "pricing_mode" "text" DEFAULT 'fixed'::"text" NOT NULL,
    "model_tier" "text",
    "range_factor" numeric(6,2) DEFAULT 1 NOT NULL,
    "cogs_estimate_usd" numeric(10,4),
    "unit_label" "text",
    CONSTRAINT "ai_generation_pricing_mode_check" CHECK (("pricing_mode" = ANY (ARRAY['fixed'::"text", 'metered'::"text"]))),
    CONSTRAINT "ai_generation_pricing_tier_check" CHECK ((("model_tier" IS NULL) OR ("model_tier" = ANY (ARRAY['fast'::"text", 'standard'::"text", 'reasoning'::"text"]))))
);


ALTER TABLE "public"."ai_generation_pricing" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_models" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "model_id" "text" NOT NULL,
    "description" "text",
    "context_window" integer,
    "is_enabled" boolean DEFAULT true,
    "is_default" boolean DEFAULT false,
    "supports_vision" boolean DEFAULT false,
    "supports_images_out" boolean DEFAULT false,
    "best_for" "text"[] DEFAULT '{}'::"text"[],
    "cost_per_1k_input" numeric(10,6),
    "cost_per_1k_output" numeric(10,6),
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ai_models" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_prompt_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "prompt_id" "uuid" NOT NULL,
    "version" integer NOT NULL,
    "system_prompt" "text" NOT NULL,
    "edited_by" "uuid",
    "edit_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ai_prompt_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_provider_secrets" (
    "provider_id" "uuid" NOT NULL,
    "api_key" "text" NOT NULL,
    "updated_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ai_provider_secrets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_providers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "base_url" "text" NOT NULL,
    "auth_header_name" "text" DEFAULT 'Authorization'::"text" NOT NULL,
    "auth_header_prefix" "text" DEFAULT 'Bearer'::"text" NOT NULL,
    "api_key" "text",
    "is_enabled" boolean DEFAULT true,
    "supports_text" boolean DEFAULT true,
    "supports_images" boolean DEFAULT false,
    "supports_streaming" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ai_providers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_system_prompts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_type" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "system_prompt" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "version" integer DEFAULT 1,
    "last_edited_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "ai_system_prompts_task_type_check" CHECK (("task_type" = ANY (ARRAY['mentor_chat'::"text", 'template_generation'::"text", 'image_generation'::"text", 'document_generation'::"text", 'reel_script'::"text", 'campaign_copy'::"text", 'context_extraction'::"text", 'variant_scene_generation'::"text", 'logo_generation'::"text", 'logo_mutation'::"text"])))
);


ALTER TABLE "public"."ai_system_prompts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_task_defaults" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_type" "text" NOT NULL,
    "model_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ai_task_defaults" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_usage_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "generation_id" "uuid",
    "task_type" "text" NOT NULL,
    "model_tier" "text",
    "provider_slug" "text" NOT NULL,
    "model_id" "text" NOT NULL,
    "input_tokens" integer DEFAULT 0 NOT NULL,
    "output_tokens" integer DEFAULT 0 NOT NULL,
    "cache_read_tokens" integer DEFAULT 0 NOT NULL,
    "cache_write_tokens" integer DEFAULT 0 NOT NULL,
    "cost_usd" numeric(12,6) DEFAULT 0 NOT NULL,
    "credits_equivalent" numeric(12,4) DEFAULT 0 NOT NULL,
    "latency_ms" integer,
    "success" boolean DEFAULT true NOT NULL,
    "error_message" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ai_usage_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_errors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "error_type" "text" NOT NULL,
    "module" "text",
    "error_code" "text",
    "error_message" "text" NOT NULL,
    "error_stack" "text",
    "context" "jsonb" DEFAULT '{}'::"jsonb",
    "task_type" "text",
    "model_id" "text",
    "provider_slug" "text",
    "is_resolved" boolean DEFAULT false,
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid",
    "resolution_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "call_location" "text",
    "user_action" "text",
    "pipeline_step" "text",
    "breadcrumbs" "jsonb" DEFAULT '[]'::"jsonb",
    "url_path" "text",
    "component_name" "text",
    CONSTRAINT "app_errors_error_type_check" CHECK (("error_type" = ANY (ARRAY['ai_call'::"text", 'database'::"text", 'storage'::"text", 'auth'::"text", 'api'::"text", 'unknown'::"text"]))),
    CONSTRAINT "app_errors_module_check" CHECK (("module" = ANY (ARRAY['mentor'::"text", 'prostudio'::"text", 'campaignkit'::"text", 'contentcalendar'::"text", 'docstudio'::"text", 'reelbuilder'::"text", 'library'::"text", 'brand_dna'::"text", 'auth'::"text", 'admin'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."app_errors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."approvals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "run_id" "uuid" NOT NULL,
    "step_id" "uuid",
    "brand_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "kind" "text" DEFAULT 'review_output'::"text" NOT NULL,
    "title" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "note" "text",
    "decided_at" timestamp with time zone,
    "decided_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "approvals_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."approvals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."assets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "source_module" "text",
    "file_url" "text",
    "file_path" "text",
    "mime_type" "text",
    "file_size_bytes" integer,
    "width" integer,
    "height" integer,
    "platform" "text",
    "template_id" "uuid",
    "times_used" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_trashed" boolean DEFAULT false NOT NULL,
    "trashed_at" timestamp with time zone,
    "version" integer DEFAULT 1 NOT NULL,
    "parent_asset_id" "uuid",
    "version_label" "text",
    CONSTRAINT "assets_source_module_check" CHECK (("source_module" = ANY (ARRAY['prostudio'::"text", 'contentstudio'::"text", 'docstudio'::"text", 'reelbuilder'::"text", 'upload'::"text", 'campaignkit'::"text"]))),
    CONSTRAINT "assets_type_check" CHECK (("type" = ANY (ARRAY['product_image'::"text", 'generated_visual'::"text", 'document'::"text", 'script'::"text", 'template_output'::"text"])))
);


ALTER TABLE "public"."assets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."automation_run_steps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "run_id" "uuid" NOT NULL,
    "step_index" integer NOT NULL,
    "type" "text" NOT NULL,
    "name" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "input" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "output" "jsonb",
    "credits_captured" numeric(12,2) DEFAULT 0 NOT NULL,
    "cost_usd" numeric(12,6) DEFAULT 0 NOT NULL,
    "usage_log_id" "uuid",
    "error" "text",
    "started_at" timestamp with time zone,
    "finished_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "automation_run_steps_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'running'::"text", 'waiting'::"text", 'done'::"text", 'failed'::"text", 'skipped'::"text"]))),
    CONSTRAINT "automation_run_steps_type_check" CHECK (("type" = ANY (ARRAY['agent_task'::"text", 'approval'::"text", 'native'::"text", 'connector'::"text"])))
);


ALTER TABLE "public"."automation_run_steps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."automation_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "automation_id" "uuid",
    "brand_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "agent_id" "uuid",
    "name" "text" NOT NULL,
    "trigger_type" "text" DEFAULT 'manual'::"text" NOT NULL,
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "input" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "output" "jsonb",
    "policy" "jsonb" DEFAULT '{"approval": "review_first"}'::"jsonb" NOT NULL,
    "budget" "jsonb" DEFAULT '{"max_steps": 8, "credits_per_run": 200}'::"jsonb" NOT NULL,
    "credits_quoted" integer DEFAULT 0 NOT NULL,
    "credits_reserved" integer DEFAULT 0 NOT NULL,
    "credits_captured" numeric(12,2) DEFAULT 0 NOT NULL,
    "generation_id" "uuid",
    "current_step" integer DEFAULT 0 NOT NULL,
    "paused_reason" "text",
    "error" "text",
    "started_at" timestamp with time zone,
    "finished_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "automation_runs_status_check" CHECK (("status" = ANY (ARRAY['queued'::"text", 'running'::"text", 'waiting_approval'::"text", 'paused'::"text", 'completed'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."automation_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."automations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "agent_id" "uuid",
    "name" "text" NOT NULL,
    "trigger_type" "text" DEFAULT 'manual'::"text" NOT NULL,
    "schedule_interval" "text",
    "next_run_at" timestamp with time zone,
    "task_input" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "policy" "jsonb" DEFAULT '{"approval": "review_first"}'::"jsonb" NOT NULL,
    "budget" "jsonb" DEFAULT '{"max_steps": 8, "credits_per_run": 200}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "last_run_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "automations_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'paused'::"text", 'archived'::"text"]))),
    CONSTRAINT "automations_trigger_check" CHECK (("trigger_type" = ANY (ARRAY['manual'::"text", 'schedule'::"text"])))
);


ALTER TABLE "public"."automations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."brand_dna" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "brand_voice" "text",
    "tone_descriptors" "text"[],
    "brand_references" "text",
    "positioning_statement" "text",
    "core_promise" "text",
    "target_audience" "text",
    "customer_profile" "text",
    "pain_points" "text",
    "why_choose_us" "text",
    "brand_feel" "text"[],
    "campaign_strategy" "text",
    "customer_insight" "text",
    "product_positioning" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."brand_dna" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."brand_dna_custom_fields" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "field_key" "text" NOT NULL,
    "field_label" "text" NOT NULL,
    "field_value" "text",
    "created_from_message_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."brand_dna_custom_fields" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."brand_journey_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "from_stage" "text",
    "to_stage" "text" NOT NULL,
    "trigger_type" "text",
    "context" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "brand_journey_events_trigger_type_check" CHECK (("trigger_type" = ANY (ARRAY['mentor_suggestion'::"text", 'user_selected'::"text", 'auto_detected'::"text", 'admin_set'::"text"])))
);


ALTER TABLE "public"."brand_journey_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."brand_stage_data" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "stage_key" "text" NOT NULL,
    "field_key" "text" NOT NULL,
    "value" "text",
    "captured_from_message_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_ai_discovered" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'captured'::"text"
);


ALTER TABLE "public"."brand_stage_data" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."brand_stage_progress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "stage_key" "text" NOT NULL,
    "substage_index" integer NOT NULL,
    "is_completed" boolean DEFAULT false,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."brand_stage_progress" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."brands" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text",
    "industry" "text",
    "tagline" "text",
    "location" "text",
    "founded_year" "text",
    "primary_color" "text" DEFAULT '#2D4A3E'::"text",
    "secondary_color" "text" DEFAULT '#F5F0E8'::"text",
    "logo_url" "text",
    "is_active" boolean DEFAULT false,
    "completeness_score" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "journey_stage" "text" DEFAULT 'spark'::"text",
    "journey_stage_updated_at" timestamp with time zone,
    "product_type" "text" DEFAULT 'unknown'::"text",
    "onboarding_completed" boolean DEFAULT false,
    "onboarding_skipped" boolean DEFAULT false,
    "context_source" "text",
    CONSTRAINT "brands_context_source_check" CHECK (("context_source" = ANY (ARRAY['fresh_start'::"text", 'text_paste'::"text", 'document_upload'::"text", 'website_url'::"text", 'mixed'::"text"]))),
    CONSTRAINT "brands_journey_stage_check" CHECK (("journey_stage" = ANY (ARRAY['spark'::"text", 'shape'::"text", 'validate'::"text", 'brand'::"text", 'launch'::"text", 'grow'::"text"]))),
    CONSTRAINT "brands_product_type_check" CHECK (("product_type" = ANY (ARRAY['digital'::"text", 'physical'::"text", 'service'::"text", 'unknown'::"text"])))
);


ALTER TABLE "public"."brands" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."calendar_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "platform" "text" NOT NULL,
    "scheduled_date" "date" NOT NULL,
    "scheduled_time" time without time zone NOT NULL,
    "copy_text" "text",
    "asset_id" "uuid",
    "campaign_creative_id" "uuid",
    "reminder_enabled" boolean DEFAULT false,
    "reminder_email" "text",
    "reminder_timing_minutes" integer DEFAULT 120,
    "reminder_sent" boolean DEFAULT false,
    "status" "text" DEFAULT 'scheduled'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "visual_html" "text",
    "content" "text",
    "content_studio_creative_id" "uuid",
    "headline" "text",
    CONSTRAINT "calendar_posts_platform_check" CHECK (("platform" = ANY (ARRAY['instagram'::"text", 'instagram_post'::"text", 'instagram_story'::"text", 'facebook'::"text", 'facebook_post'::"text", 'twitter_x'::"text", 'whatsapp'::"text", 'linkedin'::"text", 'linkedin_post'::"text", 'tiktok'::"text", 'tiktok_caption'::"text", 'email'::"text", 'youtube'::"text", 'pinterest'::"text", 'threads'::"text"]))),
    CONSTRAINT "calendar_posts_status_check" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'reminded'::"text", 'posted'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."calendar_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaign_creatives" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "platform" "text" NOT NULL,
    "copy_text" "text",
    "subject_line" "text",
    "headline" "text",
    "asset_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "scheduled_at" timestamp with time zone,
    "visual_html" "text",
    CONSTRAINT "campaign_creatives_platform_check" CHECK (("platform" = ANY (ARRAY['headlines'::"text", 'instagram'::"text", 'facebook_ad'::"text", 'google_ad'::"text", 'email'::"text", 'whatsapp'::"text", 'twitter_x'::"text", 'sms'::"text"])))
);


ALTER TABLE "public"."campaign_creatives" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaigns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "product_name" "text",
    "target_audience" "text",
    "campaign_goal" "text",
    "tone" "text",
    "key_benefit" "text",
    "call_to_action" "text",
    "asset_id" "uuid",
    "status" "text" DEFAULT 'draft'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "asset_type" "text",
    "output_id" "uuid",
    "product_image_id" "uuid",
    CONSTRAINT "campaigns_asset_type_check" CHECK (("asset_type" = ANY (ARRAY['output'::"text", 'product_image'::"text"]))),
    CONSTRAINT "campaigns_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'scheduled'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."campaigns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_platforms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "icon" "text",
    "character_limit" integer,
    "image_width" integer,
    "image_height" integer,
    "aspect_ratio" "text",
    "copy_guidelines" "text",
    "is_active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "min_headline_size" integer,
    "max_headline_size" integer,
    "min_body_size" integer,
    "min_cta_size" integer,
    "safe_zone_top" integer DEFAULT 0,
    "safe_zone_bottom" integer DEFAULT 0,
    "safe_zone_left" integer DEFAULT 0,
    "safe_zone_right" integer DEFAULT 0,
    "occupancy_target" integer DEFAULT 70,
    "visual_density" "text" DEFAULT 'balanced'::"text",
    "preferred_layouts" "text"[] DEFAULT '{}'::"text"[],
    "required_zones" "jsonb" DEFAULT '[]'::"jsonb",
    "typography_scale" "jsonb" DEFAULT '{}'::"jsonb",
    "platform_render_rules" "jsonb" DEFAULT '{}'::"jsonb",
    "supports_svg" boolean DEFAULT true,
    "auto_layout_enabled" boolean DEFAULT true
);


ALTER TABLE "public"."content_platforms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_series_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brief_id" "uuid" NOT NULL,
    "triggered_at" timestamp with time zone DEFAULT "now"(),
    "trigger_type" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "creatives_generated" integer DEFAULT 0,
    "error_message" "text",
    "completed_at" timestamp with time zone,
    CONSTRAINT "content_series_runs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'generating'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "content_series_runs_trigger_type_check" CHECK (("trigger_type" = ANY (ARRAY['cron'::"text", 'manual'::"text"])))
);


ALTER TABLE "public"."content_series_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_studio_briefs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "brief" "text",
    "campaign_goal" "text",
    "is_series" boolean DEFAULT false,
    "series_interval" "text",
    "series_active" boolean DEFAULT false,
    "next_generation_at" timestamp with time zone,
    "last_generated_at" timestamp with time zone,
    "selected_platform_ids" "uuid"[],
    "output_id" "uuid",
    "status" "text" DEFAULT 'draft'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "visual_direction" "text"[],
    "visual_assets" "jsonb" DEFAULT '{}'::"jsonb",
    "layout_complexity" "text" DEFAULT 'balanced'::"text",
    "creative_mode" "text" DEFAULT 'on_brand'::"text",
    "ai_freedom" numeric(3,2) DEFAULT 0.5,
    "image_density" numeric(3,2) DEFAULT 0.5,
    "generation_settings" "jsonb" DEFAULT '{}'::"jsonb",
    "estimated_credits" numeric(10,2) DEFAULT 0,
    "actual_credits_used" numeric(10,2) DEFAULT 0,
    "generation_version" integer DEFAULT 1,
    "selected_library_assets" "jsonb",
    CONSTRAINT "content_studio_briefs_creative_mode_check" CHECK (("creative_mode" = ANY (ARRAY['on_brand'::"text", 'explore'::"text", 'experimental'::"text"]))),
    CONSTRAINT "content_studio_briefs_layout_complexity_check" CHECK (("layout_complexity" = ANY (ARRAY['simple'::"text", 'balanced'::"text", 'advanced'::"text", 'experimental'::"text"]))),
    CONSTRAINT "content_studio_briefs_series_interval_check" CHECK (("series_interval" = ANY (ARRAY['daily'::"text", 'every_48h'::"text", 'weekly'::"text", 'biweekly'::"text", 'monthly'::"text"]))),
    CONSTRAINT "content_studio_briefs_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'generating'::"text", 'ready'::"text", 'approved'::"text", 'archived'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."content_studio_briefs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_studio_creatives" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brief_id" "uuid" NOT NULL,
    "platform_id" "uuid" NOT NULL,
    "generation_session_id" "uuid",
    "copy_text" "text",
    "subject_line" "text",
    "headline" "text",
    "hashtags" "text"[],
    "visual_html" "text",
    "visual_thumbnail_url" "text",
    "template_id" "uuid",
    "is_approved" boolean DEFAULT false,
    "scheduled_at" timestamp with time zone,
    "calendar_post_id" "uuid",
    "status" "text" DEFAULT 'generating'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_saved_to_library" boolean DEFAULT false NOT NULL,
    "scene_json" "jsonb",
    "render_engine" "text" DEFAULT 'html'::"text",
    "scene_version" "text" DEFAULT 'v1'::"text",
    "export_unstable" boolean DEFAULT false,
    "generation_quality_score" numeric,
    "generation_telemetry" "jsonb",
    "generation_fallback_reason" "text",
    CONSTRAINT "content_studio_creatives_status_check" CHECK (("status" = ANY (ARRAY['generating'::"text", 'ready'::"text", 'approved'::"text", 'scheduled'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."content_studio_creatives" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."creative_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "creative_id" "uuid" NOT NULL,
    "brief_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "version_number" integer NOT NULL,
    "version_name" character varying(255),
    "version_type" "public"."creative_version_type" DEFAULT 'auto'::"public"."creative_version_type" NOT NULL,
    "source_type" "public"."version_source_type" NOT NULL,
    "source_action" character varying(100),
    "source_metadata" "jsonb",
    "snapshot_type" "public"."snapshot_storage_type" DEFAULT 'full'::"public"."snapshot_storage_type" NOT NULL,
    "content_hash" character varying(64) NOT NULL,
    "scene_json" "jsonb",
    "scene_patch" "jsonb",
    "visual_html" "text",
    "visual_patch" "jsonb",
    "copy_text" "text",
    "headline" "text",
    "subject_line" "text",
    "hashtags" "text"[],
    "change_summary" character varying(500),
    "nodes_added" integer DEFAULT 0,
    "nodes_modified" integer DEFAULT 0,
    "nodes_deleted" integer DEFAULT 0,
    "nodes_unchanged" integer DEFAULT 0,
    "change_size_bytes" integer,
    "restored_from_version_id" "uuid",
    "is_restored_version" boolean DEFAULT false,
    "parent_version_id" "uuid",
    "is_current" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "no_future_versions" CHECK (("created_at" <= ("now"() + '00:01:00'::interval)))
);


ALTER TABLE "public"."creative_versions" OWNER TO "postgres";


COMMENT ON TABLE "public"."creative_versions" IS 'Stores version history for creative content with snapshot/patch architecture';



CREATE TABLE IF NOT EXISTS "public"."creator_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "why_apply" "text" NOT NULL,
    "portfolio_url" "text",
    "prompt_engineering_experience" "text",
    "sample_prompt" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "reviewed_at" timestamp with time zone,
    "reviewer_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "experience" "text",
    "motivation" "text",
    CONSTRAINT "creator_applications_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."creator_applications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."creator_profiles" (
    "id" "uuid" NOT NULL,
    "display_name" "text" NOT NULL,
    "bio" "text",
    "website_url" "text",
    "avatar_url" "text",
    "is_approved" boolean DEFAULT false,
    "applied_at" timestamp with time zone DEFAULT "now"(),
    "approved_at" timestamp with time zone,
    "total_templates" integer DEFAULT 0,
    "total_uses" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "approved_by" "text" NOT NULL
);


ALTER TABLE "public"."creator_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."credit_packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "credits" integer NOT NULL,
    "price_usd" numeric(10,2) NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "sort_order" integer DEFAULT 0 NOT NULL,
    "slug" "text",
    "description" "text",
    "stripe_price_id" "text",
    "stripe_product_id" "text",
    "is_subscription" boolean DEFAULT true NOT NULL,
    "monthly_credits" integer DEFAULT 0,
    "watermark_exports" boolean DEFAULT false NOT NULL,
    "priority_generation" boolean DEFAULT false NOT NULL,
    "max_workspaces" integer DEFAULT 1,
    "rollover_enabled" boolean DEFAULT false NOT NULL,
    "rollover_days" integer DEFAULT 90,
    "badge" "text",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."credit_packages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."credit_purchases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "stripe_session_id" "text",
    "stripe_payment_intent_id" "text",
    "package_id" "uuid",
    "credits" integer NOT NULL,
    "amount_usd" numeric(10,2) NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "credit_purchases_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'completed'::"text", 'failed'::"text", 'refunded'::"text"])))
);


ALTER TABLE "public"."credit_purchases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "document_type" "text" NOT NULL,
    "purpose" "text",
    "audience" "text",
    "key_message" "text",
    "key_points" "text",
    "tone" "text",
    "generated_html" "text",
    "asset_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "documents_document_type_check" CHECK (("document_type" = ANY (ARRAY['pitch_deck'::"text", 'client_proposal'::"text", 'one_pager'::"text", 'rate_card'::"text", 'case_study'::"text", 'project_brief'::"text", 'invoice_cover_letter'::"text", 'partnership_proposal'::"text"])))
);


ALTER TABLE "public"."documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generation_assets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "generation_id" "uuid" NOT NULL,
    "platform" "text" NOT NULL,
    "asset_type" "text" NOT NULL,
    "asset_url" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "generation_assets_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."generation_assets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generation_billing_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "generation_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "credits" integer DEFAULT 0,
    "provider_cost_usd" numeric(10,4) DEFAULT 0,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    "wallet_id" "uuid",
    "billing_status" "text" DEFAULT 'pending'::"text",
    "credits_reserved" numeric(12,2) DEFAULT 0,
    "credits_captured" numeric(12,2) DEFAULT 0,
    "credits_refunded" numeric(12,2) DEFAULT 0,
    "render_engine" "text",
    "generation_session_id" "text",
    "pricing_snapshot" "jsonb" DEFAULT '{}'::"jsonb",
    "idempotency_key" "text",
    "completed_at" timestamp with time zone,
    "refunded_at" timestamp with time zone,
    CONSTRAINT "generation_billing_events_type_check" CHECK (("event_type" = ANY (ARRAY['reserved'::"text", 'released'::"text", 'captured'::"text", 'refunded'::"text", 'partial_refund'::"text"])))
);


ALTER TABLE "public"."generation_billing_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "prompt" "text",
    "platform" "text",
    "status" "text" DEFAULT 'initiated'::"text" NOT NULL,
    "credits_reserved" integer DEFAULT 0 NOT NULL,
    "credits_captured" integer DEFAULT 0 NOT NULL,
    "provider" "text",
    "provider_model" "text",
    "provider_cost_usd" numeric(10,4) DEFAULT 0,
    "ai_started_at" timestamp with time zone,
    "ai_completed_at" timestamp with time zone,
    "started_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "generations_status_check" CHECK (("status" = ANY (ARRAY['initiated'::"text", 'queued'::"text", 'processing'::"text", 'ai_called'::"text", 'completed'::"text", 'failed'::"text", 'failed_pre_cost'::"text", 'failed_post_cost'::"text", 'partially_completed'::"text", 'refunded'::"text", 'partial_refund'::"text", 'reserved'::"text", 'captured'::"text", 'released'::"text"])))
);


ALTER TABLE "public"."generations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."journey_stage_fields" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "stage_key" "text" NOT NULL,
    "field_key" "text" NOT NULL,
    "field_label" "text" NOT NULL,
    "field_description" "text",
    "field_type" "text" DEFAULT 'text'::"text",
    "is_required" boolean DEFAULT false,
    "sort_order" integer DEFAULT 0,
    "maps_to_dna_field" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "substage_index" integer,
    CONSTRAINT "journey_stage_fields_field_type_check" CHECK (("field_type" = ANY (ARRAY['text'::"text", 'textarea'::"text", 'tags'::"text", 'choice'::"text"])))
);


ALTER TABLE "public"."journey_stage_fields" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."journey_stages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "stage_key" "text" NOT NULL,
    "name" "text" NOT NULL,
    "emoji" "text" DEFAULT '●'::"text" NOT NULL,
    "description" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true,
    "mentor_focus" "text",
    "relevant_modules" "text"[] DEFAULT '{}'::"text"[],
    "suggested_next_steps" "jsonb" DEFAULT '[]'::"jsonb",
    "substages" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."journey_stages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mentor_choice_prompts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "message_id" "uuid" NOT NULL,
    "prompt_type" "text" NOT NULL,
    "question" "text" NOT NULL,
    "options" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "selected_option" "text",
    "is_answered" boolean DEFAULT false,
    "dna_field" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "mentor_choice_prompts_prompt_type_check" CHECK (("prompt_type" = ANY (ARRAY['brand_name'::"text", 'target_audience'::"text", 'brand_voice'::"text", 'positioning'::"text", 'industry'::"text", 'custom'::"text"])))
);


ALTER TABLE "public"."mentor_choice_prompts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mentor_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "message_count" integer DEFAULT 0,
    "last_message_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."mentor_conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mentor_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "ai_response_failed" boolean DEFAULT false,
    CONSTRAINT "mentor_messages_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text"])))
);


ALTER TABLE "public"."mentor_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."milestones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "message_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "stage_key" "text",
    "is_substage_milestone" boolean DEFAULT false,
    CONSTRAINT "milestones_category_check" CHECK (("category" = ANY (ARRAY['brand_discovery'::"text", 'campaign_strategy'::"text", 'customer_insight'::"text", 'product_positioning'::"text", 'growth_brainstorm'::"text", 'pitch_preparation'::"text", 'free_form'::"text"])))
);


ALTER TABLE "public"."milestones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."model_rates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_slug" "text" NOT NULL,
    "model_id" "text" NOT NULL,
    "display_name" "text",
    "input_per_1m" numeric(10,4) DEFAULT 0 NOT NULL,
    "output_per_1m" numeric(10,4) DEFAULT 0 NOT NULL,
    "cache_read_per_1m" numeric(10,4),
    "cache_write_per_1m" numeric(10,4),
    "is_active" boolean DEFAULT true NOT NULL,
    "source" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."model_rates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "brand_id" "uuid",
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "action_url" "text",
    "related_id" "uuid",
    "related_type" "text",
    "is_read" boolean DEFAULT false,
    "email_sent" boolean DEFAULT false,
    "email_sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "notifications_type_check" CHECK (("type" = ANY (ARRAY['content_series_ready'::"text", 'content_series_failed'::"text", 'campaign_generated'::"text", 'milestone_reached'::"text", 'stage_suggested'::"text", 'mentor_insight'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "setting_key" "text" NOT NULL,
    "setting_value" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."platform_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "email" "text",
    "avatar_url" "text",
    "role" "text" DEFAULT 'founder'::"text",
    "plan" "text" DEFAULT 'free'::"text",
    "credits_remaining" integer DEFAULT 50,
    "plan_renewal_date" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "onboarding_completed" boolean DEFAULT false,
    "profession" "text",
    "brand_status" "text",
    "team_size" "text",
    "is_creator" boolean DEFAULT false,
    CONSTRAINT "profiles_brand_status_check" CHECK (("brand_status" = ANY (ARRAY['in_progress'::"text", 'have_idea'::"text", 'exploring'::"text", 'multiple_projects'::"text"]))),
    CONSTRAINT "profiles_plan_check" CHECK (("plan" = ANY (ARRAY['free'::"text", 'creator'::"text", 'pro'::"text", 'agency'::"text"]))),
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['founder'::"text", 'creator'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_assets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "file_type" "text" NOT NULL,
    "source" "text" NOT NULL,
    "file_url" "text",
    "storage_path" "text",
    "mime_type" "text",
    "file_size_bytes" integer,
    "content_text" "text",
    "stage_key" "text",
    "message_id" "uuid",
    "description" "text",
    "is_pinned" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_primary" boolean DEFAULT false,
    CONSTRAINT "project_assets_file_type_check" CHECK (("file_type" = ANY (ARRAY['document'::"text", 'image'::"text", 'pdf'::"text", 'spreadsheet'::"text", 'presentation'::"text", 'screenshot'::"text", 'ai_generated'::"text", 'text'::"text", 'url'::"text", 'docx'::"text", 'other'::"text"]))),
    CONSTRAINT "project_assets_source_check" CHECK (("source" = ANY (ARRAY['upload'::"text", 'ai_generated'::"text", 'mentor'::"text", 'product_image'::"text", 'onboarding'::"text", 'url_fetch'::"text", 'document_upload'::"text", 'text_paste'::"text"])))
);


ALTER TABLE "public"."project_assets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."prostudio_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "creator_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text",
    "description" "text",
    "template_type" "text" NOT NULL,
    "category" "text" NOT NULL,
    "digital_output_type" "text",
    "best_for" "text"[] DEFAULT '{}'::"text"[],
    "generation_prompt" "text",
    "cover_image_url" "text",
    "preview_background" "text" DEFAULT '#1A2A3A'::"text",
    "status" "text" DEFAULT 'draft'::"text",
    "uses_count" integer DEFAULT 0,
    "sort_order" integer DEFAULT 0,
    "is_free" boolean DEFAULT true,
    "price_credits" integer DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "admin_notes" "text",
    "admin_signature" "text",
    "reviewed_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "prostudio_templates_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'pending_review'::"text", 'published'::"text", 'unpublished'::"text"]))),
    CONSTRAINT "prostudio_templates_template_type_check" CHECK (("template_type" = ANY (ARRAY['physical'::"text", 'digital'::"text"])))
);


ALTER TABLE "public"."prostudio_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reel_scenes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reel_id" "uuid" NOT NULL,
    "scene_number" integer NOT NULL,
    "duration_start" "text",
    "duration_end" "text",
    "visual_direction" "text",
    "voiceover" "text",
    "on_screen_text" "text",
    "transition" "text",
    "music_mood" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."reel_scenes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "topic" "text",
    "platform" "text",
    "duration_seconds" integer,
    "goal" "text",
    "tone" "text",
    "key_message" "text",
    "template_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "reels_platform_check" CHECK (("platform" = ANY (ARRAY['instagram_reels'::"text", 'tiktok'::"text", 'youtube_shorts'::"text", 'facebook_reels'::"text"])))
);


ALTER TABLE "public"."reels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stripe_customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "stripe_customer_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."stripe_customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."studio_elements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "element_type" "text" NOT NULL,
    "html_snippet" "text" NOT NULL,
    "preview_svg" "text",
    "tags" "text"[],
    "created_by" "uuid",
    "is_public" boolean DEFAULT true,
    "source" "text" DEFAULT 'ai_generated'::"text",
    "uses_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "snippet_hash" "text",
    "brand_id" "uuid"
);


ALTER TABLE "public"."studio_elements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."studio_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "asset_id" "uuid",
    "brand_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "source_module" "text" NOT NULL,
    "visual_html" "text" NOT NULL,
    "generation_params" "jsonb",
    "platform_slug" "text",
    "platform_width" integer,
    "platform_height" integer,
    "template_id" "uuid",
    "brief_id" "uuid",
    "creative_id" "uuid",
    "template_output_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "scene_json" "jsonb",
    "render_engine" "text" DEFAULT 'html'::"text",
    CONSTRAINT "studio_sessions_source_module_check" CHECK (("source_module" = ANY (ARRAY['prostudio'::"text", 'contentstudio'::"text"])))
);


ALTER TABLE "public"."studio_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."template_outputs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "brand_id" "uuid",
    "output_type" "text",
    "output_html" "text",
    "output_image_url" "text",
    "output_storage_path" "text",
    "aspect_ratio" "text",
    "style_intensity" integer,
    "product_image_used" boolean DEFAULT false,
    "variation_index" integer,
    "is_saved_to_library" boolean DEFAULT false,
    "is_downloaded" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "generation_params" "jsonb",
    "output_data" "text",
    "generation_session_id" "uuid",
    "scene_json" "jsonb",
    "render_engine" "text" DEFAULT 'html'::"text",
    CONSTRAINT "template_outputs_output_type_check" CHECK (("output_type" = ANY (ARRAY['html_css'::"text", 'image_url'::"text"])))
);


ALTER TABLE "public"."template_outputs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."template_preview_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid" NOT NULL,
    "image_url" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "is_cover" boolean DEFAULT false,
    "sort_order" integer DEFAULT 0,
    "caption" "text",
    "product_used" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."template_preview_images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."template_saves" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."template_saves" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."template_variants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid" NOT NULL,
    "platform_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "scene_json" "jsonb",
    "cover_image_url" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "render_engine" "text" DEFAULT 'scene'::"text" NOT NULL,
    "is_primary" boolean DEFAULT false NOT NULL,
    "fitness_check_passed" boolean DEFAULT false NOT NULL,
    CONSTRAINT "template_variants_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."template_variants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_model_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "task_type" "text" NOT NULL,
    "model_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_model_preferences_task_type_check" CHECK (("task_type" = ANY (ARRAY['mentor_chat'::"text", 'template_generation'::"text", 'image_generation'::"text", 'document_generation'::"text", 'reel_script'::"text", 'campaign_copy'::"text"])))
);


ALTER TABLE "public"."user_model_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."version_annotations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "version_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "annotation_type" "public"."annotation_type" DEFAULT 'note'::"public"."annotation_type" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."version_annotations" OWNER TO "postgres";


COMMENT ON TABLE "public"."version_annotations" IS 'User notes and bookmarks on specific versions';



CREATE OR REPLACE VIEW "public"."version_history_view" WITH ("security_invoker"='on') AS
 SELECT "id",
    "creative_id",
    "brief_id",
    "user_id",
    "version_number",
    "version_name",
    "version_type",
    "source_type",
    "source_action",
    "change_summary",
    "nodes_added",
    "nodes_modified",
    "nodes_deleted",
    "is_current",
    "is_restored_version",
    "created_at",
    "parent_version_id",
    "restored_from_version_id",
        CASE
            WHEN ("created_at" > ("now"() - '00:01:00'::interval)) THEN 'Just now'::"text"
            WHEN ("created_at" > ("now"() - '01:00:00'::interval)) THEN ((EXTRACT(minute FROM ("now"() - "created_at")))::"text" || 'm ago'::"text")
            WHEN ("created_at" > ("now"() - '1 day'::interval)) THEN ((EXTRACT(hour FROM ("now"() - "created_at")))::"text" || 'h ago'::"text")
            WHEN ("created_at" > ("now"() - '7 days'::interval)) THEN ((EXTRACT(day FROM ("now"() - "created_at")))::"text" || 'd ago'::"text")
            ELSE "to_char"("created_at", 'Mon DD'::"text")
        END AS "age_text"
   FROM "public"."creative_versions" "cv";


ALTER VIEW "public"."version_history_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."version_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "creative_id" "uuid" NOT NULL,
    "snapshot_reason" "public"."snapshot_reason_type" DEFAULT 'periodic'::"public"."snapshot_reason_type" NOT NULL,
    "version_range_start" integer NOT NULL,
    "version_range_end" integer NOT NULL,
    "compressed_scene_json" "bytea",
    "compression_algorithm" character varying(20) DEFAULT 'zstd'::character varying,
    "original_size_bytes" integer,
    "compressed_size_bytes" integer,
    "content_hash" character varying(64) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "valid_version_range" CHECK (("version_range_start" <= "version_range_end"))
);


ALTER TABLE "public"."version_snapshots" OWNER TO "postgres";


COMMENT ON TABLE "public"."version_snapshots" IS 'Compressed periodic snapshots for efficient version reconstruction';



CREATE TABLE IF NOT EXISTS "public"."wallets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "balance" integer DEFAULT 0 NOT NULL,
    "reserved_balance" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "lifetime_earned" numeric(12,2) DEFAULT 0 NOT NULL,
    "lifetime_spent" numeric(12,2) DEFAULT 0 NOT NULL,
    "lifetime_refunded" numeric(12,2) DEFAULT 0 NOT NULL,
    CONSTRAINT "wallets_balance_nonnegative" CHECK (("balance" >= 0)),
    CONSTRAINT "wallets_reserved_lte_balance" CHECK (("reserved_balance" <= "balance")),
    CONSTRAINT "wallets_reserved_nonnegative" CHECK (("reserved_balance" >= 0))
);


ALTER TABLE "public"."wallets" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."wallet_balances" WITH ("security_invoker"='on') AS
 SELECT "id",
    "user_id",
    "balance",
    "reserved_balance",
    ("balance" - "reserved_balance") AS "available_balance"
   FROM "public"."wallets" "w";


ALTER VIEW "public"."wallet_balances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallet_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "wallet_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "transaction_type" "text" NOT NULL,
    "amount" integer NOT NULL,
    "balance_before" integer NOT NULL,
    "balance_after" integer NOT NULL,
    "reserved_before" integer DEFAULT 0 NOT NULL,
    "reserved_after" integer DEFAULT 0 NOT NULL,
    "reference_type" "text",
    "reference_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "wallet_transaction_type_check" CHECK (("transaction_type" = ANY (ARRAY['credit_purchase'::"text", 'manual_adjustment'::"text", 'generation_charge'::"text", 'reservation'::"text", 'reservation_release'::"text", 'reservation_capture'::"text", 'refund'::"text", 'partial_refund'::"text"])))
);


ALTER TABLE "public"."wallet_transactions" OWNER TO "postgres";


ALTER TABLE ONLY "public"."agent_hires"
    ADD CONSTRAINT "agent_hires_brand_agent_unique" UNIQUE ("brand_id", "agent_id");



ALTER TABLE ONLY "public"."agent_hires"
    ADD CONSTRAINT "agent_hires_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agents"
    ADD CONSTRAINT "agents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agents"
    ADD CONSTRAINT "agents_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."ai_generation_pricing"
    ADD CONSTRAINT "ai_generation_pricing_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_generation_pricing"
    ADD CONSTRAINT "ai_generation_pricing_pricing_key_key" UNIQUE ("pricing_key");



ALTER TABLE ONLY "public"."ai_models"
    ADD CONSTRAINT "ai_models_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_prompt_versions"
    ADD CONSTRAINT "ai_prompt_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_provider_secrets"
    ADD CONSTRAINT "ai_provider_secrets_pkey" PRIMARY KEY ("provider_id");



ALTER TABLE ONLY "public"."ai_providers"
    ADD CONSTRAINT "ai_providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_providers"
    ADD CONSTRAINT "ai_providers_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."ai_system_prompts"
    ADD CONSTRAINT "ai_system_prompts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_system_prompts"
    ADD CONSTRAINT "ai_system_prompts_task_type_key" UNIQUE ("task_type");



ALTER TABLE ONLY "public"."ai_task_defaults"
    ADD CONSTRAINT "ai_task_defaults_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_task_defaults"
    ADD CONSTRAINT "ai_task_defaults_task_type_key" UNIQUE ("task_type");



ALTER TABLE ONLY "public"."ai_usage_log"
    ADD CONSTRAINT "ai_usage_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_errors"
    ADD CONSTRAINT "app_errors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."approvals"
    ADD CONSTRAINT "approvals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."automation_run_steps"
    ADD CONSTRAINT "automation_run_steps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."automation_run_steps"
    ADD CONSTRAINT "automation_run_steps_run_index_unique" UNIQUE ("run_id", "step_index");



ALTER TABLE ONLY "public"."automation_runs"
    ADD CONSTRAINT "automation_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."automations"
    ADD CONSTRAINT "automations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brand_dna"
    ADD CONSTRAINT "brand_dna_brand_id_key" UNIQUE ("brand_id");



ALTER TABLE ONLY "public"."brand_dna_custom_fields"
    ADD CONSTRAINT "brand_dna_custom_fields_brand_id_field_key_key" UNIQUE ("brand_id", "field_key");



ALTER TABLE ONLY "public"."brand_dna_custom_fields"
    ADD CONSTRAINT "brand_dna_custom_fields_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brand_dna"
    ADD CONSTRAINT "brand_dna_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brand_journey_events"
    ADD CONSTRAINT "brand_journey_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brand_stage_data"
    ADD CONSTRAINT "brand_stage_data_brand_id_stage_key_field_key_key" UNIQUE ("brand_id", "stage_key", "field_key");



ALTER TABLE ONLY "public"."brand_stage_data"
    ADD CONSTRAINT "brand_stage_data_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brand_stage_progress"
    ADD CONSTRAINT "brand_stage_progress_brand_id_stage_key_substage_index_key" UNIQUE ("brand_id", "stage_key", "substage_index");



ALTER TABLE ONLY "public"."brand_stage_progress"
    ADD CONSTRAINT "brand_stage_progress_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brands"
    ADD CONSTRAINT "brands_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calendar_posts"
    ADD CONSTRAINT "calendar_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaign_creatives"
    ADD CONSTRAINT "campaign_creatives_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_platforms"
    ADD CONSTRAINT "content_platforms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_platforms"
    ADD CONSTRAINT "content_platforms_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."content_series_runs"
    ADD CONSTRAINT "content_series_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_studio_briefs"
    ADD CONSTRAINT "content_studio_briefs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_studio_creatives"
    ADD CONSTRAINT "content_studio_creatives_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."creative_versions"
    ADD CONSTRAINT "creative_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."creator_applications"
    ADD CONSTRAINT "creator_applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."creator_profiles"
    ADD CONSTRAINT "creator_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_packages"
    ADD CONSTRAINT "credit_packages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_packages"
    ADD CONSTRAINT "credit_packages_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."credit_purchases"
    ADD CONSTRAINT "credit_purchases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_purchases"
    ADD CONSTRAINT "credit_purchases_stripe_session_id_key" UNIQUE ("stripe_session_id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."generation_assets"
    ADD CONSTRAINT "generation_assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."generation_billing_events"
    ADD CONSTRAINT "generation_billing_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."generations"
    ADD CONSTRAINT "generations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."journey_stage_fields"
    ADD CONSTRAINT "journey_stage_fields_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."journey_stage_fields"
    ADD CONSTRAINT "journey_stage_fields_stage_key_field_key_key" UNIQUE ("stage_key", "field_key");



ALTER TABLE ONLY "public"."journey_stages"
    ADD CONSTRAINT "journey_stages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."journey_stages"
    ADD CONSTRAINT "journey_stages_stage_key_key" UNIQUE ("stage_key");



ALTER TABLE ONLY "public"."mentor_choice_prompts"
    ADD CONSTRAINT "mentor_choice_prompts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mentor_conversations"
    ADD CONSTRAINT "mentor_conversations_brand_id_key" UNIQUE ("brand_id");



ALTER TABLE ONLY "public"."mentor_conversations"
    ADD CONSTRAINT "mentor_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mentor_messages"
    ADD CONSTRAINT "mentor_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."milestones"
    ADD CONSTRAINT "milestones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."model_rates"
    ADD CONSTRAINT "model_rates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."model_rates"
    ADD CONSTRAINT "model_rates_provider_model_unique" UNIQUE ("provider_slug", "model_id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_settings"
    ADD CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_settings"
    ADD CONSTRAINT "platform_settings_setting_key_key" UNIQUE ("setting_key");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_assets"
    ADD CONSTRAINT "project_assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."prostudio_templates"
    ADD CONSTRAINT "prostudio_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."prostudio_templates"
    ADD CONSTRAINT "prostudio_templates_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."reel_scenes"
    ADD CONSTRAINT "reel_scenes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reels"
    ADD CONSTRAINT "reels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stripe_customers"
    ADD CONSTRAINT "stripe_customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stripe_customers"
    ADD CONSTRAINT "stripe_customers_stripe_customer_id_key" UNIQUE ("stripe_customer_id");



ALTER TABLE ONLY "public"."stripe_customers"
    ADD CONSTRAINT "stripe_customers_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."studio_elements"
    ADD CONSTRAINT "studio_elements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."studio_sessions"
    ADD CONSTRAINT "studio_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."template_outputs"
    ADD CONSTRAINT "template_outputs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."template_preview_images"
    ADD CONSTRAINT "template_preview_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."template_saves"
    ADD CONSTRAINT "template_saves_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."template_saves"
    ADD CONSTRAINT "template_saves_template_id_user_id_key" UNIQUE ("template_id", "user_id");



ALTER TABLE ONLY "public"."template_variants"
    ADD CONSTRAINT "template_variants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."template_variants"
    ADD CONSTRAINT "template_variants_template_platform_unique" UNIQUE ("template_id", "platform_id");



ALTER TABLE ONLY "public"."creative_versions"
    ADD CONSTRAINT "unique_version_number_per_creative" UNIQUE ("creative_id", "version_number");



ALTER TABLE ONLY "public"."user_model_preferences"
    ADD CONSTRAINT "user_model_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_model_preferences"
    ADD CONSTRAINT "user_model_preferences_user_id_task_type_key" UNIQUE ("user_id", "task_type");



ALTER TABLE ONLY "public"."version_annotations"
    ADD CONSTRAINT "version_annotations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."version_snapshots"
    ADD CONSTRAINT "version_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallet_transactions"
    ADD CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallets"
    ADD CONSTRAINT "wallets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallets"
    ADD CONSTRAINT "wallets_user_id_key" UNIQUE ("user_id");



CREATE INDEX "agent_hires_brand_idx" ON "public"."agent_hires" USING "btree" ("brand_id");



CREATE UNIQUE INDEX "ai_generation_pricing_key_unique" ON "public"."ai_generation_pricing" USING "btree" ("pricing_key");



CREATE INDEX "ai_models_provider_id_idx" ON "public"."ai_models" USING "btree" ("provider_id");



CREATE INDEX "ai_usage_log_created_idx" ON "public"."ai_usage_log" USING "btree" ("created_at" DESC);



CREATE INDEX "ai_usage_log_generation_idx" ON "public"."ai_usage_log" USING "btree" ("generation_id");



CREATE INDEX "ai_usage_log_user_created_idx" ON "public"."ai_usage_log" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "app_errors_created_at_idx" ON "public"."app_errors" USING "btree" ("created_at");



CREATE INDEX "app_errors_error_type_idx" ON "public"."app_errors" USING "btree" ("error_type");



CREATE INDEX "app_errors_is_resolved_idx" ON "public"."app_errors" USING "btree" ("is_resolved");



CREATE INDEX "app_errors_module_idx" ON "public"."app_errors" USING "btree" ("module");



CREATE INDEX "app_errors_user_id_idx" ON "public"."app_errors" USING "btree" ("user_id");



CREATE INDEX "approvals_pending_idx" ON "public"."approvals" USING "btree" ("user_id", "created_at" DESC) WHERE ("status" = 'pending'::"text");



CREATE INDEX "assets_brand_id_idx" ON "public"."assets" USING "btree" ("brand_id");



CREATE INDEX "assets_parent_asset_id_idx" ON "public"."assets" USING "btree" ("parent_asset_id");



CREATE INDEX "assets_type_idx" ON "public"."assets" USING "btree" ("type");



CREATE INDEX "automation_runs_brand_created_idx" ON "public"."automation_runs" USING "btree" ("brand_id", "created_at" DESC);



CREATE INDEX "automation_runs_status_idx" ON "public"."automation_runs" USING "btree" ("status") WHERE ("status" = ANY (ARRAY['queued'::"text", 'running'::"text"]));



CREATE INDEX "automations_due_idx" ON "public"."automations" USING "btree" ("next_run_at") WHERE (("status" = 'active'::"text") AND ("trigger_type" = 'schedule'::"text"));



CREATE INDEX "calendar_posts_brand_id_idx" ON "public"."calendar_posts" USING "btree" ("brand_id");



CREATE INDEX "calendar_posts_content_studio_creative_id_idx" ON "public"."calendar_posts" USING "btree" ("content_studio_creative_id");



CREATE INDEX "calendar_posts_scheduled_date_idx" ON "public"."calendar_posts" USING "btree" ("scheduled_date");



CREATE INDEX "campaign_creatives_campaign_id_idx" ON "public"."campaign_creatives" USING "btree" ("campaign_id");



CREATE UNIQUE INDEX "content_studio_unique_platform_per_session" ON "public"."content_studio_creatives" USING "btree" ("generation_session_id", "platform_id");



CREATE INDEX "idx_creative_versions_brief_id" ON "public"."creative_versions" USING "btree" ("brief_id");



CREATE INDEX "idx_creative_versions_created" ON "public"."creative_versions" USING "btree" ("creative_id", "created_at" DESC);



CREATE INDEX "idx_creative_versions_creative_id" ON "public"."creative_versions" USING "btree" ("creative_id");



CREATE INDEX "idx_creative_versions_current" ON "public"."creative_versions" USING "btree" ("creative_id", "is_current") WHERE ("is_current" = true);



CREATE INDEX "idx_creative_versions_source" ON "public"."creative_versions" USING "btree" ("source_type");



CREATE INDEX "idx_creative_versions_type" ON "public"."creative_versions" USING "btree" ("creative_id", "version_type");



CREATE INDEX "idx_creative_versions_user_id" ON "public"."creative_versions" USING "btree" ("user_id");



CREATE INDEX "idx_credit_purchases_session" ON "public"."credit_purchases" USING "btree" ("stripe_session_id");



CREATE INDEX "idx_credit_purchases_status" ON "public"."credit_purchases" USING "btree" ("status");



CREATE INDEX "idx_credit_purchases_user" ON "public"."credit_purchases" USING "btree" ("user_id");



CREATE INDEX "idx_generation_assets_generation_id" ON "public"."generation_assets" USING "btree" ("generation_id");



CREATE INDEX "idx_generation_billing_events_generation_id" ON "public"."generation_billing_events" USING "btree" ("generation_id");



CREATE INDEX "idx_generation_billing_events_session" ON "public"."generation_billing_events" USING "btree" ("generation_session_id");



CREATE INDEX "idx_generation_billing_events_status" ON "public"."generation_billing_events" USING "btree" ("billing_status");



CREATE INDEX "idx_generation_billing_events_user" ON "public"."generation_billing_events" USING "btree" ("user_id");



CREATE INDEX "idx_generations_status" ON "public"."generations" USING "btree" ("status");



CREATE INDEX "idx_generations_user" ON "public"."generations" USING "btree" ("user_id");



CREATE INDEX "idx_generations_user_id" ON "public"."generations" USING "btree" ("user_id");



CREATE INDEX "idx_stripe_customers_stripe" ON "public"."stripe_customers" USING "btree" ("stripe_customer_id");



CREATE INDEX "idx_stripe_customers_user" ON "public"."stripe_customers" USING "btree" ("user_id");



CREATE INDEX "idx_version_annotations_version_id" ON "public"."version_annotations" USING "btree" ("version_id");



CREATE INDEX "idx_version_snapshots_creative_id" ON "public"."version_snapshots" USING "btree" ("creative_id");



CREATE INDEX "idx_version_snapshots_range" ON "public"."version_snapshots" USING "btree" ("creative_id", "version_range_start", "version_range_end");



CREATE INDEX "idx_wallet_transactions_reference" ON "public"."wallet_transactions" USING "btree" ("reference_type", "reference_id");



CREATE INDEX "idx_wallet_transactions_user_id" ON "public"."wallet_transactions" USING "btree" ("user_id");



CREATE INDEX "idx_wallet_transactions_wallet_id" ON "public"."wallet_transactions" USING "btree" ("wallet_id");



CREATE INDEX "idx_wallet_txn_created" ON "public"."wallet_transactions" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_wallet_txn_ref" ON "public"."wallet_transactions" USING "btree" ("reference_id", "reference_type");



CREATE INDEX "idx_wallet_txn_type" ON "public"."wallet_transactions" USING "btree" ("transaction_type");



CREATE INDEX "idx_wallet_txn_user" ON "public"."wallet_transactions" USING "btree" ("user_id");



CREATE INDEX "idx_wallet_txn_wallet" ON "public"."wallet_transactions" USING "btree" ("wallet_id");



CREATE INDEX "idx_wallets_user" ON "public"."wallets" USING "btree" ("user_id");



CREATE INDEX "idx_wallets_user_id" ON "public"."wallets" USING "btree" ("user_id");



CREATE INDEX "mentor_messages_conversation_id_idx" ON "public"."mentor_messages" USING "btree" ("conversation_id");



CREATE INDEX "mentor_messages_created_at_idx" ON "public"."mentor_messages" USING "btree" ("created_at");



CREATE INDEX "project_assets_brand_id_idx" ON "public"."project_assets" USING "btree" ("brand_id");



CREATE UNIQUE INDEX "project_assets_primary_product_idx" ON "public"."project_assets" USING "btree" ("brand_id") WHERE (("source" = 'product_image'::"text") AND ("is_primary" = true));



CREATE INDEX "project_assets_product_images_idx" ON "public"."project_assets" USING "btree" ("brand_id", "source") WHERE ("source" = 'product_image'::"text");



CREATE INDEX "project_assets_source_idx" ON "public"."project_assets" USING "btree" ("source");



CREATE INDEX "prostudio_templates_creator_id_idx" ON "public"."prostudio_templates" USING "btree" ("creator_id");



CREATE INDEX "prostudio_templates_status_idx" ON "public"."prostudio_templates" USING "btree" ("status");



CREATE INDEX "prostudio_templates_type_idx" ON "public"."prostudio_templates" USING "btree" ("template_type");



CREATE INDEX "reel_scenes_reel_id_idx" ON "public"."reel_scenes" USING "btree" ("reel_id");



CREATE UNIQUE INDEX "studio_elements_snippet_hash_idx" ON "public"."studio_elements" USING "btree" ("snippet_hash") WHERE ("snippet_hash" IS NOT NULL);



CREATE INDEX "studio_sessions_asset_id_idx" ON "public"."studio_sessions" USING "btree" ("asset_id");



CREATE INDEX "studio_sessions_brand_id_idx" ON "public"."studio_sessions" USING "btree" ("brand_id");



CREATE INDEX "template_outputs_session_idx" ON "public"."template_outputs" USING "btree" ("generation_session_id") WHERE ("generation_session_id" IS NOT NULL);



CREATE INDEX "template_outputs_template_id_idx" ON "public"."template_outputs" USING "btree" ("template_id");



CREATE INDEX "template_outputs_user_id_idx" ON "public"."template_outputs" USING "btree" ("user_id");



CREATE INDEX "template_preview_images_template_id_idx" ON "public"."template_preview_images" USING "btree" ("template_id");



CREATE INDEX "template_variants_platform_id_idx" ON "public"."template_variants" USING "btree" ("platform_id");



CREATE INDEX "template_variants_status_idx" ON "public"."template_variants" USING "btree" ("status") WHERE ("status" = 'active'::"text");



CREATE INDEX "template_variants_template_id_idx" ON "public"."template_variants" USING "btree" ("template_id");



CREATE OR REPLACE TRIGGER "agent_hires_set_updated_at" BEFORE UPDATE ON "public"."agent_hires" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "agents_set_updated_at" BEFORE UPDATE ON "public"."agents" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "ai_providers_block_api_key" BEFORE INSERT OR UPDATE OF "api_key" ON "public"."ai_providers" FOR EACH ROW EXECUTE FUNCTION "public"."block_api_key_on_ai_providers"();



CREATE OR REPLACE TRIGGER "automation_runs_set_updated_at" BEFORE UPDATE ON "public"."automation_runs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "automations_set_updated_at" BEFORE UPDATE ON "public"."automations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "sync_creator_flag_trigger" BEFORE INSERT OR UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."sync_creator_flag"();



CREATE OR REPLACE TRIGGER "template_variants_updated_at" BEFORE UPDATE ON "public"."template_variants" FOR EACH ROW EXECUTE FUNCTION "public"."set_template_variants_updated_at"();



CREATE OR REPLACE TRIGGER "trg_mark_current_version" AFTER INSERT ON "public"."creative_versions" FOR EACH ROW WHEN (("new"."is_current" = true)) EXECUTE FUNCTION "public"."mark_previous_versions_not_current"();



CREATE OR REPLACE TRIGGER "trigger_generations_updated_at" BEFORE UPDATE ON "public"."generations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trigger_wallets_updated_at" BEFORE UPDATE ON "public"."wallets" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."agent_hires"
    ADD CONSTRAINT "agent_hires_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_hires"
    ADD CONSTRAINT "agent_hires_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_hires"
    ADD CONSTRAINT "agent_hires_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_models"
    ADD CONSTRAINT "ai_models_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."ai_providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_prompt_versions"
    ADD CONSTRAINT "ai_prompt_versions_edited_by_fkey" FOREIGN KEY ("edited_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_prompt_versions"
    ADD CONSTRAINT "ai_prompt_versions_prompt_id_fkey" FOREIGN KEY ("prompt_id") REFERENCES "public"."ai_system_prompts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_provider_secrets"
    ADD CONSTRAINT "ai_provider_secrets_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."ai_providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_provider_secrets"
    ADD CONSTRAINT "ai_provider_secrets_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_system_prompts"
    ADD CONSTRAINT "ai_system_prompts_last_edited_by_fkey" FOREIGN KEY ("last_edited_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_task_defaults"
    ADD CONSTRAINT "ai_task_defaults_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "public"."ai_models"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_usage_log"
    ADD CONSTRAINT "ai_usage_log_generation_id_fkey" FOREIGN KEY ("generation_id") REFERENCES "public"."generations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_usage_log"
    ADD CONSTRAINT "ai_usage_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."app_errors"
    ADD CONSTRAINT "app_errors_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."app_errors"
    ADD CONSTRAINT "app_errors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."approvals"
    ADD CONSTRAINT "approvals_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."approvals"
    ADD CONSTRAINT "approvals_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."approvals"
    ADD CONSTRAINT "approvals_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."automation_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."approvals"
    ADD CONSTRAINT "approvals_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "public"."automation_run_steps"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."approvals"
    ADD CONSTRAINT "approvals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_parent_asset_id_fkey" FOREIGN KEY ("parent_asset_id") REFERENCES "public"."assets"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."prostudio_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."automation_run_steps"
    ADD CONSTRAINT "automation_run_steps_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."automation_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."automation_run_steps"
    ADD CONSTRAINT "automation_run_steps_usage_log_id_fkey" FOREIGN KEY ("usage_log_id") REFERENCES "public"."ai_usage_log"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."automation_runs"
    ADD CONSTRAINT "automation_runs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."automation_runs"
    ADD CONSTRAINT "automation_runs_automation_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "public"."automations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."automation_runs"
    ADD CONSTRAINT "automation_runs_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."automation_runs"
    ADD CONSTRAINT "automation_runs_generation_id_fkey" FOREIGN KEY ("generation_id") REFERENCES "public"."generations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."automation_runs"
    ADD CONSTRAINT "automation_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."automations"
    ADD CONSTRAINT "automations_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."automations"
    ADD CONSTRAINT "automations_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."automations"
    ADD CONSTRAINT "automations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brand_dna"
    ADD CONSTRAINT "brand_dna_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brand_dna_custom_fields"
    ADD CONSTRAINT "brand_dna_custom_fields_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brand_dna_custom_fields"
    ADD CONSTRAINT "brand_dna_custom_fields_created_from_message_id_fkey" FOREIGN KEY ("created_from_message_id") REFERENCES "public"."mentor_messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."brand_journey_events"
    ADD CONSTRAINT "brand_journey_events_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brand_stage_data"
    ADD CONSTRAINT "brand_stage_data_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brand_stage_data"
    ADD CONSTRAINT "brand_stage_data_captured_from_message_id_fkey" FOREIGN KEY ("captured_from_message_id") REFERENCES "public"."mentor_messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."brand_stage_progress"
    ADD CONSTRAINT "brand_stage_progress_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brands"
    ADD CONSTRAINT "brands_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calendar_posts"
    ADD CONSTRAINT "calendar_posts_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."calendar_posts"
    ADD CONSTRAINT "calendar_posts_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calendar_posts"
    ADD CONSTRAINT "calendar_posts_content_studio_creative_id_fkey" FOREIGN KEY ("content_studio_creative_id") REFERENCES "public"."content_studio_creatives"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."calendar_posts"
    ADD CONSTRAINT "calendar_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaign_creatives"
    ADD CONSTRAINT "campaign_creatives_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."campaign_creatives"
    ADD CONSTRAINT "campaign_creatives_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_output_id_fkey" FOREIGN KEY ("output_id") REFERENCES "public"."template_outputs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_product_image_id_fkey" FOREIGN KEY ("product_image_id") REFERENCES "public"."project_assets"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_series_runs"
    ADD CONSTRAINT "content_series_runs_brief_id_fkey" FOREIGN KEY ("brief_id") REFERENCES "public"."content_studio_briefs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_studio_briefs"
    ADD CONSTRAINT "content_studio_briefs_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_studio_briefs"
    ADD CONSTRAINT "content_studio_briefs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_studio_creatives"
    ADD CONSTRAINT "content_studio_creatives_brief_id_fkey" FOREIGN KEY ("brief_id") REFERENCES "public"."content_studio_briefs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_studio_creatives"
    ADD CONSTRAINT "content_studio_creatives_calendar_post_id_fkey" FOREIGN KEY ("calendar_post_id") REFERENCES "public"."calendar_posts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."content_studio_creatives"
    ADD CONSTRAINT "content_studio_creatives_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "public"."content_platforms"("id");



ALTER TABLE ONLY "public"."content_studio_creatives"
    ADD CONSTRAINT "content_studio_creatives_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."prostudio_templates"("id");



ALTER TABLE ONLY "public"."creative_versions"
    ADD CONSTRAINT "creative_versions_brief_id_fkey" FOREIGN KEY ("brief_id") REFERENCES "public"."content_studio_briefs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."creative_versions"
    ADD CONSTRAINT "creative_versions_creative_id_fkey" FOREIGN KEY ("creative_id") REFERENCES "public"."content_studio_creatives"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."creative_versions"
    ADD CONSTRAINT "creative_versions_parent_version_id_fkey" FOREIGN KEY ("parent_version_id") REFERENCES "public"."creative_versions"("id");



ALTER TABLE ONLY "public"."creative_versions"
    ADD CONSTRAINT "creative_versions_restored_from_version_id_fkey" FOREIGN KEY ("restored_from_version_id") REFERENCES "public"."creative_versions"("id");



ALTER TABLE ONLY "public"."creative_versions"
    ADD CONSTRAINT "creative_versions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."creator_applications"
    ADD CONSTRAINT "creator_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."creator_profiles"
    ADD CONSTRAINT "creator_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."credit_purchases"
    ADD CONSTRAINT "credit_purchases_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."credit_packages"("id");



ALTER TABLE ONLY "public"."credit_purchases"
    ADD CONSTRAINT "credit_purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."generation_assets"
    ADD CONSTRAINT "generation_assets_generation_id_fkey" FOREIGN KEY ("generation_id") REFERENCES "public"."generations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."generation_billing_events"
    ADD CONSTRAINT "generation_billing_events_generation_id_fkey" FOREIGN KEY ("generation_id") REFERENCES "public"."generations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."generation_billing_events"
    ADD CONSTRAINT "generation_billing_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."generation_billing_events"
    ADD CONSTRAINT "generation_billing_events_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."generations"
    ADD CONSTRAINT "generations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mentor_choice_prompts"
    ADD CONSTRAINT "mentor_choice_prompts_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."mentor_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mentor_choice_prompts"
    ADD CONSTRAINT "mentor_choice_prompts_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."mentor_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mentor_conversations"
    ADD CONSTRAINT "mentor_conversations_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mentor_messages"
    ADD CONSTRAINT "mentor_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."mentor_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."milestones"
    ADD CONSTRAINT "milestones_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."milestones"
    ADD CONSTRAINT "milestones_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."mentor_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."milestones"
    ADD CONSTRAINT "milestones_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."mentor_messages"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_assets"
    ADD CONSTRAINT "project_assets_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_assets"
    ADD CONSTRAINT "project_assets_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."mentor_messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_assets"
    ADD CONSTRAINT "project_assets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."prostudio_templates"
    ADD CONSTRAINT "prostudio_templates_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reel_scenes"
    ADD CONSTRAINT "reel_scenes_reel_id_fkey" FOREIGN KEY ("reel_id") REFERENCES "public"."reels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reels"
    ADD CONSTRAINT "reels_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reels"
    ADD CONSTRAINT "reels_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."prostudio_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reels"
    ADD CONSTRAINT "reels_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stripe_customers"
    ADD CONSTRAINT "stripe_customers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."studio_elements"
    ADD CONSTRAINT "studio_elements_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id");



ALTER TABLE ONLY "public"."studio_elements"
    ADD CONSTRAINT "studio_elements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."studio_sessions"
    ADD CONSTRAINT "studio_sessions_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."studio_sessions"
    ADD CONSTRAINT "studio_sessions_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."studio_sessions"
    ADD CONSTRAINT "studio_sessions_brief_id_fkey" FOREIGN KEY ("brief_id") REFERENCES "public"."content_studio_briefs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."studio_sessions"
    ADD CONSTRAINT "studio_sessions_creative_id_fkey" FOREIGN KEY ("creative_id") REFERENCES "public"."content_studio_creatives"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."studio_sessions"
    ADD CONSTRAINT "studio_sessions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."prostudio_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."studio_sessions"
    ADD CONSTRAINT "studio_sessions_template_output_id_fkey" FOREIGN KEY ("template_output_id") REFERENCES "public"."template_outputs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."studio_sessions"
    ADD CONSTRAINT "studio_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."template_outputs"
    ADD CONSTRAINT "template_outputs_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."template_outputs"
    ADD CONSTRAINT "template_outputs_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."prostudio_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."template_outputs"
    ADD CONSTRAINT "template_outputs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."template_preview_images"
    ADD CONSTRAINT "template_preview_images_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."prostudio_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."template_saves"
    ADD CONSTRAINT "template_saves_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."prostudio_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."template_saves"
    ADD CONSTRAINT "template_saves_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."template_variants"
    ADD CONSTRAINT "template_variants_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."template_variants"
    ADD CONSTRAINT "template_variants_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "public"."content_platforms"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."template_variants"
    ADD CONSTRAINT "template_variants_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."prostudio_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_model_preferences"
    ADD CONSTRAINT "user_model_preferences_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "public"."ai_models"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_model_preferences"
    ADD CONSTRAINT "user_model_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."version_annotations"
    ADD CONSTRAINT "version_annotations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."version_annotations"
    ADD CONSTRAINT "version_annotations_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "public"."creative_versions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."version_snapshots"
    ADD CONSTRAINT "version_snapshots_creative_id_fkey" FOREIGN KEY ("creative_id") REFERENCES "public"."content_studio_creatives"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wallet_transactions"
    ADD CONSTRAINT "wallet_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wallet_transactions"
    ADD CONSTRAINT "wallet_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wallets"
    ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can delete platform settings" ON "public"."platform_settings" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can delete prompts" ON "public"."ai_system_prompts" FOR DELETE USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Admins can delete variants" ON "public"."template_variants" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can insert platform settings" ON "public"."platform_settings" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can insert prompt versions" ON "public"."ai_prompt_versions" FOR INSERT WITH CHECK (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Admins can insert prompts" ON "public"."ai_system_prompts" FOR INSERT WITH CHECK (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Admins can insert variants" ON "public"."template_variants" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can manage all applications" ON "public"."creator_applications" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Admins can manage all models" ON "public"."ai_models" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Admins can manage all providers" ON "public"."ai_providers" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Admins can manage all stages" ON "public"."journey_stages" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Admins can manage all template images" ON "public"."template_preview_images" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Admins can manage all templates" ON "public"."prostudio_templates" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Admins can manage platforms" ON "public"."content_platforms" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can manage stage fields" ON "public"."journey_stage_fields" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Admins can manage task defaults" ON "public"."ai_task_defaults" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Admins can read all errors" ON "public"."app_errors" FOR SELECT USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Admins can read all variants" ON "public"."template_variants" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can read prompt versions" ON "public"."ai_prompt_versions" FOR SELECT USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Admins can select all prompts" ON "public"."ai_system_prompts" FOR SELECT USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Admins can update errors" ON "public"."app_errors" FOR UPDATE USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Admins can update platform settings" ON "public"."platform_settings" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can update prompts" ON "public"."ai_system_prompts" FOR UPDATE USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Admins can update variants" ON "public"."template_variants" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins manage agents" ON "public"."agents" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins manage creator profiles" ON "public"."creator_profiles" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins manage credit packages" ON "public"."credit_packages" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins manage model rates" ON "public"."model_rates" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins manage platform settings" ON "public"."platform_settings" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins manage pricing rules" ON "public"."ai_generation_pricing" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins read all brands" ON "public"."brands" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admins read all creator applications" ON "public"."creator_applications" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admins read all errors" ON "public"."app_errors" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admins read all profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admins read all purchases" ON "public"."credit_purchases" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admins read all template preview images" ON "public"."template_preview_images" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admins read all templates" ON "public"."prostudio_templates" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admins read all transactions" ON "public"."wallet_transactions" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admins read all usage" ON "public"."ai_usage_log" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admins read all wallets" ON "public"."wallets" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admins update all profiles" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins update all templates" ON "public"."prostudio_templates" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins update creator applications" ON "public"."creator_applications" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins update errors" ON "public"."app_errors" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Anyone can read active credit packages" ON "public"."credit_packages" FOR SELECT USING (("active" = true));



CREATE POLICY "Anyone can view active platforms" ON "public"."content_platforms" FOR SELECT TO "authenticated" USING (("is_active" = true));



CREATE POLICY "Anyone can view approved creator profiles" ON "public"."creator_profiles" FOR SELECT USING (("is_approved" = true));



CREATE POLICY "Anyone can view images of published templates" ON "public"."template_preview_images" FOR SELECT USING (("template_id" IN ( SELECT "prostudio_templates"."id"
   FROM "public"."prostudio_templates"
  WHERE ("prostudio_templates"."status" = 'published'::"text"))));



CREATE POLICY "Anyone can view published templates" ON "public"."prostudio_templates" FOR SELECT USING (("status" = 'published'::"text"));



CREATE POLICY "Authenticated users can read active prompts" ON "public"."ai_system_prompts" FOR SELECT USING ((("auth"."role"() = 'authenticated'::"text") AND ("is_active" = true)));



CREATE POLICY "Authenticated users can read active stages" ON "public"."journey_stages" FOR SELECT USING ((("auth"."role"() = 'authenticated'::"text") AND ("is_active" = true)));



CREATE POLICY "Authenticated users can read active variants" ON "public"."template_variants" FOR SELECT TO "authenticated" USING (("status" = 'active'::"text"));



CREATE POLICY "Authenticated users can read enabled models" ON "public"."ai_models" FOR SELECT USING ((("auth"."role"() = 'authenticated'::"text") AND ("is_enabled" = true)));



CREATE POLICY "Authenticated users can read enabled providers" ON "public"."ai_providers" FOR SELECT USING ((("auth"."role"() = 'authenticated'::"text") AND ("is_enabled" = true)));



CREATE POLICY "Authenticated users can read model rates" ON "public"."model_rates" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read platform settings" ON "public"."platform_settings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read pricing" ON "public"."ai_generation_pricing" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read stage fields" ON "public"."journey_stage_fields" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can read task defaults" ON "public"."ai_task_defaults" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users read active agents" ON "public"."agents" FOR SELECT TO "authenticated" USING (("is_active" OR "public"."is_admin"()));



CREATE POLICY "Authenticated users read platform settings" ON "public"."platform_settings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users read pricing rules" ON "public"."ai_generation_pricing" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Creators can insert variants for own templates" ON "public"."template_variants" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."prostudio_templates" "t"
  WHERE (("t"."id" = "template_variants"."template_id") AND ("t"."creator_id" = "auth"."uid"())))));



CREATE POLICY "Creators can manage own creator profile" ON "public"."creator_profiles" USING (("auth"."uid"() = "id"));



CREATE POLICY "Creators can manage own template images" ON "public"."template_preview_images" USING (("template_id" IN ( SELECT "prostudio_templates"."id"
   FROM "public"."prostudio_templates"
  WHERE ("prostudio_templates"."creator_id" = "auth"."uid"()))));



CREATE POLICY "Creators can manage own templates" ON "public"."prostudio_templates" USING ((("auth"."uid"() = "creator_id") AND ("auth"."uid"() IN ( SELECT "creator_profiles"."id"
   FROM "public"."creator_profiles"
  WHERE ("creator_profiles"."is_approved" = true)))));



CREATE POLICY "Creators can update variants for own templates" ON "public"."template_variants" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."prostudio_templates" "t"
  WHERE (("t"."id" = "template_variants"."template_id") AND ("t"."creator_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."prostudio_templates" "t"
  WHERE (("t"."id" = "template_variants"."template_id") AND ("t"."creator_id" = "auth"."uid"())))));



CREATE POLICY "Everyone can view public elements" ON "public"."studio_elements" FOR SELECT TO "authenticated" USING ((("is_public" = true) OR ("created_by" = "auth"."uid"())));



CREATE POLICY "Owners manage their approvals" ON "public"."approvals" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Owners manage their automations" ON "public"."automations" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Owners manage their hires" ON "public"."agent_hires" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Owners manage their run steps" ON "public"."automation_run_steps" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."automation_runs" "r"
  WHERE (("r"."id" = "automation_run_steps"."run_id") AND ("r"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."automation_runs" "r"
  WHERE (("r"."id" = "automation_run_steps"."run_id") AND ("r"."user_id" = "auth"."uid"())))));



CREATE POLICY "Owners manage their runs" ON "public"."automation_runs" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Service role manages pricing" ON "public"."ai_generation_pricing" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Users can create versions for their creatives" ON "public"."creative_versions" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM ("public"."content_studio_creatives" "c"
     JOIN "public"."content_studio_briefs" "b" ON (("c"."brief_id" = "b"."id")))
  WHERE (("c"."id" = "creative_versions"."creative_id") AND ("b"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can delete their own template outputs" ON "public"."template_outputs" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert their own elements" ON "public"."studio_elements" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "Users can insert their own template outputs" ON "public"."template_outputs" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can log own errors" ON "public"."app_errors" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own applications" ON "public"."creator_applications" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own assets" ON "public"."assets" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own brand DNA" ON "public"."brand_dna" USING (("auth"."uid"() = ( SELECT "brands"."user_id"
   FROM "public"."brands"
  WHERE ("brands"."id" = "brand_dna"."brand_id"))));



CREATE POLICY "Users can manage own brands" ON "public"."brands" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own calendar posts" ON "public"."calendar_posts" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own campaign creatives" ON "public"."campaign_creatives" USING (("auth"."uid"() = ( SELECT "campaigns"."user_id"
   FROM "public"."campaigns"
  WHERE ("campaigns"."id" = "campaign_creatives"."campaign_id"))));



CREATE POLICY "Users can manage own campaigns" ON "public"."campaigns" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own choice prompts" ON "public"."mentor_choice_prompts" USING (("auth"."uid"() = ( SELECT "b"."user_id"
   FROM ("public"."mentor_conversations" "mc"
     JOIN "public"."brands" "b" ON (("b"."id" = "mc"."brand_id")))
  WHERE ("mc"."id" = "mentor_choice_prompts"."conversation_id"))));



CREATE POLICY "Users can manage own conversations" ON "public"."mentor_conversations" USING (("auth"."uid"() = ( SELECT "brands"."user_id"
   FROM "public"."brands"
  WHERE ("brands"."id" = "mentor_conversations"."brand_id"))));



CREATE POLICY "Users can manage own custom DNA fields" ON "public"."brand_dna_custom_fields" USING (("auth"."uid"() = ( SELECT "brands"."user_id"
   FROM "public"."brands"
  WHERE ("brands"."id" = "brand_dna_custom_fields"."brand_id"))));



CREATE POLICY "Users can manage own documents" ON "public"."documents" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own journey events" ON "public"."brand_journey_events" USING (("auth"."uid"() = ( SELECT "brands"."user_id"
   FROM "public"."brands"
  WHERE ("brands"."id" = "brand_journey_events"."brand_id"))));



CREATE POLICY "Users can manage own messages" ON "public"."mentor_messages" USING (("auth"."uid"() = ( SELECT "b"."user_id"
   FROM ("public"."mentor_conversations" "mc"
     JOIN "public"."brands" "b" ON (("b"."id" = "mc"."brand_id")))
  WHERE ("mc"."id" = "mentor_messages"."conversation_id"))));



CREATE POLICY "Users can manage own milestones" ON "public"."milestones" USING (("auth"."uid"() = ( SELECT "brands"."user_id"
   FROM "public"."brands"
  WHERE ("brands"."id" = "milestones"."brand_id"))));



CREATE POLICY "Users can manage own outputs" ON "public"."template_outputs" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own preferences" ON "public"."user_model_preferences" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own project assets" ON "public"."project_assets" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own reel scenes" ON "public"."reel_scenes" USING (("auth"."uid"() = ( SELECT "reels"."user_id"
   FROM "public"."reels"
  WHERE ("reels"."id" = "reel_scenes"."reel_id"))));



CREATE POLICY "Users can manage own reels" ON "public"."reels" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own saves" ON "public"."template_saves" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own stage data" ON "public"."brand_stage_data" USING (("auth"."uid"() = ( SELECT "brands"."user_id"
   FROM "public"."brands"
  WHERE ("brands"."id" = "brand_stage_data"."brand_id"))));



CREATE POLICY "Users can manage own stage progress" ON "public"."brand_stage_progress" USING (("auth"."uid"() = ( SELECT "brands"."user_id"
   FROM "public"."brands"
  WHERE ("brands"."id" = "brand_stage_progress"."brand_id"))));



CREATE POLICY "Users can manage their annotations" ON "public"."version_annotations" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage their own studio sessions" ON "public"."studio_sessions" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own template outputs" ON "public"."template_outputs" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their version names" ON "public"."creative_versions" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own application" ON "public"."creator_applications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view snapshots for their creatives" ON "public"."version_snapshots" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."content_studio_creatives" "c"
     JOIN "public"."content_studio_briefs" "b" ON (("c"."brief_id" = "b"."id")))
  WHERE (("c"."id" = "version_snapshots"."creative_id") AND ("b"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view their creative versions" ON "public"."creative_versions" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM ("public"."content_studio_creatives" "c"
     JOIN "public"."content_studio_briefs" "b" ON (("c"."brief_id" = "b"."id")))
  WHERE (("c"."id" = "creative_versions"."creative_id") AND ("b"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view their own template outputs" ON "public"."template_outputs" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users insert own errors" ON "public"."app_errors" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" IS NULL) OR ("user_id" = "auth"."uid"())));



CREATE POLICY "Users manage their own briefs" ON "public"."content_studio_briefs" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users manage their own campaign creatives" ON "public"."campaign_creatives" TO "authenticated" USING (("campaign_id" IN ( SELECT "campaigns"."id"
   FROM "public"."campaigns"
  WHERE ("campaigns"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users manage their own campaigns" ON "public"."campaigns" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users manage their own creatives" ON "public"."content_studio_creatives" TO "authenticated" USING (("brief_id" IN ( SELECT "content_studio_briefs"."id"
   FROM "public"."content_studio_briefs"
  WHERE ("content_studio_briefs"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users manage their own notifications" ON "public"."notifications" TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users read own generations" ON "public"."generations" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users read own purchases" ON "public"."credit_purchases" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users read own stripe customer" ON "public"."stripe_customers" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users read own transactions" ON "public"."wallet_transactions" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users read own usage" ON "public"."ai_usage_log" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users read own wallet" ON "public"."wallets" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users view their own series runs" ON "public"."content_series_runs" FOR SELECT TO "authenticated" USING (("brief_id" IN ( SELECT "content_studio_briefs"."id"
   FROM "public"."content_studio_briefs"
  WHERE ("content_studio_briefs"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."agent_hires" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_generation_pricing" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_models" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_prompt_versions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_provider_secrets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_providers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_system_prompts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_task_defaults" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_usage_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."app_errors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."approvals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."assets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."automation_run_steps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."automation_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."automations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."brand_dna" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."brand_dna_custom_fields" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."brand_journey_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."brand_stage_data" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."brand_stage_progress" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."brands" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."calendar_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campaign_creatives" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campaigns" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."content_platforms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."content_series_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."content_studio_briefs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."content_studio_creatives" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."creative_versions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."creator_applications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."creator_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."credit_packages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."credit_purchases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generation_assets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generation_billing_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."journey_stage_fields" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."journey_stages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mentor_choice_prompts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mentor_conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mentor_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."milestones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."model_rates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_assets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."prostudio_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reel_scenes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stripe_customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."studio_elements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."studio_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."template_outputs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."template_preview_images" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."template_saves" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."template_variants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_model_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."version_annotations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."version_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wallet_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wallets" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."add_credits"("p_user_id" "uuid", "p_amount" numeric, "p_type" "text", "p_description" "text", "p_reference_id" "uuid", "p_reference_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."add_credits"("p_user_id" "uuid", "p_amount" numeric, "p_type" "text", "p_description" "text", "p_reference_id" "uuid", "p_reference_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_credits"("p_user_id" "uuid", "p_amount" numeric, "p_type" "text", "p_description" "text", "p_reference_id" "uuid", "p_reference_type" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."add_generation_provider_cost"("p_generation_id" "uuid", "p_cost_usd" numeric, "p_provider" "text", "p_model" "text", "p_usage" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_generation_provider_cost"("p_generation_id" "uuid", "p_cost_usd" numeric, "p_provider" "text", "p_model" "text", "p_usage" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."add_generation_provider_cost"("p_generation_id" "uuid", "p_cost_usd" numeric, "p_provider" "text", "p_model" "text", "p_usage" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_generation_provider_cost"("p_generation_id" "uuid", "p_cost_usd" numeric, "p_provider" "text", "p_model" "text", "p_usage" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_cogs_daily"("p_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_cogs_daily"("p_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_cogs_daily"("p_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_provider_key_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."admin_provider_key_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_provider_key_status"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_set_provider_api_key"("p_provider_id" "uuid", "p_api_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_set_provider_api_key"("p_provider_id" "uuid", "p_api_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_set_provider_api_key"("p_provider_id" "uuid", "p_api_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_set_provider_api_key"("p_provider_id" "uuid", "p_api_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."approve_creator"("application_id" "uuid", "admin_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_creator"("application_id" "uuid", "admin_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_creator"("application_id" "uuid", "admin_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."block_api_key_on_ai_providers"() TO "anon";
GRANT ALL ON FUNCTION "public"."block_api_key_on_ai_providers"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."block_api_key_on_ai_providers"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_version_diff"("p_from_version_id" "uuid", "p_to_version_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_version_diff"("p_from_version_id" "uuid", "p_to_version_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_version_diff"("p_from_version_id" "uuid", "p_to_version_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."capture_reserved_credits"("p_generation_id" "uuid", "p_capture_amount" numeric, "p_ai_provider" "text", "p_ai_model" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."capture_reserved_credits"("p_generation_id" "uuid", "p_capture_amount" numeric, "p_ai_provider" "text", "p_ai_model" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."capture_reserved_credits"("p_generation_id" "uuid", "p_capture_amount" numeric, "p_ai_provider" "text", "p_ai_model" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_free_trial_credits"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_free_trial_credits"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_free_trial_credits"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."enqueue_due_automations"("p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enqueue_due_automations"("p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."enqueue_due_automations"("p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."enqueue_due_automations"("p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."expire_stale_reservations"("p_max_age_minutes" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."expire_stale_reservations"("p_max_age_minutes" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."expire_stale_reservations"("p_max_age_minutes" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."finalize_generation_billing"("p_generation_id" "uuid", "p_status" "text", "p_provider_cost_usd" numeric, "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."finalize_generation_billing"("p_generation_id" "uuid", "p_status" "text", "p_provider_cost_usd" numeric, "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."finalize_generation_billing"("p_generation_id" "uuid", "p_status" "text", "p_provider_cost_usd" numeric, "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."finalize_generation_billing"("p_generation_id" "uuid", "p_status" "text", "p_provider_cost_usd" numeric, "p_credits_finalized" integer, "p_ai_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."finalize_generation_billing"("p_generation_id" "uuid", "p_status" "text", "p_provider_cost_usd" numeric, "p_credits_finalized" integer, "p_ai_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."finalize_generation_billing"("p_generation_id" "uuid", "p_status" "text", "p_provider_cost_usd" numeric, "p_credits_finalized" integer, "p_ai_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."fulfill_credit_purchase"("p_purchase_id" "uuid", "p_user_id" "uuid", "p_credits_amount" numeric, "p_stripe_payment_intent_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fulfill_credit_purchase"("p_purchase_id" "uuid", "p_user_id" "uuid", "p_credits_amount" numeric, "p_stripe_payment_intent_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fulfill_credit_purchase"("p_purchase_id" "uuid", "p_user_id" "uuid", "p_credits_amount" numeric, "p_stripe_payment_intent_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_current_version"("p_creative_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_current_version"("p_creative_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_version"("p_creative_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_next_version_number"("p_creative_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_next_version_number"("p_creative_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_next_version_number"("p_creative_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_version_lineage"("p_version_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_version_lineage"("p_version_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_version_lineage"("p_version_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_wallet_balance"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_wallet_balance"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_wallet_balance"("p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."grant_credits_admin"("p_user_id" "uuid", "p_amount" numeric, "p_type" "text", "p_description" "text", "p_admin_user_id" "uuid", "p_idempotency_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."grant_credits_admin"("p_user_id" "uuid", "p_amount" numeric, "p_type" "text", "p_description" "text", "p_admin_user_id" "uuid", "p_idempotency_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."grant_credits_admin"("p_user_id" "uuid", "p_amount" numeric, "p_type" "text", "p_description" "text", "p_admin_user_id" "uuid", "p_idempotency_key" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."grant_credits_internal"("p_user_id" "uuid", "p_amount" numeric, "p_type" "text", "p_description" "text", "p_admin_user_id" "uuid", "p_idempotency_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."grant_credits_internal"("p_user_id" "uuid", "p_amount" numeric, "p_type" "text", "p_description" "text", "p_admin_user_id" "uuid", "p_idempotency_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment"("x" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."increment"("x" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment"("x" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_previous_versions_not_current"() TO "anon";
GRANT ALL ON FUNCTION "public"."mark_previous_versions_not_current"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_previous_versions_not_current"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prune_old_versions"("p_creative_id" "uuid", "p_keep_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."prune_old_versions"("p_creative_id" "uuid", "p_keep_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."prune_old_versions"("p_creative_id" "uuid", "p_keep_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."reject_creator"("application_id" "uuid", "admin_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."reject_creator"("application_id" "uuid", "admin_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_creator"("application_id" "uuid", "admin_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."release_reserved_credits"("p_generation_id" "uuid", "p_reason" "text", "p_release_amount" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."release_reserved_credits"("p_generation_id" "uuid", "p_reason" "text", "p_release_amount" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."release_reserved_credits"("p_generation_id" "uuid", "p_reason" "text", "p_release_amount" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."reserve_generation_credits"("p_user_id" "uuid", "p_credits" numeric, "p_generation_id" "uuid", "p_platform" "text", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."reserve_generation_credits"("p_user_id" "uuid", "p_credits" numeric, "p_generation_id" "uuid", "p_platform" "text", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reserve_generation_credits"("p_user_id" "uuid", "p_credits" numeric, "p_generation_id" "uuid", "p_platform" "text", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_template_variants_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_template_variants_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_template_variants_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_creator_flag"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_creator_flag"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_creator_flag"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_generation_status"("p_generation_id" "uuid", "p_new_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_generation_status"("p_generation_id" "uuid", "p_new_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_generation_status"("p_generation_id" "uuid", "p_new_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON TABLE "public"."agent_hires" TO "anon";
GRANT ALL ON TABLE "public"."agent_hires" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_hires" TO "service_role";



GRANT ALL ON TABLE "public"."agents" TO "anon";
GRANT ALL ON TABLE "public"."agents" TO "authenticated";
GRANT ALL ON TABLE "public"."agents" TO "service_role";



GRANT ALL ON TABLE "public"."ai_generation_pricing" TO "anon";
GRANT ALL ON TABLE "public"."ai_generation_pricing" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_generation_pricing" TO "service_role";



GRANT ALL ON TABLE "public"."ai_models" TO "anon";
GRANT ALL ON TABLE "public"."ai_models" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_models" TO "service_role";



GRANT ALL ON TABLE "public"."ai_prompt_versions" TO "anon";
GRANT ALL ON TABLE "public"."ai_prompt_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_prompt_versions" TO "service_role";



GRANT ALL ON TABLE "public"."ai_provider_secrets" TO "anon";
GRANT ALL ON TABLE "public"."ai_provider_secrets" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_provider_secrets" TO "service_role";



GRANT ALL ON TABLE "public"."ai_providers" TO "anon";
GRANT ALL ON TABLE "public"."ai_providers" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_providers" TO "service_role";



GRANT ALL ON TABLE "public"."ai_system_prompts" TO "anon";
GRANT ALL ON TABLE "public"."ai_system_prompts" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_system_prompts" TO "service_role";



GRANT ALL ON TABLE "public"."ai_task_defaults" TO "anon";
GRANT ALL ON TABLE "public"."ai_task_defaults" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_task_defaults" TO "service_role";



GRANT ALL ON TABLE "public"."ai_usage_log" TO "anon";
GRANT ALL ON TABLE "public"."ai_usage_log" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_usage_log" TO "service_role";



GRANT ALL ON TABLE "public"."app_errors" TO "anon";
GRANT ALL ON TABLE "public"."app_errors" TO "authenticated";
GRANT ALL ON TABLE "public"."app_errors" TO "service_role";



GRANT ALL ON TABLE "public"."approvals" TO "anon";
GRANT ALL ON TABLE "public"."approvals" TO "authenticated";
GRANT ALL ON TABLE "public"."approvals" TO "service_role";



GRANT ALL ON TABLE "public"."assets" TO "anon";
GRANT ALL ON TABLE "public"."assets" TO "authenticated";
GRANT ALL ON TABLE "public"."assets" TO "service_role";



GRANT ALL ON TABLE "public"."automation_run_steps" TO "anon";
GRANT ALL ON TABLE "public"."automation_run_steps" TO "authenticated";
GRANT ALL ON TABLE "public"."automation_run_steps" TO "service_role";



GRANT ALL ON TABLE "public"."automation_runs" TO "anon";
GRANT ALL ON TABLE "public"."automation_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."automation_runs" TO "service_role";



GRANT ALL ON TABLE "public"."automations" TO "anon";
GRANT ALL ON TABLE "public"."automations" TO "authenticated";
GRANT ALL ON TABLE "public"."automations" TO "service_role";



GRANT ALL ON TABLE "public"."brand_dna" TO "anon";
GRANT ALL ON TABLE "public"."brand_dna" TO "authenticated";
GRANT ALL ON TABLE "public"."brand_dna" TO "service_role";



GRANT ALL ON TABLE "public"."brand_dna_custom_fields" TO "anon";
GRANT ALL ON TABLE "public"."brand_dna_custom_fields" TO "authenticated";
GRANT ALL ON TABLE "public"."brand_dna_custom_fields" TO "service_role";



GRANT ALL ON TABLE "public"."brand_journey_events" TO "anon";
GRANT ALL ON TABLE "public"."brand_journey_events" TO "authenticated";
GRANT ALL ON TABLE "public"."brand_journey_events" TO "service_role";



GRANT ALL ON TABLE "public"."brand_stage_data" TO "anon";
GRANT ALL ON TABLE "public"."brand_stage_data" TO "authenticated";
GRANT ALL ON TABLE "public"."brand_stage_data" TO "service_role";



GRANT ALL ON TABLE "public"."brand_stage_progress" TO "anon";
GRANT ALL ON TABLE "public"."brand_stage_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."brand_stage_progress" TO "service_role";



GRANT ALL ON TABLE "public"."brands" TO "anon";
GRANT ALL ON TABLE "public"."brands" TO "authenticated";
GRANT ALL ON TABLE "public"."brands" TO "service_role";



GRANT ALL ON TABLE "public"."calendar_posts" TO "anon";
GRANT ALL ON TABLE "public"."calendar_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."calendar_posts" TO "service_role";



GRANT ALL ON TABLE "public"."campaign_creatives" TO "anon";
GRANT ALL ON TABLE "public"."campaign_creatives" TO "authenticated";
GRANT ALL ON TABLE "public"."campaign_creatives" TO "service_role";



GRANT ALL ON TABLE "public"."campaigns" TO "anon";
GRANT ALL ON TABLE "public"."campaigns" TO "authenticated";
GRANT ALL ON TABLE "public"."campaigns" TO "service_role";



GRANT ALL ON TABLE "public"."content_platforms" TO "anon";
GRANT ALL ON TABLE "public"."content_platforms" TO "authenticated";
GRANT ALL ON TABLE "public"."content_platforms" TO "service_role";



GRANT ALL ON TABLE "public"."content_series_runs" TO "anon";
GRANT ALL ON TABLE "public"."content_series_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."content_series_runs" TO "service_role";



GRANT ALL ON TABLE "public"."content_studio_briefs" TO "anon";
GRANT ALL ON TABLE "public"."content_studio_briefs" TO "authenticated";
GRANT ALL ON TABLE "public"."content_studio_briefs" TO "service_role";



GRANT ALL ON TABLE "public"."content_studio_creatives" TO "anon";
GRANT ALL ON TABLE "public"."content_studio_creatives" TO "authenticated";
GRANT ALL ON TABLE "public"."content_studio_creatives" TO "service_role";



GRANT ALL ON TABLE "public"."creative_versions" TO "anon";
GRANT ALL ON TABLE "public"."creative_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."creative_versions" TO "service_role";



GRANT ALL ON TABLE "public"."creator_applications" TO "anon";
GRANT ALL ON TABLE "public"."creator_applications" TO "authenticated";
GRANT ALL ON TABLE "public"."creator_applications" TO "service_role";



GRANT ALL ON TABLE "public"."creator_profiles" TO "anon";
GRANT ALL ON TABLE "public"."creator_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."creator_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."credit_packages" TO "anon";
GRANT ALL ON TABLE "public"."credit_packages" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_packages" TO "service_role";



GRANT ALL ON TABLE "public"."credit_purchases" TO "anon";
GRANT ALL ON TABLE "public"."credit_purchases" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_purchases" TO "service_role";



GRANT ALL ON TABLE "public"."documents" TO "anon";
GRANT ALL ON TABLE "public"."documents" TO "authenticated";
GRANT ALL ON TABLE "public"."documents" TO "service_role";



GRANT ALL ON TABLE "public"."generation_assets" TO "anon";
GRANT ALL ON TABLE "public"."generation_assets" TO "authenticated";
GRANT ALL ON TABLE "public"."generation_assets" TO "service_role";



GRANT ALL ON TABLE "public"."generation_billing_events" TO "anon";
GRANT ALL ON TABLE "public"."generation_billing_events" TO "authenticated";
GRANT ALL ON TABLE "public"."generation_billing_events" TO "service_role";



GRANT ALL ON TABLE "public"."generations" TO "anon";
GRANT ALL ON TABLE "public"."generations" TO "authenticated";
GRANT ALL ON TABLE "public"."generations" TO "service_role";



GRANT ALL ON TABLE "public"."journey_stage_fields" TO "anon";
GRANT ALL ON TABLE "public"."journey_stage_fields" TO "authenticated";
GRANT ALL ON TABLE "public"."journey_stage_fields" TO "service_role";



GRANT ALL ON TABLE "public"."journey_stages" TO "anon";
GRANT ALL ON TABLE "public"."journey_stages" TO "authenticated";
GRANT ALL ON TABLE "public"."journey_stages" TO "service_role";



GRANT ALL ON TABLE "public"."mentor_choice_prompts" TO "anon";
GRANT ALL ON TABLE "public"."mentor_choice_prompts" TO "authenticated";
GRANT ALL ON TABLE "public"."mentor_choice_prompts" TO "service_role";



GRANT ALL ON TABLE "public"."mentor_conversations" TO "anon";
GRANT ALL ON TABLE "public"."mentor_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."mentor_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."mentor_messages" TO "anon";
GRANT ALL ON TABLE "public"."mentor_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."mentor_messages" TO "service_role";



GRANT ALL ON TABLE "public"."milestones" TO "anon";
GRANT ALL ON TABLE "public"."milestones" TO "authenticated";
GRANT ALL ON TABLE "public"."milestones" TO "service_role";



GRANT ALL ON TABLE "public"."model_rates" TO "anon";
GRANT ALL ON TABLE "public"."model_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."model_rates" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."platform_settings" TO "anon";
GRANT ALL ON TABLE "public"."platform_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_settings" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."project_assets" TO "anon";
GRANT ALL ON TABLE "public"."project_assets" TO "authenticated";
GRANT ALL ON TABLE "public"."project_assets" TO "service_role";



GRANT ALL ON TABLE "public"."prostudio_templates" TO "anon";
GRANT ALL ON TABLE "public"."prostudio_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."prostudio_templates" TO "service_role";



GRANT ALL ON TABLE "public"."reel_scenes" TO "anon";
GRANT ALL ON TABLE "public"."reel_scenes" TO "authenticated";
GRANT ALL ON TABLE "public"."reel_scenes" TO "service_role";



GRANT ALL ON TABLE "public"."reels" TO "anon";
GRANT ALL ON TABLE "public"."reels" TO "authenticated";
GRANT ALL ON TABLE "public"."reels" TO "service_role";



GRANT ALL ON TABLE "public"."stripe_customers" TO "anon";
GRANT ALL ON TABLE "public"."stripe_customers" TO "authenticated";
GRANT ALL ON TABLE "public"."stripe_customers" TO "service_role";



GRANT ALL ON TABLE "public"."studio_elements" TO "anon";
GRANT ALL ON TABLE "public"."studio_elements" TO "authenticated";
GRANT ALL ON TABLE "public"."studio_elements" TO "service_role";



GRANT ALL ON TABLE "public"."studio_sessions" TO "anon";
GRANT ALL ON TABLE "public"."studio_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."studio_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."template_outputs" TO "anon";
GRANT ALL ON TABLE "public"."template_outputs" TO "authenticated";
GRANT ALL ON TABLE "public"."template_outputs" TO "service_role";



GRANT ALL ON TABLE "public"."template_preview_images" TO "anon";
GRANT ALL ON TABLE "public"."template_preview_images" TO "authenticated";
GRANT ALL ON TABLE "public"."template_preview_images" TO "service_role";



GRANT ALL ON TABLE "public"."template_saves" TO "anon";
GRANT ALL ON TABLE "public"."template_saves" TO "authenticated";
GRANT ALL ON TABLE "public"."template_saves" TO "service_role";



GRANT ALL ON TABLE "public"."template_variants" TO "anon";
GRANT ALL ON TABLE "public"."template_variants" TO "authenticated";
GRANT ALL ON TABLE "public"."template_variants" TO "service_role";



GRANT ALL ON TABLE "public"."user_model_preferences" TO "anon";
GRANT ALL ON TABLE "public"."user_model_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_model_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."version_annotations" TO "anon";
GRANT ALL ON TABLE "public"."version_annotations" TO "authenticated";
GRANT ALL ON TABLE "public"."version_annotations" TO "service_role";



GRANT ALL ON TABLE "public"."version_history_view" TO "anon";
GRANT ALL ON TABLE "public"."version_history_view" TO "authenticated";
GRANT ALL ON TABLE "public"."version_history_view" TO "service_role";



GRANT ALL ON TABLE "public"."version_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."version_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."version_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."wallets" TO "anon";
GRANT ALL ON TABLE "public"."wallets" TO "authenticated";
GRANT ALL ON TABLE "public"."wallets" TO "service_role";



GRANT ALL ON TABLE "public"."wallet_balances" TO "anon";
GRANT ALL ON TABLE "public"."wallet_balances" TO "authenticated";
GRANT ALL ON TABLE "public"."wallet_balances" TO "service_role";



GRANT ALL ON TABLE "public"."wallet_transactions" TO "anon";
GRANT ALL ON TABLE "public"."wallet_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."wallet_transactions" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







