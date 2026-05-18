/**
 * sceneDiff.ts
 *
 * Compare two SceneDocuments and produce a structured diff.
 * Used for undo/redo optimization, AI edit previews,
 * mutation scoring, and version history.
 */

import type { SceneDocument, SceneNode } from '@/types/scene';

// ─── Diff Types ───────────────────────────────────────────────

export type DiffChangeType = 'added' | 'removed' | 'modified' | 'moved' | 'resized' | 'retyped';

export interface NodeDiff {
  nodeId: string;
  changeType: DiffChangeType;
  /** Which fields changed (for 'modified'). */
  changedFields: string[];
  /** Old values for changed fields. */
  oldValues: Record<string, unknown>;
  /** New values for changed fields. */
  newValues: Record<string, unknown>;
}

export interface SceneDiffResult {
  /** Were there any changes? */
  hasChanges: boolean;
  /** Document-level changes. */
  documentChanges: string[];
  /** Per-node diffs. */
  nodeDiffs: NodeDiff[];
  /** Summary stats. */
  stats: {
    added: number;
    removed: number;
    modified: number;
    moved: number;
    resized: number;
    unchanged: number;
  };
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Compute a structured diff between two scenes.
 */
export function diffScenes(before: SceneDocument, after: SceneDocument): SceneDiffResult {
  const documentChanges: string[] = [];
  const nodeDiffs: NodeDiff[] = [];

  // Document-level changes
  if (before.width !== after.width) documentChanges.push(`width: ${before.width} → ${after.width}`);
  if (before.height !== after.height) documentChanges.push(`height: ${before.height} → ${after.height}`);
  if (before.background !== after.background) documentChanges.push(`background: ${before.background} → ${after.background}`);
  if (before.version !== after.version) documentChanges.push(`version: ${before.version} → ${after.version}`);

  // Build node maps
  const beforeMap = buildNodeMap(before.nodes);
  const afterMap = buildNodeMap(after.nodes);

  // Detect removed nodes
  for (const [id, node] of beforeMap) {
    if (!afterMap.has(id)) {
      nodeDiffs.push({
        nodeId: id,
        changeType: 'removed',
        changedFields: [],
        oldValues: flattenNode(node),
        newValues: {},
      });
    }
  }

  // Detect added and modified nodes
  for (const [id, afterNode] of afterMap) {
    const beforeNode = beforeMap.get(id);
    if (!beforeNode) {
      nodeDiffs.push({
        nodeId: id,
        changeType: 'added',
        changedFields: [],
        oldValues: {},
        newValues: flattenNode(afterNode),
      });
      continue;
    }

    // Compare nodes
    const diff = diffNodes(beforeNode, afterNode);
    if (diff) nodeDiffs.push(diff);
  }

  const stats = {
    added: nodeDiffs.filter((d) => d.changeType === 'added').length,
    removed: nodeDiffs.filter((d) => d.changeType === 'removed').length,
    modified: nodeDiffs.filter((d) => d.changeType === 'modified').length,
    moved: nodeDiffs.filter((d) => d.changeType === 'moved').length,
    resized: nodeDiffs.filter((d) => d.changeType === 'resized').length,
    unchanged: afterMap.size - nodeDiffs.filter((d) => d.changeType !== 'removed').length,
  };

  return {
    hasChanges: documentChanges.length > 0 || nodeDiffs.length > 0,
    documentChanges,
    nodeDiffs,
    stats,
  };
}

/**
 * Quick check: did anything change between two scenes?
 */
export function scenesChanged(before: SceneDocument, after: SceneDocument): boolean {
  return diffScenes(before, after).hasChanges;
}

/**
 * Get a human-readable summary of changes.
 */
export function diffSummary(diff: SceneDiffResult): string {
  const parts: string[] = [];
  if (diff.stats.added > 0) parts.push(`${diff.stats.added} added`);
  if (diff.stats.removed > 0) parts.push(`${diff.stats.removed} removed`);
  if (diff.stats.modified > 0) parts.push(`${diff.stats.modified} modified`);
  if (diff.stats.moved > 0) parts.push(`${diff.stats.moved} moved`);
  if (diff.stats.resized > 0) parts.push(`${diff.stats.resized} resized`);
  if (diff.documentChanges.length > 0) parts.push(`${diff.documentChanges.length} doc-level change(s)`);
  return parts.length > 0 ? parts.join(', ') : 'No changes';
}

// ─── Internal ─────────────────────────────────────────────────

function buildNodeMap(nodes: SceneNode[]): Map<string, SceneNode> {
  const map = new Map<string, SceneNode>();
  function walk(list: SceneNode[]) {
    for (const node of list) {
      map.set(node.id, node);
      if ('children' in node && Array.isArray(node.children)) {
        walk(node.children);
      }
    }
  }
  walk(nodes);
  return map;
}

function diffNodes(before: SceneNode, after: SceneNode): NodeDiff | null {
  const changedFields: string[] = [];
  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};

  const beforeFlat = flattenNode(before);
  const afterFlat = flattenNode(after);

  const allKeys = new Set([...Object.keys(beforeFlat), ...Object.keys(afterFlat)]);
  for (const key of allKeys) {
    if (key === 'children') continue; // children handled recursively
    const bVal = JSON.stringify(beforeFlat[key]);
    const aVal = JSON.stringify(afterFlat[key]);
    if (bVal !== aVal) {
      changedFields.push(key);
      oldValues[key] = beforeFlat[key];
      newValues[key] = afterFlat[key];
    }
  }

  if (changedFields.length === 0) return null;

  // Classify change type
  let changeType: DiffChangeType = 'modified';
  const posChanged = changedFields.includes('x') || changedFields.includes('y');
  const sizeChanged = changedFields.includes('width') || changedFields.includes('height');
  const onlyPos = changedFields.every((f) => f === 'x' || f === 'y');
  const onlySize = changedFields.every((f) => f === 'width' || f === 'height');

  if (changedFields.includes('type')) changeType = 'retyped';
  else if (onlyPos) changeType = 'moved';
  else if (onlySize) changeType = 'resized';
  else if (posChanged || sizeChanged) changeType = 'modified';

  return { nodeId: before.id, changeType, changedFields, oldValues, newValues };
}

function flattenNode(node: SceneNode): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === 'children') continue;
    flat[key] = value;
  }
  return flat;
}
