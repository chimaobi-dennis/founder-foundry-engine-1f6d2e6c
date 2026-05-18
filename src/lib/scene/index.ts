/**
 * Scene engine barrel export.
 *
 * Import from '@/lib/scene' to access the full rendering pipeline:
 *   validation, normalization, migrations, safe wrappers,
 *   AI parsing, composition, and studio bridge.
 */

// ─── Phase 1: Core Engine ─────────────────────────────────────

export {
  validateSceneDocument,
  normalizeSceneDocument,
  normalizeNode,
  clampBounds,
  sanitizeColor,
  type ValidationResult,
} from './validateSceneDocument';

export {
  migrateScene,
  needsMigration,
  CURRENT_SCENE_VERSION,
} from './sceneMigrations';

export {
  prepareScene,
  safeRenderToCanvas,
  safeRenderToSVG,
  safeExport,
  type PrepareResult,
} from './safeRenderScene';

// ─── Phase 2: AI Composition Pipeline ─────────────────────────

export {
  parseAISceneResponse,
  parseAIPlatformOutput,
  parseMultiPlatformResponse,
  type AISceneResult,
  type AISceneResultType,
} from './parseAISceneResponse';

export {
  htmlToScene,
  type HtmlToSceneOptions,
} from './htmlToScene';

export {
  generateCompositionRules,
  rulesToPromptBlock,
  type CompositionRules,
  type BrandContext,
  type PlatformConstraints,
  type CompositionIntent,
} from './aiCompositionRules';

export {
  getBlueprint,
  getBlueprintOrDefault,
  getAllBlueprints,
  blueprintToPromptBlock,
  type PlatformBlueprint,
} from './platformBlueprints';

export {
  stableSceneHash,
  stableSerialize,
  scenesEqual,
} from './stableSceneHash';

export {
  buildAssetManifest,
  preloadSceneAssets,
  hasExternalAssets,
  type AssetManifest,
  type PreloadResult,
} from './sceneAssetResolver';

export {
  prepareStudioScene,
  toSessionPayload,
  fromSessionPayload,
  mergeSceneNodes,
  cloneScene,
  isCompatible,
  type StudioType,
  type StudioScenePayload,
  type StudioExportRequest,
} from './studioBridge';
