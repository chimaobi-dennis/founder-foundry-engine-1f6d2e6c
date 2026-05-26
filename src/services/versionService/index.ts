/**
 * Version Service barrel export
 * 
 * Production-grade versioning system for Content Studio.
 */

export {
  createVersion,
  createManualSaveVersion,
  createPreMutationSnapshot,
  getVersionHistory,
  getVersionById,
  getCurrentVersion,
  getVersionScene,
  restoreVersion,
  compareVersions,
  renameVersion,
  pruneVersions,
} from "../versionService";

export type {
  VersionSummary,
  FullVersion,
  CreateVersionParams,
  RestoreResult,
  DiffResult,
  SaveStatus,
} from "../versionService";
