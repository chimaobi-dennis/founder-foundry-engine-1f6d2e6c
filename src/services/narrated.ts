/**
 * A call to an edge function that narrates its progress: the response is
 * NDJSON, `{ progress: [...] }` lines while the work runs and `{ result }`
 * last. `onProgress` gets each step list; the promise resolves with the
 * result. A plain JSON answer (an early error) is passed through unchanged.
 */
import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_CONFIG } from '@/config/supabaseConfig';
import { parseProgressLine, type ProgressStep } from '@shared/progress';

export type { ProgressStep } from '@shared/progress';
export type OnProgress = (steps: ProgressStep[]) => void;

export interface NarratedOptions {
  signal?: AbortSignal;
  /** Give up after this long with no final result (default two and a half minutes). */
  timeoutMs?: number;
  onProgress?: OnProgress;
}

type Failure = { success: false; error: string };

export async function postNarrated<T extends { success: boolean }>(fn: string, body: Record<string, unknown>, opts: NarratedOptions = {}): Promise<T | Failure> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { success: false, error: 'Not signed in' };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new DOMException('timeout', 'TimeoutError')), opts.timeoutMs ?? 150_000);
  const onOuter = () => ctrl.abort(opts.signal?.reason);
  opts.signal?.addEventListener('abort', onOuter, { once: true });
  try {
    const res = await fetch(`${SUPABASE_CONFIG.url}/functions/v1/${fn}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson, application/json', apikey: SUPABASE_CONFIG.anonKey, Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const type = res.headers.get('content-type') ?? '';
    if (!type.includes('ndjson') || !res.body) {
      const json = await res.json().catch(() => null);
      if (json && typeof json === 'object' && 'success' in json) return json as T | Failure;
      return { success: false, error: res.status >= 500 ? `Kinika did not answer properly (${res.status}). Try again.` : `Kinika did not answer (${res.status}).` };
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let result: T | Failure | null = null;
    const take = (line: string) => {
      const ev = parseProgressLine(line);
      if (!ev) return;
      if ('progress' in ev) opts.onProgress?.(ev.progress);
      else if ('result' in ev && ev.result && typeof ev.result === 'object') result = ev.result as T | Failure;
    };
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) { take(buf.slice(0, nl)); buf = buf.slice(nl + 1); }
    }
    if (buf.trim()) take(buf);
    return result ?? { success: false, error: 'Kinika stopped answering before it finished. Try again.' };
  } catch (e: unknown) {
    if (opts.signal?.aborted) return { success: false, error: 'cancelled' };
    if (e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError')) return { success: false, error: 'Kinika did not answer in time. Try again.' };
    return { success: false, error: e instanceof Error ? e.message : 'Could not reach Kinika' };
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onOuter);
  }
}
