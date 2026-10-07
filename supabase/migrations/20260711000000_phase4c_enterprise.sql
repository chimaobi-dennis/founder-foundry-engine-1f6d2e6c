-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 4c — Enterprise unlocks
--
-- * Database connections (provider 'postgres') need the Enterprise plan.
-- * Auto-merge for the Developer's pull requests is a connection scope
--   (scope.auto_merge_paths) honoured by run-step only when the owner's
--   entitlements say enterprise = true; no schema change needed for it.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.enforce_plan_limit()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ent jsonb;
  v_limit integer;
  v_count integer;
  v_kind text := TG_ARGV[0];
  v_user uuid;
  v_activating boolean;
BEGIN
  v_user := NEW.user_id;
  ent := public.get_entitlements(v_user);
  IF ent IS NULL THEN RETURN NEW; END IF;
  v_activating := NEW.status = 'active' AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'active'));

  IF v_kind = 'agents' THEN
    v_limit := (ent->>'agents')::int + (ent->>'extra_agent_seats')::int;
    IF (ent->>'agents')::int < 0 THEN RETURN NEW; END IF;
    SELECT count(*) INTO v_count FROM public.agent_hires WHERE user_id = v_user AND status = 'active' AND id <> NEW.id;
  ELSIF v_kind = 'automations' THEN
    v_limit := (ent->>'automations')::int;
    IF v_limit < 0 THEN RETURN NEW; END IF;
    SELECT count(*) INTO v_count FROM public.automations WHERE user_id = v_user AND status = 'active' AND id <> NEW.id;
  ELSIF v_kind = 'connections' THEN
    -- Enterprise-only providers are gated whatever the count.
    IF NEW.provider = 'postgres' AND v_activating AND NOT COALESCE((ent->>'enterprise')::boolean, false) THEN
      RAISE EXCEPTION 'PLAN_LIMIT: Database connections are included in Enterprise' USING ERRCODE = 'check_violation';
    END IF;
    v_limit := (ent->>'connections')::int;
    IF NEW.provider = 'github' THEN
      v_limit := (ent->>'code_repos')::int;
      IF v_limit < 0 THEN RETURN NEW; END IF;
      SELECT count(*) INTO v_count FROM public.tool_connections WHERE user_id = v_user AND provider = 'github' AND status <> 'paused' AND id <> NEW.id;
      IF v_activating AND v_count >= v_limit THEN
        RAISE EXCEPTION 'PLAN_LIMIT: % includes % connected repositories', ent->>'plan_name', v_limit USING ERRCODE = 'check_violation';
      END IF;
      RETURN NEW;
    END IF;
    IF v_limit < 0 THEN RETURN NEW; END IF;
    SELECT count(*) INTO v_count FROM public.tool_connections WHERE user_id = v_user AND provider <> 'github' AND status <> 'paused' AND id <> NEW.id;
  ELSE
    RETURN NEW;
  END IF;

  -- Only the transition INTO an active state is gated; pausing is always allowed.
  IF v_activating AND v_count >= v_limit THEN
    RAISE EXCEPTION 'PLAN_LIMIT: % includes % %', ent->>'plan_name', v_limit,
      CASE v_kind WHEN 'agents' THEN 'agents on your team' WHEN 'automations' THEN 'active schedules' ELSE 'connected tools' END
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
