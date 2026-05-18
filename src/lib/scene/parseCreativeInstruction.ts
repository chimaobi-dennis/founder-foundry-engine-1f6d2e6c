/**
 * parseCreativeInstruction.ts
 *
 * Converts natural language user instructions into
 * structured edit intents the orchestrator can route.
 */

// ─── Intent Types ─────────────────────────────────────────────

export type EditIntentType =
  | 'headline_edit'
  | 'cta_edit'
  | 'tone_shift'
  | 'color_change'
  | 'typography_change'
  | 'spacing_change'
  | 'density_change'
  | 'hierarchy_change'
  | 'style_conversion'
  | 'layout_change'
  | 'platform_adapt'
  | 'simplify'
  | 'modernize'
  | 'regenerate_section'
  | 'regenerate_full'
  | 'refine'
  | 'repair'
  | 'unknown';

export interface EditIntent {
  type: EditIntentType;
  /** What the edit targets ('headline', 'cta', 'background', 'scene', etc.). */
  target: string;
  /** Style/tone qualifier. */
  style?: string;
  /** Color value if detected. */
  color?: string;
  /** Font family if detected. */
  fontFamily?: string;
  /** Direction qualifier (increase/decrease/shift). */
  direction?: 'increase' | 'decrease' | 'shift';
  /** Platform slug if detected. */
  platform?: string;
  /** Replacement text if detected. */
  text?: string;
  /** Confidence 0–1. */
  confidence: number;
  /** Original instruction. */
  raw: string;
}

// ─── Keyword Maps ─────────────────────────────────────────────

const TONE_KEYWORDS: Record<string, string> = {
  aggressive: 'aggressive', bold: 'bold', premium: 'premium', luxury: 'luxury',
  modern: 'modern', clean: 'clean', minimal: 'minimal', minimalist: 'minimal',
  playful: 'playful', professional: 'professional', friendly: 'friendly',
  urgent: 'urgent', calming: 'calming', elegant: 'elegant', edgy: 'edgy',
  corporate: 'corporate', startup: 'startup', cinematic: 'cinematic',
  editorial: 'editorial', restrained: 'restrained', dramatic: 'dramatic',
};

const PLATFORM_KEYWORDS: Record<string, string> = {
  story: 'instagram_story', stories: 'instagram_story',
  instagram: 'instagram_post', 'ig post': 'instagram_post',
  reels: 'instagram_reels', reel: 'instagram_reels',
  facebook: 'facebook_ad', 'fb ad': 'facebook_ad',
  linkedin: 'linkedin_post',
  twitter: 'twitter', 'x post': 'twitter',
  pinterest: 'pinterest', pin: 'pinterest',
  youtube: 'youtube_thumbnail', thumbnail: 'youtube_thumbnail',
  email: 'email_header',
  portrait: '__portrait', landscape: '__landscape', square: '__square',
};

const COLOR_HEX = /#[0-9a-fA-F]{3,8}/;
const COLOR_NAMES: Record<string, string> = {
  red: '#e53e3e', blue: '#3182ce', green: '#38a169', yellow: '#ecc94b',
  purple: '#805ad5', pink: '#ed64a6', orange: '#dd6b20', black: '#000000',
  white: '#ffffff', dark: '#1a202c', light: '#f7fafc', navy: '#1a365d',
  teal: '#319795', gold: '#d69e2e',
};

// ─── Public API ───────────────────────────────────────────────

/**
 * Parse a natural language creative instruction into a structured intent.
 */
