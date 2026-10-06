/**
 * Pure pricing helpers shared by the ai-gateway edge function and the
 * frontend quote engine. No Deno or browser APIs here so vitest can run it.
 */

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
}

export interface ModelRate {
  input_per_1m: number;
  output_per_1m: number;
  cache_read_per_1m?: number | null;
  cache_write_per_1m?: number | null;
}

export interface CreditEconomics {
  retail_usd_per_credit: number;
  cogs_multiplier: number;
}

export const DEFAULT_CREDIT_ECONOMICS: CreditEconomics = {
  retail_usd_per_credit: 0.02,
  cogs_multiplier: 5,
};

export const EMPTY_USAGE: TokenUsage = {
  input_tokens: 0,
  output_tokens: 0,
  cache_read_tokens: 0,
  cache_write_tokens: 0,
};

/** Provider cost in USD for one call. Cache tiers fall back to the input rate. */
export function costFromUsage(usage: TokenUsage, rate: ModelRate | null | undefined): number {
  if (!rate) return 0;
  const cacheRead = rate.cache_read_per_1m ?? rate.input_per_1m;
  const cacheWrite = rate.cache_write_per_1m ?? rate.input_per_1m;
  const cost =
    (usage.input_tokens * rate.input_per_1m +
      usage.output_tokens * rate.output_per_1m +
      usage.cache_read_tokens * cacheRead +
      usage.cache_write_tokens * cacheWrite) /
    1_000_000;
  return round(cost, 6);
}

/** What one credit costs the platform, given retail price and markup. */
export function creditCogsUsd(econ: CreditEconomics): number {
  if (!econ.cogs_multiplier || econ.cogs_multiplier <= 0) return econ.retail_usd_per_credit;
  return econ.retail_usd_per_credit / econ.cogs_multiplier;
}

/** Credits a given provider cost is worth. Fractional; callers round. */
export function creditsFromCost(costUsd: number, econ: CreditEconomics): number {
  const perCredit = creditCogsUsd(econ);
  if (perCredit <= 0) return 0;
  return round(costUsd / perCredit, 4);
}

/** Whole credits to charge for a cost. Never undercharges. */
export function billableCredits(costUsd: number, econ: CreditEconomics): number {
  const raw = creditsFromCost(costUsd, econ);
  return raw <= 0 ? 0 : Math.max(1, Math.ceil(raw - 1e-9));
}

/**
 * Normalize the usage block each provider returns into one shape.
 * Anthropic: input_tokens excludes cache tokens.
 * OpenAI-compatible: prompt_tokens includes cached tokens; subtract them.
 * Google: promptTokenCount includes cachedContentTokenCount; subtract.
 */
export function normalizeUsage(providerKind: "anthropic" | "openai" | "google", raw: any): TokenUsage {
  if (!raw) return { ...EMPTY_USAGE };
  const n = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : 0);
  switch (providerKind) {
    case "anthropic":
      return {
        input_tokens: n(raw.input_tokens),
        output_tokens: n(raw.output_tokens),
        cache_read_tokens: n(raw.cache_read_input_tokens),
        cache_write_tokens: n(raw.cache_creation_input_tokens),
      };
    case "openai": {
      const cached = n(raw.prompt_tokens_details?.cached_tokens);
      return {
        input_tokens: Math.max(0, n(raw.prompt_tokens) - cached),
        output_tokens: n(raw.completion_tokens),
        cache_read_tokens: cached,
        cache_write_tokens: 0,
      };
    }
    case "google": {
      const cached = n(raw.cachedContentTokenCount);
      return {
        input_tokens: Math.max(0, n(raw.promptTokenCount) - cached),
        output_tokens: n(raw.candidatesTokenCount) + n(raw.thoughtsTokenCount),
        cache_read_tokens: cached,
        cache_write_tokens: 0,
      };
    }
  }
}

function round(v: number, places: number): number {
  const f = Math.pow(10, places);
  return Math.round(v * f) / f;
}
