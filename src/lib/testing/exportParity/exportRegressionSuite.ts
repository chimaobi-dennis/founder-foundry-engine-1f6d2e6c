/**
 * exportRegressionSuite.ts
 *
 * Automated export parity regression suite.
 * Renders each test scene through both editor and export pipelines,
 * compares pixel output, scores parity, and reports failures.
 *
 * Uses existing test scenes from testScenes.ts.
 *
 * NO DOM screenshots — SceneDocument rendering parity only.
 */

import type { SceneDocument } from '@/types/scene';
import { allTestScenes } from '@/lib/scene/__tests__/testScenes';
import { stableSceneHash } from '@/lib/scene/stableSceneHash';
import { captureEditorSnapshot, captureExportSnapshot, type Snapshot } from './captureEditorSnapshot';
import { compareCanvases, type CanvasComparisonResult } from './compareCanvases';
import { computeParityScore, type ParityScore, type ParityTier } from './parityScore';
import {
  saveGoldenSnapshot, getGoldenSnapshot, hasGoldenSnapshot,
  createGoldenFromImageData, decodeGoldenPixelData, type GoldenSnapshot,
} from './goldenSnapshotStore';

// ─── Types ────────────────────────────────────────────────────

export interface RegressionFailure {
  sceneName: string;
  score: number;
  tier: ParityTier;
  mismatchPercent: number;
  avgColorDrift: number;
  maxColorDrift: number;
  missingPixels: number;
  heatmapDataUrl: string | null;
  summary: string;
}

export interface RegressionResult {
  /** Did all tests pass? */
  passed: boolean;
  /** Overall parity score (avg across all scenes). */
  score: number;
  /** Individual failures. */
  failures: RegressionFailure[];
  /** Data URLs of heatmaps for failed scenes. */
  screenshots: string[];
  /** Per-scene results. */
  sceneResults: SceneRegressionResult[];
  /** Total test count. */
  totalScenes: number;
  /** Test duration in ms. */
  durationMs: number;
}

export interface SceneRegressionResult {
  sceneName: string;
  passed: boolean;
  score: ParityScore;
  comparison: CanvasComparisonResult;
  editorSnapshot: Snapshot;
  exportSnapshot: Snapshot;
}

