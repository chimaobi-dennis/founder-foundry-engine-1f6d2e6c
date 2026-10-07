-- Kinika billing tests. Run against any environment: it creates throwaway
-- users and ALWAYS ends by raising an exception, so nothing is ever committed.
--
--   supabase db query --linked -f supabase/tests/billing.sql
--
-- Success is the message "BILLING_TESTS_PASSED: n checks"; a failure is
-- "TEST FAILED: <name> ...". Both abort the transaction on purpose.

CREATE OR REPLACE FUNCTION pg_temp.chk(p_name text, p_ok boolean, p_detail text DEFAULT '')
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT COALESCE(p_ok, false) THEN
    RAISE EXCEPTION 'TEST FAILED: % %', p_name, p_detail;
  END IF;
  PERFORM set_config('kinika.checks', (COALESCE(NULLIF(current_setting('kinika.checks', true), ''), '0')::int + 1)::text, true);
END;
$$;

DO $$
DECLARE
  u1 uuid := gen_random_uuid();
  u2 uuid := gen_random_uuid();
  u3 uuid := gen_random_uuid();
  w public.wallets%ROWTYPE;
  r jsonb;
  gen uuid;
  gen2 uuid;
  g public.generations%ROWTYPE;
  sub uuid;
  ent jsonb;
