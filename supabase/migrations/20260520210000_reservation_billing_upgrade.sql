-- ═══════════════════════════════════════════════════════════════════════════════
-- RESERVATION-BASED BILLING UPGRADE
-- Stripe-style authorize → capture flow for AI generation credits.
--
-- Key principle: the IRREVERSIBLE billing moment is when external AI inference
-- begins. Before that point, reservations can be released. After that point,
-- credits remain consumed regardless of generation outcome.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─── 1. Wallet: add reserved_balance ────────────────────────────────────────
-- reserved_balance tracks credits that are locked but not yet captured.
-- available_balance = balance - reserved_balance

ALTER TABLE public.user_credit_wallets
  ADD COLUMN IF NOT EXISTS reserved_balance NUMERIC(12,2) NOT NULL DEFAULT 0
    CHECK (reserved_balance >= 0);

ALTER TABLE public.user_credit_wallets
  ADD COLUMN IF NOT EXISTS lifetime_reserved NUMERIC(12,2) NOT NULL DEFAULT 0;

-- Ensure balance >= reserved_balance (can't reserve more than you have)
ALTER TABLE public.user_credit_wallets
  DROP CONSTRAINT IF EXISTS wallet_reserved_lte_balance;
ALTER TABLE public.user_credit_wallets
  ADD CONSTRAINT wallet_reserved_lte_balance CHECK (reserved_balance <= balance);


-- ─── 2. Transaction types: add reservation lifecycle ────────────────────────

ALTER TYPE public.credit_transaction_type ADD VALUE IF NOT EXISTS 'reservation';
ALTER TYPE public.credit_transaction_type ADD VALUE IF NOT EXISTS 'reservation_release';
ALTER TYPE public.credit_transaction_type ADD VALUE IF NOT EXISTS 'reservation_capture';


-- ─── 3. Billing event states: granular lifecycle ────────────────────────────

-- Drop the old enum and recreate with new states
-- We can't easily alter enums in PG, so we use text cast approach
ALTER TABLE public.generation_billing_events
  ALTER COLUMN status DROP DEFAULT;

ALTER TABLE public.generation_billing_events
  ALTER COLUMN status TYPE TEXT USING status::TEXT;

DROP TYPE IF EXISTS public.billing_event_status;

CREATE TYPE public.billing_event_status AS ENUM (
  'initiated',            -- reservation created, generation not started
  'queued',               -- waiting in generation queue
  'processing',           -- pre-AI validations in progress
  'ai_called',            -- external AI inference has begun (irreversible billing moment)
  'completed',            -- generation fully succeeded
  'failed_pre_cost',      -- failed BEFORE AI inference → release reservation
  'failed_post_cost',     -- failed AFTER AI inference → keep captured credits
  'partially_completed',  -- some platforms succeeded, some failed
  'refunded',             -- admin/manual full refund (exceptional)
  'partial_refund',       -- admin/manual partial refund
  -- Legacy states (mapped from old system)
  'pending',
  'charged'
);

ALTER TABLE public.generation_billing_events
  ALTER COLUMN status TYPE public.billing_event_status
    USING status::public.billing_event_status;

ALTER TABLE public.generation_billing_events
  ALTER COLUMN status SET DEFAULT 'initiated';


-- ─── 4. Billing events: add reservation + provider cost tracking ────────────

ALTER TABLE public.generation_billing_events
  ADD COLUMN IF NOT EXISTS credits_reserved NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.generation_billing_events
  ADD COLUMN IF NOT EXISTS credits_captured NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.generation_billing_events
  ADD COLUMN IF NOT EXISTS credits_released NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.generation_billing_events
  ADD COLUMN IF NOT EXISTS provider_cost_usd NUMERIC(10,6) DEFAULT NULL;

ALTER TABLE public.generation_billing_events
  ADD COLUMN IF NOT EXISTS ai_started_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.generation_billing_events
  ADD COLUMN IF NOT EXISTS ai_completed_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.generation_billing_events
  ADD COLUMN IF NOT EXISTS ai_provider TEXT DEFAULT NULL;

ALTER TABLE public.generation_billing_events
  ADD COLUMN IF NOT EXISTS ai_model TEXT DEFAULT NULL;

ALTER TABLE public.generation_billing_events
  ADD COLUMN IF NOT EXISTS ai_tokens_used INT DEFAULT NULL;

ALTER TABLE public.generation_billing_events
  ADD COLUMN IF NOT EXISTS reservation_expires_at TIMESTAMPTZ DEFAULT NULL;

-- Index for finding stale reservations
CREATE INDEX IF NOT EXISTS idx_billing_events_reservation_expiry
  ON public.generation_billing_events(reservation_expires_at)
  WHERE status = 'initiated' AND reservation_expires_at IS NOT NULL;


-- ═══════════════════════════════════════════════════════════════════════════════
-- ATOMIC FUNCTIONS — Reservation lifecycle
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── reserve_generation_credits ─────────────────────────────────────────────
-- Phase 1: Lock credits in the wallet. Credits move from available → reserved.
-- No actual deduction yet. User cannot spend reserved credits elsewhere.

CREATE OR REPLACE FUNCTION public.reserve_generation_credits(
  p_user_id UUID,
  p_brief_id UUID,
  p_session_id TEXT,
  p_credits NUMERIC,
  p_platform_count INT,
  p_render_engine TEXT DEFAULT 'html',
  p_pricing_snapshot JSONB DEFAULT '{}',
  p_credit_breakdown JSONB DEFAULT '{}',
  p_idempotency_key TEXT DEFAULT NULL,
  p_reservation_ttl_minutes INT DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet RECORD;
  v_billing_event_id UUID;
  v_txn_id UUID;
  v_available NUMERIC;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Idempotency check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_billing_event_id
    FROM public.generation_billing_events
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'DUPLICATE_REQUEST',
        'billing_event_id', v_billing_event_id,
        'message', 'This generation request has already been processed'
      );
    END IF;
  END IF;

  -- Ensure wallet exists
  INSERT INTO public.user_credit_wallets (user_id, balance)
  VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Lock wallet row
  SELECT * INTO v_wallet
  FROM public.user_credit_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'WALLET_NOT_FOUND'
    );
  END IF;

  -- Check available balance (balance minus already-reserved)
  v_available := v_wallet.balance - v_wallet.reserved_balance;

  IF v_available < p_credits THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INSUFFICIENT_BALANCE',
      'balance', v_wallet.balance,
      'reserved', v_wallet.reserved_balance,
      'available', v_available,
      'required', p_credits,
      'message', 'Insufficient available credits'
    );
  END IF;

  -- Calculate reservation expiry
  v_expires_at := now() + (p_reservation_ttl_minutes || ' minutes')::INTERVAL;

  -- Move credits to reserved (no deduction from balance yet)
  UPDATE public.user_credit_wallets
  SET
    reserved_balance = reserved_balance + p_credits,
    lifetime_reserved = lifetime_reserved + p_credits,
    updated_at = now()
  WHERE id = v_wallet.id;

  -- Create billing event in 'initiated' state
  INSERT INTO public.generation_billing_events (
    user_id, wallet_id, brief_id, generation_session_id,
    credits_reserved, credits_charged, status,
    platform_count, render_engine,
    pricing_snapshot, credit_breakdown, idempotency_key,
    reservation_expires_at,
    created_at
  )
  VALUES (
    p_user_id, v_wallet.id, p_brief_id, p_session_id,
    p_credits, 0, 'initiated',
    p_platform_count, p_render_engine,
    p_pricing_snapshot, p_credit_breakdown, p_idempotency_key,
    v_expires_at,
    now()
  )
  RETURNING id INTO v_billing_event_id;

  -- Create immutable reservation transaction
  INSERT INTO public.credit_transactions (
    wallet_id, user_id, type, amount,
    balance_before, balance_after,
    description, reference_id, reference_type,
    metadata, idempotency_key
  )
  VALUES (
    v_wallet.id, p_user_id, 'reservation', 0,
    v_wallet.balance, v_wallet.balance,  -- balance unchanged, only reserved moves
    'Credit reservation for generation',
    v_billing_event_id, 'generation',
    jsonb_build_object(
      'brief_id', p_brief_id,
      'session_id', p_session_id,
      'credits_reserved', p_credits,
      'reservation_expires_at', v_expires_at
    ),
    CASE WHEN p_idempotency_key IS NOT NULL
      THEN 'reserve_' || p_idempotency_key
      ELSE NULL
    END
  )
  RETURNING id INTO v_txn_id;

  RETURN jsonb_build_object(
    'success', true,
    'billing_event_id', v_billing_event_id,
    'transaction_id', v_txn_id,
    'credits_reserved', p_credits,
    'balance', v_wallet.balance,
    'available_after', v_available - p_credits,
    'reservation_expires_at', v_expires_at
  );
