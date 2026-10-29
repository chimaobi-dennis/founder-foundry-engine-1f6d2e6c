/**
 * OAuth service — the browser side of universal OAuth.
 *
 * Founders: list the providers an admin has put live and connect one in a
 * popup; the callback lands on /oauth/done, which tells this window. Admins:
 * manage providers (details here, the client secret straight to Vault),
 * verify one by signing in through it, go live, pause.
 */
import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_CONFIG } from '@/config/supabaseConfig';
import { OAUTH_PRESETS, type OAuthProviderRow, type OAuthPreset } from '@shared/oauth';

export type { OAuthProviderRow, OAuthPreset };
export { OAUTH_PRESETS };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export async function listLiveProviders(): Promise<OAuthProviderRow[]> {
  const { data, error } = await db.from('oauth_providers').select('*').eq('status', 'live').order('sort_order').order('name');
  if (error) { console.error('[OAuth] listLiveProviders', error.message); return []; }
  return data ?? [];
}

export async function listAllProviders(): Promise<OAuthProviderRow[]> {
  const { data, error } = await db.from('oauth_providers').select('*').order('sort_order').order('name');
  if (error) { console.error('[OAuth] listAllProviders', error.message); return []; }
  return data ?? [];
}

export type ProviderInput = Pick<OAuthProviderRow, 'key' | 'name' | 'kind' | 'connector_provider' | 'authorize_url' | 'token_url' | 'userinfo_url' | 'scopes' | 'extra_authorize_params' | 'token_auth' | 'pkce' | 'client_id' | 'permission_words' | 'icon' | 'sort_order'>;

export async function saveProvider(id: string | null, input: ProviderInput): Promise<{ success: boolean; error?: string; provider?: OAuthProviderRow }> {
  const patch = { ...input, key: input.key.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_'), updated_at: new Date().toISOString() };
  const q = id ? db.from('oauth_providers').update(patch).eq('id', id) : db.from('oauth_providers').insert(patch);
  const { data, error } = await q.select('*').single();
  if (error) return { success: false, error: error.message };
  return { success: true, provider: data };
}

export async function setProviderStatus(id: string, status: OAuthProviderRow['status']): Promise<boolean> {
  const { error } = await db.from('oauth_providers').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
  return !error;
}

export async function deleteProvider(id: string): Promise<boolean> {
  const { error } = await db.from('oauth_providers').delete().eq('id', id);
  return !error;
}

/** The client secret goes to Vault and never comes back to the browser. */
export async function setClientSecret(providerId: string, secret: string): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await db.rpc('set_oauth_client_secret', { p_provider_id: providerId, p_secret: secret });
  if (error) return { success: false, error: error.message };
  return data?.success ? { success: true } : { success: false, error: data?.error ?? 'Could not save the secret' };
}

export async function clientSecretIsSet(providerId: string): Promise<boolean> {
  const { data } = await db.rpc('oauth_secret_is_set', { p_provider_id: providerId });
  return !!data;
}

/** The URL the admin must register with every provider. */
export function redirectUri(): string {
  return `${SUPABASE_CONFIG.url}/functions/v1/oauth-callback`;
}

async function startFlow(providerKey: string, mode: 'connect' | 'verify', brandId?: string): Promise<{ success: boolean; error?: string; url?: string }> {
  const { data, error } = await supabase.functions.invoke('oauth-start', { body: { providerKey, mode, brandId, redirectTo: `${window.location.origin}/oauth/done` } });
  if (error) {
    // The function's own message is in the response body when it refused.
    const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
    return { success: false, error: body?.error ?? error.message };
  }
  return data as { success: boolean; error?: string; url?: string };
}

export interface OAuthOutcome { ok: boolean; key?: string; error?: string; verified?: boolean }

/**
 * Open the provider's sign-in in a popup and resolve when /oauth/done reports
 * back. The page the founder is on keeps its state. If the popup is blocked,
 * the whole window goes instead and the page handles ?connected= on return.
 */
export function runInPopup(url: string): Promise<OAuthOutcome> {
  return new Promise((resolve) => {
    const w = 600, h = 720;
    const left = window.screenX + Math.max(0, (window.outerWidth - w) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - h) / 2);
    const popup = window.open(url, 'kinika-oauth', `width=${w},height=${h},left=${left},top=${top}`);
    if (!popup) { window.location.href = url; return; }
    let done = false;
    const finish = (o: OAuthOutcome) => { if (done) return; done = true; window.removeEventListener('message', onMessage); window.clearInterval(poll); resolve(o); };
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || !e.data || e.data.type !== 'kinika:oauth') return;
      finish({ ok: !e.data.error, key: e.data.key, error: e.data.error, verified: !!e.data.verified });
      try { popup.close(); } catch { /* already closed */ }
    };
    window.addEventListener('message', onMessage);
    const poll = window.setInterval(() => { if (popup.closed) finish({ ok: false, error: 'The sign-in window was closed.' }); }, 700);
  });
}

export async function connectProvider(providerKey: string, brandId: string): Promise<OAuthOutcome> {
  const r = await startFlow(providerKey, 'connect', brandId);
  if (!r.success || !r.url) return { ok: false, error: r.error ?? 'Could not start' };
  return runInPopup(r.url);
}

export async function verifyProvider(providerKey: string): Promise<OAuthOutcome> {
  const r = await startFlow(providerKey, 'verify');
  if (!r.success || !r.url) return { ok: false, error: r.error ?? 'Could not start' };
  return runInPopup(r.url);
}

/** Is this tool_connections row one made by OAuth? */
export function isOAuthConnection(c: { config: Record<string, unknown> }): boolean {
  return !!c.config?.oauth_provider_id;
}
