-- Phase 1 — schedule the runner tick (run once in the Supabase SQL editor).
--
-- Every minute, call the run-step function with the service role so that:
--   * scheduled automations that are due become runs, and
--   * queued/stalled runs are advanced even if the founder closed the tab.
--
-- Replace the two placeholders. The service role key never leaves the
-- database: it is stored in Vault and read by the cron job at call time.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key', 'Used by the runner tick');

SELECT cron.schedule(
  'kinika-runner-tick',
  '* * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/run-step',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
    ),
    body    := '{"tick": true}'::jsonb
  );
  $$
);

-- To stop it later:  SELECT cron.unschedule('kinika-runner-tick');
