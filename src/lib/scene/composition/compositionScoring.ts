/**
 * compositionScoring.ts
 *
 * Score AI-generated scenes for composition quality.
 * Detects weak layouts, sparse compositions, and missing elements.
 */

import type { SceneDocument, SceneNode } from '@/types/scene';
import { analyzeOccupancy, analyzeBalance, analyzeHierarchy } from './visualBalance';
import { isReadable } from './typographyScale';

// ─── Types ────────────────────────────────────────────────────

export interface CompositionScore {
  /** Overall score 0–100. */
  overall: number;
  /** Breakdown by category. */
  breakdown: {
    occupancy: number;
    balance: number;
    hierarchy: number;
    typography: number;
    nodeCount: number;
  };
  /** Human-readable issues found. */
  issues: string[];
  /** Quality tier. */
  tier: 'excellent' | 'good' | 'acceptable' | 'weak' | 'poor';
}

// ─── Scorer ───────────────────────────────────────────────────

/**
 * Score a scene's composition quality.
 * Returns a 0–100 score with breakdown and issues.
 */
export function scoreComposition(scene: SceneDocument): CompositionScore {
  const issues: string[] = [];

  // ── Occupancy (0–25 pts) ──
  const occ = analyzeOccupancy(scene);
  let occupancyScore = 25;
  if (occ.occupancy < 0.2) {
    occupancyScore = 5;
    issues.push('Scene is very sparse — less than 20% occupied');
  } else if (occ.occupancy < 0.4) {
    occupancyScore = 15;
    issues.push('Scene has excessive whitespace');
  } else if (occ.occupancy > 0.85) {
    occupancyScore = 10;
    issues.push('Scene is overcrowded — over 85% occupied');
  } else if (!occ.balanced) {
    occupancyScore = 18;
  }

  // ── Balance (0–25 pts) ──
  const bal = analyzeBalance(scene);
  let balanceScore = 25;
  if (bal.imbalance > 0.3) {
    balanceScore = 5;
    issues.push('Visual weight is heavily unbalanced');
  } else if (bal.imbalance > 0.15) {
    balanceScore = 15;
    issues.push('Visual weight is slightly off-center');
  }

  // ── Hierarchy (0–20 pts) ──
  const hier = analyzeHierarchy(scene);
  let hierarchyScore = 20;
  if (!hier.hasHierarchy) {
    hierarchyScore = 5;
    issues.push('No clear visual hierarchy — elements are similar sizes');
  } else if (hier.tiers < 3 && scene.nodes.length > 3) {
    hierarchyScore = 12;
    issues.push('Limited visual hierarchy — could benefit from more size variation');
  }

  // ── Typography (0–15 pts) ──
  let typographyScore = 15;
  const textNodes = collectTextNodes(scene.nodes);
  if (textNodes.length === 0 && scene.nodes.length > 0) {
    typographyScore = 8;
    issues.push('No text nodes found — composition may lack messaging');
  } else {
    const unreadable = textNodes.filter((n) => !isReadable(n.fontSize));
    if (unreadable.length > 0) {
      typographyScore -= Math.min(10, unreadable.length * 3);
      issues.push(`${unreadable.length} text node(s) have unreadably small font sizes`);
    }
    const noText = textNodes.filter((n) => !n.text.trim());
    if (noText.length > 0) {
      typographyScore -= Math.min(5, noText.length * 2);
      issues.push(`${noText.length} text node(s) are empty`);
    }
  }
  typographyScore = Math.max(0, typographyScore);

  // ── Node Count (0–15 pts) ──
  const nodeCount = countNodes(scene.nodes);
  let nodeCountScore = 15;
  if (nodeCount === 0) {
    nodeCountScore = 0;
    issues.push('Scene has no nodes');
  } else if (nodeCount === 1) {
    nodeCountScore = 5;
    issues.push('Scene has only one node — very minimal composition');
  } else if (nodeCount > 50) {
    nodeCountScore = 8;
    issues.push('Scene has many nodes — may impact performance');
  }

  const overall = Math.round(
    occupancyScore + balanceScore + hierarchyScore + typographyScore + nodeCountScore
  );

  let tier: CompositionScore['tier'];
  if (overall >= 85) tier = 'excellent';
  else if (overall >= 70) tier = 'good';
  else if (overall >= 50) tier = 'acceptable';
  else if (overall >= 30) tier = 'weak';
  else tier = 'poor';

  return {
    overall,
    breakdown: {
      occupancy: occupancyScore,
      balance: balanceScore,
      hierarchy: hierarchyScore,
      typography: typographyScore,
      nodeCount: nodeCountScore,
    },
    issues,
    tier,
  };
}

// ─── Helpers ──────────────────────────────────────────────────

function collectTextNodes(nodes: SceneNode[]): Array<{ fontSize: number; text: string }> {
  const result: Array<{ fontSize: number; text: string }> = [];
  for (const node of nodes) {
    if (node.type === 'text') {
      result.push({ fontSize: node.fontSize, text: node.text });
    }
    if (node.type === 'group') {
      result.push(...collectTextNodes(node.children));
    }
  }
  return result;
}

function countNodes(nodes: SceneNode[]): number {
  let count = 0;
  for (const node of nodes) {
    count++;
    if (node.type === 'group') count += countNodes(node.children);
  }
  return count;
}
