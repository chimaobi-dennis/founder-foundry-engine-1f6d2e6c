/**
 * Universal OAuth. An admin describes a provider (its authorize and token
 * URLs, scopes, client id; the secret goes to Vault), verifies it by signing
 * in through it, and presses Go live. From then on founders see "Connect
 * <name>". The pure parts here (presets, URL building, token parsing) are
 * shared with the browser; the token exchange and refresh run only in edge
 * functions, where the client secret is.
 */

export type OAuthKind = "social" | "email" | "chat" | "records" | "delivery" | "code" | "other";

export interface OAuthProviderRow {
  id: string;
  key: string;
  name: string;
  kind: OAuthKind;
  connector_provider: string | null;
  authorize_url: string;
  token_url: string;
  userinfo_url: string | null;
  scopes: string[];
  extra_authorize_params: Record<string, string>;
  token_auth: "post" | "basic";
  pkce: boolean;
  client_id: string;
  permission_words: string;
  icon: string;
  status: "draft" | "verified" | "live" | "paused";
  verified_at: string | null;
  verification: OAuthVerification | null;
  last_error: string | null;
  sort_order: number;
}

export interface OAuthVerification {
  at: string;
  account: OAuthAccount;
  granted_scopes: string[];
  token_type: string | null;
  has_refresh_token: boolean;
  expires_in: number | null;
}

/** Who signed in, in the few fields every provider has some form of. */
export interface OAuthAccount {
  id: string | null;
  name: string | null;
  email: string | null;
  handle: string | null;
}

/** Ready-made settings for the providers founders ask for; the admin can edit every field. */
export interface OAuthPreset {
  key: string;
  name: string;
  kind: OAuthKind;
  icon: string;
  connector_provider: string | null;
  authorize_url: string;
  token_url: string;
  userinfo_url: string | null;
  scopes: string[];
  extra_authorize_params: Record<string, string>;
  token_auth: "post" | "basic";
  pkce: boolean;
  permission_words: string;
  /** Where the admin registers the app and finds the client id and secret. */
  console_url: string;
  note: string;
}

export const OAUTH_PRESETS: OAuthPreset[] = [
  {
    key: "meta", name: "Instagram and Facebook", kind: "social", icon: "M", connector_provider: null,
    authorize_url: "https://www.facebook.com/v21.0/dialog/oauth", token_url: "https://graph.facebook.com/v21.0/oauth/access_token", userinfo_url: "https://graph.facebook.com/v21.0/me?fields=id,name,email",
    scopes: ["public_profile", "email", "pages_show_list", "pages_read_engagement", "pages_manage_posts", "instagram_basic", "instagram_content_publish", "instagram_manage_comments"],
    extra_authorize_params: {}, token_auth: "post", pkce: false,
    permission_words: "Kinika can read your pages, posts and comments, and publish or reply after your yes.",
    console_url: "https://developers.facebook.com/apps/", note: "Add the Facebook Login product and put the redirect URI under Valid OAuth Redirect URIs. Instagram needs a Business or Creator account linked to a Facebook page.",
  },
  {
    key: "google", name: "Gmail and Google", kind: "email", icon: "G", connector_provider: null,
    authorize_url: "https://accounts.google.com/o/oauth2/v2/auth", token_url: "https://oauth2.googleapis.com/token", userinfo_url: "https://openidconnect.googleapis.com/v1/userinfo",
    scopes: ["openid", "email", "profile", "https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.compose"],
    extra_authorize_params: { access_type: "offline", prompt: "consent" }, token_auth: "post", pkce: true,
    permission_words: "Kinika can read what comes into your inbox and draft replies; nothing is sent without your yes.",
    console_url: "https://console.cloud.google.com/apis/credentials", note: "Create an OAuth client of type Web application and add the redirect URI. Enable the Gmail API. Until the app is verified by Google, add test users on the consent screen.",
  },
  {
    key: "slack", name: "Slack", kind: "chat", icon: "S", connector_provider: null,
    authorize_url: "https://slack.com/oauth/v2/authorize", token_url: "https://slack.com/api/oauth.v2.access", userinfo_url: "https://slack.com/api/auth.test",
    scopes: ["channels:history", "channels:read", "chat:write", "users:read"],
    extra_authorize_params: {}, token_auth: "post", pkce: false,
    permission_words: "Kinika can read the channels you choose and post after your yes.",
    console_url: "https://api.slack.com/apps", note: "Add the redirect URI under OAuth & Permissions and the bot scopes listed here. Slack's scope goes in the scope parameter; user scopes are not used.",
  },
  {
    key: "tiktok", name: "TikTok", kind: "social", icon: "T", connector_provider: null,
    authorize_url: "https://www.tiktok.com/v2/auth/authorize/", token_url: "https://open.tiktokapis.com/v2/oauth/token/", userinfo_url: "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,username",
    scopes: ["user.info.basic", "video.list", "video.publish"],
    extra_authorize_params: {}, token_auth: "post", pkce: true,
    permission_words: "Kinika can read your videos and their comments, and publish after your yes.",
    console_url: "https://developers.tiktok.com/apps", note: "TikTok sends the client id as client_key; Kinika handles that. The app must pass TikTok's review before anyone but test users can connect.",
  },
  {
    key: "linkedin", name: "LinkedIn", kind: "social", icon: "in", connector_provider: null,
    authorize_url: "https://www.linkedin.com/oauth/v2/authorization", token_url: "https://www.linkedin.com/oauth/v2/accessToken", userinfo_url: "https://api.linkedin.com/v2/userinfo",
    scopes: ["openid", "profile", "email", "w_member_social"],
    extra_authorize_params: {}, token_auth: "post", pkce: false,
    permission_words: "Kinika can see your profile and post on your behalf after your yes.",
    console_url: "https://www.linkedin.com/developers/apps", note: "Request the Share on LinkedIn and Sign In with LinkedIn using OpenID Connect products.",
  },
  {
    key: "x", name: "X", kind: "social", icon: "X", connector_provider: null,
    authorize_url: "https://twitter.com/i/oauth2/authorize", token_url: "https://api.twitter.com/2/oauth2/token", userinfo_url: "https://api.twitter.com/2/users/me",
    scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
    extra_authorize_params: {}, token_auth: "basic", pkce: true,
    permission_words: "Kinika can read your posts and mentions, and post after your yes.",
    console_url: "https://developer.x.com/en/portal/dashboard", note: "OAuth 2.0 with PKCE; set the app type to Web App and add the redirect URI.",
  },
  {
    key: "notion", name: "Notion", kind: "delivery", icon: "N", connector_provider: "notion",
    authorize_url: "https://api.notion.com/v1/oauth/authorize", token_url: "https://api.notion.com/v1/oauth/token", userinfo_url: null,
    scopes: [], extra_authorize_params: { owner: "user" }, token_auth: "basic", pkce: false,
    permission_words: "Kinika can create and update pages in the workspace you share with it.",
    console_url: "https://www.notion.so/my-integrations", note: "Create a public integration and add the redirect URI. The founder picks the pages to share during sign-in.",
  },
  {
    key: "github", name: "GitHub", kind: "code", icon: "GH", connector_provider: "github",
    authorize_url: "https://github.com/login/oauth/authorize", token_url: "https://github.com/login/oauth/access_token", userinfo_url: "https://api.github.com/user",
    scopes: ["repo", "read:user"], extra_authorize_params: {}, token_auth: "post", pkce: false,
    permission_words: "Kinika can read the repositories you choose and open pull requests; nothing merges without your yes.",
    console_url: "https://github.com/settings/developers", note: "An OAuth App (not a GitHub App). Put the redirect URI as the Authorization callback URL.",
  },
];

