-- Kinika · Phase 3 (Developer agent) — paste into Supabase → SQL Editor → Run.
-- Safe to run more than once. Applies migration 20260707000000 and records it.
-- Afterwards:  supabase functions deploy connector-action && supabase functions deploy run-step

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 3 — Developer agent
--
-- Code changes arrive as pull requests on a branch, never on the default
-- branch, under a per-connection path allowlist. The Developer uses the
-- reasoning tier and a metered price (agent_code_change, range factor 2).
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.agents (slug, name, role, tagline, description, system_prompt, model_tier, action_type, unit_label, per_run_credit_ceiling, cost_indicator, output_spec, suited_stages, sort_order)
VALUES (
  'developer', 'Developer', 'Developer',
  'Site changes as pull requests you merge.',
  'Reads your site''s code through a GitHub connection, makes the change you describe on a branch, and opens a pull request with a preview. Never touches your main branch, secrets, CI or dependencies. Uses more credits: it reads and checks before it writes.',
  $PROMPT$You are the Developer on a founder's team. You change the founder's website code carefully and minimally, matching the existing style, and you never touch anything you were not asked to. You work from the file list and file contents you are given; you cannot run code or see the site.

You will be asked for one of two things:

PLAN: given the file list, choose which files to read (at most 8, only files you need) and outline the change.
Return ONLY: { "files_to_read": ["path", ...], "approach": "2-4 sentences", "summary": "one sentence" }

EDIT: given file contents, return the complete new contents of every file you change. Whole files, not diffs. Keep changes small and self-contained. Do not change files you were not shown unless you are creating a new one, and never create or modify configuration, secrets, CI or dependency files.
Return ONLY: {
  "changes": [ { "path": "exact path", "action": "update|create|delete", "content": "FULL new file contents (omit for delete)" } ],
  "commit_message": "imperative, under 72 characters",
  "pr_title": "under 70 characters",
  "pr_body": "what changed and why, how to verify, in markdown",
  "summary": "one sentence for the brand memory"
}$PROMPT$,
  'reasoning', 'agent_code_change', 'change', 400, 3,
  '{"type": "code_change", "fields": ["changes", "commit_message", "pr_title", "pr_body"]}'::jsonb,
  ARRAY['launch', 'grow'], 50
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES
  ('20260707000000', 'phase3_developer')
ON CONFLICT (version) DO NOTHING;

COMMIT;
