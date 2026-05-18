/**
 * aiCompositionRules.ts
 *
 * Converts platform constraints, brand context, and occupancy targets
 * into structured composition guidance for AI scene generation.
 *
 * The AI should NOT freely invent layouts. This engine shapes:
 *   - spacing rhythm
 *   - typography scale
 *   - content occupancy
 *   - CTA placement
 *   - composition zones
 */

import type { SceneMetadata } from '@/types/scene';
import { getSafeRegion, type SafeRegion } from './composition/safeZones';
import { generateTypographyScale, type TypographyTier } from './composition/typographyScale';

// ─── Input Types ──────────────────────────────────────────────

export interface BrandContext {
  primaryColor: string;
  secondaryColor: string;
  accentColor?: string;
  fontHeading: string;
  fontBody: string;
  logoUrl?: string;
  tonality?: 'professional' | 'friendly' | 'bold' | 'luxury' | 'playful';
}

export interface PlatformConstraints {
  slug: string;
  width: number;
  height: number;
  /** Maximum node count to keep performance safe. */
  maxNodes?: number;
}

export interface CompositionIntent {
  /** What is the creative for? */
  goal: 'awareness' | 'conversion' | 'engagement' | 'education' | 'announcement';
  /** Should there be a CTA? */
  hasCta: boolean;
  /** Has a hero image? */
  hasHeroImage: boolean;
  /** Desired visual density. */
  density?: SceneMetadata['visualDensity'];
  /** Desired composition style. */
  style?: SceneMetadata['compositionStyle'];
}

// ─── Output Types ─────────────────────────────────────────────

export interface CompositionRules {
  /** Canvas dimensions. */
  canvas: { width: number; height: number };
  /** Safe region (no important content outside this). */
  safeRegion: SafeRegion;
  /** Typography scale to use. */
  typography: TypographyTier[];
  /** Spacing rhythm (px). */
  spacing: SpacingRhythm;
  /** Occupancy targets. */
  occupancy: OccupancyTargets;
  /** Zone assignments. */
  zones: CompositionZone[];
  /** CTA placement rules. */
  cta: CtaRules | null;
  /** Brand colors mapped to semantic roles. */
  colors: ColorAssignment;
  /** Hard constraints the AI must respect. */
  constraints: string[];
}

export interface SpacingRhythm {
  /** Base spacing unit. */
  unit: number;
  /** Padding around canvas edges. */
  padding: number;
  /** Gap between major sections. */
  sectionGap: number;
  /** Gap between elements within a section. */
  elementGap: number;
}

export interface OccupancyTargets {
  /** Target occupancy fraction (0–1). */
  target: number;
  /** Minimum acceptable occupancy. */
  min: number;
  /** Maximum acceptable occupancy. */
  max: number;
}

export interface CompositionZone {
  role: 'hero' | 'headline' | 'body' | 'cta' | 'logo' | 'accent';
  x: number;
  y: number;
  width: number;
  height: number;
  priority: number;
}

export interface CtaRules {
  /** Preferred position. */
  position: 'bottom-center' | 'bottom-right' | 'center' | 'top-right';
  /** Minimum button dimensions. */
  minWidth: number;
  minHeight: number;
  /** Spacing from canvas edge. */
  margin: number;
}

export interface ColorAssignment {
  background: string;
  foreground: string;
  accent: string;
  ctaFill: string;
  ctaText: string;
}

// ─── Rules Generator ─────────────────────────────────────────

/**
 * Generate composition rules from platform, brand, and intent.
 * These rules are serializable — can be included in AI prompts.
 */
export function generateCompositionRules(
  platform: PlatformConstraints,
  brand: BrandContext,
  intent: CompositionIntent
): CompositionRules {
  const { width, height, slug } = platform;
  const safeRegion = getSafeRegion(width, height, slug);
  const typography = generateTypographyScale({ canvasWidth: width, canvasHeight: height });

  // Spacing rhythm based on canvas size
  const baseUnit = Math.round(Math.min(width, height) * 0.02);
  const spacing: SpacingRhythm = {
    unit: baseUnit,
    padding: baseUnit * 3,
    sectionGap: baseUnit * 4,
    elementGap: baseUnit * 2,
  };

  // Occupancy targets by density
  const occupancy = getOccupancyTargets(intent.density || 'balanced');

  // Zones
  const zones = generateZones(safeRegion, intent, spacing);

  // CTA rules
  const cta = intent.hasCta ? generateCtaRules(safeRegion, platform) : null;

  // Colors
  const colors = assignColors(brand, intent);

  // Constraints
  const constraints = buildConstraints(platform, intent);

  return {
    canvas: { width, height },
    safeRegion,
    typography,
    spacing,
    occupancy,
    zones,
    cta,
    colors,
    constraints,
  };
}

/**
 * Serialize composition rules to a string suitable for AI prompts.
 */
