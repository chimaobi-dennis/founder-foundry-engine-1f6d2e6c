/**
 * scenePatchEngine.ts
 *
 * Patch-based node-level AI editing.
 * The AI edits ONLY selected nodes — never regenerates entire scenes.
 *
 * Input:  selected node IDs + instruction + scene context
 * Output: JSON patch operations applied immutably
 */

import type { SceneDocument, SceneNode } from '@/types/scene';
import { replaceNode, removeNode, addNode, addChildNode, findNode } from './mutations/mutateNode';

// ─── Patch Operation Types ───────────────────────────────────

export type PatchOp =
  | PatchUpdate
  | PatchResize
  | PatchReposition
  | PatchReplace
  | PatchAddChild
  | PatchRemove
  | PatchRegroup;

export interface PatchUpdate {
  op: 'update';
  nodeId: string;
  fields: Partial<Record<string, unknown>>;
}

export interface PatchResize {
  op: 'resize';
  nodeId: string;
  width: number;
  height: number;
}

export interface PatchReposition {
  op: 'reposition';
  nodeId: string;
  x: number;
  y: number;
}

export interface PatchReplace {
  op: 'replace';
  nodeId: string;
  newNode: SceneNode;
}

export interface PatchAddChild {
  op: 'add_child';
  parentId: string;
  child: SceneNode;
}

export interface PatchRemove {
  op: 'remove';
  nodeId: string;
}

export interface PatchRegroup {
  op: 'regroup';
  nodeIds: string[];
  groupId: string;
}

// ─── Patch Result ─────────────────────────────────────────────

export interface PatchResult {
  scene: SceneDocument;
  appliedOps: number;
  failedOps: number;
  errors: string[];
}

// ─── Patch Application ───────────────────────────────────────

/**
 * Apply a list of patch operations to a scene.
 * Operations are applied sequentially. Failed ops are logged and skipped.
 */
export function applyPatches(scene: SceneDocument, patches: PatchOp[]): PatchResult {
  let current = scene;
  let appliedOps = 0;
  let failedOps = 0;
  const errors: string[] = [];

  for (const patch of patches) {
    try {
      current = applySinglePatch(current, patch);
      appliedOps++;
    } catch (err) {
      failedOps++;
      errors.push(`[${patch.op}] ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { scene: current, appliedOps, failedOps, errors };
}

function applySinglePatch(scene: SceneDocument, patch: PatchOp): SceneDocument {
  switch (patch.op) {
    case 'update':
      return applyUpdate(scene, patch);
    case 'resize':
      return replaceNode(scene, patch.nodeId, (n) => ({
        ...n,
        width: Math.max(1, patch.width),
        height: Math.max(1, patch.height),
      }));
    case 'reposition':
      return replaceNode(scene, patch.nodeId, (n) => ({
        ...n,
        x: patch.x,
        y: patch.y,
      }));
    case 'replace':
      return replaceNode(scene, patch.nodeId, () => patch.newNode);
    case 'add_child':
      return addChildNode(scene, patch.parentId, patch.child);
    case 'remove':
      return removeNode(scene, patch.nodeId);
    case 'regroup':
      return applyRegroup(scene, patch);
    default:
      return scene;
  }
}

function applyUpdate(scene: SceneDocument, patch: PatchUpdate): SceneDocument {
  return replaceNode(scene, patch.nodeId, (node) => {
    const updated = { ...node };
    for (const [key, value] of Object.entries(patch.fields)) {
      if (key !== 'id' && key !== 'type' && value !== undefined) {
        (updated as Record<string, unknown>)[key] = value;
      }
    }
    return updated as SceneNode;
  });
}

function applyRegroup(scene: SceneDocument, patch: PatchRegroup): SceneDocument {
  const nodeSet = new Set(patch.nodeIds);
  const collected: SceneNode[] = [];

  // Collect nodes to group
  for (const id of patch.nodeIds) {
    const node = findNode(scene, id);
    if (node) collected.push(node);
  }

  if (collected.length === 0) return scene;

  // Remove collected nodes from tree
  let result = scene;
  for (const id of patch.nodeIds) {
    result = removeNode(result, id);
  }

  // Calculate group bounds
  const minX = Math.min(...collected.map((n) => n.x));
  const minY = Math.min(...collected.map((n) => n.y));
  const maxX = Math.max(...collected.map((n) => n.x + n.width));
  const maxY = Math.max(...collected.map((n) => n.y + n.height));

  // Offset children relative to group
  const children = collected.map((n) => ({
    ...n,
    x: n.x - minX,
    y: n.y - minY,
  }));

  const groupNode: SceneNode = {
    id: patch.groupId,
    type: 'group',
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    rotation: 0,
    opacity: 1,
    zIndex: Math.max(...collected.map((n) => n.zIndex)),
    children,
  };

  return addNode(result, groupNode);
}

// ─── Patch Builders ──────────────────────────────────────────

/** Convenience: build an update patch. */
export function patchUpdate(nodeId: string, fields: Partial<Record<string, unknown>>): PatchUpdate {
  return { op: 'update', nodeId, fields };
}

/** Convenience: build a resize patch. */
export function patchResize(nodeId: string, width: number, height: number): PatchResize {
  return { op: 'resize', nodeId, width, height };
}

/** Convenience: build a reposition patch. */
export function patchReposition(nodeId: string, x: number, y: number): PatchReposition {
  return { op: 'reposition', nodeId, x, y };
}

/** Convenience: build a remove patch. */
export function patchRemove(nodeId: string): PatchRemove {
  return { op: 'remove', nodeId };
}
