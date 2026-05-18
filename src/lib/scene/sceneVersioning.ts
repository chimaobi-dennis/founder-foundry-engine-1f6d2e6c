/**
 * sceneVersioning.ts
 *
 * Immutable version history for SceneDocuments.
 * Supports snapshots, lightweight diffs, restore, branching,
 * and mutation lineage tracking.
 */

import type { SceneDocument } from '@/types/scene';
import { stableSceneHash } from './stableSceneHash';
import { diffScenes, type SceneDiffResult } from './sceneDiff';

// ─── Types ────────────────────────────────────────────────────

export interface SceneSnapshot {
  /** Unique snapshot ID. */
  id: string;
  /** Parent snapshot ID (null for initial). */
  parentId: string | null;
  /** Branch name. */
  branch: string;
  /** The full scene at this point. */
  scene: SceneDocument;
  /** Stable hash of the scene. */
  hash: string;
  /** What caused this snapshot. */
  source: SnapshotSource;
  /** ISO timestamp. */
  timestamp: string;
  /** Human-readable label. */
  label: string;
}

export type SnapshotSource =
  | { type: 'initial' }
  | { type: 'mutation'; mutationId: string; summary: string }
  | { type: 'patch'; opCount: number }
  | { type: 'ai_generation'; model?: string }
  | { type: 'user_edit'; description: string }
  | { type: 'auto_repair' }
  | { type: 'reflow'; fromSize: string; toSize: string }
  | { type: 'restore'; restoredFromId: string };

export interface VersionTimeline {
  snapshots: SceneSnapshot[];
  currentId: string;
  branches: string[];
}

// ─── Version History Manager ─────────────────────────────────

export class SceneHistory {
  private snapshots: Map<string, SceneSnapshot> = new Map();
  private currentId: string;
  private branches: Set<string> = new Set(['main']);

  constructor(initialScene: SceneDocument, label = 'Initial scene') {
    const snapshot = createSnapshot(initialScene, null, 'main', { type: 'initial' }, label);
    this.snapshots.set(snapshot.id, snapshot);
    this.currentId = snapshot.id;
  }

  /** Get the current snapshot. */
  get current(): SceneSnapshot {
    return this.snapshots.get(this.currentId)!;
  }

  /** Get the current scene. */
  get scene(): SceneDocument {
    return this.current.scene;
  }

  /** Push a new version. */
  push(scene: SceneDocument, source: SnapshotSource, label: string, branch?: string): SceneSnapshot {
    const br = branch || this.current.branch;
    this.branches.add(br);
    const snapshot = createSnapshot(scene, this.currentId, br, source, label);
    this.snapshots.set(snapshot.id, snapshot);
    this.currentId = snapshot.id;
    return snapshot;
  }

  /** Undo: move to parent snapshot. Returns null if already at root. */
  undo(): SceneSnapshot | null {
    const current = this.current;
    if (!current.parentId) return null;
    this.currentId = current.parentId;
    return this.current;
  }

  /** Redo: find a child of current on same branch. Returns null if none. */
  redo(): SceneSnapshot | null {
    const children = this.getChildren(this.currentId);
    const sameBranch = children.filter((s) => s.branch === this.current.branch);
    if (sameBranch.length === 0) return null;
    // Pick the most recent child
    const latest = sameBranch.sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
    this.currentId = latest.id;
    return this.current;
  }

  /** Restore to a specific snapshot (creates a new snapshot on current branch). */
  restore(snapshotId: string): SceneSnapshot | null {
    const target = this.snapshots.get(snapshotId);
    if (!target) return null;
    return this.push(
      target.scene,
      { type: 'restore', restoredFromId: snapshotId },
      `Restored from: ${target.label}`
    );
  }

  /** Create a new branch from current position. */
  branch(branchName: string): SceneSnapshot {
    this.branches.add(branchName);
    return this.push(
      this.scene,
      { type: 'user_edit', description: `Branch: ${branchName}` },
      `Branch: ${branchName}`,
      branchName
    );
  }

  /** Get all snapshots for a branch, ordered by time. */
  getBranch(branchName: string): SceneSnapshot[] {
    return [...this.snapshots.values()]
      .filter((s) => s.branch === branchName)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  /** Get diff between current and a specific snapshot. */
  diffFrom(snapshotId: string): SceneDiffResult | null {
    const target = this.snapshots.get(snapshotId);
    if (!target) return null;
    return diffScenes(target.scene, this.scene);
  }

  /** Get the full timeline. */
  getTimeline(): VersionTimeline {
    return {
      snapshots: [...this.snapshots.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
      currentId: this.currentId,
      branches: [...this.branches],
    };
  }

  /** Get lineage (ancestors) of the current snapshot. */
  getLineage(): SceneSnapshot[] {
    const lineage: SceneSnapshot[] = [];
    let current: SceneSnapshot | undefined = this.current;
    while (current) {
      lineage.unshift(current);
      current = current.parentId ? this.snapshots.get(current.parentId) : undefined;
    }
    return lineage;
  }

  /** Get the total number of snapshots. */
  get size(): number {
    return this.snapshots.size;
  }

  /** Prune old snapshots, keeping at most `maxSnapshots`. Preserves lineage to current. */
  prune(maxSnapshots: number): number {
    if (this.snapshots.size <= maxSnapshots) return 0;

    const lineageIds = new Set(this.getLineage().map((s) => s.id));
    const all = [...this.snapshots.entries()]
      .filter(([id]) => !lineageIds.has(id))
      .sort(([, a], [, b]) => a.timestamp.localeCompare(b.timestamp));

    const toRemove = all.slice(0, this.snapshots.size - maxSnapshots);
    for (const [id] of toRemove) {
      this.snapshots.delete(id);
    }
    return toRemove.length;
  }

  private getChildren(parentId: string): SceneSnapshot[] {
    return [...this.snapshots.values()].filter((s) => s.parentId === parentId);
  }
}

// ─── Helpers ──────────────────────────────────────────────────

function createSnapshot(
  scene: SceneDocument,
  parentId: string | null,
  branch: string,
  source: SnapshotSource,
  label: string
): SceneSnapshot {
  return {
    id: `snap_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    parentId,
    branch,
    scene,
    hash: stableSceneHash(scene),
    source,
    timestamp: new Date().toISOString(),
    label,
  };
}
