/**
 * renderSceneToCanvas.ts
 *
 * Renders a SceneDocument to an HTMLCanvasElement.
 * This is the primary rendering path for the scene-based export pipeline.
 *
 * STATUS: Scaffold only — full implementation pending.
 */

import type { SceneDocument, SceneNode } from '@/types/scene';

// ─── Options ──────────────────────────────────────────────────

export interface RenderToCanvasOptions {
  /** Device pixel ratio for high-DPI output. Default 2. */
  pixelRatio?: number;
  /** Override the background colour (otherwise uses document.background). */
  background?: string;
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Render a full SceneDocument to an HTMLCanvasElement.
 *
 * @param scene  The SceneDocument to render.
 * @param options  Rendering options.
 * @returns A canvas element with the rendered scene.
 */
export async function renderSceneToCanvas(
  scene: SceneDocument,
  options: RenderToCanvasOptions = {}
): Promise<HTMLCanvasElement> {
  const { pixelRatio = 2, background } = options;

  const canvas = document.createElement('canvas');
  canvas.width = scene.width * pixelRatio;
  canvas.height = scene.height * pixelRatio;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2d context');

  ctx.scale(pixelRatio, pixelRatio);

  // Fill background
  ctx.fillStyle = background || scene.background || '#ffffff';
  ctx.fillRect(0, 0, scene.width, scene.height);

  // TODO: Render each node by type
  const sortedNodes = [...scene.nodes].sort((a, b) => a.zIndex - b.zIndex);
  for (const node of sortedNodes) {
    await renderNode(ctx, node);
  }

  return canvas;
}

// ─── Internal Renderers (stubs) ───────────────────────────────

async function renderNode(ctx: CanvasRenderingContext2D, node: SceneNode): Promise<void> {
  ctx.save();

  // Apply common transforms
  ctx.translate(node.x + node.width / 2, node.y + node.height / 2);
  ctx.rotate((node.rotation * Math.PI) / 180);
  ctx.globalAlpha = node.opacity;
  ctx.translate(-node.width / 2, -node.height / 2);

  switch (node.type) {
    case 'text':
      // TODO: Implement text rendering with font metrics
      break;
    case 'image':
      // TODO: Implement image loading and drawing
      break;
    case 'shape':
      // TODO: Implement shape rendering (rect with radius, stroke)
      break;
    case 'group':
      // TODO: Recursively render children
      for (const child of node.children) {
        await renderNode(ctx, child);
      }
      break;
  }

  ctx.restore();
}
