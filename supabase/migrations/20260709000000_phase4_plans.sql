-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 4 — Plans, seats and entitlements
--
-- Plans are credit_packages rows with billing_interval = 'month' and a
-- limits JSON. Seats are add-on packages (addon_kind). A founder's active
-- subscription row is the source of truth for what they may do; the
-- get_entitlements() RPC computes it and three triggers enforce the counts
-- so the limits hold even if the UI is bypassed. Monthly credits are
-- granted once per billing period, idempotently.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Packages: plan metadata ─────────────────────────────────────────────────

ALTER TABLE public.credit_packages
  ADD COLUMN IF NOT EXISTS billing_interval text NOT NULL DEFAULT 'one_time'
    CONSTRAINT credit_packages_interval_check CHECK (billing_interval IN ('one_time', 'month')),
  ADD COLUMN IF NOT EXISTS addon_kind text
    CONSTRAINT credit_packages_addon_check CHECK (addon_kind IS NULL OR addon_kind IN ('agent_seat', 'member_seat')),
  ADD COLUMN IF NOT EXISTS limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS tagline text;

CREATE UNIQUE INDEX IF NOT EXISTS credit_packages_slug_unique ON public.credit_packages (slug) WHERE slug IS NOT NULL;

-- The legacy free trial row keeps its credits; give it a slug and limits.
UPDATE public.credit_packages
SET slug = 'free', billing_interval = 'month', is_subscription = true,
    limits = '{"agents": 1, "automations": 1, "connections": 1, "members": 1, "autonomous_publishing": false, "code_repos": 0, "enterprise": false}'::jsonb,
    tagline = 'Try one agent on one task.'
WHERE slug IS NULL AND price_usd = 0 AND name ILIKE '%free%';

INSERT INTO public.credit_packages
  (slug, name, description, tagline, credits, price_usd, active, sort_order, is_subscription, monthly_credits, max_workspaces, billing_interval, addon_kind, limits, badge)
VALUES
  ('solo', 'Solo', 'Two agents, three schedules, 1,000 credits a month. Review-first on everything.', 'For one founder getting things going.',
   1000, 20, true, 10, true, 1000, 1, 'month', NULL,
   '{"agents": 2, "automations": 3, "connections": 2, "members": 1, "autonomous_publishing": false, "code_repos": 1, "enterprise": false}'::jsonb, NULL),
  ('startup', 'Startup', 'Five agents, fifteen schedules, 2,000 credits a month, autonomous publishing, three repos.', 'For a small team automating real workflows.',
   2000, 45, true, 20, true, 2000, 3, 'month', NULL,
   '{"agents": 5, "automations": 15, "connections": -1, "members": 3, "autonomous_publishing": true, "code_repos": 3, "enterprise": false}'::jsonb, 'Most popular'),
  ('enterprise', 'Enterprise', 'Ten agents, unlimited schedules and tools, 6,000 credits a month, twenty members, Enterprise unlocks.', 'For teams running the business on agents.',
   6000, 139, true, 30, true, 6000, 10, 'month', NULL,
   '{"agents": 10, "automations": -1, "connections": -1, "members": 20, "autonomous_publishing": true, "code_repos": -1, "enterprise": true}'::jsonb, NULL),
  ('agent_seat', 'Extra agent', 'One more agent on your team, any role, with 250 credits a month.', NULL,
   250, 10, true, 40, true, 250, NULL, 'month', 'agent_seat', '{}'::jsonb, NULL),
  ('member_seat', 'Extra team member', 'One more person in the workspace, sharing the credit pool.', NULL,
   0, 5, true, 41, true, 0, NULL, 'month', 'member_seat', '{}'::jsonb, NULL),
  ('topup_10', 'Top-up 500', '500 credits, never expire.', NULL, 500, 10, true, 50, false, 0, NULL, 'one_time', NULL, '{}'::jsonb, NULL),
  ('topup_20', 'Top-up 1,000', '1,000 credits, never expire.', NULL, 1000, 20, true, 51, false, 0, NULL, 'one_time', NULL, '{}'::jsonb, NULL),
  ('topup_50', 'Top-up 2,750', '2,750 credits (10% bonus), never expire.', NULL, 2750, 50, true, 52, false, 0, NULL, 'one_time', NULL, '{}'::jsonb, 'Best value')
ON CONFLICT (slug) WHERE slug IS NOT NULL DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, tagline = EXCLUDED.tagline,
  credits = EXCLUDED.credits, price_usd = EXCLUDED.price_usd, sort_order = EXCLUDED.sort_order,
  is_subscription = EXCLUDED.is_subscription, monthly_credits = EXCLUDED.monthly_credits,
  billing_interval = EXCLUDED.billing_interval, addon_kind = EXCLUDED.addon_kind, limits = EXCLUDED.limits, badge = EXCLUDED.badge;

