-- Migration: Fix wallet_transaction_type_check constraint violations
-- The wallet_transaction_type_check constraint allows:
--   charge | refund | topup | bonus | adjustment | expiry | reservation | reservation_release | reservation_capture
-- But the billing functions were inserting 'capture' and 'release' — not in the constraint.
-- This replaces the three affected functions with corrected transaction type names.

-- ═══════════════════════════════════════════════════════════════════════════════
-- capture_reserved_credits — 'capture' → 'reservation_capture'
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

  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_gen.user_id FOR UPDATE;

  v_bal_before := v_wallet.balance;
  v_bal_after  := v_wallet.balance - v_capture;
  v_res_before := v_wallet.reserved_balance;
  v_res_after  := v_wallet.reserved_balance - v_capture;

  UPDATE public.wallets
  SET balance          = v_bal_after,
      reserved_balance = v_res_after,
      lifetime_spent   = lifetime_spent + v_capture,
      updated_at       = now()
  WHERE id = v_wallet.id;

  UPDATE public.generations
  SET credits_captured = credits_captured + v_capture,
      status           = 'ai_called',
      ai_started_at    = COALESCE(ai_started_at, now()),
      provider         = COALESCE(p_ai_provider, provider),
      provider_model   = COALESCE(p_ai_model, provider_model),
      updated_at       = now()
  WHERE id = p_generation_id;

  INSERT INTO public.wallet_transactions (
    wallet_id, user_id, transaction_type, amount,
    balance_before, balance_after,
    reserved_before, reserved_after,
    reference_id, reference_type, metadata
  ) VALUES (
    v_wallet.id, v_gen.user_id, 'reservation_capture', -v_capture,
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
-- release_reserved_credits — 'release' → 'reservation_release'
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
  v_res_after  := GREATEST(v_wallet.reserved_balance - v_release, 0);

  UPDATE public.wallets
  SET reserved_balance = v_res_after, updated_at = now()
  WHERE id = v_wallet.id;

  IF v_gen.credits_captured > 0 THEN
    v_new_status := 'partially_completed';
  ELSE
    v_new_status := 'failed_pre_cost';
  END IF;

  UPDATE public.generations
  SET status   = v_new_status,
      metadata = COALESCE(metadata, '{}') || jsonb_build_object('release_reason', p_reason),
      updated_at = now()
  WHERE id = p_generation_id;

  INSERT INTO public.wallet_transactions (
    wallet_id, user_id, transaction_type, amount,
    balance_before, balance_after,
    reserved_before, reserved_after,
    reference_id, reference_type, metadata
  ) VALUES (
    v_wallet.id, v_gen.user_id, 'reservation_release', 0,
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
-- finalize_generation_billing — 'release' → 'reservation_release'
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
      v_wallet.id, v_gen.user_id, 'reservation_release', 0,
      v_wallet.balance, v_wallet.balance,
      v_wallet.reserved_balance, GREATEST(v_wallet.reserved_balance - v_unreleased, 0),
      p_generation_id, 'generation',
      jsonb_build_object('released_amount', v_unreleased, 'reason', 'finalization')
    );
  END IF;

  IF p_status IS NOT NULL AND p_status != '' THEN
    v_final_status := p_status;
  ELSIF v_gen.credits_captured > 0 THEN
    v_final_status := 'completed';
  ELSE
    v_final_status := 'failed_pre_cost';
  END IF;

  UPDATE public.generations
  SET status           = v_final_status,
      provider_cost_usd = COALESCE(p_provider_cost_usd, provider_cost_usd),
      ai_completed_at  = CASE WHEN v_gen.ai_started_at IS NOT NULL THEN COALESCE(ai_completed_at, now()) ELSE NULL END,
      completed_at     = now(),
      metadata         = CASE WHEN p_metadata IS NOT NULL THEN COALESCE(metadata, '{}') || p_metadata ELSE metadata END,
      updated_at       = now()
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

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
