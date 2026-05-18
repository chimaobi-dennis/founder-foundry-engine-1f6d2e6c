/**
 * captureEditorSnapshot.ts
 *
 * Captures a pixel-perfect snapshot of a SceneDocument using the same
 * rendering pipeline as both the editor and the exporter.
 *
 * NO DOM screenshots — pure SceneDocument → Canvas rendering.
 */

import type { SceneDocument } from '@/types/scene';
import { renderSceneToCanvas, type RenderToCanvasOptions } from '@/lib/renderers/renderSceneToCanvas';
import { normalizeSceneDocument } from '@/lib/scene/validateSceneDocument';

// ─── Types ────────────────────────────────────────────────────

export interface Snapshot {
  /** Scene that was rendered. */
  scene: SceneDocument;
  /** Rendered canvas. */
  canvas: HTMLCanvasElement;
  /** Raw RGBA pixel data. */
  imageData: ImageData;
  /** Width in CSS pixels. */
  width: number;
  /** Height in CSS pixels. */
  height: number;
  /** Pixel ratio used. */
  pixelRatio: number;
  /** Data URL for visual inspection. */
  dataUrl: string;
  /** Capture timestamp (ISO). */
  timestamp: string;
  /** Label for identification. */
  label: string;
}

export interface SnapshotOptions {
  /** Device pixel ratio. Default 1 (for deterministic comparison). */
  pixelRatio?: number;
  /** Override background. */
  background?: string;
  /** Label for the snapshot. */
  label?: string;
  /** Normalize scene before rendering. Default true. */
  normalize?: boolean;
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Capture an editor-equivalent snapshot of a SceneDocument.
 * Uses the exact same rendering pipeline as the editor canvas.
 */
export async function captureEditorSnapshot(
  scene: SceneDocument,
  options: SnapshotOptions = {}
): Promise<Snapshot> {
  const {
    pixelRatio = 1,
    background,
    label = 'editor',
    normalize = true,
  } = options;

  const doc = normalize ? normalizeSceneDocument(scene) : scene;

  const canvas = await renderSceneToCanvas(doc, {
    pixelRatio,
    background,
    skipFontLoad: false,
  });

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot get 2D context from canvas');

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/png');

  return {
    scene: doc,
    canvas,
    imageData,
    width: doc.width,
    height: doc.height,
    pixelRatio,
    dataUrl,
    timestamp: new Date().toISOString(),
    label,
  };
}

/**
 * Capture an export-equivalent snapshot.
 * Uses the same pipeline but simulates export conditions (e.g. higher DPI).
 */
export async function captureExportSnapshot(
  scene: SceneDocument,
  options: SnapshotOptions = {}
): Promise<Snapshot> {
  return captureEditorSnapshot(scene, {
    ...options,
    label: options.label || 'export',
    // Export uses identical renderer; only difference is
    // usually pixelRatio — but for parity tests we use 1.
    pixelRatio: options.pixelRatio ?? 1,
    normalize: options.normalize ?? true,
  });
}