export interface RegressionOptions {
  /** Pixel ratio for rendering. Default 1 for deterministic comparison. */
  pixelRatio?: number;
  /** Minimum score to pass. Default 95. */
  minimumScore?: number;
  /** Per-channel pixel tolerance. Default 2. */
  tolerance?: number;
  /** Generate heatmaps for failures. Default true. */
  generateHeatmaps?: boolean;
  /** Which scene names to test (default: all). */
  sceneFilter?: string[];
  /** Compare against golden snapshots if available. Default false. */
  useGoldenSnapshots?: boolean;
  /** Update golden snapshots with current renders. Default false. */
  updateGoldenSnapshots?: boolean;
  /** Progress callback. */
  onProgress?: (sceneName: string, index: number, total: number) => void;
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Run the full export regression suite.
 *
 * For each test scene:
 *   1. Render via editor pipeline (captureEditorSnapshot)
 *   2. Render via export pipeline (captureExportSnapshot)
 *   3. Compare pixel-by-pixel
 *   4. Score parity
 *   5. Report failures
 */
export async function runExportRegressionSuite(
  options: RegressionOptions = {}
): Promise<RegressionResult> {
  const {
    pixelRatio = 1,
    minimumScore = 95,
    tolerance = 2,
    generateHeatmaps = true,
    sceneFilter,
    useGoldenSnapshots = false,
    updateGoldenSnapshots = false,
    onProgress,
  } = options;

  const start = performance.now();

  // Select scenes
  const scenesToTest = sceneFilter
    ? Object.entries(allTestScenes).filter(([name]) => sceneFilter.includes(name))
    : Object.entries(allTestScenes);

  const sceneResults: SceneRegressionResult[] = [];
  const failures: RegressionFailure[] = [];
  const screenshots: string[] = [];

  for (let i = 0; i < scenesToTest.length; i++) {
    const [sceneName, scene] = scenesToTest[i];
    onProgress?.(sceneName, i, scenesToTest.length);

    try {
      const result = await testSingleScene(
        sceneName, scene, {
          pixelRatio, tolerance, generateHeatmaps,
          minimumScore, useGoldenSnapshots, updateGoldenSnapshots,
        }
      );

      sceneResults.push(result);

      if (!result.passed) {
        const f: RegressionFailure = {
          sceneName,
          score: result.score.overall,
          tier: result.score.tier,
          mismatchPercent: result.comparison.mismatchPercent,
          avgColorDrift: result.comparison.avgColorDrift,
          maxColorDrift: result.comparison.maxColorDrift,
          missingPixels: result.comparison.missingPixels,
          heatmapDataUrl: result.comparison.heatmapDataUrl,
          summary: result.score.summary,
        };
        failures.push(f);
        if (result.comparison.heatmapDataUrl) {
          screenshots.push(result.comparison.heatmapDataUrl);
        }
      }
    } catch (err) {
      // Never crash the suite — record error as failure
      failures.push({
        sceneName,
        score: 0,
        tier: 'failed',
        mismatchPercent: 100,
        avgColorDrift: 255,
        maxColorDrift: 255,
        missingPixels: 0,
        heatmapDataUrl: null,
        summary: `Error: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  const avgScore = sceneResults.length > 0
    ? Math.round(sceneResults.reduce((sum, r) => sum + r.score.overall, 0) / sceneResults.length)
    : 0;

  return {
    passed: failures.length === 0,
    score: avgScore,
    failures,
    screenshots,
    sceneResults,
    totalScenes: scenesToTest.length,
    durationMs: Math.round(performance.now() - start),
  };
}

/**
 * Test a single custom scene (not from the test suite).
 */
export async function testSceneParity(
  scene: SceneDocument,
  options: Omit<RegressionOptions, 'sceneFilter'> & { sceneName?: string } = {}
): Promise<SceneRegressionResult> {
  const {
    pixelRatio = 1,
    tolerance = 2,
    generateHeatmaps = true,
    minimumScore = 95,
    useGoldenSnapshots = false,
    updateGoldenSnapshots = false,
    sceneName = 'custom',
  } = options;

  return testSingleScene(sceneName, scene, {
    pixelRatio, tolerance, generateHeatmaps,
    minimumScore, useGoldenSnapshots, updateGoldenSnapshots,
  });
}

// ─── Internal ────────────────────────────────────────────────

async function testSingleScene(
  sceneName: string,
  scene: SceneDocument,
  ctx: {
    pixelRatio: number;
    tolerance: number;
    generateHeatmaps: boolean;
    minimumScore: number;
    useGoldenSnapshots: boolean;
    updateGoldenSnapshots: boolean;
  }
): Promise<SceneRegressionResult> {
  const { pixelRatio, tolerance, generateHeatmaps, minimumScore, useGoldenSnapshots, updateGoldenSnapshots } = ctx;

  // Capture both snapshots
  const editorSnapshot = await captureEditorSnapshot(scene, {
    pixelRatio,
    label: `${sceneName}_editor`,
  });

  const exportSnapshot = await captureExportSnapshot(scene, {
    pixelRatio,
    label: `${sceneName}_export`,
  });

  // Determine comparison target
  let compareTarget = exportSnapshot.imageData;

  // If using golden snapshots, compare against golden instead
  if (useGoldenSnapshots) {
    const goldenKey = `${sceneName}_${pixelRatio}x`;
    const golden = getGoldenSnapshot(goldenKey);
    if (golden) {
      const goldenPixels = decodeGoldenPixelData(golden);
      if (goldenPixels && goldenPixels.length === compareTarget.data.length) {
        // Create ImageData from golden pixels for comparison
        // Use editor snapshot dimensions (they should match)
        compareTarget = createImageDataSafe(goldenPixels, golden.width, golden.height) ?? compareTarget;
      }
    }
  }

  // Update golden snapshots if requested
  if (updateGoldenSnapshots) {
    const goldenKey = `${sceneName}_${pixelRatio}x`;
    const hash = stableSceneHash(scene);
    const golden = createGoldenFromImageData(
      goldenKey,
      editorSnapshot.imageData,
      editorSnapshot.dataUrl,
      pixelRatio,
      hash
    );
    saveGoldenSnapshot(golden);
  }

  // Compare
  const comparison = compareCanvases(editorSnapshot.imageData, compareTarget, {
    tolerance,
    generateHeatmap: generateHeatmaps,
  });

  // Score
  const score = computeParityScore(comparison, scene, scene);
  const passed = score.overall >= minimumScore;

  return {
    sceneName,
    passed,
    score,
    comparison,
    editorSnapshot,
    exportSnapshot,
  };
}

function createImageDataSafe(data: Uint8ClampedArray, width: number, height: number): ImageData | null {
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const id = ctx.createImageData(width, height);
      id.data.set(data);
      return id;
    }
  }
  try {
    return new (ImageData as unknown as new (d: Uint8ClampedArray, w: number, h: number) => ImageData)(data, width, height);
  } catch {
    return null;
  }
}
