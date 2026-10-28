/**
 * Understanding Service — "your business, as Kinika understands it".
 * The read-back is drafted and approved by the `understanding` edge
 * function; this is the thin client, plus the pure helpers the UI shares
 * with the function.
 */

import { postNarrated, type OnProgress } from '@/services/narrated';
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

/** How long the browser waits for a read-back before giving up. */
export const READ_TIMEOUT_MS = 120_000;

/** Draft the read-back. Nothing is written until it is approved. */
export function draftUnderstanding(brandId: string, input: DraftInput, signal?: AbortSignal, onProgress?: OnProgress) {
  return postNarrated<Result<{ readback: Readback; sourcesRead: { site: boolean; chat: boolean; documents: number } }>>('understanding', { action: 'draft', brandId, ...input }, { signal, timeoutMs: READ_TIMEOUT_MS, onProgress });
}

/** Approve the (possibly edited) read-back; writes the brand record, the stage, the kind and the goal. */
export function approveUnderstanding(brandId: string, readback: Readback, goal?: string, goalHorizon?: string, sources?: { site?: boolean; chat?: boolean; documents?: number; pasted?: boolean }) {
  return postNarrated<Result<{ kind: BusinessKind; stage: string }>>('understanding', { action: 'approve', brandId, readback, goal, goalHorizon, sources }, { timeoutMs: 60_000 });
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
