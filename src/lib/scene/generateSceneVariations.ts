/**
 * generateSceneVariations.ts
 *
 * Generate scene variations without regenerating from scratch.
 * Uses mutation chains to produce safe, aggressive, minimalist,
 * editorial, and conversion-focused variants.
 *
 * All transformations are immutable.
 */

import type { SceneDocument } from '@/types/scene';
import { applyMutationChain } from './mutations/mutateScene';
import type { MutationId, MutationParams, MutationChain } from './mutations/mutationTypes';

// ─── Types ────────────────────────────────────────────────────

export type VariationStyle = 'safe' | 'aggressive' | 'minimalist' | 'editorial' | 'conversion';

export interface SceneVariation {
  style: VariationStyle;
  scene: SceneDocument;
  chain: MutationChain;
  description: string;
}

export interface VariationOptions {
  /** Which styles to generate. Default: all. */
  styles?: VariationStyle[];
  /** Override CTA text for conversion variant. */
  ctaText?: string;
  /** Override headline for aggressive variant. */
  headlineText?: string;
  /** Primary color override. */
  primaryColor?: string;
  /** Accent color override. */
  accentColor?: string;
  /** Alt font family. */
  altFontFamily?: string;
}

// ─── Mutation Recipes ────────────────────────────────────────

const RECIPES: Record<VariationStyle, (opts: VariationOptions) => Array<{ id: MutationId; params: MutationParams }>> = {
  safe: () => [
    { id: 'adjust_spacing', params: { spacingMultiplier: 1.05 } },
    { id: 'boost_contrast', params: {} },
  ],

  aggressive: (opts) => {
    const steps: Array<{ id: MutationId; params: MutationParams }> = [
      { id: 'increase_density', params: {} },
      { id: 'boost_contrast', params: {} },
    ];
    if (opts.headlineText) {
      steps.push({ id: 'replace_headline', params: { text: opts.headlineText } });
    }
    if (opts.primaryColor) {
      steps.push({ id: 'change_color_direction', params: { primaryColor: opts.primaryColor, accentColor: opts.accentColor } });
    }
    return steps;
  },

  minimalist: () => [
    { id: 'simplify_composition', params: {} },
    { id: 'adjust_spacing', params: { spacingMultiplier: 1.2 } },
  ],

  editorial: (opts) => {
    const steps: Array<{ id: MutationId; params: MutationParams }> = [
      { id: 'adjust_spacing', params: { spacingMultiplier: 1.1 } },
    ];
    if (opts.altFontFamily) {
      steps.push({ id: 'swap_typography', params: { fontFamily: opts.altFontFamily } });
    }
    return steps;
  },

  conversion: (opts) => {
    const steps: Array<{ id: MutationId; params: MutationParams }> = [
      { id: 'boost_contrast', params: {} },
    ];
    if (opts.ctaText) {
      steps.push({ id: 'rewrite_cta', params: { text: opts.ctaText } });
    }
    if (opts.primaryColor) {
      steps.push({ id: 'change_color_direction', params: { primaryColor: opts.primaryColor, accentColor: opts.accentColor } });
    }
    return steps;
  },
};

// ─── Public API ───────────────────────────────────────────────

/**
 * Generate multiple scene variations using mutation chains.
 */
export function generateVariations(
  scene: SceneDocument,
  options: VariationOptions = {}
): SceneVariation[] {
  const styles = options.styles || (['safe', 'aggressive', 'minimalist', 'editorial', 'conversion'] as VariationStyle[]);

  return styles.map((style) => {
    const recipe = RECIPES[style](options);
    const chain = applyMutationChain(scene, recipe);

    return {
      style,
      scene: chain.finalScene,
      chain,
      description: describeVariation(style, chain),
    };
  });
}

/**
 * Generate a single variation.
 */
export function generateVariation(
  scene: SceneDocument,
  style: VariationStyle,
  options: VariationOptions = {}
): SceneVariation {
  const recipe = RECIPES[style](options);
  const chain = applyMutationChain(scene, recipe);

  return {
    style,
    scene: chain.finalScene,
    chain,
    description: describeVariation(style, chain),
  };
}

/**
 * Generate a custom variation from a list of mutations.
 */
export function generateCustomVariation(
  scene: SceneDocument,
  mutations: Array<{ id: MutationId; params: MutationParams }>,
  label = 'custom'
): SceneVariation {
  const chain = applyMutationChain(scene, mutations);

  return {
    style: 'safe', // categorize custom as safe
    scene: chain.finalScene,
    chain,
    description: `Custom variation "${label}": ${chain.steps.length} mutation(s) applied`,
  };
}

// ─── Helpers ──────────────────────────────────────────────────

function describeVariation(style: VariationStyle, chain: MutationChain): string {
  const count = chain.steps.length;
  const summaries = chain.steps.map((s) => s.summary).filter(Boolean);

  const styleLabel: Record<VariationStyle, string> = {
    safe: 'Safe variant — subtle improvements',
    aggressive: 'Aggressive variant — bold changes',
    minimalist: 'Minimalist variant — reduced complexity',
    editorial: 'Editorial variant — refined typography',
    conversion: 'Conversion variant — CTA-focused',
  };

  return `${styleLabel[style]}. ${count} mutation(s): ${summaries.join('; ') || 'no changes'}`;
}
