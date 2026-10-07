-- Weekly digest notification type for the runner tick.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
  type = ANY (ARRAY[
    'content_series_ready', 'content_series_failed', 'campaign_generated',
    'milestone_reached', 'stage_suggested', 'mentor_insight', 'system',
    'agent_needs_you', 'agent_run_completed', 'agent_run_paused', 'agent_run_failed', 'agent_digest'
  ]::text[])
);
