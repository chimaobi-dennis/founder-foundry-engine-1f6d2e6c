/**
 * oauth-start — begins an OAuth flow and returns the provider's sign-in URL.
 *
 * POST (user JWT): { providerKey, mode: "connect" | "verify", brandId?, redirectTo }
 *   connect: a founder connects the provider to a workspace they own (provider must be live).
 *   verify:  an admin signs in through the provider to prove the app details work (any status).
 * The state row carries who, which workspace, the PKCE verifier and where to
 * send the browser afterwards. The callback finishes the job.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { buildAuthorizeUrl, pkcePair, type OAuthProviderRow } from "../_shared/oauth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/oauth-callback`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "POST only" }, 405);
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ success: false, error: "Unauthorized" }, 401);
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const userId = (await userClient.auth.getUser()).data.user?.id;
  if (!userId) return json({ success: false, error: "Unauthorized" }, 401);
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  let body: { providerKey?: string; mode?: string; brandId?: string; redirectTo?: string };
  try { body = await req.json(); } catch { return json({ success: false, error: "Invalid JSON body" }, 400); }
  const mode = body.mode === "verify" ? "verify" : "connect";
  const redirectTo = String(body.redirectTo ?? "").trim();
  if (!body.providerKey || !/^https?:\/\//.test(redirectTo)) return json({ success: false, error: "providerKey and redirectTo are required" }, 400);

  const { data: p } = await admin.from("oauth_providers").select("*").eq("key", body.providerKey).maybeSingle();
  const provider = p as OAuthProviderRow | null;
  if (!provider) return json({ success: false, error: "Unknown provider" }, 404);
  if (!provider.client_id) return json({ success: false, error: "This provider has no client id yet." }, 400);
  const { data: hasSecret } = await admin.from("oauth_provider_secrets").select("vault_secret_id").eq("provider_id", provider.id).maybeSingle();
  if (!hasSecret?.vault_secret_id) return json({ success: false, error: "This provider has no client secret yet." }, 400);

  let brandId: string | null = null;
  if (mode === "verify") {
    const { data: prof } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
    if (prof?.role !== "admin") return json({ success: false, error: "Only an admin can verify a provider." }, 403);
  } else {
    if (provider.status !== "live") return json({ success: false, error: `${provider.name} is not live yet.` }, 400);
    if (!body.brandId) return json({ success: false, error: "brandId is required" }, 400);
    const { data: allowed } = await userClient.rpc("can_access_brand", { p_brand_id: body.brandId, p_min_role: "owner" });
    if (!allowed) return json({ success: false, error: "Only the workspace owner can connect tools." }, 403);
    brandId = body.brandId;
  }

  const pkce = provider.pkce ? await pkcePair() : null;
  const { data: state, error } = await admin.from("oauth_states").insert({ provider_id: provider.id, user_id: userId, brand_id: brandId, mode, code_verifier: pkce?.verifier ?? null, redirect_to: redirectTo }).select("id").single();
  if (error || !state) return json({ success: false, error: error?.message ?? "Could not start" }, 500);
  return json({ success: true, url: buildAuthorizeUrl(provider, REDIRECT_URI, state.id, pkce?.challenge), redirectUri: REDIRECT_URI });
});
