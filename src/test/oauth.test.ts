import { describe, expect, it } from "vitest";
import { buildAuthorizeUrl, parseAccount, parseTokenResponse, OAUTH_PRESETS } from "@shared/oauth";

describe("buildAuthorizeUrl", () => {
  it("puts the standard parameters on, and PKCE when asked", () => {
    const u = new URL(buildAuthorizeUrl({ key: "google", authorize_url: "https://accounts.google.com/o/oauth2/v2/auth", client_id: "cid", scopes: ["openid", "email"], extra_authorize_params: { prompt: "consent" }, pkce: true }, "https://x.supabase.co/functions/v1/oauth-callback", "state-1", "chal"));
    expect(u.searchParams.get("client_id")).toBe("cid");
    expect(u.searchParams.get("scope")).toBe("openid email");
    expect(u.searchParams.get("prompt")).toBe("consent");
    expect(u.searchParams.get("code_challenge")).toBe("chal");
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
    expect(u.searchParams.get("state")).toBe("state-1");
  });
  it("uses client_key and comma scopes for TikTok", () => {
    const u = new URL(buildAuthorizeUrl({ key: "tiktok", authorize_url: "https://www.tiktok.com/v2/auth/authorize/", client_id: "k", scopes: ["a", "b"], extra_authorize_params: {}, pkce: false }, "https://cb", "s"));
    expect(u.searchParams.get("client_key")).toBe("k");
    expect(u.searchParams.get("client_id")).toBeNull();
    expect(u.searchParams.get("scope")).toBe("a,b");
  });
});

describe("parseTokenResponse", () => {
  it("reads a plain token with an expiry and space-separated scope", () => {
    const t = parseTokenResponse({ access_token: "at", refresh_token: "rt", expires_in: 3600, scope: "a b", token_type: "Bearer" });
    expect(t?.access_token).toBe("at"); expect(t?.refresh_token).toBe("rt"); expect(t?.scope).toEqual(["a", "b"]);
    expect(t?.expires_at && new Date(t.expires_at).getTime() - Date.now()).toBeGreaterThan(3_500_000);
  });
  it("reads Slack's nested user token and Meta's bare token", () => {
    expect(parseTokenResponse({ ok: true, authed_user: { access_token: "xoxp", scope: "chat:write,channels:read" } })?.scope).toEqual(["chat:write", "channels:read"]);
    expect(parseTokenResponse({ access_token: "EAAB", expires_in: 5184000 })?.refresh_token).toBeNull();
    expect(parseTokenResponse({ error: "bad" })).toBeNull();
  });
});

describe("parseAccount", () => {
  it("finds a name across provider shapes", () => {
    expect(parseAccount({ sub: "1", name: "Ada", email: "a@x.io" })).toEqual({ id: "1", name: "Ada", email: "a@x.io", handle: null });
    expect(parseAccount({ data: { user: { open_id: "o", display_name: "Tik", username: "tik" } } }).handle).toBe("tik");
    expect(parseAccount({ login: "octo", id: 7 })).toMatchObject({ id: "7", name: "octo", handle: "octo" });
  });
});

describe("presets", () => {
  it("every preset has unique keys and both URLs", () => {
    const keys = new Set(OAUTH_PRESETS.map((p) => p.key));
    expect(keys.size).toBe(OAUTH_PRESETS.length);
    for (const p of OAUTH_PRESETS) { expect(p.authorize_url).toMatch(/^https:\/\//); expect(p.token_url).toMatch(/^https:\/\//); }
  });
});
