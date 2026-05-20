-- ═══════════════════════════════════════════════════════════════════════════════
-- BILLING FUNCTIONS — Ported to production schema
--
-- Targets EXISTING tables:
--   wallets              (id, user_id, balance, reserved_balance, lifetime_earned, lifetime_spent, lifetime_refunded)
--   wallet_transactions  (id, wallet_id, user_id, transaction_type, amount, balance_before, balance_after, reserved_before, reserved_after, reference_id, reference_type, metadata)
--   generations          (id, user_id, status, credits_reserved, credits_captured, provider, provider_model, provider_cost_usd, ai_started_at, ai_completed_at, platform, prompt, metadata)
--   credit_packages      (id, name, credits, price_usd, active, sort_order, stripe_price_id, description, ...)
--   credit_purchases     (id, user_id, package_id, credits, amount_usd, status, stripe_session_id, stripe_payment_intent_id, metadata)
--   stripe_customers     (id, user_id, stripe_customer_id)
--
-- Creates ONLY functions + safe indexes. NO table creation. NO schema changes.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─── Safe indexes ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_wallets_user ON public.wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_txn_wallet ON public.wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_txn_user ON public.wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_txn_ref ON public.wallet_transactions(reference_id, reference_type);
CREATE INDEX IF NOT EXISTS idx_wallet_txn_type ON public.wallet_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_wallet_txn_created ON public.wallet_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generations_user ON public.generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_status ON public.generations(status);
CREATE INDEX IF NOT EXISTS idx_credit_purchases_user ON public.credit_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_purchases_session ON public.credit_purchases(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_credit_purchases_status ON public.credit_purchases(status);
CREATE INDEX IF NOT EXISTS idx_stripe_customers_user ON public.stripe_customers(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_customers_stripe ON public.stripe_customers(stripe_customer_id);


-- ═══════════════════════════════════════════════════════════════════════════════
-- get_wallet_balance
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_wallet_balance(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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


-- ═══════════════════════════════════════════════════════════════════════════════
-- reserve_generation_credits
-- Phase 1: Lock credits (available → reserved). No deduction yet.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.reserve_generation_credits(
  p_user_id UUID,
  p_credits NUMERIC,
  p_generation_id UUID DEFAULT NULL,
  p_platform TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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


-- ═══════════════════════════════════════════════════════════════════════════════
-- capture_reserved_credits
-- Phase 2: Convert reservation → deduction. Called when AI inference begins.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.capture_reserved_credits(
  p_generation_id UUID,
  p_capture_amount NUMERIC DEFAULT NULL,
  p_ai_provider TEXT DEFAULT NULL,
  p_ai_model TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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


-- ═══════════════════════════════════════════════════════════════════════════════
-- release_reserved_credits
-- Cancel reservation BEFORE AI inference. Credits return to available.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.release_reserved_credits(
  p_generation_id UUID,
  p_reason TEXT DEFAULT 'Pre-cost failure — reservation released',
  p_release_amount NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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


-- ═══════════════════════════════════════════════════════════════════════════════
-- finalize_generation_billing
-- Phase 3: Mark generation complete. Release uncaptured remainder. Set final status.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.finalize_generation_billing(
  p_generation_id UUID,
  p_status TEXT DEFAULT 'completed',
  p_provider_cost_usd NUMERIC DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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


-- ═══════════════════════════════════════════════════════════════════════════════
-- update_generation_status
-- Lightweight status update for intermediate states.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.update_generation_status(
  p_generation_id UUID,
  p_new_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.generations
  SET status = p_new_status, updated_at = now()
  WHERE id = p_generation_id;
  RETURN jsonb_build_object('success', true, 'status', p_new_status);
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- add_credits
-- Admin/purchase credit addition.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.add_credits(
  p_user_id UUID,
  p_amount NUMERIC,
  p_type TEXT DEFAULT 'topup',
  p_description TEXT DEFAULT 'Credit top-up',
  p_reference_id UUID DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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


-- ═══════════════════════════════════════════════════════════════════════════════
-- fulfill_credit_purchase
-- Called by Stripe webhook after verified payment. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fulfill_credit_purchase(
  p_purchase_id UUID,
  p_user_id UUID,
  p_credits_amount NUMERIC,
  p_stripe_payment_intent_id TEXT DEFAULT NULL
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


-- ═══════════════════════════════════════════════════════════════════════════════
-- grant_credits_admin
-- Manual admin credit grant with audit trail.
-- ═══════════════════════════════════════════════════════════════════════════════

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


-- ═══════════════════════════════════════════════════════════════════════════════
-- expire_stale_reservations
-- Cleanup: releases reservations stuck in 'reserved' status for too long.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.expire_stale_reservations(
  p_max_age_minutes INT DEFAULT 30
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