END;
$$;


-- ─── capture_reserved_credits ───────────────────────────────────────────────
-- Phase 2: Convert reservation → actual deduction. Called when AI inference
-- begins (the irreversible moment). Deducts from both balance and reserved.

CREATE OR REPLACE FUNCTION public.capture_reserved_credits(
  p_billing_event_id UUID,
  p_capture_amount NUMERIC DEFAULT NULL,  -- NULL = capture full reservation
  p_ai_provider TEXT DEFAULT NULL,
  p_ai_model TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event RECORD;
  v_wallet RECORD;
  v_capture NUMERIC;
  v_txn_id UUID;
  v_balance_before NUMERIC;
  v_balance_after NUMERIC;
BEGIN
  -- Lock billing event
  SELECT * INTO v_event
  FROM public.generation_billing_events
  WHERE id = p_billing_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'EVENT_NOT_FOUND'
    );
  END IF;

  -- Can only capture from 'initiated', 'queued', or 'processing' states
  IF v_event.status NOT IN ('initiated', 'queued', 'processing') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_STATE',
      'current_status', v_event.status::TEXT,
      'message', 'Can only capture from initiated/queued/processing states'
    );
  END IF;

  -- Already fully captured?
  IF v_event.credits_captured >= v_event.credits_reserved THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ALREADY_CAPTURED'
    );
  END IF;

  -- Determine capture amount
  v_capture := COALESCE(p_capture_amount, v_event.credits_reserved - v_event.credits_captured);

  -- Cannot capture more than remaining reservation
  IF v_capture > (v_event.credits_reserved - v_event.credits_captured) THEN
    v_capture := v_event.credits_reserved - v_event.credits_captured;
  END IF;

  IF v_capture <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'NOTHING_TO_CAPTURE'
    );
  END IF;

  -- Lock wallet
  SELECT * INTO v_wallet
  FROM public.user_credit_wallets
  WHERE id = v_event.wallet_id
  FOR UPDATE;

  v_balance_before := v_wallet.balance;
  v_balance_after := v_wallet.balance - v_capture;

  -- Deduct from balance AND release from reserved
  UPDATE public.user_credit_wallets
  SET
    balance = v_balance_after,
    reserved_balance = reserved_balance - v_capture,
    lifetime_spent = lifetime_spent + v_capture,
    updated_at = now()
  WHERE id = v_wallet.id;

  -- Update billing event → ai_called
  UPDATE public.generation_billing_events
  SET
    credits_captured = credits_captured + v_capture,
    credits_charged = credits_charged + v_capture,
    status = 'ai_called',
    ai_started_at = COALESCE(ai_started_at, now()),
    ai_provider = COALESCE(p_ai_provider, ai_provider),
    ai_model = COALESCE(p_ai_model, ai_model),
    charged_at = COALESCE(charged_at, now()),
    updated_at = now()
  WHERE id = p_billing_event_id;

  -- Create immutable capture transaction
  INSERT INTO public.credit_transactions (
    wallet_id, user_id, type, amount,
    balance_before, balance_after,
    description, reference_id, reference_type,
    metadata
  )
  VALUES (
    v_wallet.id, v_event.user_id, 'reservation_capture', -v_capture,
    v_balance_before, v_balance_after,
    'Credits captured — AI inference started',
    p_billing_event_id, 'generation',
    jsonb_build_object(
      'capture_amount', v_capture,
      'total_captured', v_event.credits_captured + v_capture,
      'total_reserved', v_event.credits_reserved,
      'ai_provider', p_ai_provider,
      'ai_model', p_ai_model
    )
  )
  RETURNING id INTO v_txn_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_txn_id,
    'credits_captured', v_capture,
    'total_captured', v_event.credits_captured + v_capture,
    'balance_before', v_balance_before,
    'balance_after', v_balance_after
  );
