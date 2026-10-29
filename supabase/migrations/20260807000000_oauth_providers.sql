-- Universal OAuth: an admin adds a provider's app details in Admin → Connections,
-- verifies it by signing in through it, and presses Go live. Founders then see
-- "Connect <name>" wherever connections are offered. Tokens land in Vault on
-- tool_connections like every other credential.

CREATE TABLE IF NOT EXISTS public.oauth_providers (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key                    text NOT NULL UNIQUE,            -- 'meta', 'google', 'slack', 'tiktok', ...
  name                   text NOT NULL,                   -- what founders see: "Instagram and Facebook"
  kind                   text NOT NULL DEFAULT 'other'
    CONSTRAINT oauth_providers_kind_check CHECK (kind IN ('social', 'email', 'chat', 'records', 'delivery', 'code', 'other')),
  -- when the token drives an existing connector adapter (notion, shopify, github, ...)
  connector_provider     text,
  authorize_url          text NOT NULL,
  token_url              text NOT NULL,
  userinfo_url           text,
  scopes                 text[] NOT NULL DEFAULT '{}',
  extra_authorize_params jsonb NOT NULL DEFAULT '{}'::jsonb,   -- e.g. {"access_type":"offline","prompt":"consent"}
  token_auth             text NOT NULL DEFAULT 'post'
    CONSTRAINT oauth_providers_token_auth_check CHECK (token_auth IN ('post', 'basic')),
  pkce                   boolean NOT NULL DEFAULT false,
  client_id              text NOT NULL DEFAULT '',
  permission_words       text NOT NULL DEFAULT '',             -- plain words: what Kinika may do with it
  icon                   text NOT NULL DEFAULT '',
  status                 text NOT NULL DEFAULT 'draft'
    CONSTRAINT oauth_providers_status_check CHECK (status IN ('draft', 'verified', 'live', 'paused')),
  verified_at            timestamptz,
  verification           jsonb,                                -- what came back when the admin signed in
  last_error             text,
  sort_order             int NOT NULL DEFAULT 100,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.oauth_providers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage oauth providers" ON public.oauth_providers;
CREATE POLICY "Admins manage oauth providers" ON public.oauth_providers FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Anyone signed in sees live providers" ON public.oauth_providers;
CREATE POLICY "Anyone signed in sees live providers" ON public.oauth_providers FOR SELECT USING (status = 'live' OR public.is_admin());

-- The client secret never sits in a table: Vault, under 'oauth:<provider id>'.
CREATE TABLE IF NOT EXISTS public.oauth_provider_secrets (
  provider_id      uuid PRIMARY KEY REFERENCES public.oauth_providers(id) ON DELETE CASCADE,
  vault_secret_id  uuid,
  updated_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.oauth_provider_secrets ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.set_oauth_client_secret(p_provider_id uuid, p_secret text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_vid uuid;
BEGIN
  IF NOT public.is_admin() THEN RETURN jsonb_build_object('success', false, 'error', 'NOT_ADMIN'); END IF;
  SELECT vault_secret_id INTO v_vid FROM public.oauth_provider_secrets WHERE provider_id = p_provider_id;
  IF v_vid IS NULL THEN
    DELETE FROM vault.secrets WHERE name = 'oauth:' || p_provider_id::text;
    v_vid := vault.create_secret(p_secret, 'oauth:' || p_provider_id::text, 'Kinika OAuth client secret');
    INSERT INTO public.oauth_provider_secrets (provider_id, vault_secret_id) VALUES (p_provider_id, v_vid)
    ON CONFLICT (provider_id) DO UPDATE SET vault_secret_id = EXCLUDED.vault_secret_id, updated_at = now();
  ELSE
    PERFORM vault.update_secret(v_vid, p_secret);
    UPDATE public.oauth_provider_secrets SET updated_at = now() WHERE provider_id = p_provider_id;
  END IF;
  RETURN jsonb_build_object('success', true);
END; $$;
REVOKE ALL ON FUNCTION public.set_oauth_client_secret(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.set_oauth_client_secret(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_oauth_client_secret(p_provider_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_vid uuid; v_text text;
BEGIN
  SELECT vault_secret_id INTO v_vid FROM public.oauth_provider_secrets WHERE provider_id = p_provider_id;
  IF v_vid IS NULL THEN RETURN NULL; END IF;
  SELECT decrypted_secret INTO v_text FROM vault.decrypted_secrets WHERE id = v_vid;
  RETURN v_text;
END; $$;
REVOKE ALL ON FUNCTION public.get_oauth_client_secret(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_oauth_client_secret(uuid) TO service_role;

-- Does a provider have its secret set? (admins; the page shows "secret set", never the value)
CREATE OR REPLACE FUNCTION public.oauth_secret_is_set(p_provider_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin() AND EXISTS (SELECT 1 FROM public.oauth_provider_secrets WHERE provider_id = p_provider_id AND vault_secret_id IS NOT NULL);
$$;
GRANT EXECUTE ON FUNCTION public.oauth_secret_is_set(uuid) TO authenticated;

-- One row per flow in progress. Service role only.
CREATE TABLE IF NOT EXISTS public.oauth_states (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id    uuid NOT NULL REFERENCES public.oauth_providers(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL,
  brand_id       uuid,
  mode           text NOT NULL CONSTRAINT oauth_states_mode_check CHECK (mode IN ('connect', 'verify')),
  code_verifier  text,
  redirect_to    text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz NOT NULL DEFAULT now() + interval '15 minutes'
);
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

-- The callback runs as the service role, so it stores the token with this
-- variant of set_connection_secret (same Vault layout, no auth.uid()).
CREATE OR REPLACE FUNCTION public.store_connection_secret(p_connection_id uuid, p_secret jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_vid uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tool_connections WHERE id = p_connection_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND');
  END IF;
  SELECT vault_secret_id INTO v_vid FROM public.tool_connection_secrets WHERE connection_id = p_connection_id;
  IF v_vid IS NULL THEN
    DELETE FROM vault.secrets WHERE name = 'connection:' || p_connection_id::text;
    v_vid := vault.create_secret(p_secret::text, 'connection:' || p_connection_id::text, 'Kinika connector credentials');
    INSERT INTO public.tool_connection_secrets (connection_id, vault_secret_id, secret) VALUES (p_connection_id, v_vid, NULL)
    ON CONFLICT (connection_id) DO UPDATE SET vault_secret_id = EXCLUDED.vault_secret_id, secret = NULL, updated_at = now();
  ELSE
    PERFORM vault.update_secret(v_vid, p_secret::text);
    UPDATE public.tool_connection_secrets SET secret = NULL, updated_at = now() WHERE connection_id = p_connection_id;
  END IF;
  RETURN jsonb_build_object('success', true);
END; $$;
REVOKE ALL ON FUNCTION public.store_connection_secret(uuid, jsonb) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.store_connection_secret(uuid, jsonb) TO service_role;

-- An OAuth connection is one per provider per workspace.
CREATE UNIQUE INDEX IF NOT EXISTS tool_connections_oauth_unique ON public.tool_connections (brand_id, ((config->>'oauth_provider_id'))) WHERE config ? 'oauth_provider_id';
