/**
 * creativeStrategist.ts
 *
 * The brain before generation.
 * Decides composition style, visual pacing, typography dominance,
 * and narrative structure based on campaign context.
 */

import type { SceneMetadata } from '@/types/scene';
import type { BrandTendencies } from './sceneBrandMemory';

// ─── Input Types ──────────────────────────────────────────────

export interface StrategyInput {
  /** What the campaign is trying to achieve. */
  campaignIntent: 'awareness' | 'conversion' | 'engagement' | 'education' | 'announcement' | 'retention';
  /** Target platform slug. */
  platform: string;
  /** Emotional tone. */
  emotionalTone: 'professional' | 'friendly' | 'bold' | 'luxury' | 'playful' | 'urgent' | 'calming';
  /** Brand development stage. */
  brandStage?: 'early' | 'growing' | 'established' | 'enterprise';
  /** Audience psychology signal. */
  audienceType?: 'technical' | 'creative' | 'executive' | 'consumer' | 'general';
  /** Previous brand memory tendencies. */
  brandTendencies?: BrandTendencies;
  /** Content type hint. */
  contentType?: 'product' | 'service' | 'event' | 'thought_leadership' | 'social_proof' | 'offer';
}

// ─── Output Types ─────────────────────────────────────────────

export interface CreativeStrategy {
  /** Recommended composition style. */
  compositionStyle: NonNullable<SceneMetadata['compositionStyle']>;
  /** Recommended visual density. */
  visualDensity: NonNullable<SceneMetadata['visualDensity']>;
  /** Typography dominance level (how much space type should occupy). */
  typographyDominance: 'low' | 'medium' | 'high';
  /** Whether to use hero imagery. */
  useHeroImage: boolean;
  /** Whether to include a CTA. */
  includeCta: boolean;
  /** Narrative structure. */
  narrativeStructure: 'headline-only' | 'headline-body' | 'headline-body-cta' | 'story-arc' | 'data-driven';
  /** Visual pacing — how elements are distributed vertically. */
  visualPacing: 'compressed' | 'rhythmic' | 'expansive';
  /** Color strategy. */
  colorStrategy: 'monochrome' | 'complementary' | 'accent-pop' | 'gradient';
  /** Confidence in the strategy (0–1). */
  confidence: number;
  /** Human-readable reasoning. */
  reasoning: string[];
}

// ─── Strategy Generator ──────────────────────────────────────

/**
 * Generate a creative strategy from campaign context.
 */
export function generateStrategy(input: StrategyInput): CreativeStrategy {
  const reasoning: string[] = [];
  let confidence = 0.7;

  // ── Composition Style ──
  const compositionStyle = decideCompositionStyle(input, reasoning);

  // ── Visual Density ──
  const visualDensity = decideVisualDensity(input, reasoning);

  // ── Typography Dominance ──
  const typographyDominance = decideTypographyDominance(input, reasoning);

  // ── Hero Image ──
  const useHeroImage = decideHeroImage(input, reasoning);

  // ── CTA ──
  const includeCta = decideCta(input, reasoning);

  // ── Narrative Structure ──
  const narrativeStructure = decideNarrative(input, reasoning);

  // ── Visual Pacing ──
  const visualPacing = decideVisualPacing(input, reasoning);

  // ── Color Strategy ──
  const colorStrategy = decideColorStrategy(input, reasoning);

  // Adjust confidence based on brand memory
  if (input.brandTendencies && input.brandTendencies.totalScenes > 5) {
    confidence += 0.1;
    reasoning.push('Confidence boosted by brand memory (5+ prior scenes)');
  }

  return {
    compositionStyle,
    visualDensity,
    typographyDominance,
    useHeroImage,
    includeCta,
    narrativeStructure,
    visualPacing,
    colorStrategy,
    confidence: Math.min(1, confidence),
    reasoning,
  };
}

/**
 * Serialize a strategy to a prompt block for AI generation.
 */
export function strategyToPromptBlock(strategy: CreativeStrategy): string {
  return [
    `CREATIVE STRATEGY:`,
    `  Composition: ${strategy.compositionStyle}`,
    `  Density: ${strategy.visualDensity}`,
    `  Typography Dominance: ${strategy.typographyDominance}`,
    `  Hero Image: ${strategy.useHeroImage ? 'yes' : 'no'}`,
    `  CTA: ${strategy.includeCta ? 'yes' : 'no'}`,
    `  Narrative: ${strategy.narrativeStructure}`,
    `  Visual Pacing: ${strategy.visualPacing}`,
    `  Color Strategy: ${strategy.colorStrategy}`,
    `  Confidence: ${(strategy.confidence * 100).toFixed(0)}%`,
    '',
    'REASONING:',
    ...strategy.reasoning.map((r) => `  - ${r}`),
  ].join('\n');
}

// ─── Decision Functions ──────────────────────────────────────

