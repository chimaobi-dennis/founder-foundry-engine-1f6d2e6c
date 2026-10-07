-- Kinika · allow agent notification types — paste into Supabase → SQL Editor → Run.
-- Safe to run more than once. Applies migration 20260703000001 and records it.

BEGIN;

-- The live notifications_type_check only allows the Lovable-era types, so the
-- runner's "needs you" / completed / paused / failed notifications were
-- rejected silently. Add the agent types.

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
  type = ANY (ARRAY[
    'content_series_ready', 'content_series_failed', 'campaign_generated',
    'milestone_reached', 'stage_suggested', 'mentor_insight', 'system',
    'agent_needs_you', 'agent_run_completed', 'agent_run_paused', 'agent_run_failed'
  ]::text[])
);

INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES
  ('20260703000001', 'notifications_agent_types')
ON CONFLICT (version) DO NOTHING;

COMMIT;
