-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 0 — Foundations for the agent platform
--
-- 1. Provider API keys move out of the browser-readable ai_providers row into
--    ai_provider_secrets (RLS on, no policies: service role only). Admins set
--    keys through a SECURITY DEFINER RPC and only ever see "has key / hint".
-- 2. model_rates: provider cost per 1M tokens, used by the gateway to turn
--    usage into COGS and by the quote engine to turn COGS into credits.
-- 3. ai_generation_pricing becomes the pricing_rules table: pricing_mode,
--    model_tier, range_factor, cogs_estimate_usd. Seeded with the ContentStudio
--    rule (current hardcoded multipliers) and the agent action rules.
-- 4. platform_settings.credit_economics: retail price per credit and the
--    COGS multiplier. Admin-editable; no deploy to change pricing.
-- 5. ai_usage_log: every gateway call with tokens, cost and credit-equivalent.
--    This is the COGS ledger the admin billing page reads.
-- 6. ai_task_defaults rows for the three model tiers so agents can ask for
--    "fast" / "standard" / "reasoning" instead of a concrete model.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Provider secrets ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_provider_secrets (
  provider_id uuid PRIMARY KEY REFERENCES public.ai_providers(id) ON DELETE CASCADE,
  api_key     text NOT NULL,
  updated_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_provider_secrets ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: only the service role (edge functions) can read.

-- Move any keys that are currently sitting in ai_providers.api_key.
INSERT INTO public.ai_provider_secrets (provider_id, api_key)
SELECT id, api_key
FROM public.ai_providers
WHERE api_key IS NOT NULL AND length(api_key) > 0
ON CONFLICT (provider_id) DO UPDATE SET api_key = EXCLUDED.api_key, updated_at = now();

UPDATE public.ai_providers SET api_key = NULL WHERE api_key IS NOT NULL;

-- Keep the column (callers select *) but make sure nothing can put a key back.
CREATE OR REPLACE FUNCTION public.block_api_key_on_ai_providers()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.api_key IS NOT NULL THEN
    RAISE EXCEPTION 'ai_providers.api_key is retired. Use admin_set_provider_api_key().';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ai_providers_block_api_key ON public.ai_providers;
CREATE TRIGGER ai_providers_block_api_key
  BEFORE INSERT OR UPDATE OF api_key ON public.ai_providers
  FOR EACH ROW EXECUTE FUNCTION public.block_api_key_on_ai_providers();

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$$;

CREATE OR REPLACE FUNCTION public.admin_set_provider_api_key(p_provider_id uuid, p_api_key text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

-- Admin UI needs to know whether a key exists without ever seeing it.
CREATE OR REPLACE FUNCTION public.admin_provider_key_status()
RETURNS TABLE (provider_id uuid, has_key boolean, key_hint text, updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id,
         s.provider_id IS NOT NULL,
         CASE WHEN s.provider_id IS NULL THEN NULL
              ELSE '••••' || right(s.api_key, 4) END,
         s.updated_at
  FROM public.ai_providers p
  LEFT JOIN public.ai_provider_secrets s ON s.provider_id = p.id
  WHERE public.is_admin();
$$;

REVOKE ALL ON FUNCTION public.admin_set_provider_api_key(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_set_provider_api_key(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_provider_key_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ── 2. Model rates ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.model_rates (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_slug       text NOT NULL,
  model_id            text NOT NULL,             -- provider's model identifier
  display_name        text,
  input_per_1m        numeric(10,4) NOT NULL DEFAULT 0,
  output_per_1m       numeric(10,4) NOT NULL DEFAULT 0,
  cache_read_per_1m   numeric(10,4),             -- NULL → same as input
  cache_write_per_1m  numeric(10,4),             -- NULL → same as input
  is_active           boolean NOT NULL DEFAULT true,
  source              text,                      -- where the rate came from
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT model_rates_provider_model_unique UNIQUE (provider_slug, model_id)
);

ALTER TABLE public.model_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read model rates"
  ON public.model_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage model rates"
  ON public.model_rates FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

INSERT INTO public.model_rates (provider_slug, model_id, display_name, input_per_1m, output_per_1m, cache_read_per_1m, cache_write_per_1m, source) VALUES
  ('anthropic', 'claude-haiku-4-5',  'Claude Haiku 4.5',  1.00,  5.00, 0.10, 1.25, 'Anthropic first-party pricing, Sept 2026'),
  ('anthropic', 'claude-sonnet-5-5', 'Claude Sonnet 5.5', 2.00, 10.00, 0.20, 2.50, 'Anthropic first-party pricing, Sept 2026'),
  ('anthropic', 'claude-opus-5-5',   'Claude Opus 5.5',   4.00, 20.00, 0.20, 5.00, 'Anthropic first-party pricing, Sept 2026')
ON CONFLICT (provider_slug, model_id) DO NOTHING;

-- ── 3. Pricing rules (extend ai_generation_pricing) ─────────────────────────

ALTER TABLE public.ai_generation_pricing
  ADD COLUMN IF NOT EXISTS pricing_mode       text NOT NULL DEFAULT 'fixed'
    CONSTRAINT ai_generation_pricing_mode_check CHECK (pricing_mode IN ('fixed', 'metered')),
  ADD COLUMN IF NOT EXISTS model_tier         text
    CONSTRAINT ai_generation_pricing_tier_check CHECK (model_tier IS NULL OR model_tier IN ('fast', 'standard', 'reasoning')),
  ADD COLUMN IF NOT EXISTS range_factor       numeric(6,2) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS cogs_estimate_usd  numeric(10,4),
  ADD COLUMN IF NOT EXISTS unit_label         text;

CREATE UNIQUE INDEX IF NOT EXISTS ai_generation_pricing_key_unique
  ON public.ai_generation_pricing (pricing_key);

-- The ContentStudio rule carries the multipliers that used to be hardcoded in
-- calculateGenerationCredits. Same numbers, so behaviour is unchanged.
INSERT INTO public.ai_generation_pricing
  (pricing_key, display_name, description, base_cost, per_platform_cost,
   complexity_multipliers, feature_multipliers, model_multipliers, is_active,
   pricing_mode, model_tier, range_factor, unit_label)
VALUES
  ('content_studio_generation', 'ContentStudio generation',
   'Per platform per variation, with complexity, visuals, SVG, experimental and AI-freedom multipliers.',
   0, 1,
   '{"simple": 0.75, "balanced": 1, "advanced": 1.5, "experimental": 2}'::jsonb,
   '{"ai_visuals": 1.5, "svg_per_platform": 0.5, "experimental_mode": 1.3, "ai_freedom_high": 1.2, "ai_freedom_threshold": 70}'::jsonb,
   '{}'::jsonb, true, 'fixed', 'standard', 1, 'platform')
ON CONFLICT (pricing_key) DO UPDATE SET
  complexity_multipliers = COALESCE(public.ai_generation_pricing.complexity_multipliers, EXCLUDED.complexity_multipliers),
  feature_multipliers    = COALESCE(public.ai_generation_pricing.feature_multipliers, EXCLUDED.feature_multipliers),
  pricing_mode           = EXCLUDED.pricing_mode,
  model_tier             = COALESCE(public.ai_generation_pricing.model_tier, EXCLUDED.model_tier),
  unit_label             = COALESCE(public.ai_generation_pricing.unit_label, EXCLUDED.unit_label);

-- Agent action rules. Credits come from the pricing model workbook
-- (docs/kinika-pricing-model.xlsx) at a 5x multiplier on estimated COGS.
INSERT INTO public.ai_generation_pricing
  (pricing_key, display_name, description, base_cost, per_platform_cost,
   complexity_multipliers, feature_multipliers, model_multipliers, is_active,
   pricing_mode, model_tier, range_factor, cogs_estimate_usd, unit_label)
VALUES
  ('agent_fast_step',       'Fast step (classify / summarize)', 'One fast-tier LLM step.',            2,   0, '{}', '{}', '{}', true, 'fixed',   'fast',      1,   0.0056, 'step'),
  ('agent_caption',         'Caption / short copy',             'One standard-tier copy step.',       6,   0, '{}', '{}', '{}', true, 'fixed',   'standard',  1,   0.0213, 'item'),
  ('agent_seo_refresh',     'Product SEO refresh',              'Per product. Classify + rewrite.',   5,   0, '{}', '{}', '{}', true, 'fixed',   'standard',  1,   0.0169, 'product'),
  ('agent_blog_post',       'Blog post',                        'Research + long-form draft.',       12,   0, '{}', '{}', '{}', true, 'metered', 'standard',  1.5, 0.0459, 'post'),
  ('agent_designed_post',   'Designed social post',             'Copy + image + critique.',          20,   0, '{}', '{}', '{}', true, 'fixed',   'standard',  1,   0.0769, 'post'),
  ('agent_short_video',     'Short video',                      'One short clip.',                  128,   0, '{}', '{}', '{}', true, 'fixed',   'standard',  1,   0.5113, 'clip'),
  ('agent_code_change',     'Code change (PR)',                 'Repo read + edits + build check.', 133,   0, '{}', '{}', '{}', true, 'metered', 'reasoning', 2,   0.5308, 'run')
ON CONFLICT (pricing_key) DO NOTHING;

-- ── 4. Credit economics setting ─────────────────────────────────────────────

INSERT INTO public.platform_settings (setting_key, setting_value, description)
VALUES (
  'credit_economics',
  '{"retail_usd_per_credit": 0.02, "cogs_multiplier": 5, "metered_overage_policy": "pause"}'::jsonb,
  'Retail price of one credit and the markup applied to provider cost when converting usage to credits.'
)
ON CONFLICT (setting_key) DO NOTHING;

-- ── 5. Usage log (COGS ledger) ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  generation_id       uuid REFERENCES public.generations(id) ON DELETE SET NULL,
  task_type           text NOT NULL,
  model_tier          text,
  provider_slug       text NOT NULL,
  model_id            text NOT NULL,
  input_tokens        integer NOT NULL DEFAULT 0,
  output_tokens       integer NOT NULL DEFAULT 0,
  cache_read_tokens   integer NOT NULL DEFAULT 0,
  cache_write_tokens  integer NOT NULL DEFAULT 0,
  cost_usd            numeric(12,6) NOT NULL DEFAULT 0,
  credits_equivalent  numeric(12,4) NOT NULL DEFAULT 0,
  latency_ms          integer,
  success             boolean NOT NULL DEFAULT true,
  error_message       text,
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_usage_log_user_created_idx ON public.ai_usage_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_log_created_idx ON public.ai_usage_log (created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_log_generation_idx ON public.ai_usage_log (generation_id);

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own usage"
  ON public.ai_usage_log FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins read all usage"
  ON public.ai_usage_log FOR SELECT TO authenticated USING (public.is_admin());
-- Inserts come from the gateway with the service role; no insert policy.

-- The gateway attaches real provider cost to the generation it served.
CREATE OR REPLACE FUNCTION public.add_generation_provider_cost(
  p_generation_id uuid,
  p_cost_usd numeric,
  p_provider text DEFAULT NULL,
  p_model text DEFAULT NULL,
  p_usage jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

REVOKE ALL ON FUNCTION public.add_generation_provider_cost(uuid, numeric, text, text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.add_generation_provider_cost(uuid, numeric, text, text, jsonb) TO service_role;

-- Daily COGS vs credits captured, for the admin billing page.
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
    WHERE transaction_type IN ('reservation_capture', 'generation_charge')
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

GRANT EXECUTE ON FUNCTION public.admin_cogs_daily(integer) TO authenticated;

-- ── 6. Model tier defaults ──────────────────────────────────────────────────
-- Agents request a tier; admins map each tier to a concrete model in
-- Admin → AI Models → Task Defaults, same as any other task type.

INSERT INTO public.ai_task_defaults (task_type, model_id)
SELECT t, NULL FROM unnest(ARRAY['tier_fast', 'tier_standard', 'tier_reasoning']) AS t
WHERE NOT EXISTS (SELECT 1 FROM public.ai_task_defaults d WHERE d.task_type = t);

-- ── 7. Admin write access without the service role in the browser ──────────
-- The admin billing page used to write pricing with a service-role client.
-- These policies let admins (profiles.role = 'admin') manage pricing and
-- settings through the normal client, and let everyone read what the quote
-- engine needs. Guarded so re-running is safe.

DO $$
BEGIN
  ALTER TABLE public.ai_generation_pricing ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ai_generation_pricing' AND policyname = 'Authenticated users read pricing rules') THEN
    CREATE POLICY "Authenticated users read pricing rules" ON public.ai_generation_pricing FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ai_generation_pricing' AND policyname = 'Admins manage pricing rules') THEN
    CREATE POLICY "Admins manage pricing rules" ON public.ai_generation_pricing FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
  END IF;

  ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'platform_settings' AND policyname = 'Authenticated users read platform settings') THEN
    CREATE POLICY "Authenticated users read platform settings" ON public.platform_settings FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'platform_settings' AND policyname = 'Admins manage platform settings') THEN
    CREATE POLICY "Admins manage platform settings" ON public.platform_settings FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
  END IF;
END $$;
