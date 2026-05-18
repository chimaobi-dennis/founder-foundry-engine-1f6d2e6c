import { useMemo, useRef, useCallback } from "react";
import type { SceneDocument, SceneNode } from "@/types/scene";

/**
 * Memoized sorted node list — avoids re-sorting on every render.
 */
export function useSortedNodes(document: SceneDocument) {
  return useMemo(
    () => [...document.nodes].sort((a, b) => a.zIndex - b.zIndex),
    [document.nodes]
  );
}

/**
 * Debounced scene update callback.
 * Prevents excessive updates during rapid drag/resize.
 */
export function useDebouncedUpdate(fn: (...args: unknown[]) => void, delayMs = 16) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  return useCallback(
    (...args: unknown[]) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => fn(...args), delayMs);
    },
    [fn, delayMs]
  );
}

/**
 * Intersection-based visibility for layer panel items.
 * Returns a Set of node IDs that are currently in viewport.
 */
export function useVisibleNodeIds(
  nodes: SceneNode[],
  viewportWidth: number,
  viewportHeight: number,
  pan: { x: number; y: number },
  zoom: number,
  margin = 100
): Set<string> {
  return useMemo(() => {
    const visible = new Set<string>();
    const vx = -pan.x / zoom - margin;
    const vy = -pan.y / zoom - margin;
    const vw = viewportWidth / zoom + margin * 2;
    const vh = viewportHeight / zoom + margin * 2;

    for (const node of nodes) {
      if (
        node.x + node.width >= vx &&
        node.x <= vx + vw &&
        node.y + node.height >= vy &&
        node.y <= vy + vh
      ) {
        visible.add(node.id);
      }
    }

    return visible;
  }, [nodes, viewportWidth, viewportHeight, pan.x, pan.y, zoom, margin]);
}

/**
 * Estimates whether the scene needs performance optimizations.
 */
export function useSceneComplexity(document: SceneDocument) {
  return useMemo(() => {
    const nodeCount = document.nodes.length;
    const imageCount = document.nodes.filter((n) => n.type === "image").length;

    return {
      nodeCount,
      imageCount,
      isComplex: nodeCount > 30 || imageCount > 8,
      shouldVirtualize: nodeCount > 50,
      shouldReduceMotion: nodeCount > 40,
    };
  }, [document.nodes]);
}
