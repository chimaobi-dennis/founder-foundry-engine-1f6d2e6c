/**
 * sceneRecovery.ts
 *
 * Crash recovery, autosave snapshots, draft recovery,
 * export recovery, and mutation rollback.
 */

import type { SceneDocument } from '@/types/scene';
import { stableSceneHash } from './stableSceneHash';

// ─── Types ────────────────────────────────────────────────────

export interface RecoverySnapshot {
  id: string;
  sessionId: string;
  scene: SceneDocument;
  hash: string;
  timestamp: string;
  source: 'autosave' | 'manual' | 'pre_export' | 'pre_mutation' | 'crash_recovery';
  label: string;
}

export interface RecoveryState {
  snapshots: RecoverySnapshot[];
  lastAutosaveTimestamp: string | null;
  maxSnapshots: number;
}

export interface RecoveryOptions {
  /** Storage key prefix. Default 'kinika_recovery'. */
  storageKeyPrefix?: string;
  /** Max snapshots to keep. Default 10. */
  maxSnapshots?: number;
  /** Autosave interval ms. Default 30000. */
  autosaveIntervalMs?: number;
}

// ─── Storage Abstraction ─────────────────────────────────────

export interface RecoveryStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

/** LocalStorage-backed storage (browser). */
export const localStorageAdapter: RecoveryStorage = {
  get: (key) => {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set: (key, value) => {
    try { localStorage.setItem(key, value); } catch { /* noop */ }
  },
  remove: (key) => {
    try { localStorage.removeItem(key); } catch { /* noop */ }
  },
};

/** In-memory storage (SSR / testing). */
export function createMemoryStorage(): RecoveryStorage {
  const store = new Map<string, string>();
  return {
    get: (key) => store.get(key) || null,
    set: (key, value) => store.set(key, value),
    remove: (key) => store.delete(key),
  };
}

// ─── Recovery Manager ────────────────────────────────────────

export class SceneRecoveryManager {
  private state: RecoveryState;
  private storage: RecoveryStorage;
  private prefix: string;
  private autosaveTimer: ReturnType<typeof setInterval> | null = null;
  private autosaveCallback: (() => SceneDocument | null) | null = null;

  constructor(
    storage: RecoveryStorage,
    options: RecoveryOptions = {}
  ) {
    this.storage = storage;
    this.prefix = options.storageKeyPrefix || 'kinika_recovery';
    this.state = {
      snapshots: [],
      lastAutosaveTimestamp: null,
      maxSnapshots: options.maxSnapshots || 10,
    };

    // Load existing snapshots from storage
    this.loadFromStorage();
  }

  /** Save a recovery snapshot. */
  save(
    scene: SceneDocument,
    sessionId: string,
    source: RecoverySnapshot['source'],
    label = ''
  ): RecoverySnapshot {
    const snapshot: RecoverySnapshot = {
      id: `rec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      sessionId,
      scene,
      hash: stableSceneHash(scene),
      timestamp: new Date().toISOString(),
      source,
      label: label || source,
    };

    this.state.snapshots.push(snapshot);
    this.state.lastAutosaveTimestamp = snapshot.timestamp;

    // Prune if over limit
    while (this.state.snapshots.length > this.state.maxSnapshots) {
      this.state.snapshots.shift();
    }

    this.persistToStorage();
    return snapshot;
  }

  /** Get the latest recovery snapshot. */
  getLatest(): RecoverySnapshot | null {
    if (this.state.snapshots.length === 0) return null;
    return this.state.snapshots[this.state.snapshots.length - 1];
  }

  /** Get all recovery snapshots for a session. */
  getForSession(sessionId: string): RecoverySnapshot[] {
    return this.state.snapshots.filter((s) => s.sessionId === sessionId);
  }

  /** Get all snapshots. */
  getAll(): RecoverySnapshot[] {
    return [...this.state.snapshots];
  }

  /** Recover a specific snapshot. */
  recover(snapshotId: string): SceneDocument | null {
    const snapshot = this.state.snapshots.find((s) => s.id === snapshotId);
    return snapshot ? snapshot.scene : null;
  }

  /** Recover the latest snapshot. */
  recoverLatest(): SceneDocument | null {
    return this.getLatest()?.scene || null;
  }

  /** Check if there are any recoverable snapshots. */
  hasRecoveryData(): boolean {
    return this.state.snapshots.length > 0;
  }

  /** Clear a specific snapshot. */
  clearSnapshot(snapshotId: string): void {
    this.state.snapshots = this.state.snapshots.filter((s) => s.id !== snapshotId);
    this.persistToStorage();
  }

  /** Clear all recovery data. */
  clearAll(): void {
    this.state.snapshots = [];
    this.state.lastAutosaveTimestamp = null;
    this.storage.remove(this.storageKey());
  }

  /** Start autosave timer. */
  startAutosave(
    intervalMs: number,
    sessionId: string,
    getScene: () => SceneDocument | null
  ): void {
    this.stopAutosave();
    this.autosaveCallback = getScene;
    this.autosaveTimer = setInterval(() => {
      const scene = this.autosaveCallback?.();
      if (scene) {
        this.save(scene, sessionId, 'autosave', 'Autosave');
      }
    }, intervalMs);
  }

  /** Stop autosave timer. */
  stopAutosave(): void {
    if (this.autosaveTimer) {
      clearInterval(this.autosaveTimer);
      this.autosaveTimer = null;
    }
    this.autosaveCallback = null;
  }

  /** Destroy (cleanup timers). */
  destroy(): void {
    this.stopAutosave();
  }

  // ─── Internal ──

  private storageKey(): string {
    return `${this.prefix}_snapshots`;
  }

  private persistToStorage(): void {
    try {
      const serializable = this.state.snapshots.map((s) => ({
        id: s.id,
        sessionId: s.sessionId,
        scene: s.scene,
        hash: s.hash,
        timestamp: s.timestamp,
        source: s.source,
        label: s.label,
      }));
      this.storage.set(this.storageKey(), JSON.stringify(serializable));
    } catch {
      // Storage full or unavailable — silent fail
    }
  }

  private loadFromStorage(): void {
    try {
      const raw = this.storage.get(this.storageKey());
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        this.state.snapshots = parsed as RecoverySnapshot[];
      }
    } catch {
      // Corrupt data — start fresh
    }
  }
}
