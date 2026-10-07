-- ─────────────────────────────────────────────────────────────────────────────
-- The founder's plan — the spine that ties Mentor, agents and the Team page
--
-- One plan per brand: ordered TARGETS ("Validate the idea", "Ship an MVP"),
-- each with a checklist of TASKS. A task is owned by the founder or by an
-- agent; delegating one creates a run and links it. When the run completes,
-- the task completes. Mentor builds and revises the plan from the brand's
-- context (founder-plan edge function); founders edit it directly.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.brand_plans (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id      uuid NOT NULL UNIQUE REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,   -- workspace owner
  title         text NOT NULL,
  summary       text,
  founder_type  text,                       -- idea | running | creator | other (what the plan assumed)
  version       integer NOT NULL DEFAULT 1,
  built_at      timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.plan_targets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     uuid NOT NULL REFERENCES public.brand_plans(id) ON DELETE CASCADE,
  brand_id    uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  title       text NOT NULL,
  why         text,
  position    integer NOT NULL DEFAULT 0,
  status      text NOT NULL DEFAULT 'upcoming' CONSTRAINT plan_targets_status_check CHECK (status IN ('upcoming', 'current', 'done')),
  done_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS plan_targets_plan_idx ON public.plan_targets (plan_id, position);

CREATE TABLE IF NOT EXISTS public.plan_tasks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         uuid NOT NULL REFERENCES public.brand_plans(id) ON DELETE CASCADE,
  target_id       uuid NOT NULL REFERENCES public.plan_targets(id) ON DELETE CASCADE,
  brand_id        uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  title           text NOT NULL,
  detail          text,
  position        integer NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'todo' CONSTRAINT plan_tasks_status_check CHECK (status IN ('todo', 'doing', 'done', 'skipped')),
  owner           text NOT NULL DEFAULT 'founder' CONSTRAINT plan_tasks_owner_check CHECK (owner IN ('founder', 'agent')),
  agent_slug      text,                     -- the agent suited to it, when owner = agent
  agent_brief     text,                     -- what to tell that agent
  run_id          uuid REFERENCES public.automation_runs(id) ON DELETE SET NULL,
  done_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS plan_tasks_plan_idx ON public.plan_tasks (plan_id, position);
CREATE INDEX IF NOT EXISTS plan_tasks_run_idx ON public.plan_tasks (run_id) WHERE run_id IS NOT NULL;

ALTER TABLE public.brand_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_tasks ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['brand_plans', 'plan_targets', 'plan_tasks'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Members read %1$s" ON public.%1$I', t);
    EXECUTE format('CREATE POLICY "Members read %1$s" ON public.%1$I FOR SELECT TO authenticated USING (public.can_access_brand(brand_id, ''viewer''))', t);
    EXECUTE format('DROP POLICY IF EXISTS "Editors write %1$s" ON public.%1$I', t);
    EXECUTE format('CREATE POLICY "Editors write %1$s" ON public.%1$I FOR ALL TO authenticated USING (public.can_access_brand(brand_id, ''editor'')) WITH CHECK (public.can_access_brand(brand_id, ''editor''))', t);
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS plan_tasks_set_updated_at ON public.plan_tasks;
CREATE TRIGGER plan_tasks_set_updated_at BEFORE UPDATE ON public.plan_tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS brand_plans_set_updated_at ON public.brand_plans;
CREATE TRIGGER brand_plans_set_updated_at BEFORE UPDATE ON public.brand_plans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- A delegated task follows its run: completed → done, failed or cancelled → back to todo.
CREATE OR REPLACE FUNCTION public.trg_plan_task_follows_run()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    UPDATE public.plan_tasks SET status = 'done', done_at = now() WHERE run_id = NEW.id AND status <> 'done';
  ELSIF NEW.status IN ('failed', 'cancelled') AND OLD.status NOT IN ('failed', 'cancelled') THEN
    UPDATE public.plan_tasks SET status = 'todo' WHERE run_id = NEW.id AND status = 'doing';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS automation_runs_plan_task ON public.automation_runs;
CREATE TRIGGER automation_runs_plan_task AFTER UPDATE OF status ON public.automation_runs
  FOR EACH ROW EXECUTE FUNCTION public.trg_plan_task_follows_run();

-- The current target is the first one not done.
CREATE OR REPLACE FUNCTION public.plan_recompute_current(p_plan_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.plan_targets t SET status = CASE
      WHEN t.status = 'done' THEN 'done'
      WHEN t.id = (SELECT id FROM public.plan_targets WHERE plan_id = p_plan_id AND status <> 'done' ORDER BY position LIMIT 1) THEN 'current'
      ELSE 'upcoming' END
  WHERE t.plan_id = p_plan_id;
$$;
GRANT EXECUTE ON FUNCTION public.plan_recompute_current(uuid) TO authenticated, service_role;

-- Routing: the plan builder is its own task type so an admin can route it.
INSERT INTO public.ai_task_types (task_type, class_slug, description, is_system) VALUES
  ('plan_build', 'fast', 'Builds or revises the founder plan from the brand context. Move to reasoning once that class is funded.', true)
ON CONFLICT (task_type) DO NOTHING;

CREATE OR REPLACE FUNCTION public.plan_mark_done_targets(p_plan_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.plan_targets t SET status = 'done', done_at = COALESCE(t.done_at, now())
  WHERE t.plan_id = p_plan_id AND t.status <> 'done'
    AND NOT EXISTS (SELECT 1 FROM public.plan_tasks k WHERE k.target_id = t.id AND k.status IN ('todo', 'doing'));
$$;
GRANT EXECUTE ON FUNCTION public.plan_mark_done_targets(uuid) TO authenticated, service_role;
