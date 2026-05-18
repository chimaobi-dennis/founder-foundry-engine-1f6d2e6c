/**
 * critiqueScene.ts
 *
 * AI art director review.
 * Generates human-like design feedback across hierarchy,
 * readability, spacing, emotion, conversion, and platform fitness.
 */

import type { SceneDocument, SceneNode, TextNode } from '@/types/scene';
import { analyzeOccupancy, analyzeBalance, analyzeHierarchy } from './composition/visualBalance';
import { getSafeRegion } from './composition/safeZones';
import { scoreComposition } from './composition/compositionScoring';
import { findNodes } from './mutations/mutateNode';

// ─── Types ────────────────────────────────────────────────────

export type CritiqueCategory =
  | 'hierarchy'
  | 'readability'
  | 'spacing'
  | 'emotional'
  | 'conversion'
  | 'platform';

export type CritiqueSeverity = 'praise' | 'suggestion' | 'issue' | 'critical';

export interface CritiqueItem {
  category: CritiqueCategory;
  severity: CritiqueSeverity;
  message: string;
  nodeId?: string;
  suggestion?: string;
}

export interface SceneCritique {
  items: CritiqueItem[];
  overallVerdict: 'strong' | 'good' | 'needs_work' | 'weak';
  overallScore: number;
  summary: string;
}

