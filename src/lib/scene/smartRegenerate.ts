/**
 * smartRegenerate.ts
 *
 * Selective regeneration system.
 * Regenerates only targeted sections while preserving
 * approved regions, typography, layout, and imagery.
 */

import type { SceneDocument, SceneNode } from '@/types/scene';
import { findNodes, removeNode, addNode } from './mutations/mutateNode';
import { stableSceneHash } from './stableSceneHash';

// ─── Types ────────────────────────────────────────────────────

export type RegenerateScope =
  | 'cta_only'
  | 'hero_only'
  | 'headline_only'
  | 'body_only'
  | 'visual_direction'
  | 'tone_shift'
  | 'selected_nodes'
  | 'full';

export interface RegenerateRequest {
  scope: RegenerateScope;
  /** IDs of nodes to preserve (everything else may be regenerated). */
  preserveNodeIds?: string[];
  /** IDs of specific nodes to regenerate. */
  regenerateNodeIds?: string[];
  /** New content to inject. */
  newContent?: {
    headline?: string;
    body?: string;
    ctaText?: string;
    imageSrc?: string;
  };
  /** Visual direction hint. */
  toneHint?: string;
}

export interface RegenerateContext {
  /** The scene being edited. */
  scene: SceneDocument;
  /** The request. */
  request: RegenerateRequest;
  /** Preserved nodes (locked). */
  preservedNodes: SceneNode[];
  /** Nodes to regenerate. */
  targetNodes: SceneNode[];
  /** Layout skeleton (position + size of all existing nodes). */
  layoutSkeleton: LayoutSlot[];
  /** Scene hash before regeneration. */
  hashBefore: string;
}

