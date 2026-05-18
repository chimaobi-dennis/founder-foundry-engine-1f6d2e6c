/**
 * refineComposition.ts
 *
 * Automatic composition refinement — "auto art director."
 * Takes a weak AI layout and improves it structurally.
 *
 * All transformations are immutable.
 */

import type { SceneDocument, SceneNode, TextNode } from '@/types/scene';
import { scoreComposition, type CompositionScore } from './composition/compositionScoring';
import { analyzeOccupancy, analyzeBalance } from './composition/visualBalance';
import { getSafeRegion } from './composition/safeZones';
import { findNodes, replaceNode } from './mutations/mutateNode';

// ─── Types ────────────────────────────────────────────────────

export interface RefinementResult {
  scene: SceneDocument;
  scoreBefore: CompositionScore;
  scoreAfter: CompositionScore;
  refinementsApplied: string[];
  improved: boolean;
}

export interface RefinementOptions {
  /** Platform slug for safe zone awareness. */
  platformSlug?: string;
  /** Maximum number of refinement passes. Default 3. */
  maxPasses?: number;
  /** Minimum improvement per pass to continue. Default 3 points. */
  minImprovement?: number;
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Automatically refine a scene's composition.
 * Applies multiple passes until the score plateaus.
 */
export function refineComposition(
  scene: SceneDocument,
  options: RefinementOptions = {}
): RefinementResult {
  const { platformSlug = 'generic', maxPasses = 3, minImprovement = 3 } = options;
  const scoreBefore = scoreComposition(scene);
  const refinementsApplied: string[] = [];

  let current = scene;
  let currentScore = scoreBefore.overall;

  for (let pass = 0; pass < maxPasses; pass++) {
    const refined = singlePass(current, platformSlug, refinementsApplied);
    const newScore = scoreComposition(refined).overall;

    if (newScore - currentScore < minImprovement) {
      break;
    }

    current = refined;
    currentScore = newScore;
  }

  const scoreAfter = scoreComposition(current);

  return {
    scene: current,
    scoreBefore,
    scoreAfter,
    refinementsApplied,
    improved: scoreAfter.overall > scoreBefore.overall,
  };
}

// ─── Single Refinement Pass ──────────────────────────────────

function singlePass(
  scene: SceneDocument,
  platformSlug: string,
  log: string[]
): SceneDocument {
  let result = scene;

  // 1. Fix unreadable text
  result = fixUnreadableText(result, log);

  // 2. Fix off-canvas elements
  result = fixOffCanvas(result, log);

  // 3. Fix safe zone violations
  result = fixSafeZones(result, platformSlug, log);

  // 4. Improve sparse layouts
  result = fixSparseLayout(result, log);

  // 5. Improve weak hierarchy
  result = improveHierarchy(result, log);

  // 6. Redistribute whitespace
  result = redistributeWhitespace(result, log);

  return result;
}

// ─── Refinement Functions ────────────────────────────────────

function fixUnreadableText(scene: SceneDocument, log: string[]): SceneDocument {
  const MIN_FONT = 10;
  const small = findNodes(scene, (n) => n.type === 'text' && (n as TextNode).fontSize < MIN_FONT) as TextNode[];
  if (small.length === 0) return scene;

  let result = scene;
  for (const node of small) {
    result = replaceNode(result, node.id, (n) =>
      n.type === 'text' ? { ...n, fontSize: MIN_FONT } : n
    );
  }
  log.push(`Enlarged ${small.length} unreadable text node(s) to ${MIN_FONT}px`);
  return result;
}

function fixOffCanvas(scene: SceneDocument, log: string[]): SceneDocument {
  let result = scene;
  let count = 0;

  const offCanvas = findNodes(scene, (n) =>
    n.x + n.width < 0 || n.y + n.height < 0 ||
    n.x > scene.width || n.y > scene.height
  );

  for (const node of offCanvas) {
    const newX = Math.max(0, Math.min(node.x, scene.width - node.width));
    const newY = Math.max(0, Math.min(node.y, scene.height - node.height));
    result = replaceNode(result, node.id, (n) => ({ ...n, x: newX, y: newY }));
    count++;
  }

  if (count > 0) log.push(`Moved ${count} off-canvas element(s) back into view`);
  return result;
}

function fixSafeZones(scene: SceneDocument, platformSlug: string, log: string[]): SceneDocument {
  const safe = getSafeRegion(scene.width, scene.height, platformSlug);
  let result = scene;
  let count = 0;

  // Only fix text and button nodes (important content)
  const important = findNodes(scene, (n) => n.type === 'text' || n.type === 'button');

  for (const node of important) {
    let needsFix = false;
    let newX = node.x;
    let newY = node.y;

    if (node.x < safe.x) { newX = safe.x; needsFix = true; }
    if (node.y < safe.y) { newY = safe.y; needsFix = true; }
    if (node.x + node.width > safe.x + safe.width) {
      newX = safe.x + safe.width - node.width;
      needsFix = true;
    }
    if (node.y + node.height > safe.y + safe.height) {
      newY = safe.y + safe.height - node.height;
      needsFix = true;
    }

    if (needsFix) {
      result = replaceNode(result, node.id, (n) => ({ ...n, x: newX, y: newY }));
      count++;
    }
  }

  if (count > 0) log.push(`Moved ${count} element(s) into platform safe zone`);
  return result;
}

function fixSparseLayout(scene: SceneDocument, log: string[]): SceneDocument {
  const occ = analyzeOccupancy(scene);
  if (occ.occupancy >= 0.35) return scene;

  // Scale up all nodes by 10% toward center
  const scale = 1.1;
  const cx = scene.width / 2;
  const cy = scene.height / 2;

  const newNodes = scene.nodes.map((node) => {
    const nodeCx = node.x + node.width / 2;
    const nodeCy = node.y + node.height / 2;
    const newW = Math.round(node.width * scale);
    const newH = Math.round(node.height * scale);
    // Move slightly toward center
    const newCx = cx + (nodeCx - cx) * 0.9;
    const newCy = cy + (nodeCy - cy) * 0.9;
    return {
      ...node,
      x: Math.round(newCx - newW / 2),
      y: Math.round(newCy - newH / 2),
      width: newW,
      height: newH,
    };
  });

  log.push('Scaled up sparse layout by 10%');
  return { ...scene, nodes: newNodes };
}

function improveHierarchy(scene: SceneDocument, log: string[]): SceneDocument {
  const textNodes = findNodes(scene, (n) => n.type === 'text') as TextNode[];
  if (textNodes.length < 2) return scene;

  const sizes = textNodes.map((n) => n.fontSize);
  const maxSize = Math.max(...sizes);
  const minSize = Math.min(...sizes);

  // If all text is similar size, create hierarchy
  if (maxSize / minSize < 1.3) {
    let result = scene;
    // Enlarge the first (presumably headline) text node
    const headline = textNodes.reduce((a, b) => a.zIndex <= b.zIndex ? a : b);
    result = replaceNode(result, headline.id, (n) =>
      n.type === 'text' ? { ...n, fontSize: Math.round(n.fontSize * 1.5), fontWeight: 700 } : n
    );
    log.push('Enlarged headline to create visual hierarchy');
    return result;
  }

  return scene;
}

function redistributeWhitespace(scene: SceneDocument, log: string[]): SceneDocument {
  const bal = analyzeBalance(scene);
  if (bal.balanced) return scene;
  if (scene.nodes.length < 2) return scene;

  // Nudge all nodes toward center to improve balance
  const cx = scene.width / 2;
  const cy = scene.height / 2;
  const nudge = 0.05; // 5% toward center

  const newNodes = scene.nodes.map((node) => {
    const nodeCx = node.x + node.width / 2;
    const nodeCy = node.y + node.height / 2;
    const newCx = nodeCx + (cx - nodeCx) * nudge;
    const newCy = nodeCy + (cy - nodeCy) * nudge;
    return {
      ...node,
      x: Math.round(newCx - node.width / 2),
      y: Math.round(newCy - node.height / 2),
    };
  });

  log.push('Redistributed whitespace for better balance');
  return { ...scene, nodes: newNodes };
}