END;
$$;


-- ─── release_reserved_credits ───────────────────────────────────────────────
-- Cancel a reservation. Only allowed BEFORE AI inference (pre-cost failure).
-- Moves credits back from reserved → available.

CREATE OR REPLACE FUNCTION public.release_reserved_credits(
  p_billing_event_id UUID,
  p_reason TEXT DEFAULT 'Pre-cost failure — reservation released',
  p_release_amount NUMERIC DEFAULT NULL  -- NULL = release all uncaptured
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event RECORD;
  v_wallet RECORD;
  v_release NUMERIC;
  v_txn_id UUID;
  v_new_status public.billing_event_status;
BEGIN
  -- Lock billing event
  SELECT * INTO v_event
  FROM public.generation_billing_events
  WHERE id = p_billing_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'EVENT_NOT_FOUND'
    );
  END IF;

  -- Calculate releasable amount (reserved minus already captured/released)
  v_release := COALESCE(
    p_release_amount,
    v_event.credits_reserved - v_event.credits_captured - v_event.credits_released
  );

  -- Cap at remaining
  IF v_release > (v_event.credits_reserved - v_event.credits_captured - v_event.credits_released) THEN
    v_release := v_event.credits_reserved - v_event.credits_captured - v_event.credits_released;
  END IF;

  IF v_release <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'NOTHING_TO_RELEASE',
      'message', 'No releasable reservation remaining'
    );
  END IF;

  -- Lock wallet
  SELECT * INTO v_wallet
  FROM public.user_credit_wallets
  WHERE id = v_event.wallet_id
  FOR UPDATE;

  -- Release from reserved (balance stays the same — credits become available again)
  UPDATE public.user_credit_wallets
  SET
    reserved_balance = reserved_balance - v_release,
    updated_at = now()
  WHERE id = v_wallet.id;

  -- Determine new status
  IF v_event.credits_captured > 0 THEN
    -- Some was already captured (AI ran), this is a partial release
    v_new_status := 'partially_completed';
  ELSE
    -- Nothing captured, pure pre-cost failure
    v_new_status := 'failed_pre_cost';
  END IF;

  -- Update billing event
  UPDATE public.generation_billing_events
  SET
    credits_released = credits_released + v_release,
    status = v_new_status,
    error_message = p_reason,
    updated_at = now()
  WHERE id = p_billing_event_id;

  -- Create immutable release transaction
  INSERT INTO public.credit_transactions (
    wallet_id, user_id, type, amount,
    balance_before, balance_after,
    description, reference_id, reference_type,
    metadata
  )
  VALUES (
    v_wallet.id, v_event.user_id, 'reservation_release', 0,
    v_wallet.balance, v_wallet.balance,  -- balance unchanged, reserved decreases
    p_reason,
    p_billing_event_id, 'generation',
    jsonb_build_object(
      'released_amount', v_release,
      'credits_captured', v_event.credits_captured,
      'credits_reserved', v_event.credits_reserved,
      'new_status', v_new_status::TEXT
    )
  )
  RETURNING id INTO v_txn_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_txn_id,
    'credits_released', v_release,
    'new_status', v_new_status::TEXT,
    'balance', v_wallet.balance,
    'available_after', v_wallet.balance - (v_wallet.reserved_balance - v_release)
  );
