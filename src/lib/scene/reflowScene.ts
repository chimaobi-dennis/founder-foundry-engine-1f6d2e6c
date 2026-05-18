/**
 * reflowScene.ts
 *
 * Responsive reflow engine for multi-platform generation.
 * Converts scenes between aspect ratios while preserving
 * hierarchy, readability, and rhythm.
 *
 * All transformations are immutable.
 */

import type { SceneDocument, SceneNode, TextNode } from '@/types/scene';

// ─── Types ────────────────────────────────────────────────────

export interface ReflowOptions {
  /** Target width. */
  targetWidth: number;
  /** Target height. */
  targetHeight: number;
  /** Strategy for reflowing. */
  strategy?: 'scale' | 'restack' | 'smart';
  /** Minimum font size after reflow. Default 10. */
  minFontSize?: number;
  /** Padding around canvas edges. Default 24. */
  padding?: number;
}

export interface ReflowResult {
  scene: SceneDocument;
  originalSize: { width: number; height: number };
  targetSize: { width: number; height: number };
  strategy: string;
  nodesReflowed: number;
}

// ─── Preset Conversions ──────────────────────────────────────

export const REFLOW_PRESETS: Record<string, { width: number; height: number }> = {
  instagram_post: { width: 1080, height: 1080 },
  instagram_story: { width: 1080, height: 1920 },
  facebook_ad: { width: 1200, height: 628 },
  linkedin_post: { width: 1200, height: 628 },
  twitter: { width: 1200, height: 675 },
  pinterest: { width: 1000, height: 1500 },
  youtube_thumbnail: { width: 1280, height: 720 },
};

// ─── Public API ───────────────────────────────────────────────

/**
 * Reflow a scene to new dimensions.
 */
export function reflowScene(scene: SceneDocument, options: ReflowOptions): ReflowResult {
  const { targetWidth, targetHeight, strategy = 'smart', minFontSize = 10, padding = 24 } = options;

  const originalSize = { width: scene.width, height: scene.height };
  const targetSize = { width: targetWidth, height: targetHeight };

  const sourceAspect = scene.width / scene.height;
  const targetAspect = targetWidth / targetHeight;
  const aspectShift = Math.abs(sourceAspect - targetAspect);

  let chosenStrategy = strategy;
  if (strategy === 'smart') {
    // Use scale for similar ratios, restack for dramatic changes
    chosenStrategy = aspectShift < 0.3 ? 'scale' : 'restack';
  }

  let result: SceneDocument;
  if (chosenStrategy === 'restack') {
    result = restackReflow(scene, targetWidth, targetHeight, padding, minFontSize);
  } else {
    result = scaleReflow(scene, targetWidth, targetHeight, minFontSize);
  }

  return {
    scene: result,
    originalSize,
    targetSize,
    strategy: chosenStrategy,
    nodesReflowed: result.nodes.length,
  };
}

/**
 * Reflow to a named platform preset.
 */
export function reflowToPreset(scene: SceneDocument, presetName: string): ReflowResult {
  const preset = REFLOW_PRESETS[presetName];
  if (!preset) {
    return {
      scene,
      originalSize: { width: scene.width, height: scene.height },
      targetSize: { width: scene.width, height: scene.height },
      strategy: 'none',
      nodesReflowed: 0,
    };
  }
  return reflowScene(scene, { targetWidth: preset.width, targetHeight: preset.height });
}

// ─── Scale Strategy ──────────────────────────────────────────

function scaleReflow(
  scene: SceneDocument,
  targetWidth: number,
  targetHeight: number,
  minFontSize: number
): SceneDocument {
  const sx = targetWidth / scene.width;
  const sy = targetHeight / scene.height;

  const newNodes = scene.nodes.map((node) => scaleNode(node, sx, sy, minFontSize));

  return {
    ...scene,
    width: targetWidth,
    height: targetHeight,
    nodes: newNodes,
  };
}

function scaleNode(node: SceneNode, sx: number, sy: number, minFontSize: number): SceneNode {
  const base = {
    ...node,
    x: Math.round(node.x * sx),
    y: Math.round(node.y * sy),
    width: Math.max(1, Math.round(node.width * sx)),
    height: Math.max(1, Math.round(node.height * sy)),
  };

  if (node.type === 'text') {
    const scaledSize = Math.round(node.fontSize * Math.min(sx, sy));
    return { ...base, fontSize: Math.max(minFontSize, scaledSize) } as SceneNode;
  }

  if (node.type === 'button') {
    const scaledSize = Math.round(node.fontSize * Math.min(sx, sy));
    return { ...base, fontSize: Math.max(minFontSize, scaledSize) } as SceneNode;
  }

  if ('children' in node && Array.isArray(node.children)) {
    return { ...base, children: node.children.map((c) => scaleNode(c, sx, sy, minFontSize)) } as SceneNode;
  }

  return base as SceneNode;
}

// ─── Restack Strategy ────────────────────────────────────────

function restackReflow(
  scene: SceneDocument,
  targetWidth: number,
  targetHeight: number,
  padding: number,
  minFontSize: number
): SceneDocument {
  // Sort nodes by visual importance (area × zIndex weight)
  const ranked = [...scene.nodes]
    .map((node) => ({
      node,
      importance: (node.width * node.height) * (1 + node.zIndex * 0.1),
    }))
    .sort((a, b) => b.importance - a.importance);

  const isVertical = targetHeight > targetWidth;
  const availW = targetWidth - padding * 2;
  let cursor = padding;
  const gap = Math.round(Math.min(targetWidth, targetHeight) * 0.02);

  const newNodes: SceneNode[] = ranked.map(({ node }, i) => {
    // Scale node to fit target width
    const scaleRatio = availW / Math.max(1, node.width);
    const scaleFactor = Math.min(scaleRatio, 1.5); // Don't scale up more than 150%
    const newW = Math.round(node.width * scaleFactor);
    const newH = isVertical
      ? Math.round(node.height * scaleFactor)
      : Math.round(node.height * (targetHeight / scene.height));

    const x = Math.round((targetWidth - newW) / 2);
    const y = cursor;

    cursor += newH + gap;

    let result: SceneNode = {
      ...node,
      x,
      y,
      width: newW,
      height: newH,
      zIndex: i,
    };

    if (node.type === 'text') {
      const scaled = Math.round((node as TextNode).fontSize * scaleFactor);
      result = { ...result, fontSize: Math.max(minFontSize, scaled) } as SceneNode;
    }

    if (node.type === 'button') {
      const scaled = Math.round(node.fontSize * scaleFactor);
      result = { ...result, fontSize: Math.max(minFontSize, scaled) } as SceneNode;
    }

    return result;
  });

  return {
    ...scene,
    width: targetWidth,
    height: targetHeight,
    nodes: newNodes,
  };
}
