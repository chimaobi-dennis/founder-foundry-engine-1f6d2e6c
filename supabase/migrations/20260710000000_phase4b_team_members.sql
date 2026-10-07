-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 4b — Team members
--
-- A brand is the workspace. Its owner (brands.user_id) pays and holds the
-- credit pool; members join by invite with a role:
--   viewer  reads everything, approves nothing
--   editor  does what the owner does day to day (tasks, approvals, content)
--   owner   also billing, connections' secrets, members, deletion
-- Row-level security on every brand-scoped table gains member policies
-- alongside the existing owner policies (policies OR together). Rows that
-- bill (runs, automations, hires, connections) keep user_id = owner so the
-- plan and wallet stay the owner's; created_by records who acted.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Membership ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.brand_members (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id      uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES public.profiles(id) ON DELETE CASCADE,   -- NULL until the invite is accepted
  email         text NOT NULL,
  role          text NOT NULL DEFAULT 'editor'
    CONSTRAINT brand_members_role_check CHECK (role IN ('editor', 'viewer')),
  status        text NOT NULL DEFAULT 'invited'
    CONSTRAINT brand_members_status_check CHECK (status IN ('invited', 'active')),
  invite_token  text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(18), 'hex'),
  invited_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  invited_at    timestamptz NOT NULL DEFAULT now(),
  accepted_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT brand_members_brand_email_unique UNIQUE (brand_id, email)
);
CREATE UNIQUE INDEX IF NOT EXISTS brand_members_brand_user_unique ON public.brand_members (brand_id, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS brand_members_user_idx ON public.brand_members (user_id) WHERE user_id IS NOT NULL;

-- ── Role helpers ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.brand_owner(p_brand_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT user_id FROM public.brands WHERE id = p_brand_id;
$$;

/** 'owner' | 'editor' | 'viewer' | NULL for the signed-in user. */
CREATE OR REPLACE FUNCTION public.brand_role(p_brand_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.brands b WHERE b.id = p_brand_id AND b.user_id = auth.uid()) THEN 'owner'
    ELSE (SELECT m.role FROM public.brand_members m WHERE m.brand_id = p_brand_id AND m.user_id = auth.uid() AND m.status = 'active' LIMIT 1)
  END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_brand(p_brand_id uuid, p_min_role text DEFAULT 'viewer')
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (CASE public.brand_role(p_brand_id) WHEN 'owner' THEN 3 WHEN 'editor' THEN 2 WHEN 'viewer' THEN 1 ELSE 0 END)
    >= (CASE p_min_role WHEN 'owner' THEN 3 WHEN 'editor' THEN 2 ELSE 1 END),
    false);
$$;

GRANT EXECUTE ON FUNCTION public.brand_owner(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.brand_role(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_brand(uuid, text) TO authenticated, service_role;

-- ── Membership RLS ──────────────────────────────────────────────────────────

ALTER TABLE public.brand_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners manage members" ON public.brand_members;
CREATE POLICY "Owners manage members" ON public.brand_members FOR ALL TO authenticated
  USING (public.can_access_brand(brand_id, 'owner')) WITH CHECK (public.can_access_brand(brand_id, 'owner'));
DROP POLICY IF EXISTS "Members see the roster" ON public.brand_members;
CREATE POLICY "Members see the roster" ON public.brand_members FOR SELECT TO authenticated
  USING (public.can_access_brand(brand_id, 'viewer'));
DROP POLICY IF EXISTS "Members leave" ON public.brand_members;
CREATE POLICY "Members leave" ON public.brand_members FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Accepting an invite: the token is the credential; the email must match.
CREATE OR REPLACE FUNCTION public.accept_brand_invite(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m RECORD;
  v_email text := lower(coalesce(auth.jwt()->>'email', ''));
  b RECORD;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'SIGN_IN_REQUIRED'); END IF;
  SELECT * INTO m FROM public.brand_members WHERE invite_token = p_token FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'INVITE_NOT_FOUND'); END IF;
  SELECT id, name, user_id INTO b FROM public.brands WHERE id = m.brand_id;
  IF m.status = 'active' THEN
    RETURN jsonb_build_object('success', true, 'already', true, 'brand_id', m.brand_id, 'brand_name', b.name, 'role', m.role);
  END IF;
  IF lower(m.email) <> v_email THEN
    RETURN jsonb_build_object('success', false, 'error', 'EMAIL_MISMATCH', 'invited_email', m.email);
  END IF;
  IF b.user_id = auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'OWNER_CANNOT_JOIN');
  END IF;
  UPDATE public.brand_members SET user_id = auth.uid(), status = 'active', accepted_at = now() WHERE id = m.id;
  RETURN jsonb_build_object('success', true, 'brand_id', m.brand_id, 'brand_name', b.name, 'role', m.role);
END;
$$;
GRANT EXECUTE ON FUNCTION public.accept_brand_invite(text) TO authenticated;

-- Member seats come from the owner's plan: limits.members counts the owner.
CREATE OR REPLACE FUNCTION public.enforce_member_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner uuid;
  ent jsonb;
  v_limit integer;
  v_count integer;
BEGIN
  v_owner := public.brand_owner(NEW.brand_id);
  ent := public.get_entitlements(v_owner);
  IF ent IS NULL THEN RETURN NEW; END IF;
  IF (ent->>'members')::int < 0 THEN RETURN NEW; END IF;
  v_limit := (ent->>'members')::int + (ent->>'extra_member_seats')::int - 1;
  SELECT count(*) INTO v_count
  FROM public.brand_members m JOIN public.brands b ON b.id = m.brand_id
  WHERE b.user_id = v_owner AND m.id <> NEW.id;
  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'PLAN_LIMIT: % includes % team member% besides you', ent->>'plan_name', v_limit, CASE WHEN v_limit = 1 THEN '' ELSE 's' END
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS brand_members_plan_limit ON public.brand_members;
CREATE TRIGGER brand_members_plan_limit BEFORE INSERT ON public.brand_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_member_limit();

-- Members may read the owner's entitlements (for quotes and badges).
CREATE OR REPLACE FUNCTION public.get_entitlements(p_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s RECORD;
  pkg RECORD;
  lim jsonb;
  v_status text := 'free';
  v_plan_slug text := 'free';
  v_plan_name text := 'Free';
  v_monthly integer := 0;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  IF auth.uid() IS DISTINCT FROM p_user_id AND NOT public.is_admin() AND auth.role() <> 'service_role'
     AND NOT EXISTS (
       SELECT 1 FROM public.brand_members m JOIN public.brands b ON b.id = m.brand_id
       WHERE m.user_id = auth.uid() AND m.status = 'active' AND b.user_id = p_user_id) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  SELECT * INTO s FROM public.subscriptions
  WHERE user_id = p_user_id AND status IN ('trialing', 'active', 'past_due')
  ORDER BY created_at DESC LIMIT 1;

  IF FOUND THEN
    SELECT * INTO pkg FROM public.credit_packages WHERE id = s.package_id;
    IF NOT FOUND THEN
      SELECT * INTO pkg FROM public.credit_packages WHERE slug = s.plan_slug;
    END IF;
    v_status := s.status; v_plan_slug := s.plan_slug;
    v_plan_name := COALESCE(pkg.name, initcap(s.plan_slug));
    v_monthly := COALESCE(s.monthly_credits, pkg.monthly_credits, 0);
    lim := COALESCE(pkg.limits, '{}'::jsonb);
  ELSE
    SELECT * INTO pkg FROM public.credit_packages WHERE slug = 'free';
    v_plan_name := COALESCE(pkg.name, 'Free');
    lim := COALESCE(pkg.limits, '{}'::jsonb);
  END IF;

  RETURN jsonb_build_object(
    'plan_slug', v_plan_slug,
    'plan_name', v_plan_name,
    'status', v_status,
    'monthly_credits', v_monthly,
    'agents', COALESCE((lim->>'agents')::int, 1),
    'automations', COALESCE((lim->>'automations')::int, 1),
    'connections', COALESCE((lim->>'connections')::int, 1),
    'members', COALESCE((lim->>'members')::int, 1),
    'autonomous_publishing', COALESCE((lim->>'autonomous_publishing')::boolean, false),
    'code_repos', COALESCE((lim->>'code_repos')::int, 0),
    'enterprise', COALESCE((lim->>'enterprise')::boolean, false),
    'extra_agent_seats', COALESCE(s.extra_agent_seats, 0),
    'extra_member_seats', COALESCE(s.extra_member_seats, 0),
    'current_period_end', s.current_period_end,
    'cancel_at_period_end', COALESCE(s.cancel_at_period_end, false)
  );
END;
$$;

-- Members may read the owner's wallet balance (the shared pool) but not write it.
CREATE OR REPLACE FUNCTION public.get_wallet_balance_for_brand(p_brand_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_access_brand(p_brand_id, 'viewer') THEN RAISE EXCEPTION 'not allowed'; END IF;
  RETURN public.get_wallet_balance(public.brand_owner(p_brand_id));
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_wallet_balance_for_brand(uuid) TO authenticated;

-- ── Attribution ─────────────────────────────────────────────────────────────

ALTER TABLE public.automation_runs ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.automations    ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.approvals      ADD COLUMN IF NOT EXISTS decided_role text;

-- ── Member policies on brand-scoped tables ──────────────────────────────────
-- Policies OR together: these add member access next to the owner policies.

DO $$
DECLARE
  t text;
  -- tables with a brand_id column; editors may insert/update, owners delete
  brand_tables text[] := ARRAY[
    'brand_dna', 'brand_dna_custom_fields', 'brand_stage_data', 'brand_stage_progress', 'brand_journey_events',
    'milestones', 'mentor_conversations', 'calendar_posts', 'campaigns', 'content_studio_briefs', 'documents', 'reels',
    'assets', 'project_assets', 'studio_sessions', 'template_outputs', 'agent_hires', 'automations', 'automation_runs',
    'approvals', 'tool_connections', 'change_sets'
  ];
  editor_delete text[] := ARRAY['calendar_posts', 'campaigns', 'content_studio_briefs', 'documents', 'reels', 'assets', 'project_assets', 'automations', 'agent_hires'];
BEGIN
  FOREACH t IN ARRAY brand_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Members read %1$s" ON public.%1$I', t);
    EXECUTE format('CREATE POLICY "Members read %1$s" ON public.%1$I FOR SELECT TO authenticated USING (public.can_access_brand(brand_id, ''viewer''))', t);
    IF t <> 'change_sets' THEN
      EXECUTE format('DROP POLICY IF EXISTS "Editors insert %1$s" ON public.%1$I', t);
      EXECUTE format('CREATE POLICY "Editors insert %1$s" ON public.%1$I FOR INSERT TO authenticated WITH CHECK (public.can_access_brand(brand_id, ''editor''))', t);
      EXECUTE format('DROP POLICY IF EXISTS "Editors update %1$s" ON public.%1$I', t);
      EXECUTE format('CREATE POLICY "Editors update %1$s" ON public.%1$I FOR UPDATE TO authenticated USING (public.can_access_brand(brand_id, ''editor'')) WITH CHECK (public.can_access_brand(brand_id, ''editor''))', t);
    END IF;
    IF t = ANY (editor_delete) THEN
      EXECUTE format('DROP POLICY IF EXISTS "Editors delete %1$s" ON public.%1$I', t);
      EXECUTE format('CREATE POLICY "Editors delete %1$s" ON public.%1$I FOR DELETE TO authenticated USING (public.can_access_brand(brand_id, ''editor''))', t);
    END IF;
  END LOOP;
END $$;

-- brands itself: members read, editors update, owner deletes (existing policy).
DROP POLICY IF EXISTS "Members read brands" ON public.brands;
CREATE POLICY "Members read brands" ON public.brands FOR SELECT TO authenticated USING (public.can_access_brand(id, 'viewer'));
DROP POLICY IF EXISTS "Editors update brands" ON public.brands;
CREATE POLICY "Editors update brands" ON public.brands FOR UPDATE TO authenticated USING (public.can_access_brand(id, 'editor')) WITH CHECK (public.can_access_brand(id, 'editor'));

-- Child tables reach the brand through their parent.
DROP POLICY IF EXISTS "Members read mentor_messages" ON public.mentor_messages;
CREATE POLICY "Members read mentor_messages" ON public.mentor_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.mentor_conversations c WHERE c.id = conversation_id AND public.can_access_brand(c.brand_id, 'viewer')));
DROP POLICY IF EXISTS "Editors write mentor_messages" ON public.mentor_messages;
CREATE POLICY "Editors write mentor_messages" ON public.mentor_messages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.mentor_conversations c WHERE c.id = conversation_id AND public.can_access_brand(c.brand_id, 'editor')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.mentor_conversations c WHERE c.id = conversation_id AND public.can_access_brand(c.brand_id, 'editor')));

