/**
 * sceneTokens.ts
 *
 * Design token system for SceneDocuments.
 * Supports typography, spacing, color, radius, and shadow tokens.
 * Global token updates propagate coherently across the entire scene.
 */

import type { SceneDocument, SceneNode } from '@/types/scene';
import { resolveFontFamily, resolveFontWeight } from '@/lib/fonts/fontRegistry';
import { sanitizeColor } from './validateSceneDocument';

// ─── Token Types ──────────────────────────────────────────────

export interface DesignTokens {
  colors: ColorTokens;
  typography: TypographyTokens;
  spacing: SpacingTokens;
  radii: RadiusTokens;
}

export interface ColorTokens {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  foreground: string;
  muted: string;
  ctaFill: string;
  ctaText: string;
}

export interface TypographyTokens {
  headingFont: string;
  bodyFont: string;
  headingWeight: number;
  bodyWeight: number;
  baseSize: number;
  scaleRatio: number;
}

export interface SpacingTokens {
  unit: number;
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
}

export interface RadiusTokens {
  none: number;
  sm: number;
  md: number;
  lg: number;
  full: number;
}

// ─── Default Tokens ──────────────────────────────────────────

export function createDefaultTokens(): DesignTokens {
  return {
    colors: {
      primary: '#1a1a2e',
      secondary: '#667eea',
      accent: '#764ba2',
      background: '#ffffff',
      surface: '#f8f9fa',
      foreground: '#1a1a2e',
      muted: '#6c757d',
      ctaFill: '#667eea',
      ctaText: '#ffffff',
    },
    typography: {
      headingFont: 'DM Sans',
      bodyFont: 'Inter',
      headingWeight: 700,
      bodyWeight: 400,
      baseSize: 16,
      scaleRatio: 1.25,
    },
    spacing: {
      unit: 8,
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
      xl: 40,
    },
    radii: {
      none: 0,
      sm: 4,
      md: 8,
      lg: 16,
      full: 9999,
    },
  };
}

// ─── Token Application ───────────────────────────────────────

/**
 * Apply design tokens to an entire scene.
 * Updates colors, typography, and spacing coherently.
 */
export function applyTokens(scene: SceneDocument, tokens: DesignTokens): SceneDocument {
  // Update background
  const background = sanitizeColor(tokens.colors.background);

  // Walk and update all nodes
  const nodes = scene.nodes.map((n) => applyTokensToNode(n, tokens));

  return { ...scene, background, nodes };
}

function applyTokensToNode(node: SceneNode, tokens: DesignTokens): SceneNode {
  switch (node.type) {
    case 'text': {
      const isHeading = node.fontWeight >= 600 || node.fontSize > tokens.typography.baseSize * 1.5;
      const family = resolveFontFamily(isHeading ? tokens.typography.headingFont : tokens.typography.bodyFont);
      const weight = resolveFontWeight(family, isHeading ? tokens.typography.headingWeight : tokens.typography.bodyWeight);
      return { ...node, fontFamily: family, fontWeight: weight, color: sanitizeColor(tokens.colors.foreground) };
    }

    case 'button': {
      const family = resolveFontFamily(tokens.typography.bodyFont);
      const weight = resolveFontWeight(family, 600);
      return {
        ...node,
        fontFamily: family,
        fontWeight: weight,
        fill: sanitizeColor(tokens.colors.ctaFill),
        textColor: sanitizeColor(tokens.colors.ctaText),
        radius: tokens.radii.md,
      };
    }

    case 'shape':
      return { ...node, fill: sanitizeColor(tokens.colors.surface) };

    case 'frame':
      return {
        ...node,
        fill: sanitizeColor(tokens.colors.surface),
        children: node.children.map((c) => applyTokensToNode(c, tokens)),
      };

    case 'stack':
      return {
        ...node,
        gap: tokens.spacing.md,
        padding: tokens.spacing.lg,
        children: node.children.map((c) => applyTokensToNode(c, tokens)),
      };

    case 'group':
      return { ...node, children: node.children.map((c) => applyTokensToNode(c, tokens)) };

    case 'icon':
      return { ...node, color: sanitizeColor(tokens.colors.accent) };

    default:
      return node;
  }
}

// ─── Partial Token Updates ───────────────────────────────────

/**
 * Merge partial token overrides into a full token set.
 */
export function mergeTokens(base: DesignTokens, overrides: Partial<DesignTokens>): DesignTokens {
  return {
    colors: { ...base.colors, ...overrides.colors },
    typography: { ...base.typography, ...overrides.typography },
    spacing: { ...base.spacing, ...overrides.spacing },
    radii: { ...base.radii, ...overrides.radii },
  };
}

/**
 * Extract approximate tokens from an existing scene.
 */
export function extractTokensFromScene(scene: SceneDocument): DesignTokens {
  const tokens = createDefaultTokens();

  tokens.colors.background = scene.background || '#ffffff';

  // Find dominant text properties
  const textNodes: Array<{ fontSize: number; fontFamily: string; fontWeight: number; color: string }> = [];
  function walk(nodes: SceneNode[]) {
    for (const n of nodes) {
      if (n.type === 'text') textNodes.push(n);
      if ('children' in n && Array.isArray(n.children)) walk(n.children);
    }
  }
  walk(scene.nodes);

  if (textNodes.length > 0) {
    // Most common font family
    const familyCounts = new Map<string, number>();
    for (const tn of textNodes) {
      familyCounts.set(tn.fontFamily, (familyCounts.get(tn.fontFamily) || 0) + 1);
    }
    const [dominantFamily] = [...familyCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    tokens.typography.bodyFont = dominantFamily;

    // Heading font = font used on largest text
    const largest = textNodes.reduce((a, b) => a.fontSize > b.fontSize ? a : b);
    tokens.typography.headingFont = largest.fontFamily;
    tokens.typography.headingWeight = largest.fontWeight;

    // Base size = median
    const sorted = textNodes.map((t) => t.fontSize).sort((a, b) => a - b);
    tokens.typography.baseSize = sorted[Math.floor(sorted.length / 2)];

    // Foreground = most common text color
    const colorCounts = new Map<string, number>();
    for (const tn of textNodes) {
      colorCounts.set(tn.color, (colorCounts.get(tn.color) || 0) + 1);
    }
    const [dominantColor] = [...colorCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    tokens.colors.foreground = dominantColor;
  }

  return tokens;
}
