/**
 * renderSceneToImage.ts
 *
 * Converts a SceneDocument to raster image (PNG / JPEG / PDF).
 * Built on top of renderSceneToCanvas — deterministic pipeline.
 */

import type { SceneDocument } from '@/types/scene';
import { renderSceneToCanvas, type RenderToCanvasOptions } from './renderSceneToCanvas';
import { normalizeSceneDocument } from '@/lib/scene/validateSceneDocument';
import { loadSceneFonts, waitForFontsReady } from '@/lib/fonts/fontRegistry';

// ─── Options ──────────────────────────────────────────────────

export type ImageFormat = 'png' | 'jpeg';
export type ExportFormat = 'png' | 'jpeg' | 'pdf';

export interface RenderToImageOptions extends RenderToCanvasOptions {
  /** Output format. Default 'png'. */
  format?: ImageFormat;
  /** JPEG quality 0–1. Only used when format is 'jpeg'. Default 0.92. */
  quality?: number;
  /** Validate + normalize the scene before rendering. Default true. */
  normalize?: boolean;
}

export interface ExportSceneOptions {
  /** Output format. */
  format: ExportFormat;
  /** Device pixel ratio. Default 2. */
  pixelRatio?: number;
  /** JPEG quality. Default 0.92. */
  quality?: number;
  /** Override background. */
  background?: string;
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Render a SceneDocument to a data URL string (PNG or JPEG).
 */
export async function renderSceneToDataUrl(
  scene: SceneDocument,
  options: RenderToImageOptions = {}
): Promise<string> {
  const { format = 'png', quality = 0.92, normalize = true, ...canvasOptions } = options;
  const doc = normalize ? normalizeSceneDocument(scene) : scene;
  const canvas = await renderSceneToCanvas(doc, canvasOptions);
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
  const { format = 'png', quality = 0.92, normalize = true, ...canvasOptions } = options;
  const doc = normalize ? normalizeSceneDocument(scene) : scene;
  const canvas = await renderSceneToCanvas(doc, canvasOptions);
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

// ─── PDF Export ───────────────────────────────────────────────

/**
 * Render a SceneDocument to a PDF Blob.
 * Pipeline: SceneJSON → renderSceneToCanvas (retina) → jsPDF embed.
 */
export async function renderSceneToPdf(
  scene: SceneDocument,
  options: Omit<ExportSceneOptions, 'format'> = {}
): Promise<Blob> {
  const { pixelRatio = 2, background } = options;
  const doc = normalizeSceneDocument(scene);

  // Preload fonts
  await loadSceneFonts(doc);
  await waitForFontsReady();

  // Render to canvas
  const canvas = await renderSceneToCanvas(doc, {
    pixelRatio,
    background,
    skipFontLoad: true, // already loaded
  });

  // Convert canvas to PNG data URL
  const dataUrl = canvas.toDataURL('image/png');

  // Dynamic import jsPDF to avoid bundling it when not needed
  const { default: jsPDF } = await import('jspdf');

  const orientation = doc.width > doc.height ? 'landscape' : 'portrait';
  const pdf = new jsPDF({
    orientation,
    unit: 'px',
    format: [doc.width, doc.height],
    hotfixes: ['px_scaling'],
  });

  pdf.addImage(dataUrl, 'PNG', 0, 0, doc.width, doc.height);
  return pdf.output('blob');
}

// ─── Unified Export ───────────────────────────────────────────

/**
 * One-stop export: scene → Blob in any format (PNG / JPEG / PDF).
 * Handles validation, normalization, font loading, and rendering.
 */
export async function exportScene(
  scene: SceneDocument,
  options: ExportSceneOptions
): Promise<Blob> {
  const { format, pixelRatio = 2, quality = 0.92, background } = options;

  if (format === 'pdf') {
    return renderSceneToPdf(scene, { pixelRatio, background });
  }

  return renderSceneToBlob(scene, {
    format,
    pixelRatio,
    quality,
    background,
    normalize: true,
  });
}
