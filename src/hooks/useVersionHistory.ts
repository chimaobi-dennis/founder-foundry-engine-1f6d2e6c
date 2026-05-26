/**
 * useVersionHistory.ts
 *
 * React hook for managing version history in Content Studio.
 * Integrates with the existing autosave system and provides
 * version creation, restoration, and comparison capabilities.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { SceneDocument } from "@/types/scene";
import { useAuth } from "@/contexts/AuthContext";
import {
  createVersion,
  createManualSaveVersion,
  createPreMutationSnapshot,
  getVersionHistory,
  getCurrentVersion,
  restoreVersion,
  compareVersions,
  renameVersion,
  type VersionSummary,
  type FullVersion,
  type DiffResult,
  type CreateVersionParams,
  type SaveStatus,
} from "@/services/versionService";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface VersionHistoryState {
  versions: VersionSummary[];
  currentVersion: FullVersion | null;
  isLoading: boolean;
  isRestoring: boolean;
  error: string | null;
  hasMore: boolean;
}

export interface VersionActions {
  // Version creation
  saveVersion: (name?: string, sourceAction?: string) => Promise<void>;
  createPreMutationVersion: (mutationName: string) => Promise<string | null>;
  autoSaveVersion: (sourceType: CreateVersionParams["sourceType"], sourceAction?: string) => Promise<void>;

  // Version operations
  restore: (versionId: string) => Promise<boolean>;
  compare: (fromVersionId: string, toVersionId: string) => Promise<DiffResult | null>;
  rename: (versionId: string, newName: string) => Promise<void>;

  // Data loading
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
}

export interface AutosaveIntegration {
  status: SaveStatus;
  lastSavedAt: Date | null;
  pendingChanges: boolean;
  flushPending: () => Promise<void>;
}

export interface UseVersionHistoryReturn extends VersionHistoryState, VersionActions {
  autosave: AutosaveIntegration;
}

export interface UseVersionHistoryOptions {
  creativeId: string | null;
  briefId: string | null;
  sceneJson: SceneDocument | null;
  visualHtml?: string;
  copyText?: string;
  headline?: string;
  subjectLine?: string;
  hashtags?: string[];
  enableAutosave?: boolean;
  autosaveIntervalMs?: number;
  onVersionCreated?: (versionId: string) => void;
  onRestoreComplete?: (versionId: string) => void;
  onError?: (error: string) => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useVersionHistory(options: UseVersionHistoryOptions): UseVersionHistoryReturn {
  const {
    creativeId,
    briefId,
    sceneJson,
    visualHtml,
    copyText,
    headline,
    subjectLine,
    hashtags,
    enableAutosave = true,
    autosaveIntervalMs = 120_000, // 2 minutes
    onVersionCreated,
    onRestoreComplete,
    onError,
  } = options;

  const { user } = useAuth();
  const userId = user?.id;

  // State
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [currentVersion, setCurrentVersion] = useState<FullVersion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  // Autosave state
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [pendingChanges, setPendingChanges] = useState(false);

  // Refs for autosave
  const lastContentHash = useRef<string | null>(null);
  const pendingAutoSave = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSnapshot = useRef<{
    resolve: (versionId: string) => void;
    reject: (error: Error) => void;
  } | null>(null);

  const PAGE_SIZE = 20;

  // ═══════════════════════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════════════════════

  const loadVersions = useCallback(
    async (reset = false) => {
      if (!creativeId) {
        console.log('[useVersionHistory] No creativeId, skipping load');
        return;
      }

      console.log('[useVersionHistory] loadVersions START:', { creativeId, reset, offset });
      setIsLoading(true);
      setError(null);

      try {
        const newOffset = reset ? 0 : offset;
        console.log('[useVersionHistory] Fetching version history...');
        const data = await getVersionHistory(creativeId, {
          limit: PAGE_SIZE,
          offset: newOffset,
        });
        console.log('[useVersionHistory] Versions loaded:', data.length, 'versions');

        if (reset) {
          setVersions(data);
          setOffset(PAGE_SIZE);
        } else {
          setVersions((prev) => [...prev, ...data]);
          setOffset(newOffset + PAGE_SIZE);
        }

        setHasMore(data.length === PAGE_SIZE);

        // Also load current version
        console.log('[useVersionHistory] Fetching current version...');
        const current = await getCurrentVersion(creativeId);
        console.log('[useVersionHistory] Current version:', current?.id || 'none');
        setCurrentVersion(current);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load versions";
        console.error('[useVersionHistory] Load FAILED:', err);
        setError(message);
        onError?.(message);
      } finally {
        setIsLoading(false);
        console.log('[useVersionHistory] loadVersions END');
      }
    },
    [creativeId, offset, onError]
  );

  const refresh = useCallback(async () => {
    await loadVersions(true);
  }, [loadVersions]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) return;
    await loadVersions(false);
  }, [hasMore, isLoading, loadVersions]);

  // Initial load
  useEffect(() => {
    if (creativeId) {
      loadVersions(true);
    }
  }, [creativeId]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // VERSION CREATION
  // ═══════════════════════════════════════════════════════════════════════════════

  const createVersionInternal = useCallback(
    async (params: Omit<CreateVersionParams, "creativeId" | "briefId">): Promise<string> => {
      console.log('[useVersionHistory] createVersionInternal START:', {
        hasCreativeId: !!creativeId,
        hasBriefId: !!briefId,
        hasUserId: !!userId,
        params,
      });

      if (!creativeId || !briefId || !userId) {
        console.error('[useVersionHistory] Missing required IDs:', { creativeId, briefId, userId });
        throw new Error("Missing required IDs for version creation");
      }

      setSaveStatus("saving");

      try {
        console.log('[useVersionHistory] Calling createVersion API...');
        const { versionId } = await createVersion(
          {
            creativeId,
            briefId,
            sceneJson,
            visualHtml,
            copyText,
            headline,
            subjectLine,
            hashtags,
            ...params,
          },
          userId
        );

        console.log('[useVersionHistory] Version created SUCCESS:', versionId);
        setSaveStatus("saved");
        setLastSavedAt(new Date());
        setPendingChanges(false);

        // Refresh list
        console.log('[useVersionHistory] Refreshing version list...');
        await refresh();

        onVersionCreated?.(versionId);

        // Resolve any pending snapshot promise
        if (pendingSnapshot.current) {
          pendingSnapshot.current.resolve(versionId);
          pendingSnapshot.current = null;
        }

        return versionId;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create version";
        console.error('[useVersionHistory] createVersionInternal FAILED:', err);
        setSaveStatus("error");
        onError?.(message);
        throw err;
      }
    },
    [creativeId, briefId, userId, sceneJson, visualHtml, copyText, headline, subjectLine, hashtags, refresh, onVersionCreated, onError]
  );

  /**
   * Manual save - creates a named version.
   */
  const saveVersion = useCallback(
    async (name?: string, sourceAction?: string) => {
      if (!userId) return;

      await createVersionInternal({
        sourceType: "manual_save",
        sourceAction: sourceAction || "user_save",
        versionType: name ? "named" : "manual",
        versionName: name,
      });
    },
    [createVersionInternal, userId]
  );

  /**
   * Pre-mutation snapshot - call before destructive operations.
   * Returns a promise that resolves with the version ID.
   */
  const createPreMutationVersion = useCallback(
    async (mutationName: string): Promise<string | null> => {
      if (!userId) return null;

      try {
        const versionId = await createVersionInternal({
          sourceType: "pre_delete",
          sourceAction: `pre_${mutationName}`,
          versionType: "system",
          versionName: `Before ${mutationName}`,
        });
        return versionId;
      } catch {
        return null;
      }
    },
    [createVersionInternal, userId]
  );

  /**
   * Auto-save version - for background saving.
   */
  const autoSaveVersion = useCallback(
    async (sourceType: CreateVersionParams["sourceType"], sourceAction?: string) => {
      if (!userId) return;

      // Check if content actually changed
      const currentHash = sceneJson ? stableSceneHash(sceneJson) : null;
      if (currentHash && currentHash === lastContentHash.current) {
        return; // No changes, skip
      }

      await createVersionInternal({
        sourceType,
        sourceAction,
        versionType: "auto",
      });

      lastContentHash.current = currentHash;
    },
    [createVersionInternal, userId, sceneJson]
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // AUTOSAVE INTEGRATION
  // ═══════════════════════════════════════════════════════════════════════════════

  // Watch for changes and trigger autosave
  useEffect(() => {
    if (!enableAutosave || !creativeId || !sceneJson) return;

    // Calculate content hash
    const currentHash = stableSceneHash(sceneJson);

    // Check if changed
    if (lastContentHash.current && currentHash !== lastContentHash.current) {
      setPendingChanges(true);
      setSaveStatus("unsaved");

      // Debounced autosave
      if (pendingAutoSave.current) {
        clearTimeout(pendingAutoSave.current);
      }

      pendingAutoSave.current = setTimeout(() => {
        autoSaveVersion("auto_snapshot", "auto");
      }, autosaveIntervalMs);
    }

    // Initial hash capture
    if (!lastContentHash.current) {
      lastContentHash.current = currentHash;
    }

    return () => {
      if (pendingAutoSave.current) {
        clearTimeout(pendingAutoSave.current);
      }
    };
  }, [sceneJson, enableAutosave, creativeId, autosaveIntervalMs, autoSaveVersion]);

  const flushPending = useCallback(async () => {
    if (pendingAutoSave.current) {
      clearTimeout(pendingAutoSave.current);
      pendingAutoSave.current = null;
    }

    if (pendingChanges && sceneJson) {
      await autoSaveVersion("auto_snapshot", "flush");
    }
  }, [pendingChanges, sceneJson, autoSaveVersion]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // VERSION OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  const restore = useCallback(
    async (versionId: string): Promise<boolean> => {
      if (!creativeId || !briefId || !userId) return false;

      setIsRestoring(true);
      setSaveStatus("restoring");

      try {
        const result = await restoreVersion(creativeId, briefId, versionId, userId, {
          createRestorePoint: true,
        });

        if (result.success && result.newVersionId) {
          setSaveStatus("saved");
          await refresh();
          onRestoreComplete?.(result.newVersionId);
          return true;
        } else {
          setSaveStatus("error");
          onError?.(result.error || "Restore failed");
          return false;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Restore failed";
        setSaveStatus("error");
        onError?.(message);
        return false;
      } finally {
        setIsRestoring(false);
      }
    },
    [creativeId, briefId, userId, refresh, onRestoreComplete, onError]
  );

  const compare = useCallback(
    async (fromVersionId: string, toVersionId: string): Promise<DiffResult | null> => {
      try {
        return await compareVersions(fromVersionId, toVersionId);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Comparison failed";
        onError?.(message);
        return null;
      }
    },
    [onError]
  );

  const rename = useCallback(
    async (versionId: string, newName: string) => {
      try {
        await renameVersion(versionId, newName);
        await refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Rename failed";
        onError?.(message);
      }
    },
    [refresh, onError]
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    return () => {
      if (pendingAutoSave.current) {
        clearTimeout(pendingAutoSave.current);
      }
    };
  }, []);

  return {
    // State
    versions,
    currentVersion,
    isLoading,
    isRestoring,
    error,
    hasMore,

    // Actions
    saveVersion,
    createPreMutationVersion,
    autoSaveVersion,
    restore,
    compare,
    rename,
    refresh,
    loadMore,

    // Autosave
    autosave: {
      status: saveStatus,
      lastSavedAt,
      pendingChanges,
      flushPending,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// STABLE HASH (local copy to avoid circular deps)
// ═══════════════════════════════════════════════════════════════════════════════

function stableSceneHash(doc: SceneDocument): string {
  // FNV-1a inspired hash for scene documents
  const str = JSON.stringify(doc, Object.keys(doc).sort());
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
}
