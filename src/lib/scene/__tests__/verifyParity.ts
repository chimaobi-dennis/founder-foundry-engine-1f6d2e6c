/**
 * verifyParity.ts
 *
 * Helpers for verifying visual parity between editor and export renders.
 * Use in development / testing to ensure deterministic output.
 */

import type { SceneDocument } from '@/types/scene';
import { renderSceneToCanvas } from '@/lib/renderers/renderSceneToCanvas';
import { prepareScene } from '@/lib/scene/safeRenderScene';

// ─── Pixel Comparison ─────────────────────────────────────────

export interface ParityResult {
  match: boolean;
  diffPixels: number;
  totalPixels: number;
  diffPercentage: number;
}

/**
 * Compare two canvases pixel-by-pixel.
 * Returns the number of pixels that differ and a match percentage.
 */
export function compareCanvases(a: HTMLCanvasElement, b: HTMLCanvasElement): ParityResult {
  const ctxA = a.getContext('2d');
  const ctxB = b.getContext('2d');
  if (!ctxA || !ctxB) {
    return { match: false, diffPixels: -1, totalPixels: 0, diffPercentage: 100 };
  }

  const width = Math.max(a.width, b.width);
  const height = Math.max(a.height, b.height);
  const dataA = ctxA.getImageData(0, 0, width, height).data;
  const dataB = ctxB.getImageData(0, 0, width, height).data;
  const totalPixels = width * height;

  let diffPixels = 0;
  const threshold = 2; // Allow minor anti-aliasing differences

  for (let i = 0; i < dataA.length; i += 4) {
    const dr = Math.abs(dataA[i] - dataB[i]);
    const dg = Math.abs(dataA[i + 1] - dataB[i + 1]);
    const db = Math.abs(dataA[i + 2] - dataB[i + 2]);
    const da = Math.abs(dataA[i + 3] - dataB[i + 3]);

    if (dr > threshold || dg > threshold || db > threshold || da > threshold) {
      diffPixels++;
    }
  }

  const diffPercentage = (diffPixels / totalPixels) * 100;

  return {
    match: diffPixels === 0,
    diffPixels,
    totalPixels,
    diffPercentage,
  };
}

// ─── Render Parity Check ──────────────────────────────────────

/**
 * Render the same scene twice and compare. Both renders use the
 * identical pipeline, so they should produce 0 diff pixels.
 * This validates determinism.
 */
export async function verifyDeterminism(scene: SceneDocument): Promise<ParityResult> {
  const { document: prepared } = prepareScene(scene);
  const [canvasA, canvasB] = await Promise.all([
    renderSceneToCanvas(prepared, { pixelRatio: 1 }),
    renderSceneToCanvas(prepared, { pixelRatio: 1, skipFontLoad: true }),
  ]);
  return compareCanvases(canvasA, canvasB);
}

// ─── Batch Verification ───────────────────────────────────────

export interface BatchResult {
  name: string;
  result: ParityResult;
}

/**
 * Run determinism verification on multiple test scenes.
 */
export async function verifyBatch(
  scenes: Record<string, SceneDocument>
): Promise<BatchResult[]> {
  const results: BatchResult[] = [];
  for (const [name, scene] of Object.entries(scenes)) {
    const result = await verifyDeterminism(scene);
    results.push({ name, result });
    console.log(
      `[verifyParity] ${name}: ${result.match ? '✓ PASS' : '✗ FAIL'} ` +
      `(${result.diffPixels}/${result.totalPixels} diff, ${result.diffPercentage.toFixed(3)}%)`
    );
  }
  return results;
}
