/**
 * ContentStudio Credit Calculation - Single Source of Truth
 * 
 * This utility calculates generation credits consistently across:
 * - UI credit estimates (preview)
 * - Brief creation (payload)
 * - Backend validation
 * - Generation billing
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

export interface CreditBreakdown {
  /** Base credits before multipliers */
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
}

export interface CreditCalculationResult {
  /** Total credits (rounded) */
  estimatedCredits: number;
  /** Detailed breakdown of the calculation */
  breakdown: CreditBreakdown;
}

/**
 * Calculate generation credits with consistent rounding
 * Uses Math.ceil() for final rounding to ensure we never undercharge
 */
export function calculateGenerationCredits(
  input: CreditCalculationInput
): CreditCalculationResult {
  const {
    platformCount,
    complexityLevel,
    creativeMode,
    aiFreedom,
    visualAssets,
    variationCount = 1,
  } = input;

  // Base credits: 1 per platform per variation
  let baseCredits = platformCount * variationCount;
  let totalCredits = baseCredits;

  // Complexity multiplier
  const complexityMultipliers: Record<string, number> = {
    simple: 0.75,
    balanced: 1,
    advanced: 1.5,
    experimental: 2,
  };
  const complexityMultiplier = complexityMultipliers[complexityLevel] || 1;
  totalCredits *= complexityMultiplier;

  // AI visuals multiplier
  const aiVisualsMultiplier = visualAssets.includes('ai_generated') ? 1.5 : 1;
  totalCredits *= aiVisualsMultiplier;

  // SVG generation cost
  const svgCost = visualAssets.includes('svg_graphics')
    ? platformCount * 0.5 * variationCount
    : 0;
  totalCredits += svgCost;

  // Experimental mode multiplier
  const experimentalMultiplier = creativeMode === 'experimental' ? 1.3 : 1;
  totalCredits *= experimentalMultiplier;

  // AI freedom multiplier (above 70% on 0-100 scale, or 0.7 on 0-1 scale)
  const aiFreedomMultiplier = aiFreedom > 70 || aiFreedom > 0.7 ? 1.2 : 1;
  totalCredits *= aiFreedomMultiplier;

  // Round up to ensure we never undercharge
  const rawTotal = totalCredits;
  const finalTotal = Math.ceil(rawTotal);

  const breakdown: CreditBreakdown = {
    platforms: baseCredits,
    complexityMultiplier,
    aiVisualsMultiplier,
    svgCost,
    experimentalMultiplier,
    aiFreedomMultiplier,
    rawTotal,
    total: finalTotal,
  };

  return {
    estimatedCredits: finalTotal,
    breakdown,
  };
}

export default calculateGenerationCredits;
