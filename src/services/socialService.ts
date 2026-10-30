import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_CONFIG } from '@/config/supabaseConfig';
import { isSocialProviderKey, type SocialSnapshot } from '@shared/socialRead';
import type { ToolConnection } from './connectionService';

export { isSocialProviderKey, snapshotBlock, type SocialSnapshot } from '@shared/socialRead';

/** The workspace's connections that are social accounts Kinika can read. */
export function socialConnections(connections: ToolConnection[]): ToolConnection[] {
  return connections.filter((c) => c.status !== 'error' && isSocialProviderKey(c.config?.oauth_provider_key));
}

/**
 * Ask Kinika to read the chosen accounts for this task. The facts are handed
 * to the task conversation; the reply arrives through the usual polling.
 */
export async function readSocialAccounts(brandId: string, taskId: string, connectionIds: string[]): Promise<{ success: true; snapshots: SocialSnapshot[]; errors: { account: string; error: string }[] } | { success: false; error: string }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { success: false, error: 'Not signed in' };
  try {
    const res = await fetch(`${SUPABASE_CONFIG.url}/functions/v1/social-audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_CONFIG.anonKey, Authorization: `Bearer ${token}` },
      body: JSON.stringify({ brandId, taskId, connectionIds }),
    });
    const json = await res.json().catch(() => null);
    return json ?? { success: false, error: `Kinika could not read the accounts (${res.status})` };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : 'Could not reach Kinika' };
  }
}
