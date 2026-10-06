import { describe, it, expect } from 'vitest';
import {
  billableCredits,
  costFromUsage,
  creditCogsUsd,
  creditsFromCost,
  normalizeUsage,
  type CreditEconomics,
  type TokenUsage,
} from '@shared/pricing';

const econ: CreditEconomics = { retail_usd_per_credit: 0.02, cogs_multiplier: 5 };

describe('shared pricing helpers', () => {
  it('costFromUsage prices each token class and falls back cache tiers to input', () => {
    const usage: TokenUsage = { input_tokens: 2000, output_tokens: 1500, cache_read_tokens: 6000, cache_write_tokens: 0 };
    // Sonnet-style rate with explicit cache read
    const sonnet = { input_per_1m: 2, output_per_1m: 10, cache_read_per_1m: 0.2, cache_write_per_1m: 2.5 };
    expect(costFromUsage(usage, sonnet)).toBeCloseTo((2000 * 2 + 1500 * 10 + 6000 * 0.2) / 1e6, 6);
    // No cache rates → cache tokens cost the input rate
    const open = { input_per_1m: 0.1, output_per_1m: 0.32 };
    expect(costFromUsage(usage, open)).toBeCloseTo((2000 * 0.1 + 1500 * 0.32 + 6000 * 0.1) / 1e6, 6);
    expect(costFromUsage(usage, null)).toBe(0);
  });

  it('credit COGS is retail ÷ multiplier', () => {
    expect(creditCogsUsd(econ)).toBeCloseTo(0.004, 6);
    expect(creditCogsUsd({ retail_usd_per_credit: 0.02, cogs_multiplier: 0 })).toBe(0.02);
  });

  it('creditsFromCost and billableCredits never undercharge', () => {
    expect(creditsFromCost(0.0769, econ)).toBeCloseTo(19.225, 3);
    expect(billableCredits(0.0769, econ)).toBe(20);
    expect(billableCredits(0.004, econ)).toBe(1);
    expect(billableCredits(0.0001, econ)).toBe(1); // tiny cost still 1 credit
    expect(billableCredits(0, econ)).toBe(0);
  });

  it('normalizeUsage maps each provider shape to one structure', () => {
    expect(normalizeUsage('anthropic', { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 30, cache_creation_input_tokens: 5 }))
      .toEqual({ input_tokens: 10, output_tokens: 20, cache_read_tokens: 30, cache_write_tokens: 5 });
    // OpenAI prompt_tokens includes cached tokens; they are split out
    expect(normalizeUsage('openai', { prompt_tokens: 100, completion_tokens: 40, prompt_tokens_details: { cached_tokens: 60 } }))
      .toEqual({ input_tokens: 40, output_tokens: 40, cache_read_tokens: 60, cache_write_tokens: 0 });
    // Google promptTokenCount includes cached; thoughts count as output
    expect(normalizeUsage('google', { promptTokenCount: 100, candidatesTokenCount: 30, thoughtsTokenCount: 10, cachedContentTokenCount: 20 }))
      .toEqual({ input_tokens: 80, output_tokens: 40, cache_read_tokens: 20, cache_write_tokens: 0 });
    expect(normalizeUsage('openai', null)).toEqual({ input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0 });
  });
});
