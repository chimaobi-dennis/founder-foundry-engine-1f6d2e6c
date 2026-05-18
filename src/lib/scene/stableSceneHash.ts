/**
 * stableSceneHash.ts
 *
 * Deterministic hashing for SceneDocument.
 * Used for caching, export deduplication, undo reliability,
 * and regeneration comparisons.
 *
 * Guarantees:
 *   - Same scene → same hash (deterministic serialization)
 *   - Ignores key ordering in JSON
 *   - Ignores metadata (only hashes structural content)
 */

import type { SceneDocument, SceneNode } from '@/types/scene';

// ─── Deterministic Serialization ─────────────────────────────

/**
 * Serialize a SceneDocument into a deterministic string.
 * Keys are sorted alphabetically at every level.
 * Metadata is excluded — only structural content is hashed.
 */
export function stableSerialize(scene: SceneDocument): string {
  const canonical = {
    version: scene.version,
    width: scene.width,
    height: scene.height,
    background: scene.background,
    nodes: scene.nodes.map(serializeNode),
  };
  return JSON.stringify(canonical, sortedReplacer);
}

function serializeNode(node: SceneNode): Record<string, unknown> {
  const base: Record<string, unknown> = {
    id: node.id,
    type: node.type,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    rotation: node.rotation,
    opacity: node.opacity,
    zIndex: node.zIndex,
  };

  switch (node.type) {
    case 'text':
      return { ...base, text: node.text, fontSize: node.fontSize, fontFamily: node.fontFamily, fontWeight: node.fontWeight, lineHeight: node.lineHeight, letterSpacing: node.letterSpacing, color: node.color, align: node.align };
    case 'image':
      return { ...base, src: node.src, objectFit: node.objectFit, borderRadius: node.borderRadius };
    case 'shape':
      return { ...base, fill: node.fill, stroke: node.stroke, strokeWidth: node.strokeWidth, radius: node.radius };
    case 'group':
      return { ...base, children: node.children.map(serializeNode) };
    case 'frame':
      return { ...base, children: node.children.map(serializeNode), fill: node.fill, stroke: node.stroke, strokeWidth: node.strokeWidth, radius: node.radius, clipContent: node.clipContent };
    case 'stack':
      return { ...base, children: node.children.map(serializeNode), direction: node.direction, gap: node.gap, align: node.align, justify: node.justify, padding: node.padding };
    case 'svg':
      return { ...base, svgContent: node.svgContent, preserveAspectRatio: node.preserveAspectRatio };
    case 'icon':
      return { ...base, iconName: node.iconName, iconLibrary: node.iconLibrary, color: node.color, strokeWidth: node.strokeWidth };
    case 'button':
      return { ...base, label: node.label, fontSize: node.fontSize, fontFamily: node.fontFamily, fontWeight: node.fontWeight, textColor: node.textColor, fill: node.fill, stroke: node.stroke, strokeWidth: node.strokeWidth, radius: node.radius, iconName: node.iconName, iconPosition: node.iconPosition };
    default:
      return base;
  }
}

/**
 * JSON.stringify replacer that sorts object keys alphabetically.
 */
function sortedReplacer(_key: string, value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(value).sort()) {
      sorted[k] = (value as Record<string, unknown>)[k];
    }
    return sorted;
  }
  return value;
}

// ─── Hashing ─────────────────────────────────────────────────

/**
 * Compute a stable hash of a SceneDocument.
 * Uses a fast FNV-1a-like hash for speed (not cryptographic).
 */
export function stableSceneHash(scene: SceneDocument): string {
  const str = stableSerialize(scene);
  return fnv1aHash(str);
}

/**
 * FNV-1a 32-bit hash — fast, deterministic, sufficient for cache keys.
 */
function fnv1aHash(str: string): string {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime
  }
  // Convert to unsigned 32-bit hex
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Check if two scenes are structurally identical (same hash).
 */
export function scenesEqual(a: SceneDocument, b: SceneDocument): boolean {
  return stableSceneHash(a) === stableSceneHash(b);
}