function decideCompositionStyle(
  input: StrategyInput,
  reasoning: string[]
): NonNullable<SceneMetadata['compositionStyle']> {
  // Avoid overused styles from brand memory
  const overused = input.brandTendencies?.preferredStyles?.[0];
  const avoid = overused && overused.count > 3 ? overused.style : null;

  if (input.emotionalTone === 'luxury') {
    reasoning.push('Luxury tone → cinematic composition');
    return avoid === 'cinematic' ? 'minimal' : 'cinematic';
  }
  if (input.emotionalTone === 'bold' || input.emotionalTone === 'urgent') {
    reasoning.push('Bold/urgent tone → bold composition');
    return avoid === 'bold' ? 'editorial' : 'bold';
  }
  if (input.campaignIntent === 'education') {
    reasoning.push('Education intent → modular composition');
    return avoid === 'modular' ? 'editorial' : 'modular';
  }
  if (input.platform === 'linkedin_post') {
    reasoning.push('LinkedIn → editorial composition');
    return avoid === 'editorial' ? 'modular' : 'editorial';
  }
  if (input.platform === 'instagram_story') {
    reasoning.push('Instagram Story → cinematic composition');
    return avoid === 'cinematic' ? 'bold' : 'cinematic';
  }
  if (input.emotionalTone === 'calming' || input.emotionalTone === 'professional') {
    reasoning.push('Professional/calming tone → minimal composition');
    return avoid === 'minimal' ? 'editorial' : 'minimal';
  }

  reasoning.push('Default → editorial composition');
  return 'editorial';
}

function decideVisualDensity(
  input: StrategyInput,
  reasoning: string[]
): NonNullable<SceneMetadata['visualDensity']> {
  if (input.contentType === 'offer' || input.campaignIntent === 'conversion') {
    reasoning.push('Conversion/offer → balanced density');
    return 'balanced';
  }
  if (input.emotionalTone === 'luxury' || input.emotionalTone === 'calming') {
    reasoning.push('Luxury/calming → sparse density');
    return 'sparse';
  }
  if (input.contentType === 'social_proof' || input.contentType === 'event') {
    reasoning.push('Social proof/event → dense density');
    return 'dense';
  }
  reasoning.push('Default → balanced density');
  return 'balanced';
}

function decideTypographyDominance(
  input: StrategyInput,
  reasoning: string[]
): 'low' | 'medium' | 'high' {
  if (input.platform === 'twitter' || input.platform === 'youtube_thumbnail') {
    reasoning.push('Short-form platform → high typography dominance');
    return 'high';
  }
  if (input.contentType === 'product') {
    reasoning.push('Product content → low typography (image-led)');
    return 'low';
  }
  if (input.contentType === 'thought_leadership') {
    reasoning.push('Thought leadership → high typography');
    return 'high';
  }
  reasoning.push('Default → medium typography dominance');
  return 'medium';
}

function decideHeroImage(input: StrategyInput, reasoning: string[]): boolean {
  if (input.contentType === 'product') {
    reasoning.push('Product content → hero image');
    return true;
  }
  if (input.platform === 'instagram_post' || input.platform === 'pinterest') {
    reasoning.push('Visual platform → hero image');
    return true;
  }
  if (input.contentType === 'thought_leadership') {
    reasoning.push('Thought leadership → no hero image');
    return false;
  }
  reasoning.push('Default → hero image recommended');
  return true;
}

function decideCta(input: StrategyInput, reasoning: string[]): boolean {
  if (input.campaignIntent === 'conversion' || input.campaignIntent === 'retention') {
    reasoning.push('Conversion/retention → CTA required');
    return true;
  }
  if (input.campaignIntent === 'awareness') {
    reasoning.push('Awareness → CTA optional (skipped)');
    return false;
  }
  reasoning.push('Default → include CTA');
  return true;
}

function decideNarrative(
  input: StrategyInput,
  reasoning: string[]
): CreativeStrategy['narrativeStructure'] {
  if (input.campaignIntent === 'conversion') {
    reasoning.push('Conversion → headline-body-cta narrative');
    return 'headline-body-cta';
  }
  if (input.contentType === 'social_proof') {
    reasoning.push('Social proof → data-driven narrative');
    return 'data-driven';
  }
  if (input.platform === 'instagram_story') {
    reasoning.push('Story format → story-arc narrative');
    return 'story-arc';
  }
  if (input.platform === 'twitter' || input.platform === 'youtube_thumbnail') {
    reasoning.push('Short-form → headline-only narrative');
    return 'headline-only';
  }
  reasoning.push('Default → headline-body narrative');
  return 'headline-body';
}

function decideVisualPacing(
  input: StrategyInput,
  reasoning: string[]
): CreativeStrategy['visualPacing'] {
  if (input.emotionalTone === 'luxury' || input.emotionalTone === 'calming') {
    reasoning.push('Luxury/calming → expansive pacing');
    return 'expansive';
  }
  if (input.emotionalTone === 'urgent') {
    reasoning.push('Urgent → compressed pacing');
    return 'compressed';
  }
  reasoning.push('Default → rhythmic pacing');
  return 'rhythmic';
}

function decideColorStrategy(
  input: StrategyInput,
  reasoning: string[]
): CreativeStrategy['colorStrategy'] {
  if (input.emotionalTone === 'luxury') {
    reasoning.push('Luxury → gradient color strategy');
    return 'gradient';
  }
  if (input.emotionalTone === 'bold' || input.emotionalTone === 'urgent') {
    reasoning.push('Bold/urgent → accent-pop color strategy');
    return 'accent-pop';
  }
  if (input.emotionalTone === 'professional') {
    reasoning.push('Professional → monochrome color strategy');
    return 'monochrome';
  }
  reasoning.push('Default → complementary color strategy');
  return 'complementary';
}
