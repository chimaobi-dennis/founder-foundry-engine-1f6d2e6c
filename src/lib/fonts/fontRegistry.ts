/**
 * fontRegistry.ts
 *
 * Centralised font registry for the scene rendering pipeline.
 * Guarantees deterministic font loading for editor/export parity.
 *
 * DO NOT allow arbitrary AI font URLs — only whitelisted families.
 */

import type { SceneDocument, SceneNode } from '@/types/scene';

// ─── Allowed Fonts ────────────────────────────────────────────

export interface FontEntry {
  family: string;
  weights: number[];
  googleFamily: string; // value used in the Google Fonts URL
}

const FONT_REGISTRY: FontEntry[] = [
  { family: 'DM Sans', weights: [400, 500, 700], googleFamily: 'DM+Sans' },
  { family: 'Inter', weights: [400, 500, 600, 700], googleFamily: 'Inter' },
  { family: 'Playfair Display', weights: [400, 700], googleFamily: 'Playfair+Display' },
  { family: 'Poppins', weights: [400, 500, 600, 700], googleFamily: 'Poppins' },
  { family: 'Space Grotesk', weights: [400, 500, 700], googleFamily: 'Space+Grotesk' },
];

const FALLBACK_FONT = 'Inter';

/** Immutable map for O(1) lookups (lower-cased key). */
const registryMap = new Map<string, FontEntry>(
  FONT_REGISTRY.map((f) => [f.family.toLowerCase(), f])
);

// ─── Public API ───────────────────────────────────────────────

/** Check whether a font family is in the whitelist. */
export function isFontAllowed(family: string): boolean {
  return registryMap.has(family.toLowerCase());
}

/** Resolve a possibly-unknown family to a safe whitelisted family. */
export function resolveFontFamily(family: string): string {
  if (isFontAllowed(family)) return family;
  return FALLBACK_FONT;
}

/** Resolve a font weight to the closest allowed weight for a family. */
export function resolveFontWeight(family: string, weight: number): number {
  const entry = registryMap.get(family.toLowerCase());
  if (!entry) return 400;
  // Pick closest allowed weight
  let best = entry.weights[0];
  let bestDist = Math.abs(weight - best);
  for (const w of entry.weights) {
    const d = Math.abs(weight - w);
    if (d < bestDist) {
      best = w;
      bestDist = d;
    }
  }
  return best;
}

/** Get the full registry (read-only). */
export function getAllFonts(): ReadonlyArray<FontEntry> {
  return FONT_REGISTRY;
}

// ─── Font Loading ─────────────────────────────────────────────

const loadedFamilies = new Set<string>();
let linkElement: HTMLLinkElement | null = null;

/**
 * Build a Google Fonts URL for the given families + weights.
 */
function buildGoogleFontsUrl(entries: { entry: FontEntry; weights: number[] }[]): string {
  const families = entries.map(({ entry, weights }) => {
    const uniqueWeights = [...new Set(weights)].sort((a, b) => a - b);
    return `family=${entry.googleFamily}:wght@${uniqueWeights.join(';')}`;
  });
  return `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`;
}

/**
 * Collect all unique font families + weights used in a scene.
 */
function collectSceneFonts(scene: SceneDocument): Map<string, Set<number>> {
  const map = new Map<string, Set<number>>();

  function walk(nodes: SceneNode[]) {
    for (const node of nodes) {
      if (node.type === 'text') {
        const family = resolveFontFamily(node.fontFamily);
        const weight = resolveFontWeight(family, node.fontWeight);
        if (!map.has(family)) map.set(family, new Set());
        map.get(family)!.add(weight);
      } else if (node.type === 'group') {
        walk(node.children);
      }
    }
  }

  walk(scene.nodes);
  return map;
}

/**
 * Preload all fonts used in a SceneDocument.
 * Returns a promise that resolves once all fonts are loaded and ready.
 * Safe to call multiple times — already-loaded fonts are skipped.
 */
export async function loadSceneFonts(scene: SceneDocument): Promise<void> {
  const needed = collectSceneFonts(scene);
  if (needed.size === 0) return;

  // Filter out already-loaded families
  const toLoad: { entry: FontEntry; weights: number[] }[] = [];
  for (const [family, weights] of needed) {
    const key = family.toLowerCase();
    if (loadedFamilies.has(key)) continue;
    const entry = registryMap.get(key);
    if (!entry) continue;
    toLoad.push({ entry, weights: [...weights] });
  }

  if (toLoad.length === 0) return;

  // Inject / update <link> in <head>
  const url = buildGoogleFontsUrl(toLoad);

  if (typeof document !== 'undefined') {
    if (linkElement) linkElement.remove();
    linkElement = document.createElement('link');
    linkElement.rel = 'stylesheet';
    linkElement.href = url;
    document.head.appendChild(linkElement);
  }

  // Wait for fonts to actually be available via the Font Loading API
  if (typeof document !== 'undefined' && document.fonts) {
    const promises: Promise<FontFace[]>[] = [];
    for (const { entry, weights } of toLoad) {
      for (const w of weights) {
        promises.push(document.fonts.load(`${w} 16px "${entry.family}"`));
      }
    }
    await Promise.all(promises);
  }

  // Mark as loaded
  for (const { entry } of toLoad) {
    loadedFamilies.add(entry.family.toLowerCase());
  }
}

/**
 * Wait until the browser reports all fonts are ready.
 * Use as a safety net after loadSceneFonts.
 */
export async function waitForFontsReady(): Promise<void> {
  if (typeof document !== 'undefined' && document.fonts) {
    await document.fonts.ready;
  }
}

/** Fallback font family constant. */
export const FALLBACK_FONT_FAMILY = FALLBACK_FONT;
