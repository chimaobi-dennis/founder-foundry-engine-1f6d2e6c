-- Kinika · Step 5 (billing capture fix, agent stats, fast-tier rate) — paste into Supabase → SQL Editor → Run.
-- Safe to run more than once. No function redeploys.
-- After running: Admin > Billing > Pricing, check the Gemini 3 Flash rate (it is an estimate).

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 5 — a billing fix found by the new billing tests, and agent stats
--
-- 1. capture_reserved_credits() moved a generation to 'ai_called' on the first
--    capture and then refused every later one (INVALID_STATE). Runs capture
--    once per paid step, so a hive, a Developer run or any multi-step run
--    could only ever bill its first step. 'ai_called' is now a valid state to
--    capture from; ALREADY_CAPTURED still stops over-capture.
-- 2. admin_agent_stats(): per-agent and per-action-class run counts, failure
--    rate, cost and step latency for the admin billing page, plus a list of
--    models that served calls but have no rate (their cost logs as $0).
-- 3. A rate for gemini-3-flash-preview, the model behind the fast tier. It had
--    none, so every fast-tier call was logged at $0 and the margin view read
--    100%. The figure is an ESTIMATE: check it against Google's published
--    pricing and edit it under Admin > Billing > Pricing.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.capture_reserved_credits(p_generation_id uuid, p_capture_amount numeric DEFAULT NULL::numeric, p_ai_provider text DEFAULT NULL::text, p_ai_model text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- 'ai_called' is what a generation becomes after its first capture; a run
  -- with several paid steps captures from it again.
  IF v_gen.status NOT IN ('reserved', 'queued', 'processing', 'ai_called') THEN
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

  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_gen.user_id FOR UPDATE;

  v_bal_before := v_wallet.balance;
  v_bal_after := v_wallet.balance - v_capture;
  v_res_before := v_wallet.reserved_balance;
  v_res_after := v_wallet.reserved_balance - v_capture;

  UPDATE public.wallets
  SET balance = v_bal_after,
      reserved_balance = v_res_after,
      lifetime_spent = lifetime_spent + v_capture,
      updated_at = now()
  WHERE id = v_wallet.id;

  UPDATE public.generations
  SET credits_captured = credits_captured + v_capture,
      status = 'ai_called',
      ai_started_at = COALESCE(ai_started_at, now()),
      provider = COALESCE(p_ai_provider, provider),
      provider_model = COALESCE(p_ai_model, provider_model),
      updated_at = now()
  WHERE id = p_generation_id;

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
$function$;

-- ── Agent stats (admin only) ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_agent_stats(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_since timestamptz := now() - make_interval(days => GREATEST(p_days, 1));
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'NOT_ALLOWED' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN jsonb_build_object(
    'agents', COALESCE((
      SELECT jsonb_agg(row_to_json(a) ORDER BY a.runs DESC) FROM (
        SELECT
          COALESCE(ag.slug, 'unknown') AS slug,
          COALESCE(ag.name, 'Unknown') AS name,
          count(DISTINCT r.id) AS runs,
          count(DISTINCT r.id) FILTER (WHERE r.status = 'completed') AS completed,
          count(DISTINCT r.id) FILTER (WHERE r.status = 'failed') AS failed,
          count(DISTINCT r.id) FILTER (WHERE r.status IN ('cancelled')) AS cancelled,
          count(DISTINCT r.id) FILTER (WHERE r.status = 'paused') AS paused,
          COALESCE(sum(s.credits_captured), 0) AS credits_captured,
          COALESCE(sum(s.cost_usd), 0) AS cost_usd,
          avg(EXTRACT(EPOCH FROM (s.finished_at - s.started_at))) FILTER (WHERE s.finished_at IS NOT NULL AND s.started_at IS NOT NULL AND s.type = 'agent_task') AS avg_step_seconds
        FROM public.automation_runs r
        LEFT JOIN public.agents ag ON ag.id = r.agent_id
        LEFT JOIN public.automation_run_steps s ON s.run_id = r.id
        WHERE r.created_at >= v_since
        GROUP BY ag.slug, ag.name
      ) a
    ), '[]'::jsonb),
    'action_classes', COALESCE((
      SELECT jsonb_agg(row_to_json(c) ORDER BY c.steps DESC) FROM (
        SELECT
          COALESCE(s.input ->> 'action_class', 'unclassified') AS action_class,
          count(*) AS steps,
          count(*) FILTER (WHERE s.status = 'failed') AS failed,
          avg(EXTRACT(EPOCH FROM (s.finished_at - s.started_at))) FILTER (WHERE s.finished_at IS NOT NULL AND s.started_at IS NOT NULL) AS avg_seconds,
          percentile_cont(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (s.finished_at - s.started_at))) FILTER (WHERE s.finished_at IS NOT NULL AND s.started_at IS NOT NULL) AS p95_seconds
        FROM public.automation_run_steps s
        JOIN public.automation_runs r ON r.id = s.run_id
        WHERE r.created_at >= v_since AND s.status IN ('done', 'failed')
        GROUP BY COALESCE(s.input ->> 'action_class', 'unclassified')
      ) c
    ), '[]'::jsonb),
    'unrated_models', COALESCE((
      SELECT jsonb_agg(row_to_json(m)) FROM (
        SELECT u.provider_slug, u.model_id, count(*) AS calls
        FROM public.ai_usage_log u
        WHERE u.created_at >= v_since AND u.success AND (u.input_tokens + u.output_tokens) > 0
          AND NOT EXISTS (SELECT 1 FROM public.model_rates r WHERE r.provider_slug = u.provider_slug AND r.model_id = u.model_id AND r.is_active)
        GROUP BY u.provider_slug, u.model_id
      ) m
    ), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_agent_stats(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_agent_stats(integer) TO authenticated;

-- ── A rate for the fast-tier model (estimate; verify and edit in Admin) ─────

INSERT INTO public.model_rates (provider_slug, model_id, display_name, input_per_1m, output_per_1m, is_active, source)
VALUES ('google-ai-studio', 'gemini-3-flash-preview', 'Gemini 3 Flash (preview)', 0.5000, 3.0000, true, 'estimate: verify against Google AI pricing')
ON CONFLICT (provider_slug, model_id) DO NOTHING;

-- Price the calls already logged at $0 for want of a rate (tokens x rate only;
-- credits_equivalent is left alone).
UPDATE public.ai_usage_log u
SET cost_usd = round((((u.input_tokens - u.cache_read_tokens) * r.input_per_1m
                     + u.cache_read_tokens * COALESCE(r.cache_read_per_1m, r.input_per_1m)
                     + u.cache_write_tokens * COALESCE(r.cache_write_per_1m, r.input_per_1m)
                     + u.output_tokens * r.output_per_1m) / 1000000.0)::numeric, 6)
FROM public.model_rates r
WHERE r.provider_slug = u.provider_slug AND r.model_id = u.model_id AND r.is_active
  AND u.cost_usd = 0 AND (u.input_tokens + u.output_tokens) > 0;

INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES
  ('20260716000000', 'step5_billing_fix_and_agent_stats')
ON CONFLICT (version) DO NOTHING;

COMMIT;
