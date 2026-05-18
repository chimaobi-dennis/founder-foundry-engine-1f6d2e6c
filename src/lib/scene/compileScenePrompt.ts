/**
 * compileScenePrompt.ts
 *
 * Transforms structured inputs into high-quality AI generation prompts.
 * Reduces hallucinations and improves structural consistency.
 */

import type { BrandContext, CompositionRules } from './aiCompositionRules';
import { rulesToPromptBlock, generateCompositionRules, type CompositionIntent, type PlatformConstraints } from './aiCompositionRules';
import { getBlueprintOrDefault, blueprintToPromptBlock } from './platformBlueprints';
import { generateStrategy, strategyToPromptBlock, type StrategyInput, type CreativeStrategy } from './creativeStrategist';
import type { BrandTendencies } from './sceneBrandMemory';
import { ALLOWED_FONTS } from '@/lib/fonts/fontRegistry';

// ─── Input Types ──────────────────────────────────────────────

export interface PromptCompilerInput {
  /** Platform slug (e.g. 'instagram_post'). */
  platform: string;
  /** Brand context. */
  brand: BrandContext;
  /** Campaign intent. */
  campaignIntent: CompositionIntent['goal'];
  /** Emotional tone. */
  emotionalTone: StrategyInput['emotionalTone'];
  /** Content to include (headline, body, CTA text). */
  content: {
    headline?: string;
    body?: string;
    ctaText?: string;
  };
  /** Image URL to include. */
  imageSrc?: string;
  /** Audience type. */
  audienceType?: StrategyInput['audienceType'];
  /** Brand stage. */
  brandStage?: StrategyInput['brandStage'];
  /** Content type. */
  contentType?: StrategyInput['contentType'];
  /** Previous brand memory. */
  brandTendencies?: BrandTendencies;
  /** Additional instructions. */
  additionalInstructions?: string;
}

export interface CompiledPrompt {
  /** The full system prompt. */
  systemPrompt: string;
  /** The user prompt. */
  userPrompt: string;
  /** The creative strategy used. */
  strategy: CreativeStrategy;
  /** The composition rules used. */
  rules: CompositionRules;
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Compile a full scene generation prompt from structured inputs.
 */
export function compileScenePrompt(input: PromptCompilerInput): CompiledPrompt {
  const blueprint = getBlueprintOrDefault(input.platform);

  // Generate strategy
  const strategy = generateStrategy({
    campaignIntent: input.campaignIntent,
    platform: input.platform,
    emotionalTone: input.emotionalTone,
    brandStage: input.brandStage,
    audienceType: input.audienceType,
    brandTendencies: input.brandTendencies,
    contentType: input.contentType,
  });

  // Generate composition rules
  const platformConstraints: PlatformConstraints = {
    slug: input.platform,
    width: blueprint.width,
    height: blueprint.height,
    maxNodes: blueprint.maxNodes,
  };

  const intent: CompositionIntent = {
    goal: input.campaignIntent,
    hasCta: strategy.includeCta,
    hasHeroImage: strategy.useHeroImage,
    density: strategy.visualDensity,
    style: strategy.compositionStyle,
  };

  const rules = generateCompositionRules(platformConstraints, input.brand, intent);

  // Build system prompt
  const systemPrompt = buildSystemPrompt(blueprint.name);

  // Build user prompt
  const userPrompt = buildUserPrompt(input, strategy, rules, blueprint.name);

  return { systemPrompt, userPrompt, strategy, rules };
}

// ─── Prompt Builders ─────────────────────────────────────────

function buildSystemPrompt(platformName: string): string {
  return `You are a professional creative director generating Scene JSON for ${platformName}.

OUTPUT FORMAT:
You MUST return a valid JSON object with this exact structure:
{
  "render_engine": "scene",
  "scene_version": "v1",
  "scene_json": {
    "version": "v1",
    "width": <number>,
    "height": <number>,
    "background": "<color or gradient>",
    "nodes": [ ... ]
  }
}

NODE TYPES:
- text: { type: "text", id, x, y, width, height, rotation, opacity, zIndex, text, fontSize, fontFamily, fontWeight, lineHeight, letterSpacing, color, align }
- image: { type: "image", id, x, y, width, height, rotation, opacity, zIndex, src, objectFit, borderRadius }
- shape: { type: "shape", id, x, y, width, height, rotation, opacity, zIndex, fill, stroke, strokeWidth, radius }
- button: { type: "button", id, x, y, width, height, rotation, opacity, zIndex, label, fontSize, fontFamily, fontWeight, textColor, fill, stroke, strokeWidth, radius }
- frame: { type: "frame", id, x, y, width, height, rotation, opacity, zIndex, children, fill, stroke, strokeWidth, radius, clipContent }
- group: { type: "group", id, x, y, width, height, rotation, opacity, zIndex, children }

ALLOWED FONTS: ${ALLOWED_FONTS.join(', ')}

RULES:
- All positions must be pixel values (integers)
- All IDs must be unique strings
- All colors must be hex (#RRGGBB) or CSS gradients
- zIndex determines render order (higher = on top)
- Do NOT include any text outside the JSON
- Do NOT use fonts not in the allowed list
- Ensure all content is inside the safe region`;
}

function buildUserPrompt(
  input: PromptCompilerInput,
  strategy: CreativeStrategy,
  rules: CompositionRules,
  platformName: string
): string {
  const sections: string[] = [];

  // Platform blueprint
  const bp = getBlueprintOrDefault(input.platform);
  sections.push(blueprintToPromptBlock(bp));

  // Strategy
  sections.push('');
  sections.push(strategyToPromptBlock(strategy));

  // Composition rules
  sections.push('');
  sections.push(rulesToPromptBlock(rules));

  // Content
  sections.push('');
  sections.push('CONTENT:');
  if (input.content.headline) sections.push(`  Headline: "${input.content.headline}"`);
  if (input.content.body) sections.push(`  Body: "${input.content.body}"`);
  if (input.content.ctaText) sections.push(`  CTA: "${input.content.ctaText}"`);
  if (input.imageSrc) sections.push(`  Image URL: ${input.imageSrc}`);

  // Brand
  sections.push('');
  sections.push('BRAND:');
  sections.push(`  Primary Color: ${input.brand.primaryColor}`);
  sections.push(`  Secondary Color: ${input.brand.secondaryColor}`);
  if (input.brand.accentColor) sections.push(`  Accent Color: ${input.brand.accentColor}`);
  sections.push(`  Heading Font: ${input.brand.fontHeading}`);
  sections.push(`  Body Font: ${input.brand.fontBody}`);
  if (input.brand.tonality) sections.push(`  Tonality: ${input.brand.tonality}`);

  // Additional instructions
  if (input.additionalInstructions) {
    sections.push('');
    sections.push('ADDITIONAL INSTRUCTIONS:');
    sections.push(input.additionalInstructions);
  }

  // Final instruction
  sections.push('');
  sections.push(`Generate a ${platformName} creative (${bp.width}×${bp.height}) as Scene JSON.`);
  sections.push('Return ONLY the JSON object, no other text.');

  return sections.join('\n');
}
