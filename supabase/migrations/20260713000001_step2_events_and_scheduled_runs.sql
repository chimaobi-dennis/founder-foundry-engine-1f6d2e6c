-- ─────────────────────────────────────────────────────────────────────────────
-- Step 2 — event triggers, conditions, and scheduled runs that actually bill
--
-- 1. Automations can fire on events inside Kinika (a milestone is reached, a
--    campaign is created) with simple conditions on the event's fields.
-- 2. enqueue_due_automations() inserted runs without a reservation, so a
--    scheduled run could only ever capture 1 credit. Runs now reserve the
--    automation's per-run budget, like webhook runs do. (run-step also plans
--    the steps of runs queued here; they used to have none.)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.automations DROP CONSTRAINT IF EXISTS automations_trigger_check;
ALTER TABLE public.automations ADD CONSTRAINT automations_trigger_check
  CHECK (trigger_type IN ('manual', 'schedule', 'webhook', 'event'));

ALTER TABLE public.automations ADD COLUMN IF NOT EXISTS event_type text;
ALTER TABLE public.automations DROP CONSTRAINT IF EXISTS automations_event_type_check;
ALTER TABLE public.automations ADD CONSTRAINT automations_event_type_check
  CHECK (event_type IS NULL OR event_type IN ('milestone_reached', 'campaign_created'));
ALTER TABLE public.automations ADD COLUMN IF NOT EXISTS conditions jsonb NOT NULL DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS automations_event_idx ON public.automations (brand_id, event_type)
  WHERE status = 'active' AND trigger_type = 'event';

-- conditions: [{ "field": "stage_key", "op": "eq|neq|contains", "value": "brand" }]
CREATE OR REPLACE FUNCTION public.event_conditions_match(p_conditions jsonb, p_payload jsonb)
RETURNS boolean
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  c jsonb;
  v_have text;
  v_want text;
BEGIN
  FOR c IN SELECT * FROM jsonb_array_elements(COALESCE(p_conditions, '[]'::jsonb)) LOOP
    v_have := lower(COALESCE(p_payload ->> (c ->> 'field'), ''));
    v_want := lower(COALESCE(c ->> 'value', ''));
    IF c ->> 'op' = 'neq' THEN
      IF v_have = v_want THEN RETURN false; END IF;
    ELSIF c ->> 'op' = 'contains' THEN
      IF position(v_want IN v_have) = 0 THEN RETURN false; END IF;
    ELSE
      IF v_have <> v_want THEN RETURN false; END IF;
    END IF;
  END LOOP;
  RETURN true;
END;
$$;

-- Queue a run for every active automation of this brand listening for the
-- event whose conditions match. The event id makes a repeat harmless.
CREATE OR REPLACE FUNCTION public.fire_automation_event(p_brand_id uuid, p_event text, p_payload jsonb, p_event_id text)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  a record;
  v_fired integer := 0;
  v_rows integer;
  v_credits integer;
BEGIN
  FOR a IN
    SELECT * FROM public.automations
    WHERE brand_id = p_brand_id AND status = 'active' AND trigger_type = 'event' AND event_type = p_event
  LOOP
    CONTINUE WHEN NOT public.event_conditions_match(a.conditions, p_payload);
    v_credits := COALESCE((a.budget ->> 'credits_per_run')::integer, 200);
    INSERT INTO public.automation_runs (automation_id, brand_id, user_id, agent_id, name, trigger_type, status, input, policy, budget, credits_quoted, credits_reserved, external_event_id)
    VALUES (
      a.id, a.brand_id, a.user_id, a.agent_id, a.name, 'event', 'queued',
      a.task_input || jsonb_build_object(
        'event', p_payload,
        'brief', COALESCE(a.task_input ->> 'brief', '') || E'\n\nEVENT DATA:\n' || left(p_payload::text, 2000)
      ),
      a.policy, a.budget, v_credits, v_credits, p_event_id
    )
    ON CONFLICT (automation_id, external_event_id) WHERE external_event_id IS NOT NULL DO NOTHING;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows > 0 THEN
      UPDATE public.automations SET last_run_at = now() WHERE id = a.id;
      v_fired := v_fired + 1;
    END IF;
  END LOOP;
  RETURN v_fired;
END;
$$;
REVOKE ALL ON FUNCTION public.fire_automation_event(uuid, text, jsonb, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fire_automation_event(uuid, text, jsonb, text) TO service_role;

-- The sources. A failure here must never block the insert that caused it.
CREATE OR REPLACE FUNCTION public.trg_milestone_event()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    PERFORM public.fire_automation_event(NEW.brand_id, 'milestone_reached',
      jsonb_build_object('milestone_id', NEW.id, 'name', NEW.name, 'category', NEW.category, 'stage_key', COALESCE(NEW.stage_key, '')),
      'milestone:' || NEW.id::text);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'milestone event not fired: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS milestones_fire_event ON public.milestones;
CREATE TRIGGER milestones_fire_event AFTER INSERT ON public.milestones
  FOR EACH ROW EXECUTE FUNCTION public.trg_milestone_event();

CREATE OR REPLACE FUNCTION public.trg_campaign_event()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    PERFORM public.fire_automation_event(NEW.brand_id, 'campaign_created',
      jsonb_build_object('campaign_id', NEW.id, 'name', NEW.name, 'status', COALESCE(NEW.status, ''), 'goal', COALESCE(NEW.campaign_goal, '')),
      'campaign:' || NEW.id::text);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'campaign event not fired: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS campaigns_fire_event ON public.campaigns;
CREATE TRIGGER campaigns_fire_event AFTER INSERT ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.trg_campaign_event();

-- Scheduled runs reserve their budget (they reserved 1 credit before).
CREATE OR REPLACE FUNCTION public.enqueue_due_automations(p_limit integer DEFAULT 20)
RETURNS SETOF uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  a RECORD;
  v_run_id uuid;
  v_credits integer;
BEGIN
  FOR a IN
    SELECT * FROM public.automations
    WHERE status = 'active' AND trigger_type = 'schedule'
      AND next_run_at IS NOT NULL AND next_run_at <= now()
    ORDER BY next_run_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    v_credits := COALESCE((a.budget ->> 'credits_per_run')::integer, 200);
    INSERT INTO public.automation_runs (automation_id, brand_id, user_id, agent_id, name, trigger_type, input, policy, budget, credits_quoted, credits_reserved)
    VALUES (a.id, a.brand_id, a.user_id, a.agent_id, a.name, 'schedule', a.task_input, a.policy, a.budget, v_credits, v_credits)
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
