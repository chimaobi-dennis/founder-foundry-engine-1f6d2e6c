/**
 * mutateNode.ts
 *
 * Immutable node-level transformations.
 * Every function returns a new node — never mutates the original.
 */

import type { SceneNode, SceneDocument } from '@/types/scene';
import { resolveFontFamily, resolveFontWeight } from '@/lib/fonts/fontRegistry';
import { sanitizeColor } from '@/lib/scene/validateSceneDocument';

// ─── Node Lookup ──────────────────────────────────────────────

/** Find a node by ID in a scene (deep search). */
export function findNode(scene: SceneDocument, nodeId: string): SceneNode | null {
  function search(nodes: SceneNode[]): SceneNode | null {
    for (const node of nodes) {
      if (node.id === nodeId) return node;
      if ('children' in node && Array.isArray(node.children)) {
        const found = search(node.children);
        if (found) return found;
      }
    }
    return null;
  }
  return search(scene.nodes);
}

/** Find all nodes matching a predicate. */
export function findNodes(scene: SceneDocument, predicate: (n: SceneNode) => boolean): SceneNode[] {
  const result: SceneNode[] = [];
  function walk(nodes: SceneNode[]) {
    for (const node of nodes) {
      if (predicate(node)) result.push(node);
      if ('children' in node && Array.isArray(node.children)) walk(node.children);
    }
  }
  walk(scene.nodes);
  return result;
}

// ─── Immutable Node Replace ───────────────────────────────────

/**
 * Replace a node by ID in the scene tree, returning a new scene.
 * Supports deep replacement inside groups/frames/stacks.
 */
export function replaceNode(
  scene: SceneDocument,
  nodeId: string,
  updater: (node: SceneNode) => SceneNode
): SceneDocument {
  return {
    ...scene,
    nodes: replaceInList(scene.nodes, nodeId, updater),
  };
}

function replaceInList(
  nodes: SceneNode[],
  nodeId: string,
  updater: (node: SceneNode) => SceneNode
): SceneNode[] {
  return nodes.map((node) => {
    if (node.id === nodeId) return updater(node);
    if ('children' in node && Array.isArray(node.children)) {
      const newChildren = replaceInList(node.children, nodeId, updater);
      if (newChildren !== node.children) {
        return { ...node, children: newChildren } as SceneNode;
      }
    }
    return node;
  });
}

/** Remove a node by ID from the scene tree. */
export function removeNode(scene: SceneDocument, nodeId: string): SceneDocument {
  return {
    ...scene,
    nodes: removeFromList(scene.nodes, nodeId),
  };
}

function removeFromList(nodes: SceneNode[], nodeId: string): SceneNode[] {
  return nodes
    .filter((n) => n.id !== nodeId)
    .map((node) => {
      if ('children' in node && Array.isArray(node.children)) {
        return { ...node, children: removeFromList(node.children, nodeId) } as SceneNode;
      }
      return node;
    });
}

/** Add a node to the scene's root node list. */
export function addNode(scene: SceneDocument, node: SceneNode): SceneDocument {
  return {
    ...scene,
    nodes: [...scene.nodes, node],
  };
}

/** Add a child node inside a parent group/frame/stack. */
export function addChildNode(
  scene: SceneDocument,
  parentId: string,
  child: SceneNode
): SceneDocument {
  return replaceNode(scene, parentId, (parent) => {
    if ('children' in parent && Array.isArray(parent.children)) {
      return { ...parent, children: [...parent.children, child] } as SceneNode;
    }
    return parent;
  });
}

// ─── Text Mutations ───────────────────────────────────────────

/** Update text content of a text node. */
export function updateText(scene: SceneDocument, nodeId: string, text: string): SceneDocument {
  return replaceNode(scene, nodeId, (node) => {
    if (node.type === 'text') return { ...node, text };
    if (node.type === 'button') return { ...node, label: text };
    return node;
  });
}

/** Update font family of text/button nodes. */
export function updateFontFamily(
  scene: SceneDocument,
  nodeId: string,
  fontFamily: string
): SceneDocument {
  const resolved = resolveFontFamily(fontFamily);
  return replaceNode(scene, nodeId, (node) => {
    if (node.type === 'text') {
      return { ...node, fontFamily: resolved, fontWeight: resolveFontWeight(resolved, node.fontWeight) };
    }
    if (node.type === 'button') {
      return { ...node, fontFamily: resolved, fontWeight: resolveFontWeight(resolved, node.fontWeight) };
    }
    return node;
  });
}

/** Update font size of a text node. */
export function updateFontSize(scene: SceneDocument, nodeId: string, fontSize: number): SceneDocument {
  return replaceNode(scene, nodeId, (node) => {
    if (node.type === 'text') return { ...node, fontSize: Math.max(1, fontSize) };
    if (node.type === 'button') return { ...node, fontSize: Math.max(1, fontSize) };
    return node;
  });
}

// ─── Color Mutations ──────────────────────────────────────────

/** Update the fill color of a shape/frame/button. */
export function updateFill(scene: SceneDocument, nodeId: string, fill: string): SceneDocument {
  return replaceNode(scene, nodeId, (node) => {
    if ('fill' in node) return { ...node, fill: sanitizeColor(fill) };
    return node;
  });
}

/** Update text color. */
export function updateTextColor(scene: SceneDocument, nodeId: string, color: string): SceneDocument {
  return replaceNode(scene, nodeId, (node) => {
    if (node.type === 'text') return { ...node, color: sanitizeColor(color) };
    if (node.type === 'button') return { ...node, textColor: sanitizeColor(color) };
    if (node.type === 'icon') return { ...node, color: sanitizeColor(color) };
    return node;
  });
}

// ─── Transform Mutations ─────────────────────────────────────

/** Resize a node. */
export function resizeNode(
  scene: SceneDocument,
  nodeId: string,
  width: number,
  height: number
): SceneDocument {
  return replaceNode(scene, nodeId, (node) => ({
    ...node,
    width: Math.max(1, width),
    height: Math.max(1, height),
  }));
}

/** Reposition a node. */
export function repositionNode(
  scene: SceneDocument,
  nodeId: string,
  x: number,
  y: number
): SceneDocument {
  return replaceNode(scene, nodeId, (node) => ({ ...node, x, y }));
}

/** Update node opacity. */
export function updateOpacity(scene: SceneDocument, nodeId: string, opacity: number): SceneDocument {
  return replaceNode(scene, nodeId, (node) => ({
    ...node,
    opacity: Math.max(0, Math.min(1, opacity)),
  }));
}

/** Update node rotation. */
export function updateRotation(scene: SceneDocument, nodeId: string, rotation: number): SceneDocument {
  return replaceNode(scene, nodeId, (node) => ({ ...node, rotation }));
}

/** Update node z-index. */
export function updateZIndex(scene: SceneDocument, nodeId: string, zIndex: number): SceneDocument {
  return replaceNode(scene, nodeId, (node) => ({ ...node, zIndex }));
}
