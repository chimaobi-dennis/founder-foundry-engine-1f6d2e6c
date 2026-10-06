import { describe, it, expect } from 'vitest';
import {
  calculateGenerationCredits,
  DEFAULT_CONTENT_STUDIO_RULE,
  type ContentStudioPricingRule,
} from '@/utils/calculateGenerationCredits';

const base = {
  platformCount: 2,
  complexityLevel: 'balanced',
  creativeMode: 'balanced',
  aiFreedom: 50,
  visualAssets: [] as string[],
};

describe('calculateGenerationCredits', () => {
  it('reproduces the historical numbers with the default rule', () => {
    expect(calculateGenerationCredits(base).estimatedCredits).toBe(2);
    expect(calculateGenerationCredits({ ...base, complexityLevel: 'advanced' }).estimatedCredits).toBe(3);
    expect(calculateGenerationCredits({ ...base, complexityLevel: 'simple' }).estimatedCredits).toBe(2); // 1.5 → ceil 2
    expect(calculateGenerationCredits({ ...base, visualAssets: ['ai_generated'] }).estimatedCredits).toBe(3);
    expect(calculateGenerationCredits({ ...base, visualAssets: ['svg_graphics'] }).estimatedCredits).toBe(3); // 2 + 1
    expect(calculateGenerationCredits({ ...base, creativeMode: 'experimental' }).estimatedCredits).toBe(3); // 2.6
    expect(calculateGenerationCredits({ ...base, aiFreedom: 80 }).estimatedCredits).toBe(3); // 2.4
    expect(calculateGenerationCredits({ ...base, aiFreedom: 0.8 }).estimatedCredits).toBe(3); // 0–1 scale
    expect(calculateGenerationCredits({ ...base, variationCount: 3 }).estimatedCredits).toBe(6);
  });

  it('stacks every multiplier the same way the old constants did', () => {
    const r = calculateGenerationCredits({
      platformCount: 3,
      complexityLevel: 'experimental',
      creativeMode: 'experimental',
      aiFreedom: 90,
      visualAssets: ['ai_generated', 'svg_graphics'],
    });
    // ((3 × 2 × 1.5) + 1.5) × 1.3 × 1.2 = 16.38 → 17
    expect(r.breakdown.rawTotal).toBeCloseTo(16.38, 5);
    expect(r.estimatedCredits).toBe(17);
    expect(r.breakdown.rule).toBe(DEFAULT_CONTENT_STUDIO_RULE);
  });

  it('reads multipliers from a database rule', () => {
    const rule: ContentStudioPricingRule = {
      baseCost: 1,
      perPlatformCost: 2,
      complexityMultipliers: { balanced: 1, advanced: 3 },
      featureMultipliers: { ai_visuals: 2, svg_per_platform: 1, experimental_mode: 1, ai_freedom_high: 1, ai_freedom_threshold: 90 },
    };
    // (2 platforms × 2) + 1 base = 5
    expect(calculateGenerationCredits(base, rule).estimatedCredits).toBe(5);
    expect(calculateGenerationCredits({ ...base, complexityLevel: 'advanced' }, rule).estimatedCredits).toBe(15);
    expect(calculateGenerationCredits({ ...base, visualAssets: ['ai_generated'] }, rule).estimatedCredits).toBe(10);
    expect(calculateGenerationCredits({ ...base, visualAssets: ['svg_graphics'] }, rule).estimatedCredits).toBe(7);
    // threshold moved to 90: 80 is no longer "high"
    expect(calculateGenerationCredits({ ...base, aiFreedom: 80 }, rule).breakdown.aiFreedomMultiplier).toBe(1);
  });

  it('falls back to defaults for missing keys in a partial rule', () => {
    const partial = { ...DEFAULT_CONTENT_STUDIO_RULE, complexityMultipliers: {}, featureMultipliers: {} };
    const r = calculateGenerationCredits({ ...base, complexityLevel: 'advanced', visualAssets: ['ai_generated'] }, partial);
    expect(r.breakdown.complexityMultiplier).toBe(1); // unknown level → 1
    expect(r.breakdown.aiVisualsMultiplier).toBe(DEFAULT_CONTENT_STUDIO_RULE.featureMultipliers.ai_visuals);
  });

  it('never returns fractional credits', () => {
    for (let p = 1; p <= 6; p++) {
      for (const level of ['simple', 'balanced', 'advanced', 'experimental']) {
        const n = calculateGenerationCredits({ ...base, platformCount: p, complexityLevel: level }).estimatedCredits;
        expect(Number.isInteger(n)).toBe(true);
        expect(n).toBeGreaterThan(0);
      }
    }
  });
});
