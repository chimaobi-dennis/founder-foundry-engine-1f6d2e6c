-- Kinika · Canvas surface (S7) — paste into Supabase → SQL Editor → Run.
-- Safe to run more than once. No function deploy needed.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- The canvas surface (build plan S7)
--
-- A Designer's result opens on the canvas: a ContentStudio brief made from
-- the run, edited as scenes in the existing editor, inside the workspace
-- shell. The brief remembers the task and run it came from so the workspace
-- can show the canvas instead of the document. No new table.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.content_studio_briefs
  ADD COLUMN IF NOT EXISTS plan_task_id uuid REFERENCES public.plan_tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS run_id uuid REFERENCES public.automation_runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS content_studio_briefs_plan_task_idx ON public.content_studio_briefs (plan_task_id) WHERE plan_task_id IS NOT NULL;

COMMIT;