export function parseCreativeInstruction(instruction: string): EditIntent {
  const raw = instruction;
  const lower = instruction.toLowerCase().trim();

  // ── Regeneration ──
  if (matches(lower, ['regenerate everything', 'start over', 'redo from scratch', 'generate new', 'completely redo'])) {
    return { type: 'regenerate_full', target: 'scene', confidence: 0.9, raw };
  }

  // ── Platform adaptation ──
  const platform = detectPlatform(lower);
  if (platform && matches(lower, ['adapt', 'convert', 'resize', 'reflow', 'format for', 'make it for'])) {
    return { type: 'platform_adapt', target: 'scene', platform, confidence: 0.85, raw };
  }

  // ── CTA edits ──
  if (matches(lower, ['cta', 'button', 'call to action', 'call-to-action'])) {
    const text = extractQuotedText(instruction);
    const tone = detectTone(lower);
    if (text) return { type: 'cta_edit', target: 'cta', text, confidence: 0.9, raw };
    if (tone) return { type: 'cta_edit', target: 'cta', style: tone, confidence: 0.8, raw };
    return { type: 'cta_edit', target: 'cta', confidence: 0.7, raw };
  }

  // ── Headline edits ──
  if (matches(lower, ['headline', 'title', 'heading', 'header text'])) {
    const text = extractQuotedText(instruction);
    const tone = detectTone(lower);
    if (text) return { type: 'headline_edit', target: 'headline', text, confidence: 0.9, raw };
    if (tone) return { type: 'headline_edit', target: 'headline', style: tone, confidence: 0.8, raw };
    return { type: 'headline_edit', target: 'headline', confidence: 0.7, raw };
  }

  // ── Section regeneration ──
  if (matches(lower, ['new hero', 'new header', 'different hero', 'replace hero'])) {
    return { type: 'regenerate_section', target: 'hero', confidence: 0.8, raw };
  }
  if (matches(lower, ['new cta section', 'different cta', 'replace cta'])) {
    return { type: 'regenerate_section', target: 'cta', confidence: 0.8, raw };
  }

  // ── Color changes ──
  const color = detectColor(lower);
  if (color && matches(lower, ['color', 'colour', 'background', 'theme', 'palette', 'tint', 'shade'])) {
    return { type: 'color_change', target: detectColorTarget(lower), color, confidence: 0.85, raw };
  }

  // ── Typography changes ──
  if (matches(lower, ['font', 'typeface', 'typography', 'type'])) {
    const font = extractQuotedText(instruction);
    return { type: 'typography_change', target: 'scene', fontFamily: font || undefined, confidence: 0.75, raw };
  }

  // ── Spacing ──
  if (matches(lower, ['spacing', 'space', 'breathe', 'breathing room', 'whitespace', 'tighter', 'looser', 'compact'])) {
    const dir = matches(lower, ['more', 'increase', 'add', 'looser', 'breathe']) ? 'increase' as const
      : matches(lower, ['less', 'decrease', 'reduce', 'tighter', 'compact']) ? 'decrease' as const
      : 'shift' as const;
    return { type: 'spacing_change', target: 'scene', direction: dir, confidence: 0.8, raw };
  }

  // ── Density ──
  if (matches(lower, ['density', 'denser', 'sparse', 'crowded', 'cluttered', 'empty', 'fuller'])) {
    const dir = matches(lower, ['more', 'denser', 'fuller', 'crowded']) ? 'increase' as const : 'decrease' as const;
    return { type: 'density_change', target: 'scene', direction: dir, confidence: 0.8, raw };
  }

  // ── Hierarchy ──
  if (matches(lower, ['hierarchy', 'emphasis', 'prominence', 'focal', 'focus'])) {
    return { type: 'hierarchy_change', target: 'scene', confidence: 0.7, raw };
  }

  // ── Simplify ──
  if (matches(lower, ['simplify', 'simpler', 'less clutter', 'declutter', 'clean up', 'reduce'])) {
    return { type: 'simplify', target: 'scene', confidence: 0.85, raw };
  }

  // ── Modernize ──
  if (matches(lower, ['modernize', 'modern', 'contemporary', 'fresh', 'update the look', 'freshen'])) {
    return { type: 'modernize', target: 'scene', confidence: 0.8, raw };
  }

  // ── Style conversion ──
  const tone = detectTone(lower);
  if (tone && matches(lower, ['make it', 'more', 'feel', 'look', 'style', 'vibe'])) {
    return { type: 'style_conversion' as EditIntentType, target: 'scene', style: tone, confidence: 0.75, raw };
  }

  // ── Tone shift (fallback for tone detection) ──
  if (tone) {
    return { type: 'tone_shift', target: 'scene', style: tone, confidence: 0.6, raw };
  }

  // ── Refine ──
  if (matches(lower, ['refine', 'improve', 'polish', 'enhance', 'better', 'fix'])) {
    return { type: 'refine', target: 'scene', confidence: 0.7, raw };
  }

  // ── Repair ──
  if (matches(lower, ['repair', 'fix overlap', 'fix spacing', 'fix layout', 'broken'])) {
    return { type: 'repair', target: 'scene', confidence: 0.8, raw };
  }

  // ── Unknown ──
  return { type: 'unknown', target: 'scene', confidence: 0.3, raw };
}

// ─── Helpers ──────────────────────────────────────────────────

function matches(text: string, keywords: string[]): boolean {
  return keywords.some((k) => text.includes(k));
}

function detectTone(text: string): string | undefined {
  for (const [keyword, tone] of Object.entries(TONE_KEYWORDS)) {
    if (text.includes(keyword)) return tone;
  }
  return undefined;
}

function detectPlatform(text: string): string | undefined {
  for (const [keyword, slug] of Object.entries(PLATFORM_KEYWORDS)) {
    if (text.includes(keyword)) return slug;
  }
  return undefined;
}

function detectColor(text: string): string | undefined {
  const hexMatch = text.match(COLOR_HEX);
  if (hexMatch) return hexMatch[0];
  for (const [name, hex] of Object.entries(COLOR_NAMES)) {
    if (text.includes(name)) return hex;
  }
  return undefined;
}

function detectColorTarget(text: string): string {
  if (text.includes('background') || text.includes('bg')) return 'background';
  if (text.includes('text') || text.includes('font')) return 'text';
  if (text.includes('cta') || text.includes('button')) return 'cta';
  if (text.includes('accent')) return 'accent';
  return 'scene';
}

function extractQuotedText(text: string): string | null {
  const match = text.match(/["'`]([^"'`]+)["'`]/);
  return match ? match[1] : null;
}
