/**
 * renderSceneToImage.ts
 *
 * Converts a SceneDocument to a raster image (PNG or JPEG data URL / Blob).
 * Built on top of renderSceneToCanvas.
 *
 * STATUS: Scaffold only — full implementation pending.
 */

import type { SceneDocument } from '@/types/scene';
import { renderSceneToCanvas, type RenderToCanvasOptions } from './renderSceneToCanvas';

// ─── Options ──────────────────────────────────────────────────

export type ImageFormat = 'png' | 'jpeg';

export interface RenderToImageOptions extends RenderToCanvasOptions {
  /** Output format. Default 'png'. */
  format?: ImageFormat;
  /** JPEG quality 0–1. Only used when format is 'jpeg'. Default 0.92. */
  quality?: number;
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Render a SceneDocument to a data URL string (PNG or JPEG).
 */
export async function renderSceneToDataUrl(
  scene: SceneDocument,
  options: RenderToImageOptions = {}
): Promise<string> {
  const { format = 'png', quality = 0.92, ...canvasOptions } = options;
  const canvas = await renderSceneToCanvas(scene, canvasOptions);
  const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  return canvas.toDataURL(mimeType, quality);
}

/**
 * Render a SceneDocument to a Blob (for file downloads or uploads).
 */
export async function renderSceneToBlob(
  scene: SceneDocument,
  options: RenderToImageOptions = {}
): Promise<Blob> {
  const { format = 'png', quality = 0.92, ...canvasOptions } = options;
  const canvas = await renderSceneToCanvas(scene, canvasOptions);
  const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to create image blob'));
      },
      mimeType,
      quality
    );
  });
}
