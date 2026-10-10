-- Kinika · Kinika's team and seats (S3) — paste into Supabase → SQL Editor → Run.
-- Safe to run more than once. No function deploy needed for this one.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Kinika's team and seats (build plan S3)
--
-- Kinika hires the roles a plan needs; the founder confirms the roster once.
-- The free trial is plans and consultation: no agent seats, so no hires and
-- no agent runs. Seats (how many agents) and credits (how much work) stay
-- separate; the agent-seat limit is enforced where hires and runs are made.
-- ─────────────────────────────────────────────────────────────────────────────

-- Trial: no agent seats. Plans and consultation only.
UPDATE public.credit_packages
SET limits = COALESCE(limits, '{}'::jsonb) || '{"agents": 0}'::jsonb
WHERE slug = 'free';

-- Who hired: Kinika (from the plan's roles) or the founder (from the team page).
ALTER TABLE public.agent_hires
  ADD COLUMN IF NOT EXISTS hired_by text NOT NULL DEFAULT 'founder'
    CONSTRAINT agent_hires_hired_by_check CHECK (hired_by IN ('founder', 'kinika'));

-- A run needs an active hire: no seat, no run. Service-role writes (the
-- runner, schedules, webhooks) are trusted; they only continue existing work.
CREATE OR REPLACE FUNCTION public.enforce_run_requires_hire()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() = 'service_role' OR NEW.agent_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.agent_hires h
    WHERE h.brand_id = NEW.brand_id AND h.agent_id = NEW.agent_id AND h.status = 'active'
  ) THEN
    RAISE EXCEPTION 'plan_limit: this agent is not on the team yet. Add an agent seat on Billing and let Kinika hire it.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS automation_runs_requires_hire ON public.automation_runs;
CREATE TRIGGER automation_runs_requires_hire BEFORE INSERT ON public.automation_runs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_run_requires_hire();

COMMIT;
