-- Kinika · Workspace (S4) — paste into Supabase → SQL Editor → Run.
-- Safe to run more than once. No function deploy needed.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- The workspace (build plan S4): one shell, surfaces by output type
--
-- A plan task opens a workspace. An agent run whose output is a document
-- lands as a documents row the founder edits in place; the founder's version
-- is what approval keeps. No new table: documents gains the links.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS plan_task_id uuid REFERENCES public.plan_tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS run_id uuid REFERENCES public.automation_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS body_md text,                 -- the editable surface (Markdown)
  ADD COLUMN IF NOT EXISTS body_edited_at timestamptz;   -- set when the founder changed it

CREATE INDEX IF NOT EXISTS documents_plan_task_idx ON public.documents (plan_task_id) WHERE plan_task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS documents_run_idx ON public.documents (run_id) WHERE run_id IS NOT NULL;

COMMIT;
