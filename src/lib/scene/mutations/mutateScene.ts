/**
 * mutateScene.ts
 *
 * Scene-level immutable mutations.
 * Every function returns a new SceneDocument — never mutates in place.
 */

import type { SceneDocument, SceneNode, TextNode } from '@/types/scene';
import { resolveFontFamily, resolveFontWeight } from '@/lib/fonts/fontRegistry';
import { sanitizeColor } from '@/lib/scene/validateSceneDocument';
import type { MutationParams, MutationResult, MutationId, MutationChain } from './mutationTypes';
import { findNodes, replaceNode } from './mutateNode';

// ─── Scene-Level Mutations ───────────────────────────────────

/** Replace all headline text (largest font-size text nodes). */
export function replaceHeadline(scene: SceneDocument, newText: string): MutationResult {
  const textNodes = findNodes(scene, (n) => n.type === 'text') as TextNode[];
  if (textNodes.length === 0) return noopResult(scene, 'replace_headline', {});

  const maxSize = Math.max(...textNodes.map((n) => n.fontSize));
  const headlines = textNodes.filter((n) => n.fontSize >= maxSize * 0.85);
  let result = scene;
  const ids: string[] = [];
  for (const h of headlines) {
    result = replaceNode(result, h.id, (n) => n.type === 'text' ? { ...n, text: newText } : n);
    ids.push(h.id);
  }
  return mutResult(result, 'replace_headline', { text: newText }, ids, `Replaced ${ids.length} headline(s)`);
}

/** Rewrite CTA text (button nodes or smallest prominent text). */
export function rewriteCta(scene: SceneDocument, newText: string): MutationResult {
  const buttons = findNodes(scene, (n) => n.type === 'button');
  let result = scene;
  const ids: string[] = [];
  for (const btn of buttons) {
    result = replaceNode(result, btn.id, (n) => n.type === 'button' ? { ...n, label: newText } : n);
    ids.push(btn.id);
  }
  if (ids.length === 0) {
    // Fall back to text nodes with "cta"-like characteristics (short, bold)
    const ctaLike = findNodes(scene, (n) =>
      n.type === 'text' && n.text.length < 30 && n.fontWeight >= 600
    );
    for (const c of ctaLike.slice(0, 1)) {
      result = replaceNode(result, c.id, (n) => n.type === 'text' ? { ...n, text: newText } : n);
      ids.push(c.id);
    }
  }
  return mutResult(result, 'rewrite_cta', { text: newText }, ids, `Rewrote ${ids.length} CTA(s)`);
}

/** Swap typography across all text/button nodes. */
export function swapTypography(scene: SceneDocument, fontFamily: string): MutationResult {
  const resolved = resolveFontFamily(fontFamily);
  const ids: string[] = [];
  let result = scene;

  const textNodes = findNodes(scene, (n) => n.type === 'text' || n.type === 'button');
  for (const node of textNodes) {
    result = replaceNode(result, node.id, (n) => {
      if (n.type === 'text') return { ...n, fontFamily: resolved, fontWeight: resolveFontWeight(resolved, n.fontWeight) };
      if (n.type === 'button') return { ...n, fontFamily: resolved, fontWeight: resolveFontWeight(resolved, n.fontWeight) };
      return n;
    });
    ids.push(node.id);
  }
  return mutResult(result, 'swap_typography', { fontFamily }, ids, `Swapped typography to ${resolved}`);
}

/** Change color direction (primary/accent) across the scene. */
export function changeColorDirection(
  scene: SceneDocument,
  primaryColor: string,
  accentColor?: string
): MutationResult {
  const primary = sanitizeColor(primaryColor);
  const accent = accentColor ? sanitizeColor(accentColor) : primary;
  const ids: string[] = [];
  let result = { ...scene, background: primary };

  // Update shape/frame/button fills
  const fillNodes = findNodes(scene, (n) =>
    n.type === 'shape' || n.type === 'frame' || n.type === 'button'
  );
  for (const node of fillNodes) {
    ids.push(node.id);
    result = replaceNode(result, node.id, (n) => ({ ...n, fill: accent }) as SceneNode);
  }
  return mutResult(result, 'change_color_direction', { primaryColor, accentColor: accent }, ids, `Changed color direction`);
}

/** Adjust spacing globally by a multiplier. */
export function adjustSpacing(scene: SceneDocument, multiplier: number): MutationResult {
  const m = Math.max(0.5, Math.min(2, multiplier));
  const cx = scene.width / 2;
  const cy = scene.height / 2;
  const ids: string[] = [];

  const newNodes = scene.nodes.map((node) => {
    // Move nodes toward/away from center
    const dx = node.x + node.width / 2 - cx;
    const dy = node.y + node.height / 2 - cy;
    const newX = cx + dx * m - node.width / 2;
    const newY = cy + dy * m - node.height / 2;
    ids.push(node.id);
    return { ...node, x: Math.round(newX), y: Math.round(newY) };
  });

  return mutResult(
    { ...scene, nodes: newNodes },
    'adjust_spacing',
    { spacingMultiplier: m },
    ids,
    `Adjusted spacing by ${m}x`
  );
}