DROP POLICY IF EXISTS "Members read content_studio_creatives" ON public.content_studio_creatives;
CREATE POLICY "Members read content_studio_creatives" ON public.content_studio_creatives FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.content_studio_briefs b WHERE b.id = brief_id AND public.can_access_brand(b.brand_id, 'viewer')));
DROP POLICY IF EXISTS "Editors write content_studio_creatives" ON public.content_studio_creatives;
CREATE POLICY "Editors write content_studio_creatives" ON public.content_studio_creatives FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.content_studio_briefs b WHERE b.id = brief_id AND public.can_access_brand(b.brand_id, 'editor')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.content_studio_briefs b WHERE b.id = brief_id AND public.can_access_brand(b.brand_id, 'editor')));

DROP POLICY IF EXISTS "Members read campaign_creatives" ON public.campaign_creatives;
CREATE POLICY "Members read campaign_creatives" ON public.campaign_creatives FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND public.can_access_brand(c.brand_id, 'viewer')));
DROP POLICY IF EXISTS "Editors write campaign_creatives" ON public.campaign_creatives;
CREATE POLICY "Editors write campaign_creatives" ON public.campaign_creatives FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND public.can_access_brand(c.brand_id, 'editor')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND public.can_access_brand(c.brand_id, 'editor')));

