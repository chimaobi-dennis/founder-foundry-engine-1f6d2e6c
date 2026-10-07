-- bump_agent_uses() had EXECUTE revoked from public, which also removed it
-- from the service role that run-step uses, so uses_count never moved.
GRANT EXECUTE ON FUNCTION public.bump_agent_uses(uuid) TO service_role;
