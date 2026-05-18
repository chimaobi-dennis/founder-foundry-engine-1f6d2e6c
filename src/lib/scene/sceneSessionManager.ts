/**
 * sceneSessionManager.ts
 *
 * Live AI editing session state.
 * Tracks active scene, selections, undo stack, drafts, autosave,
 * and AI action history.
 */

import type { SceneDocument } from '@/types/scene';
import { SceneHistory, type SceneSnapshot, type SnapshotSource } from './sceneVersioning';
import { stableSceneHash } from './stableSceneHash';

// ─── Types ────────────────────────────────────────────────────

export interface SessionState {
  sessionId: string;
  scene: SceneDocument;
  selectedNodeIds: string[];
  isDirty: boolean;
  lastSavedHash: string;
  aiActionLog: AiAction[];
  exportState: ExportState;
  createdAt: string;
  updatedAt: string;
}

export interface AiAction {
  id: string;
  type: string;
  instruction: string;
  timestamp: string;
  durationMs: number;
  accepted: boolean;
}

export interface ExportState {
  lastExportFormat: string | null;
  lastExportTimestamp: string | null;
  exportsCount: number;
}

export interface SessionEvents {
  onSceneChange?: (scene: SceneDocument) => void;
  onSelectionChange?: (nodeIds: string[]) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onAutoSave?: (scene: SceneDocument) => void;
}

// ─── Session Manager ─────────────────────────────────────────

export class SceneSessionManager {
  private state: SessionState;
  private history: SceneHistory;
  private events: SessionEvents;
  private autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private autoSaveIntervalMs: number;

  constructor(
    scene: SceneDocument,
    options: {
      sessionId?: string;
      events?: SessionEvents;
      autoSaveIntervalMs?: number;
    } = {}
  ) {
    const now = new Date().toISOString();
    this.state = {
      sessionId: options.sessionId || `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      scene,
      selectedNodeIds: [],
      isDirty: false,
      lastSavedHash: stableSceneHash(scene),
      aiActionLog: [],
      exportState: { lastExportFormat: null, lastExportTimestamp: null, exportsCount: 0 },
      createdAt: now,
      updatedAt: now,
    };
    this.history = new SceneHistory(scene);
    this.events = options.events || {};
    this.autoSaveIntervalMs = options.autoSaveIntervalMs ?? 30_000;
    this.startAutoSave();
  }

  // ── Scene Access ──

  get scene(): SceneDocument {
    return this.state.scene;
  }

  get sessionId(): string {
    return this.state.sessionId;
  }

  get isDirty(): boolean {
    return this.state.isDirty;
  }

  get selectedNodeIds(): string[] {
    return this.state.selectedNodeIds;
  }

  // ── Scene Updates ──

  /** Apply a new scene (from mutation, patch, etc). */
  updateScene(scene: SceneDocument, source: SnapshotSource, label: string): void {
    this.state.scene = scene;
    this.state.updatedAt = new Date().toISOString();
    this.state.isDirty = stableSceneHash(scene) !== this.state.lastSavedHash;
    this.history.push(scene, source, label);
    this.events.onSceneChange?.(scene);
    this.events.onDirtyChange?.(this.state.isDirty);
  }

  // ── Selection ──

  selectNodes(nodeIds: string[]): void {
    this.state.selectedNodeIds = nodeIds;
    this.events.onSelectionChange?.(nodeIds);
  }

  clearSelection(): void {
    this.selectNodes([]);
  }

  // ── Undo / Redo ──

  undo(): SceneDocument | null {
    const snap = this.history.undo();
    if (!snap) return null;
    this.state.scene = snap.scene;
    this.state.updatedAt = new Date().toISOString();
    this.events.onSceneChange?.(snap.scene);
    return snap.scene;
  }

  redo(): SceneDocument | null {
    const snap = this.history.redo();
    if (!snap) return null;
    this.state.scene = snap.scene;
    this.state.updatedAt = new Date().toISOString();
    this.events.onSceneChange?.(snap.scene);
    return snap.scene;
  }

  // ── AI Actions ──

  logAiAction(type: string, instruction: string, durationMs: number, accepted: boolean): void {
    this.state.aiActionLog.push({
      id: `ai_${Date.now().toString(36)}`,
      type,
      instruction,
      timestamp: new Date().toISOString(),
      durationMs,
      accepted,
    });
  }

  getAiActions(): AiAction[] {
    return this.state.aiActionLog;
  }

  // ── Save ──

  markSaved(): void {
    this.state.lastSavedHash = stableSceneHash(this.state.scene);
    this.state.isDirty = false;
    this.events.onDirtyChange?.(false);
  }

  // ── Export ──

  recordExport(format: string): void {
    this.state.exportState.lastExportFormat = format;
    this.state.exportState.lastExportTimestamp = new Date().toISOString();
    this.state.exportState.exportsCount++;
  }

  // ── History ──

  getHistory(): SceneHistory {
    return this.history;
  }

  getSnapshot(): SessionState {
    return { ...this.state };
  }

  // ── AutoSave ──

  private startAutoSave(): void {
    if (this.autoSaveIntervalMs <= 0) return;
    this.autoSaveTimer = setInterval(() => {
      if (this.state.isDirty) {
        this.events.onAutoSave?.(this.state.scene);
      }
    }, this.autoSaveIntervalMs);
  }

  destroy(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }
}
