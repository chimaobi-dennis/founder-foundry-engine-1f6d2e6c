-- ═══════════════════════════════════════════════════════════════════════════════
-- CREDIT BILLING SYSTEM — Production-grade, atomic, auditable, refundable
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. user_credit_wallets ─────────────────────────────────────────────────
-- One wallet per user. Balance is the source of truth for available credits.
-- Only service role may mutate. Users may read their own wallet.

CREATE TABLE IF NOT EXISTS public.user_credit_wallets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance       NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime_earned   NUMERIC(12,2) NOT NULL DEFAULT 0,
  lifetime_spent    NUMERIC(12,2) NOT NULL DEFAULT 0,
  lifetime_refunded NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency      TEXT NOT NULL DEFAULT 'credits',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_credit_wallets_user ON public.user_credit_wallets(user_id);

ALTER TABLE public.user_credit_wallets ENABLE ROW LEVEL SECURITY;

-- Users can read their own wallet
CREATE POLICY "Users can read own wallet"
  ON public.user_credit_wallets
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can insert/update/delete
CREATE POLICY "Service role manages wallets"
  ON public.user_credit_wallets
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');


-- ─── 2. credit_transactions ────────────────────────────────────────────────
-- Immutable ledger. NEVER UPDATE or DELETE rows. Append-only.

CREATE TYPE public.credit_transaction_type AS ENUM (
  'charge',        -- deduction for generation
  'refund',        -- reversal of a failed charge
  'topup',         -- admin/purchase credit addition
  'bonus',         -- promotional credit
  'adjustment',    -- manual admin correction
  'expiry'         -- credit expiration
);

CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id       UUID NOT NULL REFERENCES public.user_credit_wallets(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type            public.credit_transaction_type NOT NULL,
  amount          NUMERIC(12,2) NOT NULL,  -- positive for credits in, negative for credits out
  balance_before  NUMERIC(12,2) NOT NULL,
  balance_after   NUMERIC(12,2) NOT NULL,
  description     TEXT,
  reference_id    UUID,           -- links to billing_event, order, etc.
  reference_type  TEXT,           -- 'generation', 'purchase', 'admin', etc.
  metadata        JSONB DEFAULT '{}',
  idempotency_key TEXT,           -- prevents duplicate transactions
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_credit_txn_wallet ON public.credit_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_credit_txn_user ON public.credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_txn_reference ON public.credit_transactions(reference_id, reference_type);
CREATE INDEX IF NOT EXISTS idx_credit_txn_type ON public.credit_transactions(type);
CREATE INDEX IF NOT EXISTS idx_credit_txn_created ON public.credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_txn_idempotency ON public.credit_transactions(idempotency_key) WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- Users can read their own transactions
CREATE POLICY "Users can read own transactions"
  ON public.credit_transactions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can insert (append-only — no update/delete policies)
CREATE POLICY "Service role inserts transactions"
  ON public.credit_transactions
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');


-- ─── 3. ai_generation_pricing ──────────────────────────────────────────────
-- Model-aware pricing config. Supports per-model, per-feature pricing.

CREATE TABLE IF NOT EXISTS public.ai_generation_pricing (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pricing_key     TEXT NOT NULL UNIQUE,       -- e.g. 'content_studio_generation', 'prostudio_template'
  display_name    TEXT NOT NULL,
  base_cost       NUMERIC(8,2) NOT NULL DEFAULT 1,
  -- Model-specific multipliers stored as JSONB: { "gpt-4o": 1.5, "claude-sonnet": 1.2 }
  model_multipliers   JSONB DEFAULT '{}',
  -- Feature multipliers: { "scene_mode": 1.2, "ai_visuals": 1.5 }
  feature_multipliers JSONB DEFAULT '{}',
  -- Platform count multiplier (cost = base * platform_count * this)
  per_platform_cost   NUMERIC(8,2) NOT NULL DEFAULT 1,
  -- Complexity multipliers: { "simple": 0.75, "balanced": 1, "advanced": 1.5 }
  complexity_multipliers JSONB DEFAULT '{"simple": 0.75, "balanced": 1, "advanced": 1.5, "experimental": 2}',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_generation_pricing ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read pricing
CREATE POLICY "Authenticated users can read pricing"
  ON public.ai_generation_pricing
  FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Only service role can manage pricing
CREATE POLICY "Service role manages pricing"
  ON public.ai_generation_pricing
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Seed default pricing for Content Studio
INSERT INTO public.ai_generation_pricing (pricing_key, display_name, base_cost, per_platform_cost, description)
VALUES (
  'content_studio_generation',
  'Content Studio Campaign Generation',
  1,
  1,
  'Credits charged per generation session. Cost scales with platform count, complexity, and AI features.'
)
ON CONFLICT (pricing_key) DO NOTHING;


-- ─── 4. generation_billing_events ──────────────────────────────────────────
-- Links a generation session to its billing. One event per generation request.

CREATE TYPE public.billing_event_status AS ENUM (
  'pending',       -- charge initiated, generation not started
  'charged',       -- credits deducted, generation in progress
  'completed',     -- generation succeeded
  'refunded',      -- generation failed, credits returned
  'partial_refund' -- partial failure, some credits returned
);

CREATE TABLE IF NOT EXISTS public.generation_billing_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_id           UUID NOT NULL REFERENCES public.user_credit_wallets(id) ON DELETE CASCADE,
  brief_id            UUID,              -- links to content_studio_briefs
  generation_session_id TEXT,            -- matches content_studio_creatives.generation_session_id
  -- Billing
  credits_charged     NUMERIC(12,2) NOT NULL DEFAULT 0,
  credits_refunded    NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_cost            NUMERIC(12,2) GENERATED ALWAYS AS (credits_charged - credits_refunded) STORED,
  -- Pricing context (snapshot at time of charge)
  pricing_snapshot    JSONB DEFAULT '{}',  -- frozen copy of pricing + multipliers used
  credit_breakdown    JSONB DEFAULT '{}',  -- detailed calculation breakdown
  -- Status
  status              public.billing_event_status NOT NULL DEFAULT 'pending',
  -- Generation context
  platform_count      INT NOT NULL DEFAULT 0,
  platforms_succeeded INT NOT NULL DEFAULT 0,
  platforms_failed    INT NOT NULL DEFAULT 0,
  render_engine       TEXT,
  -- Idempotency
  idempotency_key     TEXT UNIQUE,
  -- Error tracking
  error_message       TEXT,
  -- Timestamps
  charged_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  refunded_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_events_user ON public.generation_billing_events(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_brief ON public.generation_billing_events(brief_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_session ON public.generation_billing_events(generation_session_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_status ON public.generation_billing_events(status);
CREATE INDEX IF NOT EXISTS idx_billing_events_idempotency ON public.generation_billing_events(idempotency_key) WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.generation_billing_events ENABLE ROW LEVEL SECURITY;

-- Users can read their own billing events
CREATE POLICY "Users can read own billing events"
  ON public.generation_billing_events
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can manage billing events
CREATE POLICY "Service role manages billing events"
  ON public.generation_billing_events
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');


-- ═══════════════════════════════════════════════════════════════════════════════
-- ATOMIC FUNCTIONS — Server-side only, use SELECT ... FOR UPDATE
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── charge_generation_credits ─────────────────────────────────────────────
-- Atomically deducts credits and creates billing event + transaction.
-- Uses row-level locking to prevent race conditions.
-- Returns JSON with result details.

CREATE OR REPLACE FUNCTION public.charge_generation_credits(
  p_user_id UUID,
  p_brief_id UUID,
  p_session_id TEXT,
  p_credits NUMERIC,
  p_platform_count INT,
  p_render_engine TEXT DEFAULT 'html',
  p_pricing_snapshot JSONB DEFAULT '{}',
  p_credit_breakdown JSONB DEFAULT '{}',
  p_idempotency_key TEXT DEFAULT NULL
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
  v_balance_before NUMERIC;
  v_balance_after NUMERIC;
BEGIN
  -- Idempotency check: if this key was already used, return the existing event
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id, status, credits_charged INTO v_billing_event_id, v_wallet
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

  -- Ensure wallet exists (auto-create with 0 balance if not)
  INSERT INTO public.user_credit_wallets (user_id, balance)
  VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Lock the wallet row to prevent concurrent modifications
  SELECT * INTO v_wallet
  FROM public.user_credit_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'WALLET_NOT_FOUND',
      'message', 'User wallet not found'
    );
  END IF;

  -- Check sufficient balance
  IF v_wallet.balance < p_credits THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INSUFFICIENT_BALANCE',
      'balance', v_wallet.balance,
      'required', p_credits,
      'message', 'Insufficient credits'
    );
  END IF;

  v_balance_before := v_wallet.balance;
  v_balance_after := v_wallet.balance - p_credits;

  -- Deduct credits
  UPDATE public.user_credit_wallets
  SET
    balance = v_balance_after,
    lifetime_spent = lifetime_spent + p_credits,
    updated_at = now()
  WHERE id = v_wallet.id;

  -- Create billing event
  INSERT INTO public.generation_billing_events (
    user_id, wallet_id, brief_id, generation_session_id,
    credits_charged, status, platform_count, render_engine,
    pricing_snapshot, credit_breakdown, idempotency_key,
    charged_at
  )
  VALUES (
    p_user_id, v_wallet.id, p_brief_id, p_session_id,
    p_credits, 'charged', p_platform_count, p_render_engine,
    p_pricing_snapshot, p_credit_breakdown, p_idempotency_key,
    now()
  )
  RETURNING id INTO v_billing_event_id;

  -- Create immutable transaction record
  INSERT INTO public.credit_transactions (
    wallet_id, user_id, type, amount,
    balance_before, balance_after,
    description, reference_id, reference_type,
    metadata, idempotency_key
  )
  VALUES (
    v_wallet.id, p_user_id, 'charge', -p_credits,
    v_balance_before, v_balance_after,
    'Campaign generation charge',
    v_billing_event_id, 'generation',
    jsonb_build_object(
      'brief_id', p_brief_id,
      'session_id', p_session_id,
      'platform_count', p_platform_count,
      'render_engine', p_render_engine
    ),
    CASE WHEN p_idempotency_key IS NOT NULL
      THEN 'charge_' || p_idempotency_key
      ELSE NULL
    END
  )
  RETURNING id INTO v_txn_id;

  RETURN jsonb_build_object(
    'success', true,
    'billing_event_id', v_billing_event_id,
    'transaction_id', v_txn_id,
    'credits_charged', p_credits,
    'balance_before', v_balance_before,
    'balance_after', v_balance_after
  );
END;
$$;


-- ─── refund_generation_credits ─────────────────────────────────────────────
-- Atomically refunds credits for a failed generation.
-- Supports full and partial refunds.

CREATE OR REPLACE FUNCTION public.refund_generation_credits(
  p_billing_event_id UUID,
  p_refund_amount NUMERIC DEFAULT NULL,  -- NULL = full refund
  p_reason TEXT DEFAULT 'Generation failed',
  p_platforms_succeeded INT DEFAULT 0,
  p_platforms_failed INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event RECORD;
  v_wallet RECORD;
  v_refund NUMERIC;
  v_txn_id UUID;
  v_balance_before NUMERIC;
  v_balance_after NUMERIC;
  v_new_status public.billing_event_status;
BEGIN
  -- Lock the billing event
  SELECT * INTO v_event
  FROM public.generation_billing_events
  WHERE id = p_billing_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'EVENT_NOT_FOUND',
      'message', 'Billing event not found'
    );
  END IF;

  -- Cannot refund already-refunded events
  IF v_event.status = 'refunded' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ALREADY_REFUNDED',
      'message', 'This billing event has already been fully refunded'
    );
  END IF;

  -- Calculate refund amount
  v_refund := COALESCE(p_refund_amount, v_event.credits_charged - v_event.credits_refunded);

  -- Cannot refund more than was charged minus already refunded
  IF v_refund > (v_event.credits_charged - v_event.credits_refunded) THEN
    v_refund := v_event.credits_charged - v_event.credits_refunded;
  END IF;

  IF v_refund <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'NOTHING_TO_REFUND',
      'message', 'No refundable amount remaining'
    );
  END IF;

  -- Lock wallet
  SELECT * INTO v_wallet
  FROM public.user_credit_wallets
  WHERE id = v_event.wallet_id
  FOR UPDATE;

  v_balance_before := v_wallet.balance;
  v_balance_after := v_wallet.balance + v_refund;

  -- Return credits to wallet
  UPDATE public.user_credit_wallets
  SET
    balance = v_balance_after,
    lifetime_refunded = lifetime_refunded + v_refund,
    updated_at = now()
  WHERE id = v_wallet.id;

  -- Determine new status
  IF (v_event.credits_refunded + v_refund) >= v_event.credits_charged THEN
    v_new_status := 'refunded';
  ELSE
    v_new_status := 'partial_refund';
  END IF;

  -- Update billing event
  UPDATE public.generation_billing_events
  SET
    credits_refunded = credits_refunded + v_refund,
    status = v_new_status,
    platforms_succeeded = p_platforms_succeeded,
    platforms_failed = p_platforms_failed,
    error_message = p_reason,
    refunded_at = now(),
    updated_at = now()
  WHERE id = p_billing_event_id;

  -- Create immutable refund transaction
  INSERT INTO public.credit_transactions (
    wallet_id, user_id, type, amount,
    balance_before, balance_after,
    description, reference_id, reference_type,
    metadata
  )
  VALUES (
    v_wallet.id, v_event.user_id, 'refund', v_refund,
    v_balance_before, v_balance_after,
    p_reason,
    p_billing_event_id, 'generation',
    jsonb_build_object(
      'original_charge', v_event.credits_charged,
      'refund_amount', v_refund,
      'platforms_succeeded', p_platforms_succeeded,
      'platforms_failed', p_platforms_failed
    )
  )
  RETURNING id INTO v_txn_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_txn_id,
    'refund_amount', v_refund,
    'balance_before', v_balance_before,
    'balance_after', v_balance_after,
    'new_status', v_new_status::text
  );
END;
$$;


-- ─── complete_generation_billing ───────────────────────────────────────────
-- Marks a billing event as completed after successful generation.

CREATE OR REPLACE FUNCTION public.complete_generation_billing(
  p_billing_event_id UUID,
  p_platforms_succeeded INT DEFAULT 0,
  p_platforms_failed INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event RECORD;
BEGIN
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

  UPDATE public.generation_billing_events
  SET
    status = 'completed',
    platforms_succeeded = p_platforms_succeeded,
    platforms_failed = p_platforms_failed,
    completed_at = now(),
    updated_at = now()
  WHERE id = p_billing_event_id;

  RETURN jsonb_build_object(
    'success', true,
    'billing_event_id', p_billing_event_id,
    'net_cost', v_event.credits_charged - v_event.credits_refunded
  );
END;
$$;


-- ─── get_wallet_balance ────────────────────────────────────────────────────
-- Simple balance check (no locking needed for reads).

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
  FROM public.user_credit_wallets
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    -- Auto-create wallet
    INSERT INTO public.user_credit_wallets (user_id, balance)
    VALUES (p_user_id, 0)
    RETURNING * INTO v_wallet;
  END IF;

  RETURN jsonb_build_object(
    'balance', v_wallet.balance,
    'lifetime_earned', v_wallet.lifetime_earned,
    'lifetime_spent', v_wallet.lifetime_spent,
    'lifetime_refunded', v_wallet.lifetime_refunded,
    'wallet_id', v_wallet.id
  );
END;
$$;


-- ─── add_credits ───────────────────────────────────────────────────────────
-- Admin/purchase credit addition.

CREATE OR REPLACE FUNCTION public.add_credits(
  p_user_id UUID,
  p_amount NUMERIC,
  p_type public.credit_transaction_type DEFAULT 'topup',
  p_description TEXT DEFAULT 'Credit top-up',
  p_reference_id UUID DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet RECORD;
  v_txn_id UUID;
  v_balance_before NUMERIC;
  v_balance_after NUMERIC;
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_AMOUNT',
      'message', 'Amount must be positive'
    );
  END IF;

  -- Idempotency check
  IF p_idempotency_key IS NOT NULL THEN
    PERFORM 1 FROM public.credit_transactions
    WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'DUPLICATE_REQUEST'
      );
    END IF;
  END IF;

  -- Ensure wallet exists
  INSERT INTO public.user_credit_wallets (user_id, balance)
  VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Lock wallet
  SELECT * INTO v_wallet
  FROM public.user_credit_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  v_balance_before := v_wallet.balance;
  v_balance_after := v_wallet.balance + p_amount;

  -- Add credits
  UPDATE public.user_credit_wallets
  SET
    balance = v_balance_after,
    lifetime_earned = lifetime_earned + p_amount,
    updated_at = now()
  WHERE id = v_wallet.id;

  -- Record transaction
  INSERT INTO public.credit_transactions (
    wallet_id, user_id, type, amount,
    balance_before, balance_after,
    description, reference_id, reference_type,
    idempotency_key
  )
  VALUES (
    v_wallet.id, p_user_id, p_type, p_amount,
    v_balance_before, v_balance_after,
    p_description, p_reference_id, p_reference_type,
    p_idempotency_key
  )
  RETURNING id INTO v_txn_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_txn_id,
    'amount', p_amount,
    'balance_before', v_balance_before,
    'balance_after', v_balance_after
  );
END;
$$;
