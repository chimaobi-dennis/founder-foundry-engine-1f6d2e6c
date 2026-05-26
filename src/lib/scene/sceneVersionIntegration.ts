/**
 * sceneVersionIntegration.ts
 *
 * Integration layer connecting the existing autosave system
 * with the new versioning infrastructure.
 *
 * This module provides:
 * - Hooks into existing autosave flow
 * - Automatic version creation on significant changes
 * - Pre-mutation snapshots before AI operations
 * - Version-aware save status management
 */

import type { SceneDocument } from "@/types/scene";
import {
  createVersion,
  createManualSaveVersion,
  createPreMutationSnapshot,
  getCurrentVersion,
  type CreateVersionParams,
  type VersionSummary,
  type SaveStatus,
} from "@/services/versionService";

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface VersionIntegrationConfig {
  /** Creative ID being edited */
  creativeId: string;
  /** Brief ID for the creative */
  briefId: string;
  /** Current user ID */
  userId: string;
  /** Minimum time between auto-versions (ms) */
  minVersionIntervalMs: number;
  /** Whether versioning is enabled */
  enabled: boolean;
  /** Max versions to keep per creative */
  maxVersions: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SAVE STATUS MANAGER
// ═══════════════════════════════════════════════════════════════════════════════

export interface SaveState {
  status: SaveStatus;
  lastSavedAt: Date | null;
  pendingChanges: boolean;
  currentVersionId: string | null;
  lastVersionNumber: number;
}

type SaveStateListener = (state: SaveState) => void;

export class SaveStateManager {
  private state: SaveState;
  private listeners: Set<SaveStateListener> = new Set();
  private config: VersionIntegrationConfig;

  constructor(config: VersionIntegrationConfig) {
    this.config = config;
    this.state = {
      status: "saved",
      lastSavedAt: null,
      pendingChanges: false,
      currentVersionId: null,
      lastVersionNumber: 0,
    };
  }

  // ─── State Access ─────────────────────────────────────────────────────────

  getState(): SaveState {
    return { ...this.state };
  }

  subscribe(listener: SaveStateListener): () => void {
    this.listeners.add(listener);
    // Immediately notify with current state
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const state = this.getState();
    this.listeners.forEach((l) => l(state));
  }

  // ─── State Updates ───────────────────────────────────────────────────────

  setSaving(): void {
    this.state.status = "saving";
    this.notify();
  }

  setSaved(versionId?: string, versionNumber?: number): void {
    this.state.status = "saved";
    this.state.lastSavedAt = new Date();
    this.state.pendingChanges = false;
    if (versionId) this.state.currentVersionId = versionId;
    if (versionNumber) this.state.lastVersionNumber = versionNumber;
    this.notify();
  }

  setAutosaved(versionId?: string): void {
    this.state.status = "autosaved";
    this.state.lastSavedAt = new Date();
    this.state.pendingChanges = false;
    if (versionId) this.state.currentVersionId = versionId;
    this.notify();
  }

  setUnsaved(): void {
    if (this.state.status !== "saving" && this.state.status !== "restoring") {
      this.state.status = "unsaved";
      this.state.pendingChanges = true;
      this.notify();
    }
  }

  setRestoring(): void {
    this.state.status = "restoring";
    this.notify();
  }

  setError(): void {
    this.state.status = "error";
    this.notify();
  }

  setCurrentVersion(versionId: string, versionNumber: number): void {
    this.state.currentVersionId = versionId;
    this.state.lastVersionNumber = versionNumber;
    this.notify();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERSION AUTOSAVE INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface VersionAutosaveController {
  /** Trigger immediate version creation */
  saveNow: (sourceType: CreateVersionParams["sourceType"], sourceAction?: string) => Promise<string | null>;
  /** Manual save with optional name */
  manualSave: (name?: string) => Promise<string | null>;
  /** Create snapshot before mutation */
  preMutationSnapshot: (mutationName: string) => Promise<string | null>;
  /** Get current save state */
  getState: () => SaveState;
  /** Subscribe to state changes */
  subscribe: (listener: SaveStateListener) => () => void;
  /** Flush any pending autosave */
  flush: () => Promise<void>;
  /** Destroy/cleanup */
  destroy: () => void;
}

/**
 * Create a version autosave controller that integrates with existing autosave.
 */
export function createVersionAutosave(
  config: VersionIntegrationConfig,
  getCurrentContent: () => {
    sceneJson?: SceneDocument;
    visualHtml?: string;
    copyText?: string;
    headline?: string;
    subjectLine?: string;
    hashtags?: string[];
  }
): VersionAutosaveController {
  const stateManager = new SaveStateManager(config);
  let lastVersionTime = 0;
  let pendingTimer: ReturnType<typeof setTimeout> | null = null;
  let isDestroyed = false;

  // Track content hash to detect real changes
  let lastContentHash: string | null = null;

  const shouldCreateVersion = (): boolean => {
    if (!config.enabled || isDestroyed) return false;
    const now = Date.now();
    return now - lastVersionTime >= config.minVersionIntervalMs;
  };

  const getContentHash = (): string => {
    const content = getCurrentContent();
    return JSON.stringify({
      scene: content.sceneJson,
      html: content.visualHtml,
      copy: content.copyText,
      headline: content.headline,
    });
  };

  const saveNow = async (
    sourceType: CreateVersionParams["sourceType"],
    sourceAction?: string
  ): Promise<string | null> => {
    if (!config.enabled || isDestroyed) return null;

    // Check if content actually changed
    const currentHash = getContentHash();
    if (currentHash === lastContentHash && sourceType !== "manual_save") {
      return null; // No changes, skip
    }

    stateManager.setSaving();

    try {
      const content = getCurrentContent();
      const { versionId, versionNumber } = await createVersion(
        {
          creativeId: config.creativeId,
          briefId: config.briefId,
          sceneJson: content.sceneJson,
          visualHtml: content.visualHtml,
          copyText: content.copyText,
          headline: content.headline,
          subjectLine: content.subjectLine,
          hashtags: content.hashtags,
          sourceType,
          sourceAction,
          versionType: sourceType === "manual_save" ? "manual" : "auto",
        },
        config.userId
      );

      lastVersionTime = Date.now();
      lastContentHash = currentHash;

      if (sourceType === "manual_save") {
        stateManager.setSaved(versionId, versionNumber);
      } else {
        stateManager.setAutosaved(versionId);
      }
      stateManager.setCurrentVersion(versionId, versionNumber);

      return versionId;
    } catch (error) {
      stateManager.setError();
      console.error("[VersionAutosave] Failed to create version:", error);
      return null;
    }
  };

  const manualSave = async (name?: string): Promise<string | null> => {
    const content = getCurrentContent();
    stateManager.setSaving();

    try {
      const { versionId, versionNumber } = await createManualSaveVersion(
        {
          creativeId: config.creativeId,
          briefId: config.briefId,
          sceneJson: content.sceneJson,
          visualHtml: content.visualHtml,
          copyText: content.copyText,
          headline: content.headline,
          subjectLine: content.subjectLine,
          hashtags: content.hashtags,
        },
        config.userId,
        name
      );

      lastVersionTime = Date.now();
      lastContentHash = getContentHash();

      stateManager.setSaved(versionId, versionNumber);
      stateManager.setCurrentVersion(versionId, versionNumber);

      return versionId;
    } catch (error) {
      stateManager.setError();
      console.error("[VersionAutosave] Manual save failed:", error);
      return null;
    }
  };

  const preMutationSnapshot = async (mutationName: string): Promise<string | null> => {
    const content = getCurrentContent();
    stateManager.setSaving();

    try {
      const { versionId } = await createPreMutationSnapshot(
        {
          creativeId: config.creativeId,
          briefId: config.briefId,
          sceneJson: content.sceneJson,
          visualHtml: content.visualHtml,
          copyText: content.copyText,
          headline: content.headline,
          subjectLine: content.subjectLine,
          hashtags: content.hashtags,
        },
        config.userId,
        mutationName
      );

      return versionId;
    } catch (error) {
      console.error("[VersionAutosave] Pre-mutation snapshot failed:", error);
      return null;
    }
  };

  const flush = async (): Promise<void> => {
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }
  };

  const destroy = (): void => {
    isDestroyed = true;
    flush();
  };

  return {
    saveNow,
    manualSave,
    preMutationSnapshot,
    getState: () => stateManager.getState(),
    subscribe: (listener) => stateManager.subscribe(listener),
    flush,
    destroy,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI OPERATION WRAPPER
// ═══════════════════════════════════════════════════════════════════════════════

export interface AIOperationContext {
  preMutationSnapshot: () => Promise<string | null>;
  onComplete: (success: boolean, result?: unknown) => Promise<void>;
  onError: (error: Error) => Promise<void>;
}

/**
 * Wrap an AI operation with version safety (pre-mutation snapshot + post-completion version).
 */
export async function withVersionSafety<T>(
  controller: VersionAutosaveController,
  operationName: string,
  operation: (ctx: AIOperationContext) => Promise<T>
): Promise<T> {
  // Create pre-mutation snapshot
  const snapshotId = await controller.preMutationSnapshot(operationName);

  const ctx: AIOperationContext = {
    preMutationSnapshot: async () => snapshotId,
    onComplete: async (success) => {
      if (success) {
        // Create version of the result
        await controller.saveNow("ai_regenerate", `ai_${operationName}`);
      }
    },
    onError: async () => {
      // Error already logged, snapshot exists for recovery
    },
  };

  try {
    const result = await operation(ctx);
    await ctx.onComplete(true, result);
    return result;
  } catch (error) {
    await ctx.onError(error as Error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTENT STUDIO INTEGRATION HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Initialize version integration for a Content Studio session.
 */
export async function initVersionIntegration(
  creativeId: string,
  briefId: string,
  userId: string,
  getContent: () => {
    sceneJson?: SceneDocument;
    visualHtml?: string;
    copyText?: string;
    headline?: string;
    subjectLine?: string;
    hashtags?: string[];
  },
  options?: {
    minVersionIntervalMs?: number;
    enabled?: boolean;
  }
): Promise<VersionAutosaveController> {
  const config: VersionIntegrationConfig = {
    creativeId,
    briefId,
    userId,
    minVersionIntervalMs: options?.minVersionIntervalMs ?? 120_000, // 2 min default
    enabled: options?.enabled ?? true,
    maxVersions: 50,
  };

  const controller = createVersionAutosave(config, getContent);

  // Load current version info
  try {
    const currentVersion = await getCurrentVersion(creativeId);
    if (currentVersion) {
      const stateManager = (controller as unknown as { stateManager: SaveStateManager }).stateManager;
      if (stateManager) {
        stateManager.setCurrentVersion(currentVersion.id, currentVersion.versionNumber);
      }
    }
  } catch {
    // Silent fail - version system is best-effort
  }

  return controller;
}