export function rulesToPromptBlock(rules: CompositionRules): string {
  const lines: string[] = [
    `CANVAS: ${rules.canvas.width}×${rules.canvas.height}px`,
    `SAFE REGION: x=${rules.safeRegion.x} y=${rules.safeRegion.y} w=${rules.safeRegion.width} h=${rules.safeRegion.height}`,
    '',
    'TYPOGRAPHY SCALE:',
    ...rules.typography.map(t => `  ${t.role}: ${t.fontSize}px / weight ${t.fontWeight} / lh ${t.lineHeight}`),
    '',
    `SPACING: unit=${rules.spacing.unit}px padding=${rules.spacing.padding}px sectionGap=${rules.spacing.sectionGap}px elementGap=${rules.spacing.elementGap}px`,
    '',
    `OCCUPANCY: target=${(rules.occupancy.target * 100).toFixed(0)}% min=${(rules.occupancy.min * 100).toFixed(0)}% max=${(rules.occupancy.max * 100).toFixed(0)}%`,
    '',
    'COMPOSITION ZONES:',
    ...rules.zones.map(z => `  ${z.role}: x=${z.x} y=${z.y} w=${z.width} h=${z.height} (priority ${z.priority})`),
    '',
    'COLORS:',
    `  background: ${rules.colors.background}`,
    `  foreground: ${rules.colors.foreground}`,
    `  accent: ${rules.colors.accent}`,
    `  ctaFill: ${rules.colors.ctaFill}`,
    `  ctaText: ${rules.colors.ctaText}`,
  ];

  if (rules.cta) {
    lines.push('', 'CTA RULES:', `  position: ${rules.cta.position}`, `  minSize: ${rules.cta.minWidth}×${rules.cta.minHeight}`);
  }

  if (rules.constraints.length > 0) {
    lines.push('', 'CONSTRAINTS:', ...rules.constraints.map(c => `  - ${c}`));
  }

  return lines.join('\n');
}

// ─── Internal Helpers ─────────────────────────────────────────

function getOccupancyTargets(density: NonNullable<SceneMetadata['visualDensity']>): OccupancyTargets {
  switch (density) {
    case 'sparse': return { target: 0.35, min: 0.2, max: 0.5 };
    case 'dense': return { target: 0.7, min: 0.55, max: 0.85 };
    case 'balanced':
    default: return { target: 0.55, min: 0.4, max: 0.7 };
  }
}

function generateZones(
  safe: SafeRegion,
  intent: CompositionIntent,
  spacing: SpacingRhythm
): CompositionZone[] {
  const zones: CompositionZone[] = [];
  const { x, y, width, height } = safe;

  if (intent.hasHeroImage) {
    const heroH = Math.round(height * 0.4);
    zones.push({ role: 'hero', x, y, width, height: heroH, priority: 1 });
    const headY = y + heroH + spacing.sectionGap;
    const headH = Math.round(height * 0.15);
    zones.push({ role: 'headline', x, y: headY, width, height: headH, priority: 2 });
    const bodyY = headY + headH + spacing.elementGap;
    const bodyH = Math.round(height * 0.2);
    zones.push({ role: 'body', x, y: bodyY, width, height: bodyH, priority: 3 });
  } else {
    const headH = Math.round(height * 0.25);
    zones.push({ role: 'headline', x, y, width, height: headH, priority: 1 });
    const bodyY = y + headH + spacing.sectionGap;
    const bodyH = Math.round(height * 0.35);
    zones.push({ role: 'body', x, y: bodyY, width, height: bodyH, priority: 2 });
  }

  if (intent.hasCta) {
    const ctaH = 56;
    zones.push({
      role: 'cta',
      x: x + Math.round(width * 0.15),
      y: y + height - ctaH - spacing.padding,
      width: Math.round(width * 0.7),
      height: ctaH,
      priority: 4,
    });
  }

  return zones;
}

function generateCtaRules(safe: SafeRegion, platform: PlatformConstraints): CtaRules {
  const isVertical = platform.height > platform.width;
  return {
    position: isVertical ? 'bottom-center' : 'bottom-right',
    minWidth: Math.round(safe.width * 0.3),
    minHeight: 44,
    margin: Math.round(Math.min(safe.width, safe.height) * 0.04),
  };
}

function assignColors(brand: BrandContext, intent: CompositionIntent): ColorAssignment {
  const isConversion = intent.goal === 'conversion';
  return {
    background: '#ffffff',
    foreground: '#1a1a2e',
    accent: brand.accentColor || brand.secondaryColor,
    ctaFill: isConversion ? brand.primaryColor : brand.accentColor || brand.primaryColor,
    ctaText: '#ffffff',
  };
}

function buildConstraints(platform: PlatformConstraints, intent: CompositionIntent): string[] {
  const c: string[] = [];
  c.push(`All important content must be inside the safe region`);
  c.push(`Maximum ${platform.maxNodes || 30} nodes`);
  c.push(`No text smaller than 10px`);
  c.push(`Maintain at least 2 hierarchy tiers`);
  if (intent.hasCta) c.push(`CTA must be clearly visible and tappable (min 44px tall)`);
  if (intent.hasHeroImage) c.push(`Hero image must fill its zone completely`);
  c.push(`All positions must be even pixel values`);
  c.push(`Use only whitelisted fonts`);
  return c;
}