DROP POLICY IF EXISTS "Members read reel_scenes" ON public.reel_scenes;
CREATE POLICY "Members read reel_scenes" ON public.reel_scenes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.reels r WHERE r.id = reel_id AND public.can_access_brand(r.brand_id, 'viewer')));
DROP POLICY IF EXISTS "Editors write reel_scenes" ON public.reel_scenes;
CREATE POLICY "Editors write reel_scenes" ON public.reel_scenes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.reels r WHERE r.id = reel_id AND public.can_access_brand(r.brand_id, 'editor')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.reels r WHERE r.id = reel_id AND public.can_access_brand(r.brand_id, 'editor')));

DROP POLICY IF EXISTS "Members read automation_run_steps" ON public.automation_run_steps;
CREATE POLICY "Members read automation_run_steps" ON public.automation_run_steps FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.automation_runs r WHERE r.id = run_id AND public.can_access_brand(r.brand_id, 'viewer')));

DROP POLICY IF EXISTS "Members read creative_versions" ON public.creative_versions;
CREATE POLICY "Members read creative_versions" ON public.creative_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.content_studio_briefs b WHERE b.id = brief_id AND public.can_access_brand(b.brand_id, 'viewer')));
DROP POLICY IF EXISTS "Editors write creative_versions" ON public.creative_versions;
CREATE POLICY "Editors write creative_versions" ON public.creative_versions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.content_studio_briefs b WHERE b.id = brief_id AND public.can_access_brand(b.brand_id, 'editor')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.content_studio_briefs b WHERE b.id = brief_id AND public.can_access_brand(b.brand_id, 'editor')));

-- Viewers must not decide approvals: editors and owners only.
DROP POLICY IF EXISTS "Editors update approvals" ON public.approvals;
CREATE POLICY "Editors update approvals" ON public.approvals FOR UPDATE TO authenticated
  USING (public.can_access_brand(brand_id, 'editor')) WITH CHECK (public.can_access_brand(brand_id, 'editor'));

-- Connections' credentials stay owner-only (set_connection_secret checks user_id = owner already).
-- Members may pause/resume and remove is owner-only via the existing policies; editors can insert new
-- connections (their secret RPC call will be refused unless they own the row), so restrict inserts:
DROP POLICY IF EXISTS "Editors insert tool_connections" ON public.tool_connections;
DROP POLICY IF EXISTS "Editors update tool_connections" ON public.tool_connections;
CREATE POLICY "Editors update tool_connections" ON public.tool_connections FOR UPDATE TO authenticated
  USING (public.can_access_brand(brand_id, 'editor')) WITH CHECK (public.can_access_brand(brand_id, 'editor'));
