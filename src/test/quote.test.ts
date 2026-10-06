import { describe, it, expect, vi } from 'vitest';

// pricingService imports the supabase client at module load; stub it so the
// pure quote functions can be tested without a network.
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

import { quoteFromRule, usageCredits, withBalance, type PricingRule } from '@/services/pricingService';

const econ = { retail_usd_per_credit: 0.02, cogs_multiplier: 5 };

const rule = (over: Partial<PricingRule>): PricingRule => ({
  id: 'r1',
  pricing_key: 'agent_designed_post',
  display_name: 'Designed social post',
  description: null,
  base_cost: 20,
  per_platform_cost: 0,
  complexity_multipliers: {},
  feature_multipliers: { rush: 1.5 },
  model_multipliers: {},
  is_active: true,
  pricing_mode: 'fixed',
  model_tier: 'standard',
  range_factor: 1,
  cogs_estimate_usd: 0.0769,
  unit_label: 'post',
  ...over,
});

describe('quoteFromRule', () => {
  it('fixed rules quote an exact number with min = max', () => {
    const q = quoteFromRule(rule({}), { actionType: 'agent_designed_post', units: 3 }, econ);
    expect(q.mode).toBe('fixed');
    expect(q.estimate).toBe(60);
    expect(q.min).toBe(60);
    expect(q.max).toBe(60);
    expect(q.retailUsd).toBeCloseTo(1.2, 2);
    expect(q.fromRule).toBe(true);
    expect(q.breakdown[0].label).toContain('× 3 posts');
  });

  it('metered rules quote a range and reserve the max', () => {
    const q = quoteFromRule(rule({ pricing_key: 'agent_code_change', pricing_mode: 'metered', base_cost: 133, range_factor: 2 }), { actionType: 'agent_code_change' }, econ);
    expect(q.mode).toBe('metered');
    expect(q.estimate).toBe(133);
    expect(q.max).toBe(266);
    expect(q.min).toBe(66);
    expect(q.breakdown.some((l) => l.label.startsWith('Metered'))).toBe(true);
  });

  it('applies option multipliers and rounds up', () => {
    const q = quoteFromRule(rule({ base_cost: 7 }), { actionType: 'agent_designed_post', options: ['rush', 'unknown'] }, econ);
    expect(q.estimate).toBe(11); // 7 × 1.5 = 10.5 → 11
    expect(q.breakdown.find((l) => l.label === 'rush')?.value).toBe('×1.5');
  });

  it('a missing rule quotes zero and says so', () => {
    const q = quoteFromRule(null, { actionType: 'nope' }, econ);
    expect(q.estimate).toBe(0);
    expect(q.fromRule).toBe(false);
  });
});

describe('withBalance', () => {
  it('reports shortfall against the max, balance after against the estimate', () => {
    const q = quoteFromRule(rule({ pricing_mode: 'metered', base_cost: 100, range_factor: 1.5 }), { actionType: 'x' }, econ);
    const a = withBalance(q, 120);
    expect(a.hasSufficientBalance).toBe(false);
    expect(a.shortfall).toBe(30); // max 150 − 120
    expect(a.balanceAfter).toBe(20); // 120 − estimate 100
    const b = withBalance(q, 200);
    expect(b.hasSufficientBalance).toBe(true);
    expect(b.shortfall).toBe(0);
  });
});

describe('usageCredits', () => {
  it('turns real usage into cost, equivalent credits and a whole billable amount', () => {
    const u = usageCredits(
      { input_tokens: 2000, output_tokens: 1500, cache_read_tokens: 6000, cache_write_tokens: 0 },
      { input_per_1m: 2, output_per_1m: 10, cache_read_per_1m: 0.2, cache_write_per_1m: 2.5 },
      econ
    );
    expect(u.costUsd).toBeCloseTo(0.0202, 4);
    expect(u.creditCogsUsd).toBeCloseTo(0.004, 6);
    expect(u.creditsEquivalent).toBeCloseTo(5.05, 2);
    expect(u.billableCredits).toBe(6);
  });
});
