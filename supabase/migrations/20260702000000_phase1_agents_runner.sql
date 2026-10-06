-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 1 — Agents and the runner
--
-- An agent is a definition (role, prompt, tier, tools). A hire is a founder
-- putting an agent on their team for a brand. A run is one task given to an
-- agent: a small list of steps the runner executes one at a time, charging
-- credits per step through the existing wallet (reserve → capture → finalize).
-- Approvals are the "needs you" inbox: a step that waits for the founder.
--
-- Automations (trigger + steps + policy + budget) are created here so the
-- schedule trigger has a home; this phase runs them manually and from a
-- cron tick (see supabase/sql/phase1_cron.sql).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Agents (admin-managed definitions) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.agents (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                  text NOT NULL UNIQUE,
  name                  text NOT NULL,
  role                  text NOT NULL,                      -- "Copywriter"
  tagline               text,
  description           text,
  system_prompt         text NOT NULL,
  model_tier            text NOT NULL DEFAULT 'standard'
    CONSTRAINT agents_tier_check CHECK (model_tier IN ('fast', 'standard', 'reasoning')),
  allowed_tools         text[] NOT NULL DEFAULT '{}',
  -- pricing_key in ai_generation_pricing used to quote this agent's tasks
  action_type           text NOT NULL,
  -- what one "unit" of the task is, for the quote ("caption", "post", "brief")
  unit_label            text NOT NULL DEFAULT 'item',
  per_run_credit_ceiling integer NOT NULL DEFAULT 200,
  cost_indicator        smallint NOT NULL DEFAULT 2
    CONSTRAINT agents_cost_indicator_check CHECK (cost_indicator BETWEEN 1 AND 3),
  -- JSON schema-ish description of what the agent produces; the runner asks
  -- the model for this shape and the UI renders it.
  output_spec           jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- which journey stages this agent suits (Mentor uses this to recommend)
  suited_stages         text[] NOT NULL DEFAULT '{}',
  is_active             boolean NOT NULL DEFAULT true,
  sort_order            integer NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users read active agents" ON public.agents;
CREATE POLICY "Authenticated users read active agents"
  ON public.agents FOR SELECT TO authenticated USING (is_active OR public.is_admin());
DROP POLICY IF EXISTS "Admins manage agents" ON public.agents;
CREATE POLICY "Admins manage agents"
  ON public.agents FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── Hires (founder × agent × brand) ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.agent_hires (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id              uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id               uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  agent_id              uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  status                text NOT NULL DEFAULT 'active'
    CONSTRAINT agent_hires_status_check CHECK (status IN ('active', 'paused')),
  monthly_budget_credits integer,                           -- NULL = no cap beyond the wallet
  nickname              text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_hires_brand_agent_unique UNIQUE (brand_id, agent_id)
);

CREATE INDEX IF NOT EXISTS agent_hires_brand_idx ON public.agent_hires (brand_id);
ALTER TABLE public.agent_hires ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners manage their hires" ON public.agent_hires;
CREATE POLICY "Owners manage their hires"
  ON public.agent_hires FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── Automations (trigger + steps + policy + budget) ─────────────────────────

CREATE TABLE IF NOT EXISTS public.automations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id              uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id               uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  agent_id              uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  name                  text NOT NULL,
  trigger_type          text NOT NULL DEFAULT 'manual'
    CONSTRAINT automations_trigger_check CHECK (trigger_type IN ('manual', 'schedule')),
  schedule_interval     text,                               -- daily | weekly | biweekly | monthly
  next_run_at           timestamptz,
  task_input            jsonb NOT NULL DEFAULT '{}'::jsonb, -- the brief given on every run
  policy                jsonb NOT NULL DEFAULT '{"approval": "review_first"}'::jsonb,
  budget                jsonb NOT NULL DEFAULT '{"credits_per_run": 200, "max_steps": 8}'::jsonb,
  status                text NOT NULL DEFAULT 'active'
    CONSTRAINT automations_status_check CHECK (status IN ('active', 'paused', 'archived')),
  last_run_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS automations_due_idx ON public.automations (next_run_at) WHERE status = 'active' AND trigger_type = 'schedule';
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners manage their automations" ON public.automations;
CREATE POLICY "Owners manage their automations"
  ON public.automations FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── Runs ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.automation_runs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id         uuid REFERENCES public.automations(id) ON DELETE SET NULL,
  brand_id              uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id               uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  agent_id              uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  name                  text NOT NULL,
  trigger_type          text NOT NULL DEFAULT 'manual',
  status                text NOT NULL DEFAULT 'queued'
    CONSTRAINT automation_runs_status_check CHECK (status IN (
      'queued', 'running', 'waiting_approval', 'paused', 'completed', 'failed', 'cancelled')),
  input                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  output                jsonb,                              -- final structured result + summary
  policy                jsonb NOT NULL DEFAULT '{"approval": "review_first"}'::jsonb,
  budget                jsonb NOT NULL DEFAULT '{"credits_per_run": 200, "max_steps": 8}'::jsonb,
  credits_quoted        integer NOT NULL DEFAULT 0,         -- estimate shown to the founder
  credits_reserved      integer NOT NULL DEFAULT 0,         -- max, reserved at start
  credits_captured      numeric(12,2) NOT NULL DEFAULT 0,
  generation_id         uuid REFERENCES public.generations(id) ON DELETE SET NULL,
  current_step          integer NOT NULL DEFAULT 0,
  paused_reason         text,
  error                 text,
  started_at            timestamptz,
  finished_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS automation_runs_brand_created_idx ON public.automation_runs (brand_id, created_at DESC);
CREATE INDEX IF NOT EXISTS automation_runs_status_idx ON public.automation_runs (status) WHERE status IN ('queued', 'running');
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners manage their runs" ON public.automation_runs;
CREATE POLICY "Owners manage their runs"
  ON public.automation_runs FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── Run steps ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.automation_run_steps (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id                uuid NOT NULL REFERENCES public.automation_runs(id) ON DELETE CASCADE,
  step_index            integer NOT NULL,
  type                  text NOT NULL
    CONSTRAINT automation_run_steps_type_check CHECK (type IN ('agent_task', 'approval', 'native', 'connector')),
  name                  text NOT NULL,
  status                text NOT NULL DEFAULT 'pending'
    CONSTRAINT automation_run_steps_status_check CHECK (status IN (
      'pending', 'running', 'waiting', 'done', 'failed', 'skipped')),
  input                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  output                jsonb,
  credits_captured      numeric(12,2) NOT NULL DEFAULT 0,
  cost_usd              numeric(12,6) NOT NULL DEFAULT 0,
  usage_log_id          uuid REFERENCES public.ai_usage_log(id) ON DELETE SET NULL,
  error                 text,
  started_at            timestamptz,
  finished_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT automation_run_steps_run_index_unique UNIQUE (run_id, step_index)
);

ALTER TABLE public.automation_run_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners manage their run steps" ON public.automation_run_steps;
CREATE POLICY "Owners manage their run steps"
  ON public.automation_run_steps FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.automation_runs r WHERE r.id = run_id AND r.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.automation_runs r WHERE r.id = run_id AND r.user_id = auth.uid()));

