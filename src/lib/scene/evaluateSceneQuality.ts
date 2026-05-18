/**
 * evaluateSceneQuality.ts
 *
 * Comprehensive quality evaluation for AI-generated scenes.
 * Used for auto-rejection, auto-refinement, and ranking generations.
 */

import type { SceneDocument, SceneNode, TextNode } from '@/types/scene';
import { analyzeOccupancy, analyzeBalance, analyzeHierarchy } from './composition/visualBalance';
import { getSafeRegion } from './composition/safeZones';
import { isFontAllowed } from '@/lib/fonts/fontRegistry';
import { stableSceneHash } from './stableSceneHash';

// ─── Types ────────────────────────────────────────────────────

export interface QualityEvaluation {
  /** Overall quality score 0–100. */
  overall: number;
  /** Detailed scores per category. */
  scores: {
    readability: number;
    hierarchy: number;
    occupancy: number;
    contrast: number;
    ctaClarity: number;
    platformFitness: number;
    originality: number;
    brandConsistency: number;
  };
  /** Pass/fail flags. */
  flags: {
    passesMinimum: boolean;
    autoReject: boolean;
    needsRefinement: boolean;
  };
  /** Issues found. */
  issues: QualityIssue[];
  /** Scene hash for dedup. */
  hash: string;
}

export interface QualityIssue {
  severity: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  nodeId?: string;
}

