/**
 * ContentStudio Credit Calculation - Single Source of Truth
 *
 * This utility calculates generation credits consistently across:
 * - UI credit estimates (preview)
 * - Brief creation (payload)
 * - Backend validation
 * - Generation billing
 *
 * The multipliers live in the `content_studio_generation` row of
 * ai_generation_pricing (see pricingService). Pass that rule in; when none is
 * given, DEFAULT_CONTENT_STUDIO_RULE reproduces the historical constants so
 * existing callers keep the same numbers.
 *
 * IMPORTANT: Backend should always recalculate credits server-side before generation.
 * Frontend values are for preview only.
 */

export interface CreditCalculationInput {
  /** Number of platforms being generated for */
  platformCount: number;
  /** Visual complexity level */
  complexityLevel: string;
  /** Creative mode (affects experimental multiplier) */
  creativeMode: string;
  /** AI freedom setting (0-100 or 0-1 scale) */
  aiFreedom: number;
  /** Selected visual assets array */
  visualAssets: string[];
  /** Number of variations per platform (default: 1) */
  variationCount?: number;
}

/** The parts of a pricing rule the ContentStudio calculation reads. */
export interface ContentStudioPricingRule {
  /** Flat credits added once per generation */
  baseCost: number;
  /** Credits per platform per variation */
  perPlatformCost: number;
  /** complexityLevel → multiplier */
  complexityMultipliers: Record<string, number>;
  /**
   * Feature multipliers and add-ons:
   *  ai_visuals          multiplier when 'ai_generated' is selected
   *  svg_per_platform    credits added per platform per variation for 'svg_graphics'
   *  experimental_mode   multiplier when creativeMode === 'experimental'
   *  ai_freedom_high     multiplier when aiFreedom is above the threshold
   *  ai_freedom_threshold threshold on the 0–100 scale (0–1 inputs are scaled)
   */
  featureMultipliers: Record<string, number>;
}

/** Historical constants. Same numbers the function used before rules moved to the database. */
export const DEFAULT_CONTENT_STUDIO_RULE: ContentStudioPricingRule = {
  baseCost: 0,
  perPlatformCost: 1,
  complexityMultipliers: { simple: 0.75, balanced: 1, advanced: 1.5, experimental: 2 },
  featureMultipliers: {
    ai_visuals: 1.5,
    svg_per_platform: 0.5,
    experimental_mode: 1.3,
    ai_freedom_high: 1.2,
    ai_freedom_threshold: 70,
  },
};

export interface CreditBreakdown {
  /** Base credits before multipliers (platforms × variations × per-platform cost, plus flat base) */
  platforms: number;
  /** Complexity multiplier applied */
  complexityMultiplier: number;
  /** AI visuals multiplier applied */
  aiVisualsMultiplier: number;
  /** Additional SVG generation cost */
  svgCost: number;
  /** Experimental mode multiplier applied */
  experimentalMultiplier: number;
  /** AI freedom multiplier applied */
  aiFreedomMultiplier: number;
  /** Raw calculated total before rounding */
  rawTotal: number;
  /** Final rounded total credits */
  total: number;
  /** The rule values used, so previews can show real multipliers */
  rule: ContentStudioPricingRule;
}

export interface CreditCalculationResult {
  /** Total credits (rounded) */
  estimatedCredits: number;
  /** Detailed breakdown of the calculation */
  breakdown: CreditBreakdown;
}

const num = (v: unknown, fallback: number): number =>
  typeof v === 'number' && isFinite(v) ? v : fallback;

/**
 * Calculate generation credits with consistent rounding
 * Uses Math.ceil() for final rounding to ensure we never undercharge
 */
export function calculateGenerationCredits(
  input: CreditCalculationInput,
  rule: ContentStudioPricingRule = DEFAULT_CONTENT_STUDIO_RULE
): CreditCalculationResult {
  const {
    platformCount,
    complexityLevel,
    creativeMode,
    aiFreedom,
    visualAssets,
    variationCount = 1,
  } = input;

  const perPlatform = num(rule.perPlatformCost, DEFAULT_CONTENT_STUDIO_RULE.perPlatformCost);
  const baseFlat = num(rule.baseCost, 0);
  const complexity = rule.complexityMultipliers ?? {};
  const features = rule.featureMultipliers ?? {};
  const defaults = DEFAULT_CONTENT_STUDIO_RULE.featureMultipliers;

  // Base credits: per platform per variation, plus any flat base
  const baseCredits = platformCount * variationCount * perPlatform + baseFlat;
  let totalCredits = baseCredits;

  // Complexity multiplier
  const complexityMultiplier = num(complexity[complexityLevel], 1);
  totalCredits *= complexityMultiplier;

  // AI visuals multiplier
  const aiVisualsMultiplier = visualAssets.includes('ai_generated')
    ? num(features.ai_visuals, defaults.ai_visuals)
    : 1;
  totalCredits *= aiVisualsMultiplier;

  // SVG generation cost
  const svgCost = visualAssets.includes('svg_graphics')
    ? platformCount * num(features.svg_per_platform, defaults.svg_per_platform) * variationCount
    : 0;
  totalCredits += svgCost;

  // Experimental mode multiplier
  const experimentalMultiplier = creativeMode === 'experimental'
    ? num(features.experimental_mode, defaults.experimental_mode)
    : 1;
  totalCredits *= experimentalMultiplier;

  // AI freedom multiplier (threshold is on the 0-100 scale; 0-1 inputs are scaled up)
  const threshold = num(features.ai_freedom_threshold, defaults.ai_freedom_threshold);
  const freedomPct = aiFreedom <= 1 ? aiFreedom * 100 : aiFreedom;
  const aiFreedomMultiplier = freedomPct > threshold
    ? num(features.ai_freedom_high, defaults.ai_freedom_high)
    : 1;
  totalCredits *= aiFreedomMultiplier;

  // Round up to ensure we never undercharge
  const rawTotal = totalCredits;
  const finalTotal = Math.ceil(rawTotal - 1e-9);

  const breakdown: CreditBreakdown = {
    platforms: baseCredits,
    complexityMultiplier,
    aiVisualsMultiplier,
    svgCost,
    experimentalMultiplier,
    aiFreedomMultiplier,
    rawTotal,
    total: finalTotal,
    rule,
  };

  return {
    estimatedCredits: finalTotal,
    breakdown,
  };
}

export default calculateGenerationCredits;
