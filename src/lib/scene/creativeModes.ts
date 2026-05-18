/**
 * creativeModes.ts
 *
 * Creative modes that influence the strategist, mutations,
 * composition rules, typography, density, and CTA behavior.
 */

import type { SceneMetadata } from '@/types/scene';
import type { DesignTokens, ColorTokens, TypographyTokens } from './sceneTokens';

// ─── Mode Identifiers ────────────────────────────────────────

export type CreativeMode =
  | 'on_brand'
  | 'experimental'
  | 'conversion'
  | 'editorial'
  | 'premium'
  | 'cinematic'
  | 'social_native'
  | 'startup_launch'
  | 'minimal'
  | 'bold';

// ─── Mode Configuration ─────────────────────────────────────

export interface ModeConfig {
  id: CreativeMode;
  name: string;
  description: string;
  compositionStyle: NonNullable<SceneMetadata['compositionStyle']>;
  visualDensity: NonNullable<SceneMetadata['visualDensity']>;
  typographyDominance: 'low' | 'medium' | 'high';
  includeCta: boolean;
  useHeroImage: boolean;
  colorOverrides: Partial<ColorTokens>;
  typographyOverrides: Partial<TypographyTokens>;
  spacingMultiplier: number;
  maxNodes: number;
  radiusStyle: 'sharp' | 'soft' | 'round';
}

// ─── Mode Registry ───────────────────────────────────────────

const MODES: Record<CreativeMode, ModeConfig> = {
  on_brand: {
    id: 'on_brand',
    name: 'On Brand',
    description: 'Follow brand guidelines strictly. Consistent, professional, safe.',
    compositionStyle: 'editorial',
    visualDensity: 'balanced',
    typographyDominance: 'medium',
    includeCta: true,
    useHeroImage: true,
    colorOverrides: {},
    typographyOverrides: {},
    spacingMultiplier: 1.0,
    maxNodes: 25,
    radiusStyle: 'soft',
  },
  experimental: {
    id: 'experimental',
    name: 'Experimental',
    description: 'Push boundaries. Unconventional layouts, bold choices, surprise.',
    compositionStyle: 'cinematic',
    visualDensity: 'dense',
    typographyDominance: 'high',
    includeCta: false,
    useHeroImage: true,
    colorOverrides: {},
    typographyOverrides: { scaleRatio: 1.5 },
    spacingMultiplier: 0.85,
    maxNodes: 30,
    radiusStyle: 'sharp',
  },
  conversion: {
    id: 'conversion',
    name: 'Conversion',
    description: 'Optimize for action. Clear CTA, strong hierarchy, trust signals.',
    compositionStyle: 'editorial',
    visualDensity: 'balanced',
    typographyDominance: 'medium',
    includeCta: true,
    useHeroImage: true,
    colorOverrides: {},
    typographyOverrides: { headingWeight: 700 },
    spacingMultiplier: 1.0,
    maxNodes: 20,
    radiusStyle: 'soft',
  },
  editorial: {
    id: 'editorial',
    name: 'Editorial',
    description: 'Magazine-quality layout. Strong typography, elegant spacing.',
    compositionStyle: 'editorial',
    visualDensity: 'balanced',
    typographyDominance: 'high',
    includeCta: false,
    useHeroImage: true,
    colorOverrides: { foreground: '#1a1a2e' },
    typographyOverrides: { headingFont: 'Playfair Display', scaleRatio: 1.333 },
    spacingMultiplier: 1.15,
    maxNodes: 20,
    radiusStyle: 'sharp',
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    description: 'Luxury feeling. Generous whitespace, refined typography, subtle palette.',
    compositionStyle: 'minimal',
    visualDensity: 'sparse',
    typographyDominance: 'high',
    includeCta: true,
    useHeroImage: false,
    colorOverrides: { background: '#0a0a0a', foreground: '#f5f5f0', ctaFill: '#c4a35a', ctaText: '#0a0a0a' },
    typographyOverrides: { headingFont: 'Playfair Display', bodyFont: 'Inter', headingWeight: 400 },
    spacingMultiplier: 1.3,
    maxNodes: 15,
    radiusStyle: 'sharp',
  },
  cinematic: {
    id: 'cinematic',
    name: 'Cinematic',
    description: 'Film-poster energy. Full-bleed imagery, dramatic overlay, bold type.',
    compositionStyle: 'cinematic',
    visualDensity: 'sparse',
    typographyDominance: 'high',
    includeCta: false,
    useHeroImage: true,
    colorOverrides: { background: '#000000', foreground: '#ffffff' },
    typographyOverrides: { headingFont: 'DM Sans', headingWeight: 700, scaleRatio: 1.5 },
    spacingMultiplier: 1.2,
    maxNodes: 12,
    radiusStyle: 'sharp',
  },
  social_native: {
    id: 'social_native',
    name: 'Social Native',
    description: 'Platform-native feeling. Casual, punchy, scroll-stopping.',
    compositionStyle: 'bold',
    visualDensity: 'balanced',
    typographyDominance: 'medium',
    includeCta: true,
    useHeroImage: true,
    colorOverrides: {},
    typographyOverrides: { headingFont: 'Poppins', bodyFont: 'Inter' },
    spacingMultiplier: 0.95,
    maxNodes: 20,
    radiusStyle: 'round',
  },
  startup_launch: {
    id: 'startup_launch',
    name: 'Startup Launch',
    description: 'High-energy launch. Bold claims, strong CTA, modern feel.',
    compositionStyle: 'bold',
    visualDensity: 'balanced',
    typographyDominance: 'high',
    includeCta: true,
    useHeroImage: false,
    colorOverrides: {},
    typographyOverrides: { headingFont: 'Space Grotesk', headingWeight: 700 },
    spacingMultiplier: 1.05,
    maxNodes: 20,
    radiusStyle: 'soft',
  },
  minimal: {
    id: 'minimal',
    name: 'Minimal',
    description: 'Maximum restraint. Essential elements only, vast whitespace.',
    compositionStyle: 'minimal',
    visualDensity: 'sparse',
    typographyDominance: 'medium',
    includeCta: false,
    useHeroImage: false,
    colorOverrides: { background: '#ffffff', foreground: '#333333' },
    typographyOverrides: { headingFont: 'Inter', headingWeight: 500 },
    spacingMultiplier: 1.4,
    maxNodes: 10,
    radiusStyle: 'sharp',
  },
  bold: {
    id: 'bold',
    name: 'Bold',
    description: 'Maximum impact. Large type, saturated colors, dense layout.',
    compositionStyle: 'bold',
    visualDensity: 'dense',
    typographyDominance: 'high',
    includeCta: true,
    useHeroImage: true,
    colorOverrides: {},
    typographyOverrides: { headingWeight: 900, scaleRatio: 1.5 },
    spacingMultiplier: 0.85,
    maxNodes: 25,
    radiusStyle: 'round',
  },
};

