-- Kinika · Phase 4d-fix 3 (agent guard vs service role) — paste into Supabase → SQL Editor → Run.
-- Safe to run more than once. No function redeploys.

BEGIN;

-- The creator guard on agents rejected the service role's uses_count bump
-- (auth.uid() is NULL there), so community agents never counted their runs.
CREATE OR REPLACE FUNCTION public.guard_creator_agent()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_admin boolean := public.is_admin();
  v_content_changed boolean;
BEGIN
  -- Admins are unrestricted. So is the service role (auth.uid() is NULL):
  -- run-step bumps uses_count through bump_agent_uses(); RLS already keeps
  -- anonymous callers out of this table.
  IF v_admin OR auth.uid() IS NULL THEN
    IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND v_admin THEN NEW.reviewed_at := now(); END IF;
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


INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES
  ('20260712000003', 'agent_guard_service_role')
ON CONFLICT (version) DO NOTHING;

COMMIT;
