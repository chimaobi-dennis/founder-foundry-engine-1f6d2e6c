/**
 * studioBridge.ts
 *
 * Shared scene architecture between ContentStudio and ProStudio.
 *
 * Both studios converge onto ONE scene engine:
 *   - Unified SceneDocument
 *   - Reusable renderer
 *   - Reusable export pipeline
 *   - Reusable node system
 *
 * This module provides the compatibility contract and helpers
 * so both studios can interop without duplicating renderer systems.
 */

import type {
  SceneDocument,
  SceneNode,
  RenderEngine,
  StudioSessionPayload,
  SceneMetadata,
} from '@/types/scene';
import { prepareScene } from './safeRenderScene';
import { stableSceneHash } from './stableSceneHash';
import { buildAssetManifest, type AssetManifest } from './sceneAssetResolver';

// ─── Studio Types ─────────────────────────────────────────────

export type StudioType = 'content_studio' | 'pro_studio';

export interface StudioScenePayload {
  /** Which studio this came from. */
  studio: StudioType;
  /** The render engine in use. */
  renderEngine: RenderEngine;
  /** Validated + normalized scene document. */
  scene: SceneDocument;
  /** Stable hash for caching / dedup. */
  hash: string;
  /** Asset manifest for preloading. */
  assets: AssetManifest;
  /** Scene metadata for AI/intelligence features. */
  meta: SceneMetadata | undefined;
}

export interface StudioExportRequest {
  studio: StudioType;
  scene: SceneDocument;
  format: 'png' | 'jpeg' | 'pdf' | 'svg';
  pixelRatio?: number;
  quality?: number;
  background?: string;
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Prepare a scene for use in either studio.
 * Validates, normalizes, migrates, computes hash and asset manifest.
 */
export function prepareStudioScene(
  raw: unknown,
  studio: StudioType
): StudioScenePayload {
  const { document: scene } = prepareScene(raw);
  return {
    studio,
    renderEngine: 'scene',
    scene,
    hash: stableSceneHash(scene),
    assets: buildAssetManifest(scene),
    meta: scene.meta,
  };
}

/**
 * Convert a StudioScenePayload to a StudioSessionPayload
 * (the shape the frontend expects when loading a session).
 */
export function toSessionPayload(payload: StudioScenePayload): StudioSessionPayload {
  return {
    renderEngine: payload.renderEngine,
    visualHtml: null,
    sceneJson: payload.scene,
  };
}

/**
 * Convert a legacy session payload (possibly HTML) into a StudioScenePayload.
 * If the session is HTML-only, returns null — caller should convert via htmlToScene.
 */
export function fromSessionPayload(
  session: StudioSessionPayload,
  studio: StudioType
): StudioScenePayload | null {
  if (session.renderEngine !== 'scene' || !session.sceneJson) {
    return null;
  }
  return prepareStudioScene(session.sceneJson, studio);
}

/**
 * Merge nodes from one scene into another.
 * Useful for composing scenes from templates + user edits.
 * Deduplicates by node ID.
 */
export function mergeSceneNodes(
  base: SceneDocument,
  overlay: SceneNode[]
): SceneDocument {
  const existingIds = new Set(base.nodes.map((n) => n.id));
  const newNodes = overlay.filter((n) => !existingIds.has(n.id));
  const maxZ = base.nodes.reduce((max, n) => Math.max(max, n.zIndex), -1);

  return {
    ...base,
    nodes: [
      ...base.nodes,
      ...newNodes.map((n, i) => ({ ...n, zIndex: maxZ + 1 + i })),
    ],
  };
}

/**
 * Clone a scene document with new IDs for all nodes.
 * Used for template instantiation and duplication.
 */
export function cloneScene(scene: SceneDocument): SceneDocument {
  function cloneNode(node: SceneNode): SceneNode {
    const newId = `${node.type}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;

    if (node.type === 'group' || node.type === 'frame' || node.type === 'stack') {
      return {
        ...node,
        id: newId,
        children: node.children.map(cloneNode),
      } as SceneNode;
    }

    return { ...node, id: newId };
  }

  return {
    ...scene,
    nodes: scene.nodes.map(cloneNode),
  };
}

/**
 * Check compatibility between two studios' scenes.
 * Returns true if the scene can be used in both studios without loss.
 */
export function isCompatible(scene: SceneDocument): { compatible: boolean; issues: string[] } {
  const issues: string[] = [];

  // Check for unsupported node types (future-proofing)
  const validTypes = new Set(['text', 'image', 'shape', 'group', 'frame', 'stack', 'svg', 'icon', 'button']);
  function checkNodes(nodes: SceneNode[]) {
    for (const node of nodes) {
      if (!validTypes.has(node.type)) {
        issues.push(`Unknown node type: ${node.type}`);
      }
      if (node.type === 'group' || node.type === 'frame' || node.type === 'stack') {
        checkNodes(node.children);
      }
    }
  }
  checkNodes(scene.nodes);

  if (!scene.version) {
    issues.push('Missing scene version');
  }
  if (scene.width <= 0 || scene.height <= 0) {
    issues.push('Invalid canvas dimensions');
  }

  return { compatible: issues.length === 0, issues };
}