export interface CritiqueOptions {
  platformSlug?: string;
  campaignGoal?: 'awareness' | 'conversion' | 'engagement';
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Generate a full design critique for a scene.
 */
export function critiqueScene(
  scene: SceneDocument,
  options: CritiqueOptions = {}
): SceneCritique {
  const items: CritiqueItem[] = [];

  critiqueHierarchy(scene, items);
  critiqueReadability(scene, items);
  critiqueSpacing(scene, items);
  critiqueEmotional(scene, items);
  critiqueConversion(scene, items, options.campaignGoal);
  critiquePlatform(scene, items, options.platformSlug);

  const score = scoreComposition(scene).overall;
  const verdict = score >= 75 ? 'strong' : score >= 55 ? 'good' : score >= 35 ? 'needs_work' : 'weak';

  return {
    items,
    overallVerdict: verdict,
    overallScore: score,
    summary: buildSummary(items, verdict),
  };
}

// ─── Category Critiques ──────────────────────────────────────

function critiqueHierarchy(scene: SceneDocument, items: CritiqueItem[]): void {
  const h = analyzeHierarchy(scene);

  if (h.tiers >= 3) {
    items.push({ category: 'hierarchy', severity: 'praise', message: 'Strong visual hierarchy with multiple tiers — the eye moves naturally through the composition.' });
  } else if (h.tiers === 2) {
    items.push({ category: 'hierarchy', severity: 'suggestion', message: 'The hierarchy has two tiers but could benefit from a third tier to guide the eye more deliberately.', suggestion: 'Add a subtitle or supporting text between headline and body.' });
  } else if (h.tiers <= 1 && scene.nodes.length > 2) {
    items.push({ category: 'hierarchy', severity: 'issue', message: 'Flat visual hierarchy — all elements compete for attention equally.', suggestion: 'Increase headline font size or weight to create a clear focal point.' });
  }

  const textNodes = findNodes(scene, (n) => n.type === 'text') as TextNode[];
  if (textNodes.length > 0) {
    const sizes = textNodes.map((n) => n.fontSize);
    const maxSize = Math.max(...sizes);
    const minSize = Math.min(...sizes);
    if (maxSize > 0 && maxSize / minSize < 1.3 && textNodes.length > 1) {
      items.push({ category: 'hierarchy', severity: 'issue', message: 'Text sizes are too similar — there\'s no clear focal point.', suggestion: 'Make the headline at least 1.5× larger than body text.' });
    }
  }
}

function critiqueReadability(scene: SceneDocument, items: CritiqueItem[]): void {
  const textNodes = findNodes(scene, (n) => n.type === 'text') as TextNode[];

  for (const node of textNodes) {
    if (node.fontSize < 10) {
      items.push({ category: 'readability', severity: 'critical', message: `"${node.text.slice(0, 30)}..." is too small at ${node.fontSize}px — nearly invisible on most screens.`, nodeId: node.id, suggestion: 'Minimum 12px for body text, 10px absolute minimum.' });
    } else if (node.fontSize < 12 && node.text.length > 20) {
      items.push({ category: 'readability', severity: 'suggestion', message: `Body text at ${node.fontSize}px is tight — consider bumping to 14px for comfortable reading.`, nodeId: node.id });
    }

    if (!node.text.trim()) {
      items.push({ category: 'readability', severity: 'issue', message: 'Empty text node detected — either fill it or remove it.', nodeId: node.id });
    }

    // Long lines
    const charsPerLine = Math.round(node.width / (node.fontSize * 0.55));
    if (charsPerLine > 75 && node.text.length > 50) {
      items.push({ category: 'readability', severity: 'suggestion', message: `Text block may be too wide (~${charsPerLine} chars/line). Optimal is 45–65 characters per line.`, nodeId: node.id, suggestion: 'Narrow the text block or increase font size.' });
    }
  }

  if (textNodes.length === 0 && scene.nodes.length > 0) {
    items.push({ category: 'readability', severity: 'suggestion', message: 'No text in this scene. If this is intentional (pure imagery), this is fine — otherwise, add a headline.' });
  }
}

function critiqueSpacing(scene: SceneDocument, items: CritiqueItem[]): void {
  const occ = analyzeOccupancy(scene);
  const bal = analyzeBalance(scene);

  if (occ.occupancy < 0.2) {
    items.push({ category: 'spacing', severity: 'issue', message: 'The scene is very empty — only 20% occupied. It feels unfinished.', suggestion: 'Fill more of the canvas or increase element sizes.' });
  } else if (occ.occupancy < 0.35) {
    items.push({ category: 'spacing', severity: 'suggestion', message: 'Sparse composition. The generous whitespace could feel intentional or empty — depends on brand.', suggestion: 'Consider whether this sparsity matches the brand personality.' });
  } else if (occ.occupancy > 0.8) {
    items.push({ category: 'spacing', severity: 'issue', message: 'The scene is overcrowded. Elements don\'t have room to breathe.', suggestion: 'Remove low-priority elements or add more whitespace between sections.' });
  } else if (occ.balanced) {
    items.push({ category: 'spacing', severity: 'praise', message: 'Good occupancy balance — elements have breathing room without feeling empty.' });
  }

  if (!bal.balanced && bal.imbalance > 0.3) {
    items.push({ category: 'spacing', severity: 'suggestion', message: `Visual weight is off-center (imbalance: ${(bal.imbalance * 100).toFixed(0)}%). The composition feels lopsided.`, suggestion: 'Redistribute elements or add a counterbalancing visual on the opposite side.' });
  }
}

function critiqueEmotional(scene: SceneDocument, items: CritiqueItem[]): void {
  const textNodes = findNodes(scene, (n) => n.type === 'text') as TextNode[];
  if (textNodes.length === 0) return;

  // Check if fonts convey appropriate emotion
  const fonts = new Set(textNodes.map((n) => n.fontFamily));
  if (fonts.size > 3) {
    items.push({ category: 'emotional', severity: 'issue', message: `${fonts.size} different fonts create visual noise. Maximum 2–3 for cohesion.`, suggestion: 'Reduce to 1 heading font and 1 body font.' });
  } else if (fonts.size === 1) {
    items.push({ category: 'emotional', severity: 'suggestion', message: 'Single font family throughout. Functional but lacks typographic personality.', suggestion: 'Consider a contrasting heading font for visual interest.' });
  } else if (fonts.size === 2) {
    items.push({ category: 'emotional', severity: 'praise', message: 'Clean two-font system — professional and focused.' });
  }

  // Check for all-caps overuse
  const allCapsCount = textNodes.filter((n) => n.text === n.text.toUpperCase() && n.text.length > 3).length;
  if (allCapsCount > 2) {
    items.push({ category: 'emotional', severity: 'suggestion', message: 'Multiple ALL-CAPS text blocks feel aggressive. Use sparingly for emphasis.' });
  }
}

function critiqueConversion(
  scene: SceneDocument,
  items: CritiqueItem[],
  goal?: string
): void {
  const buttons = findNodes(scene, (n) => n.type === 'button');

  if (goal === 'conversion' && buttons.length === 0) {
    items.push({ category: 'conversion', severity: 'critical', message: 'Conversion goal but no CTA button. This will underperform.', suggestion: 'Add a prominent button with clear action text.' });
  }

  for (const btn of buttons) {
    if (btn.type !== 'button') continue;
    if (btn.width < 100 || btn.height < 36) {
      items.push({ category: 'conversion', severity: 'issue', message: 'CTA button is too small to be easily tappable on mobile.', nodeId: btn.id, suggestion: 'Minimum 44px height, 120px width for comfortable tapping.' });
    }
    if (btn.opacity < 0.8) {
      items.push({ category: 'conversion', severity: 'issue', message: 'CTA button has low opacity — it won\'t stand out.', nodeId: btn.id, suggestion: 'Set CTA opacity to 1.0 for maximum visibility.' });
    }
  }

  if (buttons.length >= 1) {
    items.push({ category: 'conversion', severity: 'praise', message: 'Clear CTA present — the user knows what to do.' });
  }
}

function critiquePlatform(
  scene: SceneDocument,
  items: CritiqueItem[],
  platformSlug?: string
): void {
  if (!platformSlug) return;

  const safe = getSafeRegion(scene.width, scene.height, platformSlug);
  const importantNodes = findNodes(scene, (n) => n.type === 'text' || n.type === 'button');

  let violations = 0;
  for (const node of importantNodes) {
    if (node.x < safe.x || node.y < safe.y ||
      node.x + node.width > safe.x + safe.width ||
      node.y + node.height > safe.y + safe.height) {
      violations++;
    }
  }

  if (violations > 0) {
    items.push({ category: 'platform', severity: 'issue', message: `${violations} element(s) extend outside the platform safe zone — they may be clipped by UI overlays.`, suggestion: 'Move all text and CTAs inside the safe region.' });
  } else if (importantNodes.length > 0) {
    items.push({ category: 'platform', severity: 'praise', message: 'All important content is within the platform safe zone.' });
  }
}

// ─── Summary Builder ─────────────────────────────────────────

function buildSummary(items: CritiqueItem[], verdict: string): string {
  const criticals = items.filter((i) => i.severity === 'critical').length;
  const issues = items.filter((i) => i.severity === 'issue').length;
  const praises = items.filter((i) => i.severity === 'praise').length;
  const suggestions = items.filter((i) => i.severity === 'suggestion').length;

  const parts: string[] = [];

  if (verdict === 'strong') parts.push('This is a strong composition.');
  else if (verdict === 'good') parts.push('Solid composition with room for refinement.');
  else if (verdict === 'needs_work') parts.push('This layout needs attention in several areas.');
  else parts.push('This composition has significant issues that should be addressed.');

  if (praises > 0) parts.push(`${praises} strength(s) noted.`);
  if (criticals > 0) parts.push(`${criticals} critical issue(s).`);
  if (issues > 0) parts.push(`${issues} issue(s).`);
  if (suggestions > 0) parts.push(`${suggestions} suggestion(s).`);

  return parts.join(' ');
}
