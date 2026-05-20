-- ═══════════════════════════════════════════════════════════════════════════════
-- STRIPE BILLING INFRASTRUCTURE
-- Enables credit purchasing via Stripe Checkout with webhook-driven fulfillment.
--
-- Key principle: Credits are ONLY added from verified webhook events.
-- Frontend NEVER determines credit amounts. All mutations via service role.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─── 1. stripe_customers ──────────────────────────────────────────────────────
-- Maps Kinika users to Stripe customers. One row per user.

CREATE TABLE IF NOT EXISTS public.stripe_customers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL,
  email             TEXT,
  name              TEXT,
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id),
  UNIQUE (stripe_customer_id)
);

CREATE INDEX IF NOT EXISTS idx_stripe_customers_user ON public.stripe_customers(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_customers_stripe ON public.stripe_customers(stripe_customer_id);

ALTER TABLE public.stripe_customers ENABLE ROW LEVEL SECURITY;

-- Users can read their own Stripe customer record
CREATE POLICY "Users can read own stripe customer"
  ON public.stripe_customers
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can manage
CREATE POLICY "Service role manages stripe customers"
  ON public.stripe_customers
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');


-- ─── 2. credit_purchases ─────────────────────────────────────────────────────
-- Tracks every credit purchase attempt and fulfillment.
-- Status flow: pending → completed | failed | refunded

CREATE TYPE public.credit_purchase_status AS ENUM (
  'pending',      -- checkout session created, awaiting payment
  'completed',    -- payment verified, credits added to wallet
  'failed',       -- payment failed or expired
  'refunded'      -- purchase refunded via Stripe
);

CREATE TABLE IF NOT EXISTS public.credit_purchases (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Stripe references
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id   TEXT,
  stripe_customer_id    TEXT,
  -- Package snapshot (frozen at purchase time)
  package_id            UUID REFERENCES public.credit_packages(id),
  package_name          TEXT NOT NULL,
  credits_amount        NUMERIC(12,2) NOT NULL,
  price_usd             NUMERIC(10,2) NOT NULL,
  -- Fulfillment
  status                public.credit_purchase_status NOT NULL DEFAULT 'pending',
  credits_granted       NUMERIC(12,2) NOT NULL DEFAULT 0,
  wallet_transaction_id UUID REFERENCES public.credit_transactions(id),
  -- Idempotency: prevents double-crediting from duplicate webhooks
  fulfillment_idempotency_key TEXT UNIQUE,
  -- Timestamps
  paid_at               TIMESTAMPTZ,
  fulfilled_at          TIMESTAMPTZ,
  refunded_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Metadata
  metadata              JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_credit_purchases_user ON public.credit_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_purchases_session ON public.credit_purchases(stripe_checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_credit_purchases_payment ON public.credit_purchases(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_credit_purchases_status ON public.credit_purchases(status);
CREATE INDEX IF NOT EXISTS idx_credit_purchases_fulfillment ON public.credit_purchases(fulfillment_idempotency_key)
  WHERE fulfillment_idempotency_key IS NOT NULL;

ALTER TABLE public.credit_purchases ENABLE ROW LEVEL SECURITY;

-- Users can read their own purchases
CREATE POLICY "Users can read own purchases"
  ON public.credit_purchases
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can manage purchases
CREATE POLICY "Service role manages purchases"
  ON public.credit_purchases
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');


-- ─── 3. Enhance credit_packages (add stripe_price_id + sort) ──────────────────

ALTER TABLE public.credit_packages
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS badge TEXT,
  ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Seed default packages if empty
INSERT INTO public.credit_packages (name, credits, price_usd, active, sort_order, description, badge)
VALUES
  ('Starter',    50,   4.99, true, 1, '50 credits for quick campaigns', NULL),
  ('Growth',    200,  14.99, true, 2, '200 credits — best for weekly content', 'Popular'),
  ('Scale',     500,  29.99, true, 3, '500 credits — power users & teams', 'Best Value'),
  ('Enterprise', 2000, 99.99, true, 4, '2000 credits — unlimited creativity', NULL)
ON CONFLICT DO NOTHING;


-- ─── 4. Seed extended platform_settings ───────────────────────────────────────

INSERT INTO public.platform_settings (setting_key, setting_value, description)
VALUES
  ('billing', '{
    "stripe_live_mode": false,
    "free_trial_credits": 10,
    "max_retry_count": 3,
    "default_generation_cost": 1
  }', 'Billing and Stripe configuration')
ON CONFLICT (setting_key) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════════
-- ATOMIC FUNCTION: fulfill_credit_purchase
-- Called by webhook after verified Stripe payment.
-- Idempotent — safe to call multiple times with same fulfillment key.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fulfill_credit_purchase(
  p_purchase_id        UUID,
  p_user_id            UUID,
  p_credits_amount     NUMERIC,
  p_stripe_payment_intent_id TEXT DEFAULT NULL,
  p_fulfillment_key    TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id      UUID;
  v_balance_before NUMERIC;
  v_balance_after  NUMERIC;
  v_txn_id         UUID;
  v_existing       UUID;
BEGIN
  -- ── Idempotency check ──
  IF p_fulfillment_key IS NOT NULL THEN
    SELECT id INTO v_existing
    FROM public.credit_purchases
    WHERE fulfillment_idempotency_key = p_fulfillment_key
      AND status = 'completed';
    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'already_fulfilled', true,
        'purchase_id', v_existing
      );
    END IF;
  END IF;

  -- ── Get or create wallet ──
  SELECT id, balance INTO v_wallet_id, v_balance_before
  FROM public.user_credit_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    INSERT INTO public.user_credit_wallets (user_id, balance, lifetime_earned)
    VALUES (p_user_id, 0, 0)
    RETURNING id, balance INTO v_wallet_id, v_balance_before;
  END IF;

  -- ── Add credits to wallet ──
  v_balance_after := v_balance_before + p_credits_amount;

  UPDATE public.user_credit_wallets
  SET balance = v_balance_after,
      lifetime_earned = lifetime_earned + p_credits_amount,
      updated_at = now()
  WHERE id = v_wallet_id;

  -- ── Insert transaction ──
  INSERT INTO public.credit_transactions (
    wallet_id, user_id, type, amount,
    balance_before, balance_after,
    description, reference_id, reference_type,
    idempotency_key
  )
  VALUES (
    v_wallet_id, p_user_id, 'topup', p_credits_amount,
    v_balance_before, v_balance_after,
    'Credit purchase via Stripe',
    p_purchase_id, 'purchase',
    p_fulfillment_key
  )
  RETURNING id INTO v_txn_id;

  -- ── Update purchase record ──
  UPDATE public.credit_purchases
  SET status = 'completed',
      credits_granted = p_credits_amount,
      wallet_transaction_id = v_txn_id,
      stripe_payment_intent_id = COALESCE(p_stripe_payment_intent_id, stripe_payment_intent_id),
      fulfillment_idempotency_key = p_fulfillment_key,
      paid_at = COALESCE(paid_at, now()),
      fulfilled_at = now(),
      updated_at = now()
  WHERE id = p_purchase_id;

  RETURN jsonb_build_object(
    'success', true,
    'already_fulfilled', false,
    'purchase_id', p_purchase_id,
    'transaction_id', v_txn_id,
    'credits_granted', p_credits_amount,
    'balance_before', v_balance_before,
    'balance_after', v_balance_after
  );
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- ATOMIC FUNCTION: grant_credits_admin
-- Manual admin credit grant with full audit trail.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.grant_credits_admin(
  p_user_id        UUID,
  p_amount         NUMERIC,
  p_type           TEXT DEFAULT 'bonus',      -- 'bonus' | 'adjustment'
  p_description    TEXT DEFAULT 'Admin credit grant',
  p_admin_user_id  UUID DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id      UUID;
  v_balance_before NUMERIC;
  v_balance_after  NUMERIC;
  v_txn_id         UUID;
  v_existing       UUID;
BEGIN
  -- ── Idempotency ──
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing
    FROM public.credit_transactions
    WHERE idempotency_key = p_idempotency_key;
    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'already_granted', true, 'transaction_id', v_existing);
    END IF;
  END IF;

  -- ── Validate ──
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  IF p_type NOT IN ('bonus', 'adjustment', 'topup') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid credit type');
  END IF;

  -- ── Get or create wallet ──
  SELECT id, balance INTO v_wallet_id, v_balance_before
  FROM public.user_credit_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    INSERT INTO public.user_credit_wallets (user_id, balance, lifetime_earned)
    VALUES (p_user_id, 0, 0)
    RETURNING id, balance INTO v_wallet_id, v_balance_before;
  END IF;

  v_balance_after := v_balance_before + p_amount;

  UPDATE public.user_credit_wallets
  SET balance = v_balance_after,
      lifetime_earned = lifetime_earned + p_amount,
      updated_at = now()
  WHERE id = v_wallet_id;

  INSERT INTO public.credit_transactions (
    wallet_id, user_id, type, amount,
    balance_before, balance_after,
    description, reference_type,
    metadata, idempotency_key
  )
  VALUES (
    v_wallet_id, p_user_id, p_type::public.credit_transaction_type, p_amount,
    v_balance_before, v_balance_after,
    p_description, 'admin_grant',
    jsonb_build_object('admin_user_id', p_admin_user_id),
    p_idempotency_key
  )
  RETURNING id INTO v_txn_id;

  RETURN jsonb_build_object(
    'success', true,
    'already_granted', false,
    'transaction_id', v_txn_id,
    'credits_granted', p_amount,
    'balance_after', v_balance_after
  );
END;
$$;
