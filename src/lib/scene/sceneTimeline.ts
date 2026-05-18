/**
 * sceneTimeline.ts
 *
 * Timeline engine for mutation history, generation history,
 * restore points, branch previews, and revision comparison.
 */

import type { SceneDocument } from '@/types/scene';
import { SceneHistory, type SceneSnapshot, type SnapshotSource, type VersionTimeline } from './sceneVersioning';
import { diffScenes, diffSummary, type SceneDiffResult } from './sceneDiff';
import { stableSceneHash } from './stableSceneHash';

// ─── Types ────────────────────────────────────────────────────

export interface TimelineEntry {
  snapshotId: string;
  label: string;
  source: SnapshotSource;
  timestamp: string;
  hash: string;
  /** Change summary relative to previous entry. */
  changeSummary: string;
  /** Whether this is a restore point. */
  isRestorePoint: boolean;
  /** Branch name. */
  branch: string;
}

export interface TimelineView {
  entries: TimelineEntry[];
  currentIndex: number;
  branches: string[];
  totalSnapshots: number;
}

export interface RevisionComparison {
  from: TimelineEntry;
  to: TimelineEntry;
  diff: SceneDiffResult;
  summary: string;
}

// ─── Timeline Manager ────────────────────────────────────────

export class SceneTimelineManager {
  private history: SceneHistory;
  private restorePointIds: Set<string> = new Set();

  constructor(initialScene: SceneDocument) {
    this.history = new SceneHistory(initialScene);
  }

  /** Push a new scene state. */
  push(scene: SceneDocument, source: SnapshotSource, label: string): TimelineEntry {
    const snap = this.history.push(scene, source, label);
    return this.snapshotToEntry(snap);
  }

  /** Mark the current snapshot as a restore point. */
  markRestorePoint(): void {
    this.restorePointIds.add(this.history.current.id);
  }

  /** Get the full timeline view. */
  getTimeline(branch?: string): TimelineView {
    const timeline = this.history.getTimeline();
    const filtered = branch
      ? timeline.snapshots.filter((s) => s.branch === branch)
      : timeline.snapshots;

    const entries = filtered.map((snap, i) => {
      const prev = i > 0 ? filtered[i - 1] : null;
      return this.snapshotToEntry(snap, prev || undefined);
    });

    const currentIndex = entries.findIndex((e) => e.snapshotId === timeline.currentId);

    return {
      entries,
      currentIndex: currentIndex >= 0 ? currentIndex : entries.length - 1,
      branches: timeline.branches,
      totalSnapshots: timeline.snapshots.length,
    };
  }

  /** Get restore points only. */
  getRestorePoints(): TimelineEntry[] {
    return this.getTimeline().entries.filter((e) => e.isRestorePoint);
  }

  /** Restore to a specific snapshot. */
  restore(snapshotId: string): SceneDocument | null {
    const snap = this.history.restore(snapshotId);
    return snap ? snap.scene : null;
  }

  /** Undo. */
  undo(): SceneDocument | null {
    return this.history.undo()?.scene || null;
  }

  /** Redo. */
  redo(): SceneDocument | null {
    return this.history.redo()?.scene || null;
  }

  /** Create a branch. */
  createBranch(name: string): TimelineEntry {
    const snap = this.history.branch(name);
    return this.snapshotToEntry(snap);
  }

  /** Compare two revisions. */
  compare(fromId: string, toId: string): RevisionComparison | null {
    const timeline = this.history.getTimeline();
    const fromSnap = timeline.snapshots.find((s) => s.id === fromId);
    const toSnap = timeline.snapshots.find((s) => s.id === toId);
    if (!fromSnap || !toSnap) return null;

    const diff = diffScenes(fromSnap.scene, toSnap.scene);
    return {
      from: this.snapshotToEntry(fromSnap),
      to: this.snapshotToEntry(toSnap),
      diff,
      summary: diffSummary(diff),
    };
  }

  /** Get current scene. */
  get scene(): SceneDocument {
    return this.history.scene;
  }

  /** Get the lineage of the current snapshot. */
  getLineage(): TimelineEntry[] {
    return this.history.getLineage().map((s) => this.snapshotToEntry(s));
  }

  /** Prune old snapshots. */
  prune(maxSnapshots: number): number {
    return this.history.prune(maxSnapshots);
  }

  // ─── Internal ──

  private snapshotToEntry(snap: SceneSnapshot, prev?: SceneSnapshot): TimelineEntry {
    let changeSummary = 'Initial';
    if (prev) {
      const diff = diffScenes(prev.scene, snap.scene);
      changeSummary = diffSummary(diff);
    }

    return {
      snapshotId: snap.id,
      label: snap.label,
      source: snap.source,
      timestamp: snap.timestamp,
      hash: snap.hash,
      changeSummary,
      isRestorePoint: this.restorePointIds.has(snap.id),
      branch: snap.branch,
    };
  }
}
