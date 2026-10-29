/**
 * Watch service — what a workspace can watch and the last real item, for
 * "start from" at set-up. The reading happens in the watch-source function,
 * where the credentials are.
 */
import { supabase } from '@/integrations/supabase/client';
import type { WatchItem } from '@shared/watch';

export type { WatchItem };
export { WATCH_SOURCES, watchSourceFor } from '@shared/watch';

async function call<T>(body: Record<string, unknown>): Promise<T & { success: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke('watch-source', { body });
  if (error) {
    const b = await (error as { context?: Response }).context?.json?.().catch(() => null);
    return { success: false, error: b?.error ?? error.message } as T & { success: boolean; error?: string };
  }
  return data as T & { success: boolean; error?: string };
}

export interface AvailableSource { key: string; name: string; words: string; noun: string; nouns: string; options: { key: string; label: string; placeholder: string }[]; connection_id: string; display_name: string }

export function listWatchSources(brandId: string) {
  return call<{ sources: AvailableSource[] }>({ action: 'sources', brandId });
}

/** The newest item and how many arrived in the last week. */
export function peekWatchSource(brandId: string, source: string, connectionId: string, options?: Record<string, string>) {
  return call<{ latest: WatchItem | null; recentCount: number; connection_id: string }>({ action: 'peek', brandId, source, connectionId, options });
}

/** "2 hours ago", for the start-from line. */
export function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}