export interface EvaluationOptions {
  platformSlug?: string;
  /** Hashes of previously generated scenes (for originality check). */
  previousHashes?: Set<string>;
  /** Expected brand fonts. */
  brandFonts?: string[];
  /** Expected brand colors. */
  brandColors?: string[];
  /** Minimum overall score to pass. Default 40. */
  minimumScore?: number;
  /** Score below which auto-reject triggers. Default 25. */
  autoRejectScore?: number;
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Evaluate the quality of a scene.
 */
export function evaluateSceneQuality(
  scene: SceneDocument,
  options: EvaluationOptions = {}
): QualityEvaluation {
  const {
    platformSlug = 'generic',
    previousHashes,
    brandFonts,
    brandColors,
    minimumScore = 40,
    autoRejectScore = 25,
  } = options;

  const issues: QualityIssue[] = [];
  const hash = stableSceneHash(scene);

  // ── Readability (0–15) ──
  const readability = evalReadability(scene, issues);

  // ── Hierarchy (0–15) ──
  const hierarchy = evalHierarchy(scene, issues);

  // ── Occupancy (0–15) ──
  const occupancy = evalOccupancy(scene, issues);

  // ── Contrast (0–10) ──
  const contrast = evalContrast(scene, issues);

  // ── CTA Clarity (0–10) ──
  const ctaClarity = evalCtaClarity(scene, issues);

  // ── Platform Fitness (0–15) ──
  const platformFitness = evalPlatformFitness(scene, platformSlug, issues);

  // ── Originality (0–10) ──
  const originality = evalOriginality(hash, previousHashes, issues);

  // ── Brand Consistency (0–10) ──
  const brandConsistency = evalBrandConsistency(scene, brandFonts, brandColors, issues);

  const overall = readability + hierarchy + occupancy + contrast + ctaClarity + platformFitness + originality + brandConsistency;

  return {
    overall,
    scores: { readability, hierarchy, occupancy, contrast, ctaClarity, platformFitness, originality, brandConsistency },
    flags: {
      passesMinimum: overall >= minimumScore,
      autoReject: overall < autoRejectScore,
      needsRefinement: overall < 60,
    },
    issues,
    hash,
  };
}

// ─── Evaluators ──────────────────────────────────────────────

function evalReadability(scene: SceneDocument, issues: QualityIssue[]): number {
  let score = 15;
  const textNodes = collectNodes(scene.nodes, 'text') as TextNode[];

  if (textNodes.length === 0) {
    if (scene.nodes.length > 0) {
      issues.push({ severity: 'warning', category: 'readability', message: 'No text nodes found' });
      return 8;
    }
    return 0;
  }

  for (const node of textNodes) {
    if (node.fontSize < 10) {
      score -= 3;
      issues.push({ severity: 'error', category: 'readability', message: `Text "${node.text.slice(0, 20)}..." is too small (${node.fontSize}px)`, nodeId: node.id });
    }
    if (!node.text.trim()) {
      score -= 2;
      issues.push({ severity: 'warning', category: 'readability', message: 'Empty text node', nodeId: node.id });
    }
    if (!isFontAllowed(node.fontFamily)) {
      score -= 1;
      issues.push({ severity: 'warning', category: 'readability', message: `Unknown font: ${node.fontFamily}`, nodeId: node.id });
    }
  }

  return Math.max(0, score);
}

function evalHierarchy(scene: SceneDocument, issues: QualityIssue[]): number {
  const h = analyzeHierarchy(scene);
  if (!h.hasHierarchy && scene.nodes.length > 2) {
    issues.push({ severity: 'warning', category: 'hierarchy', message: 'No clear visual hierarchy' });
    return 5;
  }
  if (h.tiers >= 3) return 15;
  if (h.tiers >= 2) return 10;
  return 7;
}

function evalOccupancy(scene: SceneDocument, issues: QualityIssue[]): number {
  const occ = analyzeOccupancy(scene);
  if (occ.occupancy < 0.15) {
    issues.push({ severity: 'error', category: 'occupancy', message: 'Scene is nearly empty' });
    return 2;
  }
  if (occ.occupancy < 0.3) {
    issues.push({ severity: 'warning', category: 'occupancy', message: 'Scene is very sparse' });
    return 7;
  }
  if (occ.occupancy > 0.85) {
    issues.push({ severity: 'warning', category: 'occupancy', message: 'Scene is overcrowded' });
    return 8;
  }
  if (occ.balanced) return 15;
  return 11;
}

function evalContrast(scene: SceneDocument, issues: QualityIssue[]): number {
  // Simple check: are text colors sufficiently different from background?
  const bg = scene.background || '#ffffff';
  const textNodes = collectNodes(scene.nodes, 'text') as TextNode[];
  if (textNodes.length === 0) return 10;

  let score = 10;
  for (const node of textNodes) {
    if (colorsAreSimilar(node.color, bg)) {
      score -= 3;
      issues.push({ severity: 'warning', category: 'contrast', message: `Low contrast text on background`, nodeId: node.id });
    }
  }
  return Math.max(0, score);
}

function evalCtaClarity(scene: SceneDocument, issues: QualityIssue[]): number {
  const buttons = collectNodes(scene.nodes, 'button');
  if (buttons.length === 0) {
    // No CTA is not necessarily bad
    return 7;
  }
  let score = 10;
  for (const btn of buttons) {
    if (btn.width < 80 || btn.height < 36) {
      score -= 3;
      issues.push({ severity: 'warning', category: 'cta', message: 'CTA button too small to be tappable', nodeId: btn.id });
    }
  }
  return Math.max(0, score);
}

function evalPlatformFitness(scene: SceneDocument, platformSlug: string, issues: QualityIssue[]): number {
  const safe = getSafeRegion(scene.width, scene.height, platformSlug);
  let score = 15;

  const important = collectNodes(scene.nodes, 'text').concat(collectNodes(scene.nodes, 'button'));
  for (const node of important) {
    if (node.x < safe.x || node.y < safe.y ||
      node.x + node.width > safe.x + safe.width ||
      node.y + node.height > safe.y + safe.height) {
      score -= 2;
      issues.push({ severity: 'warning', category: 'platform', message: 'Content outside safe zone', nodeId: node.id });
    }
  }

  return Math.max(0, score);
}

function evalOriginality(hash: string, previousHashes: Set<string> | undefined, issues: QualityIssue[]): number {
  if (!previousHashes || previousHashes.size === 0) return 10;
  if (previousHashes.has(hash)) {
    issues.push({ severity: 'error', category: 'originality', message: 'Duplicate scene detected' });
    return 0;
  }
  return 10;
}

function evalBrandConsistency(
  scene: SceneDocument,
  brandFonts: string[] | undefined,
  brandColors: string[] | undefined,
  issues: QualityIssue[]
): number {
  let score = 10;

  if (brandFonts && brandFonts.length > 0) {
    const textNodes = collectNodes(scene.nodes, 'text') as TextNode[];
    const usedFonts = new Set(textNodes.map((n) => n.fontFamily));
    const brandSet = new Set(brandFonts);
    const offBrand = [...usedFonts].filter((f) => !brandSet.has(f));
    if (offBrand.length > 0) {
      score -= Math.min(5, offBrand.length * 2);
      issues.push({ severity: 'info', category: 'brand', message: `Off-brand fonts: ${offBrand.join(', ')}` });
    }
  }

  return Math.max(0, score);
}

// ─── Helpers ──────────────────────────────────────────────────

function collectNodes(nodes: SceneNode[], type: string): SceneNode[] {
  const result: SceneNode[] = [];
  for (const node of nodes) {
    if (node.type === type) result.push(node);
    if ('children' in node && Array.isArray(node.children)) {
      result.push(...collectNodes(node.children, type));
    }
  }
  return result;
}

function colorsAreSimilar(a: string, b: string): boolean {
  const ra = parseHexChannel(a, 1), ga = parseHexChannel(a, 3), ba_ = parseHexChannel(a, 5);
  const rb = parseHexChannel(b, 1), gb = parseHexChannel(b, 3), bb = parseHexChannel(b, 5);
  const diff = Math.abs(ra - rb) + Math.abs(ga - gb) + Math.abs(ba_ - bb);
  return diff < 80;
}

function parseHexChannel(hex: string, offset: number): number {
  if (!hex.startsWith('#') || hex.length < offset + 2) return 128;
  return parseInt(hex.slice(offset, offset + 2), 16) || 128;
}
