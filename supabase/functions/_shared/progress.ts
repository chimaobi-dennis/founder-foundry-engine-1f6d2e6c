/**
 * Narrated progress: the real steps of a long piece of work, as they happen.
 *
 * A function plans its steps up front (so the founder sees the to-do list),
 * then marks each one doing, done or failed as the work moves. Two sinks:
 *   - streamed: NDJSON lines on the HTTP response, for work the browser waits
 *     for (the read-back, the plan, the breakdown). The last line carries the
 *     result; everything before it is `{ "progress": [...] }`.
 *   - stored: a jsonb column on the row the browser already polls (task chat).
 * The words name what Kinika is doing, never fake steps; a step that was
 * skipped says so in its note instead of being hidden.
 *
 * Pure helpers live here so the browser can share the types via @shared.
 */

export type ProgressStatus = "todo" | "doing" | "done" | "failed" | "skipped";

export interface ProgressStep {
  key: string;
  label: string;
  status: ProgressStatus;
  /** ISO time the step started or ended; the browser shows elapsed time on the doing step. */
  at?: string;
  /** One short plain-words line: what was found, what was left out, why it failed. */
  note?: string;
}

export interface Narrator {
  /** Declare the steps in order. Can be called again to append steps discovered along the way. */
  plan(steps: Array<{ key: string; label: string }>): void;
  start(key: string, label?: string): void;
  done(key: string, note?: string): void;
  fail(key: string, note?: string): void;
  skip(key: string, note?: string): void;
  readonly steps: ProgressStep[];
}

/** Apply one event to a step list; returns a new list. Exported for tests and for the browser. */
export function applyProgress(steps: ProgressStep[], ev: { op: "plan"; steps: Array<{ key: string; label: string }> } | { op: ProgressStatus; key: string; label?: string; note?: string; at: string }): ProgressStep[] {
  if (ev.op === "plan") {
    const have = new Set(steps.map((s) => s.key));
    return [...steps, ...ev.steps.filter((s) => !have.has(s.key)).map((s) => ({ key: s.key, label: s.label, status: "todo" as const }))];
  }
  if (!steps.some((s) => s.key === ev.key)) steps = [...steps, { key: ev.key, label: ev.label ?? ev.key, status: "todo" }];
  return steps.map((s) => s.key !== ev.key ? s : { ...s, status: ev.op, label: ev.label ?? s.label, at: ev.at, ...(ev.note ? { note: ev.note } : {}) });
}

/** A narrator whose every change is handed to `emit` with the full step list. */
export function makeNarrator(emit: (steps: ProgressStep[]) => void): Narrator {
  let steps: ProgressStep[] = [];
  const push = (ev: Parameters<typeof applyProgress>[1]) => { steps = applyProgress(steps, ev); emit(steps); };
  const now = () => new Date().toISOString();
  return {
    get steps() { return steps; },
    plan: (list) => push({ op: "plan", steps: list }),
    start: (key, label) => push({ op: "doing", key, label, at: now() }),
    done: (key, note) => push({ op: "done", key, note, at: now() }),
    fail: (key, note) => push({ op: "failed", key, note, at: now() }),
    skip: (key, note) => push({ op: "skipped", key, note, at: now() }),
  };
}

/** A narrator that does nothing: for callers (the runner) that have no one watching. */
export const silentNarrator: Narrator = makeNarrator(() => {});

/** Whether the caller asked for the narrated stream; anyone else gets plain JSON as before. */
export function wantsStream(req: Request): boolean {
  return (req.headers.get("accept") ?? "").includes("application/x-ndjson");
}

/**
 * Streamed sink. `work` receives the narrator and returns the final body;
 * the response is NDJSON: progress lines, then `{ "result": body }`.
 * Errors thrown by `work` become `{ result: { success: false, error } }`.
 * A caller that did not ask for the stream (Accept without x-ndjson) gets
 * the final body as plain JSON, so older clients keep working.
 */
export function narratedResponse(req: Request, headers: Record<string, string>, work: (n: Narrator) => Promise<unknown>): Response | Promise<Response> {
  if (!wantsStream(req)) {
    return work(silentNarrator)
      .then((result) => new Response(JSON.stringify(result), { status: 200, headers: { ...headers, "content-type": "application/json" } }))
      .catch((e) => new Response(JSON.stringify({ success: false, error: (e as Error).message }), { status: 500, headers: { ...headers, "content-type": "application/json" } }));
  }
  const enc = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  const write = (obj: unknown) => { try { controller?.enqueue(enc.encode(JSON.stringify(obj) + "\n")); } catch { /* closed: the browser went away */ } };
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
      const n = makeNarrator((steps) => write({ progress: steps }));
      work(n)
        .then((result) => write({ result }))
        .catch((e) => write({ result: { success: false, error: (e as Error).message } }))
        .finally(() => { try { c.close(); } catch { /* already closed */ } });
    },
  });
  return new Response(stream, { status: 200, headers: { ...headers, "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-cache", "x-accel-buffering": "no" } });
}

/**
 * Stored sink: the step list is written to `table.column` on `id` at every
 * change. Writes are awaited in order so the row never goes backwards.
 */
// deno-lint-ignore no-explicit-any
export function storedNarrator(admin: any, table: string, id: string, column = "progress"): Narrator {
  let chain: Promise<unknown> = Promise.resolve();
  return makeNarrator((steps) => {
    chain = chain.then(() => admin.from(table).update({ [column]: steps }).eq("id", id)).catch(() => null);
  });
}

/** Parse one NDJSON line from a narrated response. */
export function parseProgressLine(line: string): { progress: ProgressStep[] } | { result: unknown } | null {
  const t = line.trim();
  if (!t) return null;
  try { return JSON.parse(t); } catch { return null; }
}
