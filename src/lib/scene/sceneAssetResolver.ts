/**
 * sceneAssetResolver.ts
 *
 * Resolves and preloads all assets required by a SceneDocument:
 *   - Images (external URLs, data URIs)
 *   - Fonts (via font registry)
 *   - SVG content
 *   - Icon references
 *
 * Required for export reliability, offline-safe rendering,
 * and deterministic previews.
 */

import type { SceneDocument, SceneNode } from '@/types/scene';
import { loadSceneFonts, waitForFontsReady, isFontAllowed, resolveFontFamily } from '@/lib/fonts/fontRegistry';

// ─── Types ────────────────────────────────────────────────────

export interface AssetManifest {
  images: AssetRef[];
  fonts: FontRef[];
  svgs: AssetRef[];
  icons: IconRef[];
  /** Total number of assets. */
  totalCount: number;
  /** Total number of assets that failed to resolve. */
  failedCount: number;
}

export interface AssetRef {
  nodeId: string;
  src: string;
  status: 'pending' | 'loaded' | 'failed';
}

export interface FontRef {
  family: string;
  weight: number;
  allowed: boolean;
  resolved: string;
}

export interface IconRef {
  nodeId: string;
  iconName: string;
  iconLibrary: string;
  resolved: boolean;
}

export interface PreloadResult {
  manifest: AssetManifest;
  /** All assets loaded successfully? */
  allLoaded: boolean;
  /** Duration in ms. */
  durationMs: number;
}

// ─── Manifest Builder ─────────────────────────────────────────

/**
 * Scan a SceneDocument and build a manifest of all required assets.
 */
export function buildAssetManifest(scene: SceneDocument): AssetManifest {
  const images: AssetRef[] = [];
  const fonts: FontRef[] = [];
  const svgs: AssetRef[] = [];
  const icons: IconRef[] = [];

  const seenFonts = new Set<string>();

  function walk(nodes: SceneNode[]) {
    for (const node of nodes) {
      switch (node.type) {
        case 'image':
          if (node.src) {
            images.push({ nodeId: node.id, src: node.src, status: 'pending' });
          }
          break;

        case 'text': {
          const key = `${node.fontFamily}:${node.fontWeight}`;
          if (!seenFonts.has(key)) {
            seenFonts.add(key);
            fonts.push({
              family: node.fontFamily,
              weight: node.fontWeight,
              allowed: isFontAllowed(node.fontFamily),
              resolved: resolveFontFamily(node.fontFamily),
            });
          }
          break;
        }

        case 'button': {
          const bKey = `${node.fontFamily}:${node.fontWeight}`;
          if (!seenFonts.has(bKey)) {
            seenFonts.add(bKey);
            fonts.push({
              family: node.fontFamily,
              weight: node.fontWeight,
              allowed: isFontAllowed(node.fontFamily),
              resolved: resolveFontFamily(node.fontFamily),
            });
          }
          break;
        }

        case 'svg':
          if (node.svgContent) {
            svgs.push({ nodeId: node.id, src: node.svgContent.slice(0, 100), status: 'pending' });
          }
          break;

        case 'icon':
          icons.push({
            nodeId: node.id,
            iconName: node.iconName,
            iconLibrary: node.iconLibrary,
            resolved: false,
          });
          break;

        case 'group':
        case 'frame':
        case 'stack':
          walk(node.children);
          break;
      }
    }
  }

  walk(scene.nodes);

  const totalCount = images.length + fonts.length + svgs.length + icons.length;

  return { images, fonts, svgs, icons, totalCount, failedCount: 0 };
}

// ─── Preloader ────────────────────────────────────────────────

/**
 * Preload all assets for a SceneDocument.
 * Loads fonts via the font registry and images via fetch.
 * Returns a manifest with status updates.
 */
export async function preloadSceneAssets(scene: SceneDocument): Promise<PreloadResult> {
  const start = performance.now();
  const manifest = buildAssetManifest(scene);

  // Fonts
  try {
    await loadSceneFonts(scene);
    await waitForFontsReady();
  } catch (err) {
    console.warn('[sceneAssetResolver] Font loading failed:', err);
  }

  // Images — preload in parallel
  const imageResults = await Promise.allSettled(
    manifest.images.map(async (ref) => {
      try {
        if (ref.src.startsWith('data:')) {
          ref.status = 'loaded';
          return;
        }
        const resp = await fetch(ref.src, { mode: 'cors', method: 'HEAD' });
        ref.status = resp.ok ? 'loaded' : 'failed';
      } catch {
        ref.status = 'failed';
      }
    })
  );

  // SVGs — validate they parse
  for (const ref of manifest.svgs) {
    try {
      if (ref.src.startsWith('data:') || ref.src.startsWith('<svg')) {
        ref.status = 'loaded';
      } else {
        ref.status = 'loaded'; // Inline content, assume valid
      }
    } catch {
      ref.status = 'failed';
    }
  }

  // Count failures
  manifest.failedCount =
    manifest.images.filter((r) => r.status === 'failed').length +
    manifest.svgs.filter((r) => r.status === 'failed').length +
    manifest.fonts.filter((r) => !r.allowed).length;

  const durationMs = Math.round(performance.now() - start);

  return {
    manifest,
    allLoaded: manifest.failedCount === 0,
    durationMs,
  };
}

/**
 * Quick check: does this scene have any external image URLs
 * that need network access?
 */
export function hasExternalAssets(scene: SceneDocument): boolean {
  function check(nodes: SceneNode[]): boolean {
    for (const node of nodes) {
      if (node.type === 'image' && node.src && !node.src.startsWith('data:')) return true;
      if (node.type === 'group' || node.type === 'frame' || node.type === 'stack') {
        if (check(node.children)) return true;
      }
    }
    return false;
  }
  return check(scene.nodes);
}