END;
$$;


-- ─── finalize_generation_billing ────────────────────────────────────────────
-- Phase 3: Mark generation as completed. Releases any uncaptured reservation
-- remainder and sets final status.

CREATE OR REPLACE FUNCTION public.finalize_generation_billing(
  p_billing_event_id UUID,
  p_platforms_succeeded INT DEFAULT 0,
  p_platforms_failed INT DEFAULT 0,
  p_provider_cost_usd NUMERIC DEFAULT NULL,
  p_ai_tokens_used INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event RECORD;
  v_wallet RECORD;
  v_unreleased NUMERIC;
  v_final_status public.billing_event_status;
BEGIN
  -- Lock billing event
  SELECT * INTO v_event
  FROM public.generation_billing_events
  WHERE id = p_billing_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'EVENT_NOT_FOUND'
    );
  END IF;

  -- Calculate any remaining unreleased/uncaptured reservation
  v_unreleased := v_event.credits_reserved - v_event.credits_captured - v_event.credits_released;

  -- Release any leftover reservation
  IF v_unreleased > 0 THEN
    SELECT * INTO v_wallet
    FROM public.user_credit_wallets
    WHERE id = v_event.wallet_id
    FOR UPDATE;

    UPDATE public.user_credit_wallets
    SET
      reserved_balance = GREATEST(reserved_balance - v_unreleased, 0),
      updated_at = now()
    WHERE id = v_wallet.id;

    -- Record the release
    INSERT INTO public.credit_transactions (
      wallet_id, user_id, type, amount,
      balance_before, balance_after,
      description, reference_id, reference_type,
      metadata
    )
    VALUES (
      v_wallet.id, v_event.user_id, 'reservation_release', 0,
      v_wallet.balance, v_wallet.balance,
      'Finalization — releasing uncaptured reservation remainder',
      p_billing_event_id, 'generation',
      jsonb_build_object('released_amount', v_unreleased)
    );
  END IF;

  -- Determine final status
  IF p_platforms_failed = 0 AND p_platforms_succeeded > 0 THEN
    v_final_status := 'completed';
  ELSIF p_platforms_succeeded > 0 AND p_platforms_failed > 0 THEN
    v_final_status := 'partially_completed';
  ELSIF v_event.credits_captured > 0 THEN
    -- AI was called but all platforms failed → post-cost failure
    v_final_status := 'failed_post_cost';
  ELSE
    v_final_status := 'failed_pre_cost';
  END IF;

  -- Update billing event
  UPDATE public.generation_billing_events
  SET
    credits_released = credits_released + v_unreleased,
    status = v_final_status,
    platforms_succeeded = p_platforms_succeeded,
    platforms_failed = p_platforms_failed,
    provider_cost_usd = COALESCE(p_provider_cost_usd, provider_cost_usd),
    ai_tokens_used = COALESCE(p_ai_tokens_used, ai_tokens_used),
    ai_completed_at = CASE WHEN v_event.ai_started_at IS NOT NULL THEN now() ELSE NULL END,
    completed_at = now(),
    updated_at = now()
  WHERE id = p_billing_event_id;

  RETURN jsonb_build_object(
    'success', true,
    'billing_event_id', p_billing_event_id,
    'final_status', v_final_status::TEXT,
    'credits_captured', v_event.credits_captured,
    'credits_released', v_event.credits_released + v_unreleased,
    'provider_cost_usd', p_provider_cost_usd,
    'net_cost', v_event.credits_captured
  );
