/**
 * Export Parity Testing — Barrel Export
 *
 * Guarantees deterministic visual parity between:
 *   Editor Preview ↔ Exported PNG ↔ Exported PDF ↔ Rendered Scene
 */

// Snapshot capture
export {
  captureEditorSnapshot,
  captureExportSnapshot,
  type Snapshot,
  type SnapshotOptions,
} from './captureEditorSnapshot';

// Pixel-level comparison
export {
  compareCanvases,
  compareCanvasElements,
  type CanvasComparisonResult,
  type CompareOptions,
} from './compareCanvases';

// Parity scoring
export {
  computeParityScore,
  isProductionSafe,
  type ParityScore,
  type ParityTier,
  type ParityScoreOptions,
} from './parityScore';

// Golden snapshot store
export {
  saveGoldenSnapshot,
  getGoldenSnapshot,
  hasGoldenSnapshot,
  deleteGoldenSnapshot,
  listGoldenSnapshots,
  clearGoldenSnapshots,
  getGoldenStoreStats,
  createGoldenFromImageData,
  decodeGoldenPixelData,
  type GoldenSnapshot,
  type GoldenStoreStats,
} from './goldenSnapshotStore';

// Regression suite
export {
  runExportRegressionSuite,
  testSceneParity,
  type RegressionResult,
  type RegressionFailure,
  type SceneRegressionResult,
  type RegressionOptions,
} from './exportRegressionSuite';
