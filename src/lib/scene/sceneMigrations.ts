/**
 * sceneMigrations.ts
 *
 * Version-aware migration system for SceneDocument.
 * Every scene carries a `version` field (e.g. "v1").
 * When the schema evolves, add a migration function here and
 * bump CURRENT_SCENE_VERSION.
 *
 * migrateScene() is idempotent — calling it on an already-current
 * document is a no-op.
 */

import type { SceneDocument } from '@/types/scene';

// ─── Version Constants ────────────────────────────────────────

export const CURRENT_SCENE_VERSION = 'v1';

// ─── Migration Registry ──────────────────────────────────────

/**
 * Each migration transforms a document from `fromVersion` to `toVersion`.
 * They are applied in sequence until the document reaches CURRENT_SCENE_VERSION.
 */
interface Migration {
  fromVersion: string;
  toVersion: string;
  migrate: (doc: SceneDocument) => SceneDocument;
}

const migrations: Migration[] = [
  // Example future migration:
  // {
  //   fromVersion: 'v1',
  //   toVersion: 'v2',
  //   migrate: (doc) => {
  //     // Add new fields, transform existing ones, etc.
  //     return {
  //       ...doc,
  //       version: 'v2',
  //       nodes: doc.nodes.map(n => ({ ...n, newField: defaultValue })),
  //     };
  //   },
  // },
];

// ─── Public API ───────────────────────────────────────────────

/**
 * Migrate a SceneDocument to the current version.
 * Applies migrations in sequence. If the document is already current,
 * returns it unchanged.
 *
 * Safe to call on every load — idempotent and non-destructive.
 */
export function migrateScene(doc: SceneDocument): SceneDocument {
  let current = { ...doc };

  // If no version, assume v1
  if (!current.version) {
    current.version = 'v1';
  }

  // Already at current version
  if (current.version === CURRENT_SCENE_VERSION) {
    return current;
  }

  // Apply migrations in order
  let migrated = true;
  const maxIterations = migrations.length + 1; // safety guard
  let iterations = 0;

  while (current.version !== CURRENT_SCENE_VERSION && migrated && iterations < maxIterations) {
    migrated = false;
    iterations++;

    for (const m of migrations) {
      if (m.fromVersion === current.version) {
        console.log(`[sceneMigrations] Migrating scene from ${m.fromVersion} to ${m.toVersion}`);
        current = m.migrate(current);
        migrated = true;
        break;
      }
    }
  }

  if (current.version !== CURRENT_SCENE_VERSION) {
    console.warn(
      `[sceneMigrations] Could not migrate scene from ${doc.version} to ${CURRENT_SCENE_VERSION}. ` +
      `Document version ${current.version} has no registered migration.`
    );
    // Force version to current so the renderer doesn't reject it
    current.version = CURRENT_SCENE_VERSION;
  }

  return current;
}

/**
 * Check if a scene document needs migration.
 */
export function needsMigration(doc: SceneDocument): boolean {
  return (doc.version || 'v1') !== CURRENT_SCENE_VERSION;
}
