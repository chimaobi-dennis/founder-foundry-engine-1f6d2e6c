-- Watch triggers: a board that begins when something new arrives in a
-- connected system (an email, a Slack message, an order, a comment, an
-- issue). The runner's tick checks each watching board on its own interval
-- and only ever looks at what is newer than its cursor. "Start from" is the
-- last real item at set-up time: the first run uses it, the watch begins after it.

ALTER TABLE public.automations DROP CONSTRAINT IF EXISTS automations_trigger_check;
ALTER TABLE public.automations ADD CONSTRAINT automations_trigger_check
  CHECK (trigger_type IN ('manual', 'schedule', 'webhook', 'event', 'watch'));

-- watch: { source, connection_id, options: {channel?}, interval_minutes, cursor: {at, id}, started_from: {id, title, at} }
ALTER TABLE public.automations ADD COLUMN IF NOT EXISTS watch jsonb;
ALTER TABLE public.automations ADD COLUMN IF NOT EXISTS next_watch_at timestamptz;
ALTER TABLE public.automations ADD COLUMN IF NOT EXISTS last_watched_at timestamptz;
ALTER TABLE public.automations ADD COLUMN IF NOT EXISTS last_watch_error text;
CREATE INDEX IF NOT EXISTS automations_watch_due_idx ON public.automations (next_watch_at)
  WHERE status = 'active' AND trigger_type = 'watch';

-- The planner prompts learn the watch schedule. Admin edits are kept: the
-- section is appended only where it is not there yet.
UPDATE public.ai_system_prompts
SET system_prompt = system_prompt || E'\n\nWATCH (a board that starts when something new arrives)\n- When the task is about reacting to things as they come in (new emails, messages, orders, comments, issues), set schedule to "watch" and "watch" to {"source": "<source key>"} using only the sources listed below. Each source names the connection it reads. If no source fits, say so in "warnings" and plan a schedule instead.\n\nSOURCES\n{{sources}}'
WHERE task_type IN ('plan_board', 'automation_planner') AND position('WATCH (a board' IN system_prompt) = 0;
