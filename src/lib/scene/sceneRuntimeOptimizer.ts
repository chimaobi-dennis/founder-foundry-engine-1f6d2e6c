/**
 * sceneRuntimeOptimizer.ts
 *
 * Performance runtime for smooth editing with large scenes.
 * Lazy node rendering prep, viewport culling, export batching,
 * image memory cleanup, cache invalidation, and mutation batching.
 */

import type { SceneDocument, SceneNode } from '@/types/scene';
import { stableSceneHash } from './stableSceneHash';

// ─── Types ────────────────────────────────────────────────────

export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
}

export interface CullingResult {
  visibleNodes: SceneNode[];
  culledCount: number;
  totalCount: number;
}

export interface RenderCache {
  hash: string;
  timestamp: number;
}

export interface MutationBatch {
  operations: Array<() => SceneDocument>;
  scene: SceneDocument;
}

// ─── Viewport Culling ────────────────────────────────────────

/**
 * Determine which nodes are visible in the current viewport.
 * Nodes outside the viewport can be skipped during interactive rendering.
 */
export function cullToViewport(scene: SceneDocument, viewport: Viewport): CullingResult {
  const margin = 50; // px margin to avoid pop-in
  const vx = viewport.x - margin;
  const vy = viewport.y - margin;
  const vw = viewport.width / viewport.zoom + margin * 2;
  const vh = viewport.height / viewport.zoom + margin * 2;

  const visibleNodes: SceneNode[] = [];
  let culledCount = 0;

  function walk(nodes: SceneNode[]) {
    for (const node of nodes) {
      if (isInViewport(node, vx, vy, vw, vh)) {
        visibleNodes.push(node);
        if ('children' in node && Array.isArray(node.children)) {
          walk(node.children);
        }
      } else {
        culledCount++;
      }
    }
  }

  walk(scene.nodes);

  return {
    visibleNodes,
    culledCount,
    totalCount: visibleNodes.length + culledCount,
  };
}

function isInViewport(node: SceneNode, vx: number, vy: number, vw: number, vh: number): boolean {
  return !(node.x + node.width < vx || node.x > vx + vw ||
           node.y + node.height < vy || node.y > vy + vh);
}

// ─── Render Cache ────────────────────────────────────────────

/**
 * Simple render cache that tracks scene hashes.
 * If the hash hasn't changed, the cached render is still valid.
 */
export class SceneRenderCache {
  private cache = new Map<string, RenderCache>();
  private maxEntries: number;

  constructor(maxEntries = 20) {
    this.maxEntries = maxEntries;
  }

  /** Check if a scene render is cached and still valid. */
  isValid(scene: SceneDocument, key = 'default'): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    return entry.hash === stableSceneHash(scene);
  }

  /** Mark a scene as rendered (update cache). */
  mark(scene: SceneDocument, key = 'default'): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxEntries) {
      const oldest = [...this.cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      if (oldest) this.cache.delete(oldest[0]);
    }

    this.cache.set(key, {
      hash: stableSceneHash(scene),
      timestamp: Date.now(),
    });
  }

  /** Invalidate a specific cache entry. */
  invalidate(key = 'default'): void {
    this.cache.delete(key);
  }

  /** Invalidate all cache entries. */
  invalidateAll(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

// ─── Image Memory Manager ────────────────────────────────────

/**
 * Tracks loaded image objects and provides cleanup.
 * Prevents memory leaks from accumulated image loads.
 */
export class ImageMemoryManager {
  private urls = new Set<string>();
  private objectUrls = new Set<string>();
  private maxImages: number;

  constructor(maxImages = 50) {
    this.maxImages = maxImages;
  }

  /** Register an image URL as loaded. */
  register(url: string): void {
    this.urls.add(url);
  }

  /** Register a blob object URL (needs explicit revocation). */
  registerObjectUrl(url: string): void {
    this.objectUrls.add(url);
  }

  /** Revoke all object URLs and clear tracking. */
  cleanup(): void {
    for (const url of this.objectUrls) {
      try { URL.revokeObjectURL(url); } catch { /* noop */ }
    }
    this.objectUrls.clear();
    this.urls.clear();
  }

  /** Check if we're approaching the memory limit. */
  isNearLimit(): boolean {
    return this.urls.size + this.objectUrls.size >= this.maxImages;
  }

  get loadedCount(): number {
    return this.urls.size + this.objectUrls.size;
  }
}

// ─── Mutation Batching ───────────────────────────────────────

/**
 * Batch multiple mutations into a single scene update.
 * Reduces intermediate renders and history snapshots.
 */
export class MutationBatcher {
  private operations: Array<(scene: SceneDocument) => SceneDocument> = [];
  private baseScene: SceneDocument;

  constructor(scene: SceneDocument) {
    this.baseScene = scene;
  }

  /** Queue a mutation. */
  add(mutation: (scene: SceneDocument) => SceneDocument): this {
    this.operations.push(mutation);
    return this;
  }

  /** Apply all queued mutations and return the final scene. */
  flush(): SceneDocument {
    let scene = this.baseScene;
    for (const op of this.operations) {
      scene = op(scene);
    }
    this.operations = [];
    return scene;
  }

  /** Discard all queued mutations. */
  discard(): void {
    this.operations = [];
  }

  get pendingCount(): number {
    return this.operations.length;
  }
}

// ─── Scene Complexity ────────────────────────────────────────

/**
 * Estimate scene rendering complexity.
 * Used to decide rendering strategy (full vs progressive).
 */
export function estimateComplexity(scene: SceneDocument): {
  nodeCount: number;
  imageCount: number;
  textCount: number;
  depth: number;
  complexity: 'low' | 'medium' | 'high';
} {
  let imageCount = 0;
  let textCount = 0;
  let maxDepth = 0;

  function walk(nodes: SceneNode[], depth: number) {
    maxDepth = Math.max(maxDepth, depth);
    for (const node of nodes) {
      if (node.type === 'image') imageCount++;
      if (node.type === 'text') textCount++;
      if ('children' in node && Array.isArray(node.children)) {
        walk(node.children, depth + 1);
      }
    }
  }

  walk(scene.nodes, 0);

  const nodeCount = scene.nodes.length;
  const complexity =
    nodeCount > 50 || imageCount > 10 ? 'high' :
    nodeCount > 20 || imageCount > 5 ? 'medium' : 'low';

  return { nodeCount, imageCount, textCount, depth: maxDepth, complexity };
}
