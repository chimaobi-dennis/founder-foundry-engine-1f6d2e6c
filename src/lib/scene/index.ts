/**
 * Scene engine barrel export.
 *
 * Import from '@/lib/scene' to access the full rendering pipeline:
 *   validation, normalization, migrations, safe wrappers.
 */

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
