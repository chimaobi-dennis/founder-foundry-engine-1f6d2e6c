/**
 * safeRenderScene.ts
 *
 * Top-level orchestrator that wraps the full render pipeline:
 *   raw input → validate → normalize → migrate → load fonts → render
 *
 * Every public function here is resilient — it will never throw.
 * On failure it returns null/fallback and logs warnings.
 */

import type { SceneDocument } from '@/types/scene';
import { validateSceneDocument, normalizeSceneDocument } from './validateSceneDocument';
import { migrateScene } from './sceneMigrations';
import { loadSceneFonts, waitForFontsReady } from '@/lib/fonts/fontRegistry';
import { renderSceneToCanvas, type RenderToCanvasOptions } from '@/lib/renderers/renderSceneToCanvas';
import { renderSceneToSVG, type RenderToSVGOptions } from '@/lib/renderers/renderSceneToSVG';
import {
  renderSceneToBlob,
  renderSceneToPdf,
  type ExportSceneOptions,
} from '@/lib/renderers/renderSceneToImage';

// ─── Pipeline ─────────────────────────────────────────────────

export interface PrepareResult {
  document: SceneDocument;
  warnings: string[];
  valid: boolean;
}

/**
 * Full preparation pipeline: validate → normalize → migrate.
 * Always returns a usable SceneDocument, even from garbage input.
 */
export function prepareScene(raw: unknown): PrepareResult {
  const { valid, document: validated, warnings } = validateSceneDocument(raw);
  const normalized = normalizeSceneDocument(validated);
  const migrated = migrateScene(normalized);
  return { document: migrated, warnings, valid };
}

// ─── Safe Canvas Render ───────────────────────────────────────

/**
 * Full safe pipeline: raw → validated → normalized → canvas.
 * Returns null on catastrophic failure.
 */
export async function safeRenderToCanvas(
  raw: unknown,
  options: RenderToCanvasOptions = {}
): Promise<HTMLCanvasElement | null> {
  try {
    const { document: scene, warnings } = prepareScene(raw);
    if (warnings.length > 0) {
      console.warn('[safeRenderToCanvas] Validation warnings:', warnings);
    }

    await loadSceneFonts(scene);
    await waitForFontsReady();

    return await renderSceneToCanvas(scene, { ...options, skipFontLoad: true });
  } catch (err) {
    console.error('[safeRenderToCanvas] Fatal render error:', err);
    return null;
  }
}

// ─── Safe SVG Render ──────────────────────────────────────────

/**
 * Full safe pipeline: raw → validated → normalized → SVG string.
 * Returns empty SVG on catastrophic failure.
 */
export async function safeRenderToSVG(
  raw: unknown,
  options: RenderToSVGOptions = {}
): Promise<string> {
  try {
    const { document: scene, warnings } = prepareScene(raw);
    if (warnings.length > 0) {
      console.warn('[safeRenderToSVG] Validation warnings:', warnings);
    }
    return await renderSceneToSVG(scene, options);
  } catch (err) {
    console.error('[safeRenderToSVG] Fatal render error:', err);
    return '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#ffffff" /></svg>';
  }
}

// ─── Safe Export ──────────────────────────────────────────────

/**
 * Full safe pipeline: raw → validated → normalized → Blob (PNG/JPEG/PDF).
 * Returns null on catastrophic failure.
 */
export async function safeExport(
  raw: unknown,
  options: ExportSceneOptions
): Promise<Blob | null> {
  try {
    const { document: scene, warnings } = prepareScene(raw);
    if (warnings.length > 0) {
      console.warn('[safeExport] Validation warnings:', warnings);
    }

    await loadSceneFonts(scene);
    await waitForFontsReady();

    if (options.format === 'pdf') {
      return await renderSceneToPdf(scene, {
        pixelRatio: options.pixelRatio,
        background: options.background,
      });
    }

    return await renderSceneToBlob(scene, {
      format: options.format,
      pixelRatio: options.pixelRatio,
      quality: options.quality,
      background: options.background,
      normalize: false, // already normalized by prepareScene
    });
  } catch (err) {
    console.error('[safeExport] Fatal export error:', err);
    return null;
  }
}
