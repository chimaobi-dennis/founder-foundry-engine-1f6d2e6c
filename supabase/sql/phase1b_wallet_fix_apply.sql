-- Kinika · wallet transaction type fix — paste into Supabase → SQL Editor → Run.
-- Safe to run more than once. Applies migration 20260703000000 and records it.
-- Then (optional, releases credits stuck in reserved_balance for every wallet):
--   SELECT public.release_orphaned_reservations();

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Fix: wallet_transaction_type_check rejects what the billing functions insert
--
-- On the live database the constraint allows
--   credit_purchase | manual_adjustment | generation_charge | reservation |
--   reservation_release | reservation_capture | refund | partial_refund
-- while the functions insert
--   capture_reserved_credits   → 'capture'
--   release_reserved_credits   → 'release'
--   finalize_generation_billing→ 'release'
--   add_credits / claim_free_trial_credits → 'topup'
--   fulfill_credit_purchase    → 'purchase', 'topup'
--   grant_credits_admin        → 'bonus'
-- so every capture, release, purchase and grant failed with 23514 and only
-- reservations ever landed (wallets accumulate reserved_balance they can
-- never release). Found while running the Phase 1 runner end to end.
--
-- Widening the constraint is the lowest-risk fix: it keeps every function
-- body as deployed and makes the ledger accept both vocabularies. Reporting
-- (admin_cogs_daily) counts both spellings of a capture.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transaction_type_check;
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transaction_type_check CHECK (
  transaction_type = ANY (ARRAY[
    -- live vocabulary
    'credit_purchase', 'manual_adjustment', 'generation_charge', 'reservation',
    'reservation_release', 'reservation_capture', 'refund', 'partial_refund',
    -- what the deployed functions insert
    'capture', 'release', 'charge', 'topup', 'bonus', 'adjustment', 'purchase', 'expiry', 'deduction'
  ]::text[])
);

-- Release reservations that were orphaned by failed captures/releases:
-- generations finished (or abandoned) while the wallet still holds them.
CREATE OR REPLACE FUNCTION public.release_orphaned_reservations(p_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w RECORD;
  v_open numeric;
  v_fixed integer := 0;
  v_released numeric := 0;
BEGIN
  IF p_user_id IS NOT NULL AND auth.uid() IS DISTINCT FROM p_user_id AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_ALLOWED');
  END IF;

  FOR w IN
    SELECT * FROM public.wallets
    WHERE reserved_balance > 0 AND (p_user_id IS NULL OR user_id = p_user_id)
    FOR UPDATE
  LOOP
    -- Reservations still legitimately open: generations that are reserved or
    -- mid-flight and younger than a day.
    SELECT COALESCE(SUM(credits_reserved - credits_captured), 0) INTO v_open
    FROM public.generations
    WHERE user_id = w.user_id
      AND status IN ('reserved', 'queued', 'processing', 'ai_called')
      AND created_at > now() - interval '1 day'
      AND credits_reserved > credits_captured;

    IF w.reserved_balance > v_open THEN
      INSERT INTO public.wallet_transactions (
        wallet_id, user_id, transaction_type, amount,
        balance_before, balance_after, reserved_before, reserved_after,
        reference_id, reference_type, metadata
      ) VALUES (
        w.id, w.user_id, 'reservation_release', 0,
        w.balance, w.balance, w.reserved_balance, v_open,
        NULL, 'maintenance',
        jsonb_build_object('released_amount', w.reserved_balance - v_open, 'reason', 'orphaned_reservations')
      );
      v_released := v_released + (w.reserved_balance - v_open);
      UPDATE public.wallets SET reserved_balance = v_open, updated_at = now() WHERE id = w.id;
      v_fixed := v_fixed + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'wallets_fixed', v_fixed, 'credits_released', v_released);
END;
$$;

GRANT EXECUTE ON FUNCTION public.release_orphaned_reservations(uuid) TO authenticated;

-- Reporting: count both spellings of a capture.
CREATE OR REPLACE FUNCTION public.admin_cogs_daily(p_days integer DEFAULT 30)
RETURNS TABLE (
  day date,
  calls bigint,
  cost_usd numeric,
  credits_equivalent numeric,
  credits_captured numeric,
  retail_usd numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
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
    WHERE transaction_type IN ('reservation_capture', 'capture', 'generation_charge', 'charge')
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

INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES
  ('20260703000000', 'wallet_transaction_types_allow_all')
ON CONFLICT (version) DO NOTHING;

COMMIT;
