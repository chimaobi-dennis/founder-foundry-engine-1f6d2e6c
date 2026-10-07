/**
 * Model routing helpers shared by the gateway, the admin page and tests.
 * The database decides the candidates (resolve_ai_route); this decides how
 * the gateway walks them.
 */

export type TaskClass = "fast" | "writing" | "reasoning" | "coding" | "vision";
export const TASK_CLASSES: TaskClass[] = ["fast", "writing", "reasoning", "coding", "vision"];

/** The class a legacy tier maps to. */
export function tierClass(tier: string | null | undefined): TaskClass | null {
  switch (tier) {
    case "fast": return "fast";
    case "standard": return "writing";
    case "reasoning": return "reasoning";
    case "coding": return "coding";
    default: return null;
  }
}

export interface RouteCandidate {
  model_row_id: string;
  model_id: string;
  model_name: string;
  max_output: number | null;
  strip_reasoning: boolean;
  supports_vision: boolean;
  cost_per_1k_input: number | null;
  cost_per_1k_output: number | null;
  provider: { id: string; slug: string; base_url: string; auth_header_name: string; auth_header_prefix: string; is_enabled: boolean };
}

export interface Route {
  profile: string | null;
  class: string | null;
  source: string;
  candidates: RouteCandidate[];
}

/** Up to this many distinct models are tried for one call. */
export const MAX_CANDIDATES = 3;
/** One retry on the same model before moving to the next, after this pause. */
export const RETRY_DELAY_MS = 1200;

const RETRYABLE_TEXT = /high demand|overloaded|rate limit|capacity|temporarily unavailable|try again|timed? ?out|service unavailable|resource.?exhausted/i;

/** A failure worth retrying or failing over: the provider, not the request, is the problem. */
export function isRetryable(status: number | null | undefined, message: string | null | undefined): boolean {
  if (status === 408 || status === 409 || status === 425 || status === 429) return true;
  if (status != null && status >= 500 && status <= 599) return true;
  return RETRYABLE_TEXT.test(String(message ?? ""));
}

/** Reasoning models (R1, Qwen-thinking) may wrap their thinking in <think>…</think>; callers want the answer. */
export function stripReasoning(text: string): string {
  if (!text) return text;
  const out = text.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/^<think>[\s\S]*$/i, "");
  return out.trim() || text.trim();
}

/** Keep vision-capable candidates first when the request carries an image; drop none, since a text answer beats no answer. */
export function orderForRequest(candidates: RouteCandidate[], needsVision: boolean): RouteCandidate[] {
  const usable = candidates.filter((c) => c.provider?.is_enabled !== false).slice(0, MAX_CANDIDATES * 2);
  if (!needsVision) return usable.slice(0, MAX_CANDIDATES);
  return [...usable.filter((c) => c.supports_vision), ...usable.filter((c) => !c.supports_vision)].slice(0, MAX_CANDIDATES);
}

/** Cap the request's max tokens at what the model can produce, when known. */
export function capMaxTokens(requested: number, candidate: Pick<RouteCandidate, "max_output">): number {
  const cap = candidate.max_output && candidate.max_output > 0 ? candidate.max_output : requested;
  return Math.max(16, Math.min(requested, cap));
}
