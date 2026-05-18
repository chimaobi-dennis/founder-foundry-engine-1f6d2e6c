/**
 * visualBalance.ts
 *
 * Scene occupancy analysis and whitespace balancing.
 * Scores how well a scene uses its canvas space.
 */

import type { SceneDocument, SceneNode } from '@/types/scene';

// ─── Types ────────────────────────────────────────────────────

export interface OccupancyResult {
  /** Fraction of canvas covered by nodes (0–1). */
  occupancy: number;
  /** Fraction of canvas that is whitespace (0–1). */
  whitespace: number;
  /** Total node area in px². */
  totalNodeArea: number;
  /** Canvas area in px². */
  canvasArea: number;
  /** Whether occupancy is in the optimal range (0.4–0.75). */
  balanced: boolean;
}

export interface BalanceResult {
  /** Horizontal center of mass (0 = left edge, 1 = right edge). */
  centerX: number;
  /** Vertical center of mass (0 = top edge, 1 = bottom edge). */
  centerY: number;
  /** How far the center of mass is from the visual center (0 = perfect, 1 = extreme). */
  imbalance: number;
  /** Whether the layout is visually balanced (imbalance < 0.15). */
  balanced: boolean;
}

export interface HierarchyResult {
  /** Number of distinct size tiers detected. */
  tiers: number;
  /** Whether there's a clear visual hierarchy (>= 2 tiers). */
  hasHierarchy: boolean;
  /** Ratio of largest node to smallest node. */
  sizeContrast: number;
}

// ─── Occupancy Analysis ──────────────────────────────────────

/**
 * Analyze how much of the canvas is occupied by nodes.
 * Ideal occupancy for most creative formats: 40–75%.
 */
export function analyzeOccupancy(scene: SceneDocument): OccupancyResult {
  const canvasArea = scene.width * scene.height;
  if (canvasArea === 0) {
    return { occupancy: 0, whitespace: 1, totalNodeArea: 0, canvasArea: 0, balanced: false };
  }

  let totalNodeArea = 0;
  function sumArea(nodes: SceneNode[]) {
    for (const node of nodes) {
      totalNodeArea += node.width * node.height;
      if (node.type === 'group') sumArea(node.children);
    }
  }
  sumArea(scene.nodes);

  // Clamp to 1 — overlapping nodes can exceed 100%
  const occupancy = Math.min(1, totalNodeArea / canvasArea);
  const whitespace = 1 - occupancy;

  return {
    occupancy,
    whitespace,
    totalNodeArea,
    canvasArea,
    balanced: occupancy >= 0.4 && occupancy <= 0.75,
  };
}

// ─── Balance Analysis ─────────────────────────────────────────

/**
 * Analyze the visual balance (center of mass) of the scene.
 * Weighted by node area.
 */
export function analyzeBalance(scene: SceneDocument): BalanceResult {
  let totalWeight = 0;
  let weightedX = 0;
  let weightedY = 0;

  function accumulate(nodes: SceneNode[]) {
    for (const node of nodes) {
      const area = node.width * node.height;
      const cx = node.x + node.width / 2;
      const cy = node.y + node.height / 2;
      weightedX += cx * area;
      weightedY += cy * area;
      totalWeight += area;
      if (node.type === 'group') accumulate(node.children);
    }
  }
  accumulate(scene.nodes);

  if (totalWeight === 0) {
    return { centerX: 0.5, centerY: 0.5, imbalance: 0, balanced: true };
  }

  const centerX = weightedX / totalWeight / scene.width;
  const centerY = weightedY / totalWeight / scene.height;

  // Distance from visual center (0.5, 0.5)
  const dx = centerX - 0.5;
  const dy = centerY - 0.5;
  const imbalance = Math.sqrt(dx * dx + dy * dy) * 2; // normalize to 0–1

  return {
    centerX,
    centerY,
    imbalance: Math.min(1, imbalance),
    balanced: imbalance < 0.15,
  };
}

// ─── Hierarchy Analysis ──────────────────────────────────────

/**
 * Detect visual hierarchy tiers based on node sizes.
 */
export function analyzeHierarchy(scene: SceneDocument): HierarchyResult {
  const areas: number[] = [];

  function collectAreas(nodes: SceneNode[]) {
    for (const node of nodes) {
      if (node.type !== 'group') {
        areas.push(node.width * node.height);
      }
      if (node.type === 'group') collectAreas(node.children);
    }
  }
  collectAreas(scene.nodes);

  if (areas.length === 0) {
    return { tiers: 0, hasHierarchy: false, sizeContrast: 0 };
  }

  areas.sort((a, b) => a - b);
  const smallest = areas[0];
  const largest = areas[areas.length - 1];
  const sizeContrast = smallest > 0 ? largest / smallest : 0;

  // Cluster areas into tiers using a simple threshold (2x difference = new tier)
  let tiers = 1;
  let lastTierSize = areas[0];
  for (const area of areas) {
    if (area > lastTierSize * 2) {
      tiers++;
      lastTierSize = area;
    }
  }

  return {
    tiers,
    hasHierarchy: tiers >= 2,
    sizeContrast,
  };
}