BEGIN
  INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
  VALUES (u1, 'billing-test-1-' || u1 || '@kinika.test', 'authenticated', 'authenticated', '{}'::jsonb),
         (u2, 'billing-test-2-' || u2 || '@kinika.test', 'authenticated', 'authenticated', '{}'::jsonb),
         (u3, 'billing-test-3-' || u3 || '@kinika.test', 'authenticated', 'authenticated', '{}'::jsonb);

  -- ── add_credits ───────────────────────────────────────────────────────────
  r := public.add_credits(u1, 100, 'topup', 'test grant');
  PERFORM pg_temp.chk('add_credits succeeds', (r ->> 'success')::boolean, r::text);
  SELECT * INTO w FROM public.wallets WHERE user_id = u1;
  PERFORM pg_temp.chk('add_credits sets balance and lifetime_earned', w.balance = 100 AND w.lifetime_earned = 100, format('balance=%s earned=%s', w.balance, w.lifetime_earned));
  r := public.add_credits(u1, 0);
  PERFORM pg_temp.chk('add_credits rejects zero', r ->> 'error' = 'INVALID_AMOUNT', r::text);
  PERFORM pg_temp.chk('add_credits writes a ledger row', (SELECT count(*) FROM public.wallet_transactions WHERE user_id = u1 AND transaction_type = 'topup' AND balance_before = 0 AND balance_after = 100) = 1);

  -- ── reserve ───────────────────────────────────────────────────────────────
  r := public.reserve_generation_credits(u1, 10, NULL, 'agent', '{}'::jsonb);
  PERFORM pg_temp.chk('reserve succeeds', (r ->> 'success')::boolean, r::text);
  gen := (r ->> 'generation_id')::uuid;
  SELECT * INTO w FROM public.wallets WHERE user_id = u1;
  PERFORM pg_temp.chk('reserve moves credits to reserved, balance untouched', w.balance = 100 AND w.reserved_balance = 10, format('balance=%s reserved=%s', w.balance, w.reserved_balance));
  r := public.reserve_generation_credits(u1, 95, NULL, 'agent', '{}'::jsonb);
  PERFORM pg_temp.chk('reserve refuses more than is available', r ->> 'error' = 'INSUFFICIENT_BALANCE' AND (r ->> 'available')::numeric = 90, r::text);

  -- ── capture (a run captures once per paid step) ───────────────────────────
  r := public.capture_reserved_credits(gen, 4, 'test', 'test-model');
  PERFORM pg_temp.chk('first capture succeeds', (r ->> 'success')::boolean AND (r ->> 'credits_captured')::numeric = 4, r::text);
  SELECT * INTO w FROM public.wallets WHERE user_id = u1;
  PERFORM pg_temp.chk('capture deducts balance and releases the same reserved amount', w.balance = 96 AND w.reserved_balance = 6, format('balance=%s reserved=%s', w.balance, w.reserved_balance));
  r := public.capture_reserved_credits(gen, 3, 'test', 'test-model');
  PERFORM pg_temp.chk('a second capture on the same generation succeeds (multi-step runs)', (r ->> 'success')::boolean, r::text);
  SELECT * INTO w FROM public.wallets WHERE user_id = u1;
  PERFORM pg_temp.chk('second capture deducts again', w.balance = 93 AND w.reserved_balance = 3, format('balance=%s reserved=%s', w.balance, w.reserved_balance));
  r := public.capture_reserved_credits(gen, 50, 'test', 'test-model');
  PERFORM pg_temp.chk('capture is capped at what remains reserved', (r ->> 'success')::boolean AND (r ->> 'credits_captured')::numeric = 3, r::text);
  r := public.capture_reserved_credits(gen, 1, 'test', 'test-model');
  PERFORM pg_temp.chk('nothing more can be captured once fully captured', r ->> 'error' = 'ALREADY_CAPTURED', r::text);
  SELECT * INTO w FROM public.wallets WHERE user_id = u1;
  PERFORM pg_temp.chk('balance and reservation are consistent after over-capture attempts', w.balance = 90 AND w.reserved_balance = 0, format('balance=%s reserved=%s', w.balance, w.reserved_balance));

  -- ── finalize ──────────────────────────────────────────────────────────────
  r := public.finalize_generation_billing(gen, 'completed', NULL, '{}'::jsonb);
  PERFORM pg_temp.chk('finalize completed releases nothing when fully captured', (r ->> 'success')::boolean AND (r ->> 'credits_released')::numeric = 0 AND (r ->> 'net_cost')::numeric = 10, r::text);

  r := public.reserve_generation_credits(u1, 10, NULL, 'agent', '{}'::jsonb);
  gen2 := (r ->> 'generation_id')::uuid;
  PERFORM public.capture_reserved_credits(gen2, 2, 'test', 'm');
  r := public.finalize_generation_billing(gen2, 'failed_post_cost', NULL, '{}'::jsonb);
  PERFORM pg_temp.chk('failure after cost keeps what was captured and releases the rest', (r ->> 'credits_released')::numeric = 8 AND (r ->> 'net_cost')::numeric = 2, r::text);
  SELECT * INTO w FROM public.wallets WHERE user_id = u1;
  PERFORM pg_temp.chk('wallet reflects the partial capture', w.balance = 88 AND w.reserved_balance = 0, format('balance=%s reserved=%s', w.balance, w.reserved_balance));

  r := public.reserve_generation_credits(u1, 10, NULL, 'agent', '{}'::jsonb);
  gen2 := (r ->> 'generation_id')::uuid;
  r := public.finalize_generation_billing(gen2, 'failed_pre_cost', NULL, '{}'::jsonb);
  SELECT * INTO w FROM public.wallets WHERE user_id = u1;
  PERFORM pg_temp.chk('failure before cost releases the whole reservation', (r ->> 'credits_released')::numeric = 10 AND w.balance = 88 AND w.reserved_balance = 0, format('%s balance=%s reserved=%s', r, w.balance, w.reserved_balance));

  -- ── orphaned reservations ─────────────────────────────────────────────────
  UPDATE public.wallets SET reserved_balance = 5 WHERE user_id = u1;       -- a reservation with no generation behind it
  PERFORM set_config('request.jwt.claim.sub', u1::text, true);
  r := public.release_orphaned_reservations(u1);
  SELECT * INTO w FROM public.wallets WHERE user_id = u1;
  PERFORM pg_temp.chk('orphaned reservations are released', (r ->> 'success')::boolean AND w.reserved_balance = 0 AND (r ->> 'credits_released')::numeric = 5, format('%s reserved=%s', r, w.reserved_balance));
  PERFORM set_config('request.jwt.claim.sub', u2::text, true);
  r := public.release_orphaned_reservations(u1);
  PERFORM pg_temp.chk('one user cannot release another user''s reservations', r ->> 'error' = 'NOT_ALLOWED', r::text);

  -- ── trial credits ─────────────────────────────────────────────────────────
  PERFORM set_config('request.jwt.claim.sub', u2::text, true);
  r := public.claim_trial_credits();
  SELECT * INTO w FROM public.wallets WHERE user_id = u2;
  PERFORM pg_temp.chk('a new account is granted the trial credits once', (r ->> 'success')::boolean AND (r ->> 'granted')::int = 50 AND w.balance = 50 AND w.trial_granted_at IS NOT NULL, format('%s balance=%s', r, w.balance));
  r := public.claim_trial_credits();
  SELECT * INTO w FROM public.wallets WHERE user_id = u2;
  PERFORM pg_temp.chk('the trial cannot be claimed twice', (r ->> 'granted')::int = 0 AND r ->> 'reason' = 'ALREADY_CLAIMED' AND w.balance = 50, r::text);

  PERFORM set_config('request.jwt.claim.sub', u1::text, true);
  r := public.claim_trial_credits();
  PERFORM pg_temp.chk('an account that already earned credits is not eligible', (r ->> 'granted')::int = 0 AND r ->> 'reason' = 'NOT_ELIGIBLE', r::text);

  -- ── subscriptions: monthly grant is idempotent per period ─────────────────
  INSERT INTO public.subscriptions (user_id, plan_slug, status, monthly_credits, extra_agent_seats, current_period_start, current_period_end)
  VALUES (u3, 'solo', 'active', 1000, 2, now(), now() + interval '30 days') RETURNING id INTO sub;
  r := public.grant_subscription_credits(sub, date_trunc('day', now()));
  SELECT * INTO w FROM public.wallets WHERE user_id = u3;
  PERFORM pg_temp.chk('monthly grant gives plan credits plus 250 per extra agent seat', (r ->> 'credits_granted')::int = 1500 AND w.balance = 1500, format('%s balance=%s', r, w.balance));
  r := public.grant_subscription_credits(sub, date_trunc('day', now()));
  SELECT * INTO w FROM public.wallets WHERE user_id = u3;
  PERFORM pg_temp.chk('the same period is never granted twice', (r ->> 'already_granted')::boolean AND w.balance = 1500, format('%s balance=%s', r, w.balance));
  r := public.grant_subscription_credits(sub, date_trunc('day', now()) + interval '31 days');
  SELECT * INTO w FROM public.wallets WHERE user_id = u3;
  PERFORM pg_temp.chk('the next period is granted', (r ->> 'credits_granted')::int = 1500 AND w.balance = 3000, format('%s balance=%s', r, w.balance));

  -- ── entitlements ──────────────────────────────────────────────────────────
  ent := public.get_entitlements(u3);
  PERFORM pg_temp.chk('a Solo subscriber gets the Solo limits and their extra seats', ent ->> 'plan_slug' = 'solo' AND (ent ->> 'agents')::int = 2 AND (ent ->> 'extra_agent_seats')::int = 2, ent::text);
  ent := public.get_entitlements(u2);
  PERFORM pg_temp.chk('an account with no subscription is on the Free Trial limits', ent ->> 'plan_slug' = 'free' AND (ent ->> 'agents')::int = 1 AND (ent ->> 'autonomous_publishing')::boolean = false, ent::text);

  -- ── invariants across every wallet we touched ─────────────────────────────
  PERFORM pg_temp.chk('no wallet is negative or over-reserved',
    NOT EXISTS (SELECT 1 FROM public.wallets WHERE user_id IN (u1, u2, u3) AND (balance < 0 OR reserved_balance < 0 OR reserved_balance > balance)));
  PERFORM pg_temp.chk('every ledger row is internally consistent',
    NOT EXISTS (SELECT 1 FROM public.wallet_transactions WHERE user_id IN (u1, u2, u3) AND transaction_type IN ('topup', 'bonus', 'capture') AND balance_after <> balance_before + amount));

  -- Always abort so nothing here persists. The message is the result.
  RAISE EXCEPTION 'BILLING_TESTS_PASSED: % checks', current_setting('kinika.checks', true);
END;
$$;
