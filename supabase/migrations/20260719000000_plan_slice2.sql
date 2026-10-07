-- ─────────────────────────────────────────────────────────────────────────────
-- The founder's plan, slice 2 — the plan keeps itself current
--
-- Reaching a milestone or moving journey stage queues a revision note on the
-- plan; the runner's housekeeping tick asks Mentor to revise it (debounced so
-- several events become one revision). Once a week the tick writes a check-in:
-- what moved, what is next, what has stalled. No new tables: brand_plans
-- carries the queue and the cadence.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.brand_plans
  ADD COLUMN IF NOT EXISTS auto_revise          boolean NOT NULL DEFAULT true,  -- revise on milestones and stage changes
  ADD COLUMN IF NOT EXISTS revise_note          text,                           -- what happened since; cleared when revised
  ADD COLUMN IF NOT EXISTS revise_requested_at  timestamptz,
  ADD COLUMN IF NOT EXISTS last_revision_reason text,                           -- shown on the plan: "Revised after: …"
  ADD COLUMN IF NOT EXISTS next_checkin_at      timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  ADD COLUMN IF NOT EXISTS last_checkin_at      timestamptz;

CREATE INDEX IF NOT EXISTS brand_plans_revise_idx ON public.brand_plans (revise_requested_at) WHERE revise_note IS NOT NULL;
CREATE INDEX IF NOT EXISTS brand_plans_checkin_idx ON public.brand_plans (next_checkin_at);

-- Queue a revision. Reasons accumulate (deduplicated) until the tick revises;
-- the first request's time is kept so the debounce measures from the first event.
CREATE OR REPLACE FUNCTION public.plan_request_revision(p_brand_id uuid, p_reason text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.brand_plans SET
    revise_note = CASE
      WHEN revise_note IS NULL OR revise_note = '' THEN left(p_reason, 1500)
      WHEN position(p_reason IN revise_note) > 0 THEN revise_note
      ELSE left(revise_note || ' ' || p_reason, 1500) END,
    revise_requested_at = COALESCE(revise_requested_at, now())
  WHERE brand_id = p_brand_id AND auto_revise;
$$;
REVOKE ALL ON FUNCTION public.plan_request_revision(uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.plan_request_revision(uuid, text) TO service_role;

-- A milestone reached is news for the plan.
CREATE OR REPLACE FUNCTION public.trg_milestone_plan_revision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    PERFORM public.plan_request_revision(NEW.brand_id, 'Milestone reached: ' || NEW.name || '.');
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'plan revision not queued: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS milestones_plan_revision ON public.milestones;
CREATE TRIGGER milestones_plan_revision AFTER INSERT ON public.milestones
  FOR EACH ROW EXECUTE FUNCTION public.trg_milestone_plan_revision();

-- So is a change of journey stage (Mentor advancing the founder, or the founder moving it).
CREATE OR REPLACE FUNCTION public.trg_brand_stage_plan_revision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.journey_stage IS DISTINCT FROM OLD.journey_stage AND NEW.journey_stage IS NOT NULL THEN
    BEGIN
      PERFORM public.plan_request_revision(NEW.id, 'Journey stage moved from ' || COALESCE(OLD.journey_stage, 'none') || ' to ' || NEW.journey_stage || '.');
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'plan revision not queued: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS brands_stage_plan_revision ON public.brands;
CREATE TRIGGER brands_stage_plan_revision AFTER UPDATE OF journey_stage ON public.brands
  FOR EACH ROW EXECUTE FUNCTION public.trg_brand_stage_plan_revision();

-- The tick's two new notifications.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
  type = ANY (ARRAY[
    'content_series_ready', 'content_series_failed', 'campaign_generated',
    'milestone_reached', 'stage_suggested', 'mentor_insight', 'system',
    'agent_needs_you', 'agent_run_completed', 'agent_run_paused', 'agent_run_failed', 'agent_digest',
    'plan_revised', 'plan_checkin'
  ]::text[])
);