/** The authorize URL for one flow. TikTok names the client id differently; everything else is standard. */
export function buildAuthorizeUrl(p: Pick<OAuthProviderRow, "key" | "authorize_url" | "client_id" | "scopes" | "extra_authorize_params" | "pkce">, redirectUri: string, state: string, codeChallenge?: string): string {
  const u = new URL(p.authorize_url);
  u.searchParams.set(p.key === "tiktok" ? "client_key" : "client_id", p.client_id);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("response_type", "code");
  if (p.scopes.length) u.searchParams.set("scope", p.scopes.join(p.key === "tiktok" ? "," : " "));
  u.searchParams.set("state", state);
  for (const [k, v] of Object.entries(p.extra_authorize_params ?? {})) u.searchParams.set(k, String(v));
  if (p.pkce && codeChallenge) { u.searchParams.set("code_challenge", codeChallenge); u.searchParams.set("code_challenge_method", "S256"); }
  return u.toString();
}

export interface TokenSet {
  access_token: string;
  refresh_token: string | null;
  token_type: string | null;
  expires_at: string | null;
  scope: string[];
  raw: Record<string, unknown>;
}

/** The token response, whatever shape the provider used (Slack nests, Meta omits the type). */
export function parseTokenResponse(body: Record<string, unknown>): TokenSet | null {
  const nested = (body.authed_user ?? null) as Record<string, unknown> | null;
  const access = String(body.access_token ?? nested?.access_token ?? "").trim();
  if (!access) return null;
  const expiresIn = Number(body.expires_in ?? nested?.expires_in ?? 0);
  const scopeRaw = body.scope ?? nested?.scope ?? "";
  const scope = Array.isArray(scopeRaw) ? scopeRaw.map(String) : String(scopeRaw).split(/[ ,]+/).filter(Boolean);
  return {
    access_token: access,
    refresh_token: body.refresh_token ? String(body.refresh_token) : nested?.refresh_token ? String(nested.refresh_token) : null,
    token_type: body.token_type ? String(body.token_type) : null,
    expires_at: expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
    scope,
    raw: body,
  };
}

