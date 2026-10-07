-- Kinika · the runner tick — paste into Supabase → SQL Editor → Run.
--
-- pg_cron and pg_net are not installed on the project, so nothing has been
-- calling run-step on a schedule: scheduled automations, the weekly digest,
-- build-first PR checks, auto-merge, plan revisions and the weekly check-in
-- all wait for this tick. Every minute it POSTs {"tick": true} to run-step
-- with the service role key, which stays in Vault (never in the app).
--
-- ONE edit before running: replace <SERVICE_ROLE_KEY> below with the key from
-- Dashboard → Project Settings → API Keys → service_role. Safe to run again.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
DECLARE k text := '<SERVICE_ROLE_KEY>';
        existing uuid;
BEGIN
  IF k LIKE '<%' THEN RAISE EXCEPTION 'Replace <SERVICE_ROLE_KEY> with the service_role key first'; END IF;
  SELECT id INTO existing FROM vault.secrets WHERE name = 'service_role_key' LIMIT 1;
  IF existing IS NULL THEN
    PERFORM vault.create_secret(k, 'service_role_key', 'Used by the runner tick');
  ELSE
    PERFORM vault.update_secret(existing, k, 'service_role_key', 'Used by the runner tick');
  END IF;
END $$;

-- Re-schedule cleanly if it already exists.
DO $$
BEGIN
  PERFORM cron.unschedule('kinika-runner-tick');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'kinika-runner-tick',
  '* * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://ypwfruanfcaleuqhgskw.supabase.co/functions/v1/run-step',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
    ),
    body    := '{"tick": true}'::jsonb
  );
  $$
);

-- Check it is running (after a minute or two):
--   SELECT status, start_time FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;
-- To stop it:  SELECT cron.unschedule('kinika-runner-tick');