END;
$$;


-- ─── mark_billing_ai_called ─────────────────────────────────────────────────
-- Lightweight status update: marks the moment AI inference begins.
-- Does NOT move credits — use capture_reserved_credits for that.

CREATE OR REPLACE FUNCTION public.mark_billing_ai_called(
  p_billing_event_id UUID,
  p_ai_provider TEXT DEFAULT NULL,
  p_ai_model TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.generation_billing_events
  SET
    status = 'ai_called',
    ai_started_at = COALESCE(ai_started_at, now()),
    ai_provider = COALESCE(p_ai_provider, ai_provider),
    ai_model = COALESCE(p_ai_model, ai_model),
    updated_at = now()
  WHERE id = p_billing_event_id
    AND status IN ('initiated', 'queued', 'processing');

  RETURN jsonb_build_object('success', true);
END;
$$;


-- ─── update_billing_status ──────────────────────────────────────────────────
-- Generic status update for intermediate states (queued, processing).

CREATE OR REPLACE FUNCTION public.update_billing_status(
  p_billing_event_id UUID,
  p_new_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.generation_billing_events
  SET
    status = p_new_status::public.billing_event_status,
    updated_at = now()
  WHERE id = p_billing_event_id;

  RETURN jsonb_build_object('success', true, 'status', p_new_status);
END;
$$;


-- ─── expire_stale_reservations ──────────────────────────────────────────────
-- Cleanup function: releases reservations that have expired.
-- Intended to be called by a cron job or periodic task.

CREATE OR REPLACE FUNCTION public.expire_stale_reservations()
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
    FROM public.generation_billing_events
    WHERE status = 'initiated'
      AND reservation_expires_at IS NOT NULL
      AND reservation_expires_at < now()
    FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM public.release_reserved_credits(
      v_expired.id,
      'Reservation expired'
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
