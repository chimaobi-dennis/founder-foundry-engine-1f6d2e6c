/**
 * oauth-callback — where every provider sends the browser back.
 *
 * GET ?code&state (or ?error): looks the state up, exchanges the code for a
 * token with the client secret from Vault, asks who signed in, then either
 *   verify:  records the result on the provider (status → verified), or
 *   connect: writes a tool_connections row for the workspace with the token in Vault,
 * and redirects to where the flow started with ?connected=<key> or ?oauth_error=.
 * Public (no JWT): the provider calls it. The state id is the credential.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { exchangeToken, fetchAccount, type OAuthProviderRow, type OAuthSecret, type OAuthVerification } from "../_shared/oauth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/oauth-callback`;

function back(to: string, params: Record<string, string>): Response {
  let u: URL;
  try { u = new URL(to); } catch { u = new URL("https://www.kinika.app/team"); }
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return new Response(null, { status: 302, headers: { location: u.toString(), "cache-control": "no-store" } });
}

serve(async (req) => {
  const url = new URL(req.url);
  const stateId = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  const providerError = url.searchParams.get("error_description") ?? url.searchParams.get("error") ?? "";
  if (!stateId) return new Response("Missing state", { status: 400 });
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const { data: st } = await admin.from("oauth_states").select("*").eq("id", stateId).maybeSingle();
  if (!st) return new Response("This sign-in link has already been used or has expired. Start again from Kinika.", { status: 400 });
  await admin.from("oauth_states").delete().eq("id", stateId);
  if (new Date(st.expires_at).getTime() < Date.now()) return back(st.redirect_to, { oauth_error: "The sign-in took too long. Start again." });

  const { data: p } = await admin.from("oauth_providers").select("*").eq("id", st.provider_id).maybeSingle();
  const provider = p as OAuthProviderRow | null;
  if (!provider) return back(st.redirect_to, { oauth_error: "The provider is gone." });
  const fail = async (message: string) => {
    if (st.mode === "verify") await admin.from("oauth_providers").update({ last_error: message, updated_at: new Date().toISOString() }).eq("id", provider.id);
    return back(st.redirect_to, { oauth_error: message, provider: provider.key });
  };
  if (providerError) return fail(`${provider.name} said: ${providerError.slice(0, 200)}`);
  if (!code) return fail("The provider sent no code back.");

  const { data: clientSecret } = await admin.rpc("get_oauth_client_secret", { p_provider_id: provider.id });
  if (!clientSecret) return fail("No client secret is set for this provider.");
  const params: Record<string, string> = { grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI };
  if (st.code_verifier) params.code_verifier = st.code_verifier;
  const ex = await exchangeToken(provider, String(clientSecret), params);
  if (!ex.ok) return fail(`Token exchange failed: ${ex.error}`);
  const account = (await fetchAccount(provider, ex.token.access_token)) ?? { id: null, name: null, email: null, handle: null };
  const now = new Date().toISOString();

  if (st.mode === "verify") {
    const verification: OAuthVerification = { at: now, account, granted_scopes: ex.token.scope, token_type: ex.token.token_type, has_refresh_token: !!ex.token.refresh_token, expires_in: ex.token.expires_at ? Math.round((new Date(ex.token.expires_at).getTime() - Date.now()) / 1000) : null };
    await admin.from("oauth_providers").update({ verification, verified_at: now, last_error: null, status: provider.status === "draft" ? "verified" : provider.status, updated_at: now }).eq("id", provider.id);
    return back(st.redirect_to, { verified: provider.key });
  }

  // connect: one connection per provider per workspace; reconnecting replaces the token.
  const writes = provider.kind === "social" ? ["read", "publish"] : provider.kind === "code" ? ["read", "code_write"] : ["read", "data_write"];
  const display = `${provider.name}${account.name || account.handle || account.email ? ` · ${account.name ?? account.handle ?? account.email}` : ""}`.slice(0, 120);
  const { data: existing } = await admin.from("tool_connections").select("id").eq("brand_id", st.brand_id).filter("config->>oauth_provider_id", "eq", provider.id).maybeSingle();
  const row = { brand_id: st.brand_id, user_id: st.user_id, provider: provider.connector_provider ?? provider.key, display_name: display, capabilities: writes, config: { oauth_provider_id: provider.id, oauth_provider_key: provider.key, account, granted_scopes: ex.token.scope }, status: "active", last_error: null, last_tested_at: now, updated_at: now };
  let connectionId = existing?.id as string | undefined;
  if (connectionId) {
    const { error } = await admin.from("tool_connections").update(row).eq("id", connectionId);
    if (error) return fail(error.message);
  } else {
    const { data: created, error } = await admin.from("tool_connections").insert({ ...row, scope: { max_records_per_run: 50 } }).select("id").single();
    if (error || !created) return fail(error?.message ?? "Could not save the connection");
    connectionId = created.id;
  }
  const secret: OAuthSecret = { oauth_provider_id: provider.id, access_token: ex.token.access_token, refresh_token: ex.token.refresh_token, expires_at: ex.token.expires_at, scope: ex.token.scope };
  const { data: stored } = await admin.rpc("store_connection_secret", { p_connection_id: connectionId, p_secret: secret });
  if (!stored?.success) return fail("Could not store the token.");
  return back(st.redirect_to, { connected: provider.key });
});
