-- ─────────────────────────────────────────────────────────────────────────────
-- Step 4 — team memory
--
-- Every finished agent run writes a structured summary here; every write to a
-- connected tool writes its outcome; every approval, rejection and revert
-- writes the founder's feedback. The context pack reads the latest of these,
-- so the next run knows what the team did and what the founder thought of it.
-- Founders can read and delete what is remembered (they stay in control).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.brand_memories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id    uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,   -- the workspace owner
  kind        text NOT NULL CONSTRAINT brand_memories_kind_check CHECK (kind IN ('run_summary', 'outcome', 'feedback')),
  source      text NOT NULL DEFAULT 'agent_run',
  title       text NOT NULL,
  summary     text NOT NULL,
  data        jsonb NOT NULL DEFAULT '{}'::jsonb,
  run_id      uuid REFERENCES public.automation_runs(id) ON DELETE SET NULL,
  -- makes a retried step harmless: one memory per event
  dedupe_key  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS brand_memories_dedupe_unique ON public.brand_memories (brand_id, dedupe_key);
CREATE INDEX IF NOT EXISTS brand_memories_brand_idx ON public.brand_memories (brand_id, created_at DESC);

ALTER TABLE public.brand_memories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members read brand memories" ON public.brand_memories;
CREATE POLICY "Members read brand memories" ON public.brand_memories FOR SELECT TO authenticated
  USING (public.can_access_brand(brand_id, 'viewer'));
DROP POLICY IF EXISTS "Editors delete brand memories" ON public.brand_memories;
CREATE POLICY "Editors delete brand memories" ON public.brand_memories FOR DELETE TO authenticated
  USING (public.can_access_brand(brand_id, 'editor'));
-- Rows are written by the runner with the service role.

-- Keep what the team already did: one summary per finished run so far.
INSERT INTO public.brand_memories (brand_id, user_id, kind, source, title, summary, data, run_id, dedupe_key, created_at)
SELECT r.brand_id, r.user_id, 'run_summary', 'agent_run', left(r.name, 160), left(trim(r.output ->> 'summary'), 600),
       jsonb_build_object('backfilled', true), r.id, 'run:' || r.id::text || ':summary', COALESCE(r.finished_at, r.created_at)
FROM public.automation_runs r
WHERE r.status = 'completed' AND coalesce(trim(r.output ->> 'summary'), '') <> ''
ON CONFLICT (brand_id, dedupe_key) DO NOTHING;
