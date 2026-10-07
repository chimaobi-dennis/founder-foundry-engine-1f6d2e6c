-- Kinika · Phase 2b (publishing, Notion, digest) — paste into Supabase → SQL Editor → Run.
-- Safe to run more than once. Applies migration 20260706000000 and records it.
-- Afterwards:  supabase functions deploy connector-action && supabase functions deploy run-step

BEGIN;

-- Weekly digest notification type for the runner tick.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
  type = ANY (ARRAY[
    'content_series_ready', 'content_series_failed', 'campaign_generated',
    'milestone_reached', 'stage_suggested', 'mentor_insight', 'system',
    'agent_needs_you', 'agent_run_completed', 'agent_run_paused', 'agent_run_failed', 'agent_digest'
  ]::text[])
);

INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES
  ('20260706000000', 'agent_digest_notification')
ON CONFLICT (version) DO NOTHING;

COMMIT;
