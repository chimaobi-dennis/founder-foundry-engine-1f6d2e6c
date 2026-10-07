-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 3b — webhook triggers for automations
--
-- An automation can be fired by another system: POST to the webhook-trigger
-- function with the automation id and its secret. Deliveries carry an event
-- id so retries never create a second run.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.automations DROP CONSTRAINT IF EXISTS automations_trigger_check;
ALTER TABLE public.automations ADD CONSTRAINT automations_trigger_check
  CHECK (trigger_type IN ('manual', 'schedule', 'webhook'));

ALTER TABLE public.automations
  ADD COLUMN IF NOT EXISTS webhook_secret text;

ALTER TABLE public.automation_runs
  ADD COLUMN IF NOT EXISTS external_event_id text;

CREATE UNIQUE INDEX IF NOT EXISTS automation_runs_external_event_unique
  ON public.automation_runs (automation_id, external_event_id)
  WHERE external_event_id IS NOT NULL;

-- Owners generate the secret client-side; it is readable by them (they need
-- to paste it into the other system) and nobody else, via RLS on automations.
