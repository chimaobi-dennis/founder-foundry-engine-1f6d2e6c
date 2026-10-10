/**
 * Understanding Service — "your business, as Kinika understands it".
 * The read-back is drafted and approved by the `understanding` edge
 * function; this is the thin client, plus the pure helpers the UI shares
 * with the function.
 */

import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_CONFIG } from '@/config/supabaseConfig';
import type { BusinessKind, Readback } from '@shared/understanding';

export type { BusinessKind, Readback, ReadbackSection, Confidence } from '@shared/understanding';
export { sectionLabels } from '@shared/understanding';

export interface DraftInput {
  text: string;
  kind: BusinessKind;
  websiteUrl?: string;
  chatUrl?: string;
  pasted?: string;
  documents?: string[];
}

type Result<T> = ({ success: true; error?: undefined } & T) | { success: false; error: string };

async function call<T>(body: Record<string, unknown>): Promise<Result<T>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { success: false, error: 'Not signed in' };
  try {
    const res = await fetch(`${SUPABASE_CONFIG.url}/functions/v1/understanding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_CONFIG.anonKey, Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    return json ?? { success: false, error: `Kinika did not answer (${res.status})` };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : 'Could not reach Kinika' };
  }
}

/** Draft the read-back. Nothing is written until it is approved. */
export function draftUnderstanding(brandId: string, input: DraftInput) {
  return call<{ readback: Readback; sourcesRead: { site: boolean; chat: boolean; documents: number } }>({ action: 'draft', brandId, ...input });
}

/** Approve the (possibly edited) read-back; writes the brand record, the stage, the kind and the goal. */
export function approveUnderstanding(brandId: string, readback: Readback, goal?: string, goalHorizon?: string) {
  return call<{ kind: BusinessKind; stage: string }>({ action: 'approve', brandId, readback, goal, goalHorizon });
}

/** Read a text-like file in the browser for the draft (PDF and images are not read here). */
export function readTextFile(file: File, limit = 6000): Promise<string | null> {
  if (!/^text\/|json|markdown|csv/.test(file.type) && !/\.(txt|md|csv|json)$/i.test(file.name)) return Promise.resolve(null);
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(String(e.target?.result ?? '').slice(0, limit) || null);
    reader.onerror = () => resolve(null);
    reader.readAsText(file);
  });
}
