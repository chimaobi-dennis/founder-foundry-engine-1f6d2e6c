/**
 * parityScore.ts
 *
 * Computes a 0–100 parity score from canvas comparison results.
 * Breaks down: mismatch %, color drift, layout drift, typography drift.
 *
 * Thresholds:
 *   95+ = production safe
 *   85–94 = acceptable
 *   <85 = failed export
 */

import type { CanvasComparisonResult } from './compareCanvases';
import type { SceneDocument, SceneNode, TextNode } from '@/types/scene';

// ─── Types ────────────────────────────────────────────────────

export interface ParityScore {
  /** Overall 0–100 score. */
  overall: number;
  /** Tier: 'production' | 'acceptable' | 'failed'. */
  tier: ParityTier;
  /** Breakdown scores (each 0–100). */
  breakdown: {
    pixelMatch: number;
    colorFidelity: number;
    layoutAccuracy: number;
    typographyFidelity: number;
  };
  /** Summary string. */
  summary: string;
}

export type ParityTier = 'production' | 'acceptable' | 'failed';

export interface ParityScoreOptions {
  /** Weight for pixel match score. Default 0.40. */
  weightPixelMatch?: number;
  /** Weight for color fidelity. Default 0.25. */
  weightColor?: number;
  /** Weight for layout accuracy. Default 0.20. */
  weightLayout?: number;
  /** Weight for typography fidelity. Default 0.15. */
  weightTypography?: number;
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Compute a parity score from a canvas comparison result.
 */
export function computeParityScore(
  comparison: CanvasComparisonResult,
  sceneA: SceneDocument,
  sceneB: SceneDocument,
  options: ParityScoreOptions = {}
): ParityScore {
  const {
    weightPixelMatch = 0.40,
    weightColor = 0.25,
    weightLayout = 0.20,
    weightTypography = 0.15,
  } = options;

  // ── Pixel match (0–100) ───────────────────────────────────
  const pixelMatch = computePixelMatchScore(comparison);

  // ── Color fidelity (0–100) ────────────────────────────────
  const colorFidelity = computeColorFidelityScore(comparison);

  // ── Layout accuracy (0–100) ───────────────────────────────
  const layoutAccuracy = computeLayoutAccuracyScore(comparison, sceneA, sceneB);

  // ── Typography fidelity (0–100) ───────────────────────────
  const typographyFidelity = computeTypographyFidelityScore(sceneA, sceneB);

  // ── Weighted overall ──────────────────────────────────────
  const overall = Math.round(
    pixelMatch * weightPixelMatch +
    colorFidelity * weightColor +
    layoutAccuracy * weightLayout +
    typographyFidelity * weightTypography
  );

  const tier = toTier(overall);
  const summary = buildSummary(overall, tier, comparison);

  return {
    overall,
    tier,
    breakdown: { pixelMatch, colorFidelity, layoutAccuracy, typographyFidelity },
    summary,
  };
}

/**
 * Quick pass/fail check.
 */
export function isProductionSafe(score: ParityScore): boolean {
  return score.tier === 'production';
}

// ─── Score Computers ─────────────────────────────────────────

function computePixelMatchScore(c: CanvasComparisonResult): number {
  if (c.identical) return 100;
  if (c.totalPixels === 0) return 0;

  // Exponential decay: small mismatches are OK, large ones penalized heavily
  const matchRatio = 1 - (c.mismatchedPixels / c.totalPixels);
  // 99.5% match → ~97 score, 95% match → ~60 score
  return Math.round(Math.pow(matchRatio, 4) * 100);
}

function computeColorFidelityScore(c: CanvasComparisonResult): number {
  if (c.identical) return 100;
  if (c.mismatchedPixels === 0) return 100;

  // avgColorDrift is 0–255. Score drops as drift increases.
  // drift < 5 → ~95, drift > 30 → ~50, drift > 100 → ~10
  const normalizedDrift = c.avgColorDrift / 255;
  const score = Math.round((1 - normalizedDrift) * 100);
  return Math.max(0, score);
}

function computeLayoutAccuracyScore(
  c: CanvasComparisonResult,
  sceneA: SceneDocument,
  sceneB: SceneDocument
): number {
  // If identical, perfect
  if (c.identical) return 100;

  // Compare node positions and sizes between scenes
  const nodesA = flattenNodes(sceneA.nodes);
  const nodesB = flattenNodes(sceneB.nodes);

  if (nodesA.length === 0 && nodesB.length === 0) return 100;
  if (nodesA.length !== nodesB.length) {
    // Node count mismatch — significant layout issue
    return Math.max(0, 100 - Math.abs(nodesA.length - nodesB.length) * 20);
  }

  let totalDrift = 0;
  let comparisons = 0;
  const canvasDiag = Math.sqrt(sceneA.width * sceneA.width + sceneA.height * sceneA.height);

  for (const nodeA of nodesA) {
    const nodeB = nodesB.find((n) => n.id === nodeA.id);
    if (!nodeB) continue;

    // Position drift (normalized by canvas diagonal)
    const positionDrift = Math.sqrt(
      Math.pow(nodeA.x - nodeB.x, 2) + Math.pow(nodeA.y - nodeB.y, 2)
    ) / canvasDiag;

    // Size drift
    const sizeDrift = (
      Math.abs(nodeA.width - nodeB.width) + Math.abs(nodeA.height - nodeB.height)
    ) / (sceneA.width + sceneA.height);

    totalDrift += positionDrift + sizeDrift;
    comparisons++;
  }

  if (comparisons === 0) return 100;
  const avgDrift = totalDrift / comparisons;

  // avgDrift < 0.01 → ~99, > 0.1 → ~60
  return Math.round(Math.max(0, (1 - avgDrift * 5) * 100));
}

function computeTypographyFidelityScore(sceneA: SceneDocument, sceneB: SceneDocument): number {
  const textA = flattenNodes(sceneA.nodes).filter((n) => n.type === 'text') as TextNode[];
  const textB = flattenNodes(sceneB.nodes).filter((n) => n.type === 'text') as TextNode[];

  if (textA.length === 0 && textB.length === 0) return 100;
  if (textA.length !== textB.length) return 50;

  let totalScore = 0;
  let count = 0;

  for (const tA of textA) {
    const tB = textB.find((t) => t.id === tA.id);
    if (!tB) continue;

    let nodeScore = 100;

    // Font family mismatch
    if (tA.fontFamily !== tB.fontFamily) nodeScore -= 30;
    // Font weight mismatch
    if (tA.fontWeight !== tB.fontWeight) nodeScore -= 10;
    // Font size drift
    const sizeDrift = Math.abs(tA.fontSize - tB.fontSize) / Math.max(tA.fontSize, 1);
    nodeScore -= Math.round(sizeDrift * 50);
    // Color mismatch
    if (tA.color !== tB.color) nodeScore -= 10;
    // Text content mismatch
    if (tA.text !== tB.text) nodeScore -= 40;

    totalScore += Math.max(0, nodeScore);
    count++;
  }

  return count > 0 ? Math.round(totalScore / count) : 100;
}

// ─── Helpers ──────────────────────────────────────────────────

function flattenNodes(nodes: SceneNode[]): SceneNode[] {
  const result: SceneNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if ('children' in node && Array.isArray(node.children)) {
      result.push(...flattenNodes(node.children));
    }
  }
  return result;
}

function toTier(score: number): ParityTier {
  if (score >= 95) return 'production';
  if (score >= 85) return 'acceptable';
  return 'failed';
}

function buildSummary(score: number, tier: ParityTier, c: CanvasComparisonResult): string {
  if (c.identical) return `Perfect parity (100). Identical pixel output.`;
  const tierLabel = tier === 'production' ? 'Production safe' : tier === 'acceptable' ? 'Acceptable' : 'FAILED';
  return `${tierLabel} (${score}). ${c.mismatchPercent.toFixed(2)}% pixel mismatch, avg drift ${c.avgColorDrift.toFixed(1)}.`;
}