// ─── Public API ───────────────────────────────────────────────

/** Get a mode configuration. */
export function getMode(mode: CreativeMode): ModeConfig {
  return MODES[mode];
}

/** Get all available modes. */
export function getAllModes(): ModeConfig[] {
  return Object.values(MODES);
}

/** Apply mode overrides to design tokens. */
export function applyModeToTokens(tokens: DesignTokens, mode: CreativeMode): DesignTokens {
  const cfg = MODES[mode];
  const radius = cfg.radiusStyle === 'sharp' ? 0 : cfg.radiusStyle === 'round' ? 16 : 8;

  return {
    colors: { ...tokens.colors, ...cfg.colorOverrides },
    typography: { ...tokens.typography, ...cfg.typographyOverrides },
    spacing: {
      ...tokens.spacing,
      xs: Math.round(tokens.spacing.xs * cfg.spacingMultiplier),
      sm: Math.round(tokens.spacing.sm * cfg.spacingMultiplier),
      md: Math.round(tokens.spacing.md * cfg.spacingMultiplier),
      lg: Math.round(tokens.spacing.lg * cfg.spacingMultiplier),
      xl: Math.round(tokens.spacing.xl * cfg.spacingMultiplier),
    },
    radii: { ...tokens.radii, sm: Math.round(radius * 0.5), md: radius, lg: Math.round(radius * 2) },
  };
}

/** Get a mode config suitable for prompt injection. */
export function modeToPromptBlock(mode: CreativeMode): string {
  const cfg = MODES[mode];
  return [
    `CREATIVE MODE: ${cfg.name}`,
    `  ${cfg.description}`,
    `  Composition: ${cfg.compositionStyle}`,
    `  Density: ${cfg.visualDensity}`,
    `  Typography Dominance: ${cfg.typographyDominance}`,
    `  CTA: ${cfg.includeCta ? 'required' : 'optional'}`,
    `  Hero Image: ${cfg.useHeroImage ? 'recommended' : 'optional'}`,
    `  Max Nodes: ${cfg.maxNodes}`,
    `  Radius Style: ${cfg.radiusStyle}`,
  ].join('\n');
}
