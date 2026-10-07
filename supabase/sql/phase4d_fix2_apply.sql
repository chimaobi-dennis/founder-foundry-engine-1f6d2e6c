-- Kinika · Phase 4d-fix 2 (agent uses counter) — paste into Supabase → SQL Editor → Run.
-- Safe to run more than once. Then redeploy: supabase functions deploy run-step

BEGIN;

-- bump_agent_uses() had EXECUTE revoked from public, which also removed it
-- from the service role that run-step uses, so uses_count never moved.
GRANT EXECUTE ON FUNCTION public.bump_agent_uses(uuid) TO service_role;

INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES
  ('20260712000002', 'bump_agent_uses_grant')
ON CONFLICT (version) DO NOTHING;

COMMIT;