export interface LayoutSlot {
  nodeId: string;
  type: SceneNode['type'];
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  preserved: boolean;
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Build a regeneration context.
 * This extracts what to preserve, what to regenerate,
 * and the layout skeleton for the AI to fill.
 */
export function buildRegenerateContext(
  scene: SceneDocument,
  request: RegenerateRequest
): RegenerateContext {
  const preserveIds = new Set(request.preserveNodeIds || []);
  const regenIds = new Set(request.regenerateNodeIds || []);

  // Decide which nodes to preserve vs regenerate based on scope
  const { preserved, targets } = classifyNodes(scene, request.scope, preserveIds, regenIds);

  const layoutSkeleton: LayoutSlot[] = scene.nodes.map((n) => ({
    nodeId: n.id,
    type: n.type,
    x: n.x,
    y: n.y,
    width: n.width,
    height: n.height,
    zIndex: n.zIndex,
    preserved: preserved.some((p) => p.id === n.id),
  }));

  return {
    scene,
    request,
    preservedNodes: preserved,
    targetNodes: targets,
    layoutSkeleton,
    hashBefore: stableSceneHash(scene),
  };
}

/**
 * Apply regenerated nodes back into the scene.
 * Preserved nodes stay. Target nodes are replaced with new ones.
 */
export function applyRegeneratedNodes(
  context: RegenerateContext,
  newNodes: SceneNode[]
): SceneDocument {
  let scene = context.scene;

  // Remove target nodes
  for (const target of context.targetNodes) {
    scene = removeNode(scene, target.id);
  }

  // Add new nodes
  for (const node of newNodes) {
    scene = addNode(scene, node);
  }

  return scene;
}

/**
 * Build a prompt fragment describing what should be regenerated.
 * Used by the prompt compiler to guide AI generation.
 */
export function regenerateToPromptBlock(context: RegenerateContext): string {
  const lines: string[] = [
    'SELECTIVE REGENERATION REQUEST:',
    `  Scope: ${context.request.scope}`,
    `  Preserved nodes: ${context.preservedNodes.length}`,
    `  Target nodes: ${context.targetNodes.length}`,
    '',
    'PRESERVED LAYOUT (do NOT move or resize these):',
  ];

  for (const slot of context.layoutSkeleton.filter((s) => s.preserved)) {
    lines.push(`  [${slot.type}] id=${slot.nodeId} at (${slot.x},${slot.y}) size ${slot.width}×${slot.height}`);
  }

  lines.push('', 'SLOTS TO FILL (regenerate these):');
  for (const slot of context.layoutSkeleton.filter((s) => !s.preserved)) {
    lines.push(`  [${slot.type}] at (${slot.x},${slot.y}) size ${slot.width}×${slot.height}`);
  }

  if (context.request.newContent) {
    lines.push('', 'NEW CONTENT:');
    const c = context.request.newContent;
    if (c.headline) lines.push(`  Headline: "${c.headline}"`);
    if (c.body) lines.push(`  Body: "${c.body}"`);
    if (c.ctaText) lines.push(`  CTA: "${c.ctaText}"`);
    if (c.imageSrc) lines.push(`  Image: ${c.imageSrc}`);
  }

  if (context.request.toneHint) {
    lines.push('', `TONE: ${context.request.toneHint}`);
  }

  return lines.join('\n');
}

// ─── Internal ─────────────────────────────────────────────────

function classifyNodes(
  scene: SceneDocument,
  scope: RegenerateScope,
  preserveIds: Set<string>,
  regenIds: Set<string>
): { preserved: SceneNode[]; targets: SceneNode[] } {
  const allNodes = flattenNodes(scene.nodes);

  // If explicit regen IDs provided, use those
  if (regenIds.size > 0) {
    const targets = allNodes.filter((n) => regenIds.has(n.id));
    const preserved = allNodes.filter((n) => !regenIds.has(n.id));
    return { preserved, targets };
  }

  // If explicit preserve IDs provided, everything else is a target
  if (preserveIds.size > 0) {
    const preserved = allNodes.filter((n) => preserveIds.has(n.id));
    const targets = allNodes.filter((n) => !preserveIds.has(n.id));
    return { preserved, targets };
  }

  // Scope-based classification
  switch (scope) {
    case 'cta_only': {
      const targets = findNodes(scene, (n) => n.type === 'button');
      const preserved = allNodes.filter((n) => !targets.some((t) => t.id === n.id));
      return { preserved, targets };
    }
    case 'hero_only': {
      const targets = findNodes(scene, (n) => n.type === 'image' && n.width > scene.width * 0.5);
      const preserved = allNodes.filter((n) => !targets.some((t) => t.id === n.id));
      return { preserved, targets };
    }
    case 'headline_only': {
      const textNodes = findNodes(scene, (n) => n.type === 'text') as Array<SceneNode & { fontSize: number }>;
      if (textNodes.length === 0) return { preserved: allNodes, targets: [] };
      const maxSize = Math.max(...textNodes.map((n) => n.fontSize));
      const headlines = textNodes.filter((n) => n.fontSize >= maxSize * 0.85);
      const preserved = allNodes.filter((n) => !headlines.some((h) => h.id === n.id));
      return { preserved, targets: headlines };
    }
    case 'body_only': {
      const textNodes = findNodes(scene, (n) => n.type === 'text') as Array<SceneNode & { fontSize: number }>;
      if (textNodes.length === 0) return { preserved: allNodes, targets: [] };
      const maxSize = Math.max(...textNodes.map((n) => n.fontSize));
      const body = textNodes.filter((n) => n.fontSize < maxSize * 0.85);
      const preserved = allNodes.filter((n) => !body.some((b) => b.id === n.id));
      return { preserved, targets: body };
    }
    case 'visual_direction':
    case 'tone_shift':
      // Preserve layout (positions), regenerate content
      return { preserved: [], targets: allNodes };
    case 'full':
      return { preserved: [], targets: allNodes };
    case 'selected_nodes':
      return { preserved: allNodes, targets: [] };
    default:
      return { preserved: allNodes, targets: [] };
  }
}

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