-- ── Subscriptions ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  package_id                  uuid REFERENCES public.credit_packages(id) ON DELETE SET NULL,
  plan_slug                   text NOT NULL,
  stripe_subscription_id      text UNIQUE,
  stripe_customer_id          text,
  status                      text NOT NULL DEFAULT 'incomplete'
    CONSTRAINT subscriptions_status_check CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'unpaid')),
  monthly_credits             integer NOT NULL DEFAULT 0,
  extra_agent_seats           integer NOT NULL DEFAULT 0,
  extra_member_seats          integer NOT NULL DEFAULT 0,
  current_period_start        timestamptz,
  current_period_end          timestamptz,
  cancel_at_period_end        boolean NOT NULL DEFAULT false,
  last_credit_grant_period    timestamptz,                 -- idempotency for monthly grants
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscriptions_user_idx ON public.subscriptions (user_id);
-- One usable subscription per founder.
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_one_live_per_user
  ON public.subscriptions (user_id) WHERE status IN ('trialing', 'active', 'past_due', 'incomplete');

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners read their subscription" ON public.subscriptions;
CREATE POLICY "Owners read their subscription" ON public.subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Admins read all subscriptions" ON public.subscriptions;
CREATE POLICY "Admins read all subscriptions" ON public.subscriptions FOR SELECT TO authenticated USING (public.is_admin());
-- Writes come from the Stripe webhook with the service role.

DROP TRIGGER IF EXISTS subscriptions_set_updated_at ON public.subscriptions;
CREATE TRIGGER subscriptions_set_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Entitlements ────────────────────────────────────────────────────────────

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
  IF auth.uid() IS DISTINCT FROM p_user_id AND NOT public.is_admin() AND auth.role() <> 'service_role' THEN
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
GRANT EXECUTE ON FUNCTION public.get_entitlements(uuid) TO authenticated, service_role;

-- ── Enforcement triggers ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.enforce_plan_limit()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ent jsonb;
  v_limit integer;
  v_count integer;
  v_kind text := TG_ARGV[0];
  v_user uuid;
BEGIN
  v_user := NEW.user_id;
  ent := public.get_entitlements(v_user);
  IF ent IS NULL THEN RETURN NEW; END IF;

  IF v_kind = 'agents' THEN
    v_limit := (ent->>'agents')::int + (ent->>'extra_agent_seats')::int;
    IF (ent->>'agents')::int < 0 THEN RETURN NEW; END IF;
    SELECT count(*) INTO v_count FROM public.agent_hires WHERE user_id = v_user AND status = 'active' AND id <> NEW.id;
  ELSIF v_kind = 'automations' THEN
    v_limit := (ent->>'automations')::int;
    IF v_limit < 0 THEN RETURN NEW; END IF;
    SELECT count(*) INTO v_count FROM public.automations WHERE user_id = v_user AND status = 'active' AND id <> NEW.id;
  ELSIF v_kind = 'connections' THEN
    v_limit := (ent->>'connections')::int;
    IF NEW.provider = 'github' THEN
      v_limit := (ent->>'code_repos')::int;
      IF v_limit < 0 THEN RETURN NEW; END IF;
      SELECT count(*) INTO v_count FROM public.tool_connections WHERE user_id = v_user AND provider = 'github' AND status <> 'paused' AND id <> NEW.id;
      IF v_count >= v_limit THEN
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
  IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.status = 'active' AND OLD.status IS DISTINCT FROM 'active')) AND NEW.status = 'active' THEN
    IF v_count >= v_limit THEN
      RAISE EXCEPTION 'PLAN_LIMIT: % includes % %', ent->>'plan_name', v_limit,
        CASE v_kind WHEN 'agents' THEN 'agents on your team' WHEN 'automations' THEN 'active schedules' ELSE 'connected tools' END
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS agent_hires_plan_limit ON public.agent_hires;
CREATE TRIGGER agent_hires_plan_limit BEFORE INSERT OR UPDATE OF status ON public.agent_hires
  FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_limit('agents');
DROP TRIGGER IF EXISTS automations_plan_limit ON public.automations;
CREATE TRIGGER automations_plan_limit BEFORE INSERT OR UPDATE OF status ON public.automations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_limit('automations');
DROP TRIGGER IF EXISTS tool_connections_plan_limit ON public.tool_connections;
CREATE TRIGGER tool_connections_plan_limit BEFORE INSERT OR UPDATE OF status ON public.tool_connections
  FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_limit('connections');

-- ── Monthly credit grant (idempotent per billing period) ────────────────────

CREATE OR REPLACE FUNCTION public.grant_subscription_credits(p_subscription_id uuid, p_period_start timestamptz)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s RECORD;
  v_amount integer;
  r jsonb;
BEGIN
  SELECT * INTO s FROM public.subscriptions WHERE id = p_subscription_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'SUBSCRIPTION_NOT_FOUND'); END IF;
  IF s.last_credit_grant_period IS NOT NULL AND s.last_credit_grant_period >= p_period_start THEN
    RETURN jsonb_build_object('success', true, 'already_granted', true);
  END IF;
  v_amount := COALESCE(s.monthly_credits, 0) + 250 * COALESCE(s.extra_agent_seats, 0);
  IF v_amount <= 0 THEN
    UPDATE public.subscriptions SET last_credit_grant_period = p_period_start WHERE id = s.id;
    RETURN jsonb_build_object('success', true, 'credits_granted', 0);
  END IF;
  r := public.add_credits(s.user_id, v_amount, 'topup', format('Monthly credits · %s plan', s.plan_slug), s.id, 'subscription');
  UPDATE public.subscriptions SET last_credit_grant_period = p_period_start WHERE id = s.id;
  RETURN jsonb_build_object('success', true, 'credits_granted', v_amount, 'wallet', r);
END;
$$;
REVOKE ALL ON FUNCTION public.grant_subscription_credits(uuid, timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.grant_subscription_credits(uuid, timestamptz) TO service_role;
