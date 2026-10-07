-- Kinika · Phase 4d (agent marketplace) — paste into Supabase → SQL Editor → Run.
-- Safe to run more than once. Applies migration 20260712000000 and records it.
-- Then redeploy: supabase functions deploy run-step

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 4d — Agent marketplace
--
-- The Creator program (creator_profiles, prostudio_templates) extends to
-- agents: an approved creator drafts an agent (prompt, tier, stages), submits
-- it for review, an admin publishes it, founders hire it like any other, and
-- every credit it earns pays the creator a share (creator_earnings).
-- System agents keep creator_id NULL and status 'published'.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS creator_id uuid REFERENCES public.creator_profiles(id) ON DELETE SET NULL;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published';
ALTER TABLE public.agents DROP CONSTRAINT IF EXISTS agents_status_check;
ALTER TABLE public.agents ADD CONSTRAINT agents_status_check CHECK (status IN ('draft', 'pending_review', 'published', 'unpublished'));
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS admin_notes text;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS revenue_share_pct smallint NOT NULL DEFAULT 30;
ALTER TABLE public.agents DROP CONSTRAINT IF EXISTS agents_revenue_share_check;
ALTER TABLE public.agents ADD CONSTRAINT agents_revenue_share_check CHECK (revenue_share_pct BETWEEN 0 AND 90);
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS uses_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
CREATE INDEX IF NOT EXISTS agents_creator_idx ON public.agents (creator_id) WHERE creator_id IS NOT NULL;

-- Founders see published, active agents; creators also see their own; admins everything.
DROP POLICY IF EXISTS "Authenticated users read active agents" ON public.agents;
CREATE POLICY "Authenticated users read active agents"
  ON public.agents FOR SELECT TO authenticated
  USING ((is_active AND status = 'published') OR creator_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Creators manage their agents" ON public.agents;
CREATE POLICY "Creators manage their agents"
  ON public.agents FOR ALL TO authenticated
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid() AND EXISTS (SELECT 1 FROM public.creator_profiles cp WHERE cp.id = auth.uid() AND cp.is_approved));

-- What a creator may set. Admins are unrestricted (their policy, their call).
CREATE OR REPLACE FUNCTION public.guard_creator_agent()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_admin boolean := public.is_admin();
  v_content_changed boolean;
BEGIN
  IF v_admin THEN
    IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN NEW.reviewed_at := now(); END IF;
    RETURN NEW;
  END IF;
  IF NEW.creator_id IS NULL OR NEW.creator_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the creator may edit this agent' USING ERRCODE = 'insufficient_privilege';
  END IF;
  -- Community agents run on the shared metered rules and never get tools.
  NEW.action_type := 'agent_custom_' || NEW.model_tier;
  NEW.allowed_tools := '{}';
  NEW.per_run_credit_ceiling := LEAST(COALESCE(NEW.per_run_credit_ceiling, 150), 300);
  NEW.cost_indicator := CASE NEW.model_tier WHEN 'fast' THEN 1 WHEN 'reasoning' THEN 3 ELSE 2 END;
  NEW.revenue_share_pct := COALESCE(OLD.revenue_share_pct, 30);
  NEW.admin_notes := CASE WHEN TG_OP = 'UPDATE' THEN OLD.admin_notes ELSE NULL END;
  NEW.uses_count := CASE WHEN TG_OP = 'UPDATE' THEN OLD.uses_count ELSE 0 END;
  NEW.is_active := true;
  NEW.sort_order := 1000;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('draft', 'pending_review') THEN NEW.status := 'draft'; END IF;
  ELSE
    v_content_changed := NEW.system_prompt IS DISTINCT FROM OLD.system_prompt
      OR NEW.name IS DISTINCT FROM OLD.name OR NEW.role IS DISTINCT FROM OLD.role
      OR NEW.description IS DISTINCT FROM OLD.description OR NEW.tagline IS DISTINCT FROM OLD.tagline
      OR NEW.model_tier IS DISTINCT FROM OLD.model_tier OR NEW.output_spec IS DISTINCT FROM OLD.output_spec
      OR NEW.unit_label IS DISTINCT FROM OLD.unit_label;
    IF OLD.status IN ('published', 'unpublished') THEN
      -- A creator may pause and resume a reviewed agent, but any change to
      -- what it says or does goes back through review.
      IF v_content_changed THEN
        NEW.status := 'pending_review';
      ELSIF NEW.status NOT IN ('published', 'unpublished') THEN
        NEW.status := OLD.status;
      END IF;
    ELSIF NEW.status NOT IN ('draft', 'pending_review') THEN
      NEW.status := OLD.status;
    END IF;
  END IF;
  IF NEW.status = 'pending_review' AND (TG_OP = 'INSERT' OR OLD.status <> 'pending_review') THEN NEW.submitted_at := now(); END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS agents_creator_guard ON public.agents;
CREATE TRIGGER agents_creator_guard BEFORE INSERT OR UPDATE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION public.guard_creator_agent();

-- Shared metered rules for community agents, one per tier.
INSERT INTO public.ai_generation_pricing
  (pricing_key, display_name, description, base_cost, per_platform_cost,
   complexity_multipliers, feature_multipliers, model_multipliers, is_active,
   pricing_mode, model_tier, range_factor, cogs_estimate_usd, unit_label)
VALUES
  ('agent_custom_fast',      'Community agent (fast)',      'One fast-tier step of a creator-made agent.',      3,  0, '{}', '{}', '{}', true, 'metered', 'fast',      1.5, 0.0056, 'item'),
  ('agent_custom_standard',  'Community agent (standard)',  'One standard-tier step of a creator-made agent.',  8,  0, '{}', '{}', '{}', true, 'metered', 'standard',  1.5, 0.0213, 'item'),
  ('agent_custom_reasoning', 'Community agent (reasoning)', 'One reasoning-tier step of a creator-made agent.', 20, 0, '{}', '{}', '{}', true, 'metered', 'reasoning', 1.5, 0.06,   'item')
ON CONFLICT (pricing_key) DO NOTHING;

-- ── Earnings ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.creator_earnings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id      uuid NOT NULL REFERENCES public.creator_profiles(id) ON DELETE CASCADE,
  agent_id        uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  run_id          uuid REFERENCES public.automation_runs(id) ON DELETE SET NULL,
  step_id         uuid UNIQUE REFERENCES public.automation_run_steps(id) ON DELETE SET NULL,
  founder_id      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  credits         integer NOT NULL,
  share_pct       smallint NOT NULL,
  amount_usd      numeric(10, 4) NOT NULL,
  paid_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS creator_earnings_creator_idx ON public.creator_earnings (creator_id, created_at DESC);
ALTER TABLE public.creator_earnings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Creators read their earnings" ON public.creator_earnings;
CREATE POLICY "Creators read their earnings"
  ON public.creator_earnings FOR SELECT TO authenticated USING (creator_id = auth.uid() OR public.is_admin());
-- Rows are written by run-step with the service role.

CREATE OR REPLACE FUNCTION public.bump_agent_uses(p_agent_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.agents SET uses_count = uses_count + 1 WHERE id = p_agent_id;
$$;
REVOKE ALL ON FUNCTION public.bump_agent_uses(uuid) FROM public, anon, authenticated;

INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES
  ('20260712000000', 'phase4d_marketplace')
ON CONFLICT (version) DO NOTHING;

COMMIT;
