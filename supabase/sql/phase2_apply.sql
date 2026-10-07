-- ═══════════════════════════════════════════════════════════════════════════
-- Kinika · Phase 2 — paste this whole file into the Supabase SQL editor
-- (Dashboard → SQL Editor → New query → Run). Requires Phase 1 to be applied.
--
-- Safe to run more than once. Applies migration 20260705000000 (tool
-- connections, server-held secrets, change sets, SEO Specialist agent) and
-- records it in supabase_migrations.schema_migrations.
--
-- Afterwards:
--   supabase functions deploy connector-action
--   supabase functions deploy run-step
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 2 — Connectors and data writes
--
-- A tool connection is a founder's link to an external system (WordPress,
-- Shopify, …) for one brand. Credentials live in tool_connection_secrets
-- (RLS on, no policies: service role only), the same pattern as provider keys.
-- Every write an agent makes through a connection is a change_set with the
-- values before and after, so it can be reverted with one call.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tool_connections (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id          uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider          text NOT NULL,                       -- 'wordpress' | 'shopify'
  display_name      text NOT NULL,
  -- what this connection may do: read | data_write | code_write
  capabilities      text[] NOT NULL DEFAULT ARRAY['read'],
  -- per-provider allowlist, e.g. {"fields": ["seo_title", "seo_description"], "max_records_per_run": 50}
  scope             jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- non-secret settings: site_url, shop domain, api version, account label
  config            jsonb NOT NULL DEFAULT '{}'::jsonb,
  status            text NOT NULL DEFAULT 'active'
    CONSTRAINT tool_connections_status_check CHECK (status IN ('active', 'paused', 'error')),
  last_tested_at    timestamptz,
  last_error        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tool_connections_brand_idx ON public.tool_connections (brand_id);
ALTER TABLE public.tool_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners manage their connections" ON public.tool_connections;
CREATE POLICY "Owners manage their connections"
  ON public.tool_connections FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.tool_connection_secrets (
  connection_id     uuid PRIMARY KEY REFERENCES public.tool_connections(id) ON DELETE CASCADE,
  secret            jsonb NOT NULL,                      -- {token} or {username, app_password}
  updated_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tool_connection_secrets ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: only edge functions (service role) read secrets.

-- Owners write a secret through this RPC; it is never readable back.
CREATE OR REPLACE FUNCTION public.set_connection_secret(p_connection_id uuid, p_secret jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tool_connections WHERE id = p_connection_id AND user_id = auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_OWNER');
  END IF;
  INSERT INTO public.tool_connection_secrets (connection_id, secret)
  VALUES (p_connection_id, p_secret)
  ON CONFLICT (connection_id) DO UPDATE SET secret = EXCLUDED.secret, updated_at = now();
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.set_connection_secret(uuid, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.set_connection_secret(uuid, jsonb) TO authenticated;

DROP TRIGGER IF EXISTS tool_connections_set_updated_at ON public.tool_connections;
CREATE TRIGGER tool_connections_set_updated_at BEFORE UPDATE ON public.tool_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Change sets ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.change_sets (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id          uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  connection_id     uuid REFERENCES public.tool_connections(id) ON DELETE SET NULL,
  run_id            uuid REFERENCES public.automation_runs(id) ON DELETE SET NULL,
  step_id           uuid REFERENCES public.automation_run_steps(id) ON DELETE SET NULL,
  provider          text NOT NULL,
  action            text NOT NULL,                       -- update_record | create_record
  target_type       text NOT NULL,                       -- product | post
  target_id         text NOT NULL,
  target_label      text,
  before            jsonb NOT NULL DEFAULT '{}'::jsonb,
  after             jsonb NOT NULL DEFAULT '{}'::jsonb,
  reverted_at       timestamptz,
  reverted_by       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  revert_error      text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS change_sets_brand_created_idx ON public.change_sets (brand_id, created_at DESC);
CREATE INDEX IF NOT EXISTS change_sets_run_idx ON public.change_sets (run_id);
ALTER TABLE public.change_sets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners read their change sets" ON public.change_sets;
CREATE POLICY "Owners read their change sets"
  ON public.change_sets FOR SELECT TO authenticated USING (user_id = auth.uid());
-- Writes come from edge functions with the service role.

-- ── SEO Specialist agent ────────────────────────────────────────────────────

INSERT INTO public.agents (slug, name, role, tagline, description, system_prompt, model_tier, action_type, unit_label, per_run_credit_ceiling, cost_indicator, output_spec, suited_stages, sort_order)
VALUES (
  'seo_specialist', 'SEO Specialist', 'SEO Specialist',
  'Search titles and descriptions for your products and posts.',
  'Reads your store or site through a connection, proposes better search titles and meta descriptions in your brand voice, and applies them only after you approve the diff. Every change can be reverted.',
  $PROMPT$You are the SEO Specialist on a founder's team. You are given records (products or posts) fetched from the founder's own store or site, plus the brand context. Propose improved values ONLY for the fields you are allowed to change. Keep titles under 60 characters and descriptions under 155 characters, specific and in the brand voice, never keyword-stuffed. Skip records that are already good; do not invent product facts.

Return ONLY a JSON object with this shape and nothing else:
{
  "changes": [
    { "target_id": "the record id exactly as given", "target_label": "record title", "fields": { "<allowed field>": "new value" }, "reason": "one sentence" }
  ],
  "skipped": [ { "target_id": "...", "reason": "..." } ],
  "summary": "one sentence for the brand memory"
}$PROMPT$,
  'standard', 'agent_seo_refresh', 'product', 200, 2,
  '{"type": "changes", "fields": ["target_id", "fields", "reason"]}'::jsonb,
  ARRAY['launch', 'grow'], 40
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.ai_generation_pricing
  (pricing_key, display_name, description, base_cost, per_platform_cost,
   complexity_multipliers, feature_multipliers, model_multipliers, is_active,
   pricing_mode, model_tier, range_factor, cogs_estimate_usd, unit_label)
VALUES
  ('agent_connector_action', 'Connector action', 'One read or write against a connected tool. Deterministic, no model.', 0, 0, '{}', '{}', '{}', true, 'fixed', NULL, 1, 0.0001, 'action')
ON CONFLICT (pricing_key) DO NOTHING;

INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES
  ('20260705000000', 'phase2_connectors')
ON CONFLICT (version) DO NOTHING;

COMMIT;