/** The account behind a userinfo answer, in the four fields Kinika keeps. */
export function parseAccount(body: Record<string, unknown>): OAuthAccount {
  const d = (body.data ?? body.user ?? body) as Record<string, unknown>;
  const u = (d.user ?? d) as Record<string, unknown>;
  const pick = (...keys: string[]) => { for (const k of keys) { const v = u[k] ?? d[k] ?? body[k]; if (v != null && String(v).trim()) return String(v); } return null; };
  return {
    id: pick("id", "sub", "open_id", "user_id", "bot_user_id"),
    name: pick("name", "display_name", "real_name", "login"),
    email: pick("email"),
    handle: pick("username", "login", "handle", "user", "screen_name"),
  };
}

// ── Edge-function only ──────────────────────────────────────────────────────

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = ""; for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function pkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  return { verifier, challenge };
}

/** POST to the token endpoint, the way the provider wants its client credentials. */
export async function exchangeToken(p: Pick<OAuthProviderRow, "key" | "token_url" | "token_auth" | "client_id">, clientSecret: string, params: Record<string, string>): Promise<{ ok: true; token: TokenSet } | { ok: false; error: string }> {
  const form = new URLSearchParams(params);
  const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded", accept: "application/json" };
  if (p.token_auth === "basic") headers.authorization = `Basic ${btoa(`${p.client_id}:${clientSecret}`)}`;
  else { form.set(p.key === "tiktok" ? "client_key" : "client_id", p.client_id); form.set("client_secret", clientSecret); }
  let res: Response;
  try { res = await fetch(p.token_url, { method: "POST", headers, body: form.toString() }); }
  catch (e) { return { ok: false, error: `Could not reach ${p.token_url}: ${(e as Error).message}` }; }
  const text = await res.text();
  let body: Record<string, unknown>;
  try { body = JSON.parse(text); } catch { body = Object.fromEntries(new URLSearchParams(text).entries()); }
  if (!res.ok || body.error || body.ok === false) {
    const err = typeof body.error === "object" && body.error ? String((body.error as Record<string, unknown>).message ?? JSON.stringify(body.error)) : String(body.error_description ?? body.error ?? `HTTP ${res.status}`);
    return { ok: false, error: err.slice(0, 300) };
  }
  const token = parseTokenResponse(body);
  if (!token) return { ok: false, error: "The provider answered without an access token." };
  return { ok: true, token };
}

export async function fetchAccount(p: Pick<OAuthProviderRow, "key" | "userinfo_url">, accessToken: string): Promise<OAuthAccount | null> {
  if (!p.userinfo_url) return null;
  try {
    const res = await fetch(p.userinfo_url, { method: p.key === "slack" ? "POST" : "GET", headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" } });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body) return null;
    return parseAccount(body as Record<string, unknown>);
  } catch { return null; }
}

/** What a tool_connections row stores in Vault for an OAuth connection. */
export interface OAuthSecret {
  oauth_provider_id: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  scope: string[];
}

/**
 * A usable access token for a connection, refreshed through the provider when
 * it is about to expire. Connector adapters call this instead of reading the
 * secret themselves.
 */
// deno-lint-ignore no-explicit-any
export async function getOAuthAccessToken(admin: any, connectionId: string): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const { data: secret } = await admin.rpc("get_connection_secret", { p_connection_id: connectionId });
  const s = secret as OAuthSecret | null;
  if (!s?.access_token || !s.oauth_provider_id) return { ok: false, error: "This connection has no OAuth token." };
  const soon = s.expires_at ? new Date(s.expires_at).getTime() - Date.now() < 60_000 : false;
  if (!soon) return { ok: true, token: s.access_token };
  if (!s.refresh_token) return { ok: false, error: "The token has expired and the provider gave no refresh token. Connect it again." };
  const [{ data: p }, { data: clientSecret }] = await Promise.all([
    admin.from("oauth_providers").select("*").eq("id", s.oauth_provider_id).maybeSingle(),
    admin.rpc("get_oauth_client_secret", { p_provider_id: s.oauth_provider_id }),
  ]);
  if (!p || !clientSecret) return { ok: false, error: "The provider behind this connection is gone." };
  const r = await exchangeToken(p as OAuthProviderRow, String(clientSecret), { grant_type: "refresh_token", refresh_token: s.refresh_token });
  if (r.ok === false) { await admin.from("tool_connections").update({ status: "error", last_error: `Token refresh failed: ${r.error}` }).eq("id", connectionId); return { ok: false, error: r.error }; }
  const next: OAuthSecret = { ...s, access_token: r.token.access_token, refresh_token: r.token.refresh_token ?? s.refresh_token, expires_at: r.token.expires_at, scope: r.token.scope.length ? r.token.scope : s.scope };
  await admin.rpc("store_connection_secret", { p_connection_id: connectionId, p_secret: next });
  return { ok: true, token: next.access_token };
}