/** Increase visual density — scale up nodes, reduce gaps. */
export function increaseDensity(scene: SceneDocument): MutationResult {
  const scaleFactor = 1.15;
  const ids: string[] = [];
  const newNodes = scene.nodes.map((node) => {
    const newW = Math.round(node.width * scaleFactor);
    const newH = Math.round(node.height * scaleFactor);
    const dx = (newW - node.width) / 2;
    const dy = (newH - node.height) / 2;
    ids.push(node.id);
    return {
      ...node,
      x: Math.round(node.x - dx),
      y: Math.round(node.y - dy),
      width: newW,
      height: newH,
    };
  });
  return mutResult({ ...scene, nodes: newNodes }, 'increase_density', { densityDirection: 'increase' }, ids, 'Increased visual density');
}

/** Simplify composition — remove the lowest-priority nodes. */
export function simplifyComposition(scene: SceneDocument): MutationResult {
  if (scene.nodes.length <= 3) return noopResult(scene, 'simplify_composition', {});

  // Remove small decorative shapes (lowest area, lowest z)
  const sorted = [...scene.nodes].sort((a, b) => (a.width * a.height) - (b.width * b.height));
  const removeCount = Math.max(1, Math.floor(sorted.length * 0.2));
  const toRemove = new Set(sorted.slice(0, removeCount).map((n) => n.id));

  const newNodes = scene.nodes.filter((n) => !toRemove.has(n.id));
  return mutResult(
    { ...scene, nodes: newNodes },
    'simplify_composition',
    {},
    [...toRemove],
    `Removed ${removeCount} low-priority node(s)`
  );
}

/** Boost contrast — darken dark text, lighten light backgrounds. */
export function boostContrast(scene: SceneDocument): MutationResult {
  const ids: string[] = [];
  let result = scene;

  const textNodes = findNodes(scene, (n) => n.type === 'text');
  for (const node of textNodes) {
    result = replaceNode(result, node.id, (n) => {
      if (n.type === 'text') {
        ids.push(n.id);
        return { ...n, color: darkenColor(n.color) };
      }
      return n;
    });
  }
  return mutResult(result, 'boost_contrast', {}, ids, `Boosted contrast on ${ids.length} text node(s)`);
}

// ─── Mutation Chain Builder ──────────────────────────────────

/**
 * Apply a chain of mutations sequentially.
 * Each mutation receives the output of the previous one.
 */
export function applyMutationChain(
  scene: SceneDocument,
  mutations: Array<{ id: MutationId; params: MutationParams }>
): MutationChain {
  const steps: MutationResult[] = [];
  let current = scene;

  for (const { id, params } of mutations) {
    const result = applyMutation(current, id, params);
    steps.push(result);
    current = result.scene;
  }

  return {
    steps,
    originalScene: scene,
    finalScene: current,
  };
}

/**
 * Apply a single named mutation.
 */
export function applyMutation(
  scene: SceneDocument,
  mutationId: MutationId,
  params: MutationParams
): MutationResult {
  switch (mutationId) {
    case 'replace_headline':
      return replaceHeadline(scene, params.text || '');
    case 'rewrite_cta':
      return rewriteCta(scene, params.text || '');
    case 'swap_typography':
      return swapTypography(scene, params.fontFamily || 'Inter');
    case 'change_color_direction':
      return changeColorDirection(scene, params.primaryColor || '#000000', params.accentColor);
    case 'adjust_spacing':
      return adjustSpacing(scene, params.spacingMultiplier || 1);
    case 'increase_density':
      return increaseDensity(scene);
    case 'simplify_composition':
      return simplifyComposition(scene);
    case 'boost_contrast':
      return boostContrast(scene);
    default:
      return noopResult(scene, mutationId, params);
  }
}

// ─── Helpers ──────────────────────────────────────────────────

function mutResult(
  scene: SceneDocument,
  mutationId: MutationId,
  params: MutationParams,
  changedNodeIds: string[],
  summary: string
): MutationResult {
  return { scene, mutationId, params, changedNodeIds, summary, timestamp: Date.now() };
}

function noopResult(scene: SceneDocument, mutationId: MutationId, params: MutationParams): MutationResult {
  return { scene, mutationId, params, changedNodeIds: [], summary: 'No changes applied', timestamp: Date.now() };
}

function darkenColor(color: string): string {
  if (!color.startsWith('#') || color.length < 7) return color;
  try {
    const r = Math.max(0, parseInt(color.slice(1, 3), 16) - 30);
    const g = Math.max(0, parseInt(color.slice(3, 5), 16) - 30);
    const b = Math.max(0, parseInt(color.slice(5, 7), 16) - 30);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  } catch {
    return color;
  }
}