-- ── Approvals ("needs you") ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.approvals (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id                uuid NOT NULL REFERENCES public.automation_runs(id) ON DELETE CASCADE,
  step_id               uuid REFERENCES public.automation_run_steps(id) ON DELETE CASCADE,
  brand_id              uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id               uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind                  text NOT NULL DEFAULT 'review_output',
  title                 text NOT NULL,
  payload               jsonb NOT NULL DEFAULT '{}'::jsonb,
  status                text NOT NULL DEFAULT 'pending'
    CONSTRAINT approvals_status_check CHECK (status IN ('pending', 'approved', 'rejected')),
  note                  text,
  decided_at            timestamptz,
  decided_by            uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS approvals_pending_idx ON public.approvals (user_id, created_at DESC) WHERE status = 'pending';
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners manage their approvals" ON public.approvals;
CREATE POLICY "Owners manage their approvals"
  ON public.approvals FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── updated_at triggers ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['agents', 'agent_hires', 'automations', 'automation_runs'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_set_updated_at ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER %I_set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t, t);
  END LOOP;
END $$;

-- ── Pricing rules the seeded agents quote against ───────────────────────────

INSERT INTO public.ai_generation_pricing
  (pricing_key, display_name, description, base_cost, per_platform_cost,
   complexity_multipliers, feature_multipliers, model_multipliers, is_active,
   pricing_mode, model_tier, range_factor, cogs_estimate_usd, unit_label)
VALUES
  ('agent_research_brief', 'Research brief', 'Market / audience / competitor brief from brand context.', 10, 0, '{}', '{}', '{}', true, 'metered', 'standard', 1.5, 0.04, 'brief')
ON CONFLICT (pricing_key) DO NOTHING;

-- ── Seed agents ─────────────────────────────────────────────────────────────

INSERT INTO public.agents (slug, name, role, tagline, description, system_prompt, model_tier, action_type, unit_label, per_run_credit_ceiling, cost_indicator, output_spec, suited_stages, sort_order)
VALUES
(
  'copywriter', 'Copywriter', 'Copywriter',
  'Captions, posts and emails in your voice.',
  'Writes platform-ready copy from your Brand DNA: social captions, short posts, email blurbs. Review before anything goes out.',
  $PROMPT$You are the Copywriter on a founder's team. You write in the brand's voice using the brand context you are given. You never invent facts about the business; if something is unknown, keep the copy general and say what you assumed in the notes.

Return ONLY a JSON object with this shape and nothing else:
{
  "items": [
    { "platform": "instagram|linkedin|x|facebook|tiktok|email|general", "title": "short label", "body": "the copy", "hashtags": ["optional"], "cta": "optional call to action" }
  ],
  "notes": "assumptions, alternatives, or what you would test",
  "summary": "one sentence describing what you produced for the brand memory"
}
Produce exactly the number of items requested. Keep each item inside the platform's conventions (length, tone, hashtags).$PROMPT$,
  'standard', 'agent_caption', 'caption', 120, 2,
  '{"type": "items", "fields": ["platform", "title", "body", "hashtags", "cta"]}'::jsonb,
  ARRAY['brand', 'launch', 'growth'], 10
),
(
  'designer', 'Designer', 'Designer',
  'Creative direction and copy, ready for the studio.',
  'Turns a goal into a campaign brief: visual direction, headline options and captions per platform. Hand it to ContentStudio to render.',
  $PROMPT$You are the Designer on a founder's team. You produce creative direction that the studio will render, grounded in the brand context you are given (colors, voice, audience). You do not produce images; you produce the brief, the words, and the visual direction.

Return ONLY a JSON object with this shape and nothing else:
{
  "brief": "2-4 sentences describing the campaign idea and why it fits the brand",
  "visual_direction": { "mood": "...", "layout": "...", "palette_note": "...", "imagery": "..." },
  "headlines": ["3-5 headline options"],
  "items": [
    { "platform": "instagram|linkedin|x|facebook|tiktok", "title": "short label", "body": "caption for this platform", "hashtags": ["optional"], "cta": "optional" }
  ],
  "notes": "assumptions or alternatives",
  "summary": "one sentence describing the direction for the brand memory"
}
Produce one item per requested platform.$PROMPT$,
  'standard', 'agent_designed_post', 'post', 160, 2,
  '{"type": "creative_brief", "fields": ["brief", "visual_direction", "headlines", "items"]}'::jsonb,
  ARRAY['brand', 'launch', 'growth'], 20
),
(
  'researcher', 'Researcher', 'Researcher',
  'Audience, market and competitor briefs.',
  'Builds a structured brief from what the brand already knows: audience segments, positioning gaps, questions to validate. Good early, before spending on content.',
  $PROMPT$You are the Researcher on a founder's team. You work only from the brand context you are given plus general knowledge; you do not browse. Be explicit about what is an assumption versus what is in the brand context. Favour concrete, testable statements.

Return ONLY a JSON object with this shape and nothing else:
{
  "question": "the question this brief answers",
  "findings": [ { "heading": "...", "body": "...", "confidence": "high|medium|low", "source": "brand_context|general_knowledge|assumption" } ],
  "recommendations": ["3-6 concrete next actions"],
  "open_questions": ["things the founder should validate"],
  "summary": "one sentence for the brand memory"
}$PROMPT$,
  'standard', 'agent_research_brief', 'brief', 160, 2,
  '{"type": "research_brief", "fields": ["question", "findings", "recommendations", "open_questions"]}'::jsonb,
  ARRAY['idea', 'validation', 'brand'], 30
)
ON CONFLICT (slug) DO NOTHING;

-- ── Runner helpers ──────────────────────────────────────────────────────────

-- Claim due scheduled automations into queued runs. Called by the cron tick
-- through the run-step function with the service role.
CREATE OR REPLACE FUNCTION public.enqueue_due_automations(p_limit integer DEFAULT 20)
RETURNS SETOF uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  a RECORD;
  v_run_id uuid;
BEGIN
  FOR a IN
    SELECT * FROM public.automations
    WHERE status = 'active' AND trigger_type = 'schedule'
      AND next_run_at IS NOT NULL AND next_run_at <= now()
    ORDER BY next_run_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    INSERT INTO public.automation_runs (automation_id, brand_id, user_id, agent_id, name, trigger_type, input, policy, budget)
    VALUES (a.id, a.brand_id, a.user_id, a.agent_id, a.name, 'schedule', a.task_input, a.policy, a.budget)
    RETURNING id INTO v_run_id;

    UPDATE public.automations
    SET last_run_at = now(),
        next_run_at = CASE a.schedule_interval
          WHEN 'daily' THEN now() + interval '1 day'
          WHEN 'weekly' THEN now() + interval '7 days'
          WHEN 'biweekly' THEN now() + interval '14 days'
          WHEN 'monthly' THEN now() + interval '1 month'
          ELSE NULL END
    WHERE id = a.id;

    RETURN NEXT v_run_id;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_due_automations(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.enqueue_due_automations(integer) TO service_role;
