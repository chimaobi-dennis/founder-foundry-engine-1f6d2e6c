/**
 * sceneBrandMemory.ts
 *
 * Visual memory intelligence.
 * Tracks recurring layouts, typography patterns, CTA structures,
 * visual density, and composition tendencies across generated scenes.
 *
 * Ensures future outputs evolve coherently without repeating identical layouts.
 */

import type { SceneDocument, SceneNode, SceneMetadata } from '@/types/scene';
import { stableSceneHash } from './stableSceneHash';
import { scoreComposition } from './composition/compositionScoring';
import { analyzeOccupancy, analyzeBalance } from './composition/visualBalance';

// ─── Types ────────────────────────────────────────────────────

export interface SceneFingerprint {
  /** Stable hash of the scene. */
  hash: string;
  /** Number of top-level nodes. */
  nodeCount: number;
  /** Node type distribution. */
  nodeTypeCounts: Record<string, number>;
  /** Dominant composition style. */
  compositionStyle: SceneMetadata['compositionStyle'] | 'unknown';
  /** Visual density. */
  visualDensity: SceneMetadata['visualDensity'] | 'unknown';
  /** Occupancy fraction. */
  occupancy: number;
  /** Balance imbalance score. */
  imbalance: number;
  /** Typography fingerprint. */
  typographySignature: string;
  /** Color palette fingerprint. */
  colorSignature: string;
  /** Composition score. */
  compositionScore: number;
  /** Timestamp. */
  timestamp: string;
  /** Platform slug. */
  platform?: string;
}

export interface BrandMemory {
  /** All fingerprints collected. */
  fingerprints: SceneFingerprint[];
  /** Aggregated tendencies. */
  tendencies: BrandTendencies;
}

export interface BrandTendencies {
  /** Most used composition styles. */
  preferredStyles: Array<{ style: string; count: number }>;
  /** Most used font families. */
  preferredFonts: Array<{ font: string; count: number }>;
  /** Average occupancy. */
  avgOccupancy: number;
  /** Average composition score. */
  avgScore: number;
  /** Average density. */
  avgDensity: string;
  /** Hashes of all generated scenes (for deduplication). */
  seenHashes: Set<string>;
  /** Total scenes analyzed. */
  totalScenes: number;
}

// ─── Fingerprinting ──────────────────────────────────────────

/**
 * Generate a fingerprint from a scene.
 */
export function fingerprintScene(scene: SceneDocument, platform?: string): SceneFingerprint {
  const nodeTypeCounts: Record<string, number> = {};
  const fonts: string[] = [];
  const colors: string[] = [];

  function walk(nodes: SceneNode[]) {
    for (const node of nodes) {
      nodeTypeCounts[node.type] = (nodeTypeCounts[node.type] || 0) + 1;
      if (node.type === 'text') {
        fonts.push(node.fontFamily);
        colors.push(node.color);
      }
      if (node.type === 'button') {
        fonts.push(node.fontFamily);
        colors.push(node.fill);
      }
      if (node.type === 'shape' || node.type === 'frame') {
        colors.push((node as { fill: string }).fill);
      }
      if ('children' in node && Array.isArray(node.children)) walk(node.children);
    }
  }
  walk(scene.nodes);

  const occ = analyzeOccupancy(scene);
  const bal = analyzeBalance(scene);
  const score = scoreComposition(scene);

  // Typography signature: sorted unique fonts
  const typoSig = [...new Set(fonts)].sort().join(',') || 'none';
  // Color signature: sorted unique colors
  const colorSig = [...new Set(colors)].sort().join(',') || 'none';

  const density: SceneMetadata['visualDensity'] =
    occ.occupancy > 0.65 ? 'dense' : occ.occupancy < 0.35 ? 'sparse' : 'balanced';

  return {
    hash: stableSceneHash(scene),
    nodeCount: scene.nodes.length,
    nodeTypeCounts,
    compositionStyle: scene.meta?.compositionStyle || 'unknown',
    visualDensity: density,
    occupancy: Math.round(occ.occupancy * 100) / 100,
    imbalance: Math.round(bal.imbalance * 100) / 100,
    typographySignature: typoSig,
    colorSignature: colorSig,
    compositionScore: score.overall,
    timestamp: new Date().toISOString(),
    platform,
  };
}

// ─── Brand Memory Manager ────────────────────────────────────

export class BrandMemoryManager {
  private fingerprints: SceneFingerprint[] = [];
  private seenHashes = new Set<string>();

  /** Record a new scene generation. */
  record(scene: SceneDocument, platform?: string): SceneFingerprint {
    const fp = fingerprintScene(scene, platform);
    this.fingerprints.push(fp);
    this.seenHashes.add(fp.hash);
    return fp;
  }

  /** Check if a scene is a duplicate of something already generated. */
  isDuplicate(scene: SceneDocument): boolean {
    return this.seenHashes.has(stableSceneHash(scene));
  }

  /** Get aggregated brand tendencies. */
  getTendencies(): BrandTendencies {
    const styleCounts = new Map<string, number>();
    const fontCounts = new Map<string, number>();
    let totalOcc = 0;
    let totalScore = 0;
    const densities: string[] = [];

    for (const fp of this.fingerprints) {
      const style = fp.compositionStyle || 'unknown';
      styleCounts.set(style, (styleCounts.get(style) || 0) + 1);

      for (const font of fp.typographySignature.split(',')) {
        if (font && font !== 'none') fontCounts.set(font, (fontCounts.get(font) || 0) + 1);
      }

      totalOcc += fp.occupancy;
      totalScore += fp.compositionScore;
      densities.push(fp.visualDensity || 'balanced');
    }

    const n = this.fingerprints.length || 1;

    // Most common density
    const densCount = new Map<string, number>();
    for (const d of densities) densCount.set(d, (densCount.get(d) || 0) + 1);
    const avgDensity = [...densCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'balanced';

    return {
      preferredStyles: [...styleCounts.entries()]
        .map(([style, count]) => ({ style, count }))
        .sort((a, b) => b.count - a.count),
      preferredFonts: [...fontCounts.entries()]
        .map(([font, count]) => ({ font, count }))
        .sort((a, b) => b.count - a.count),
      avgOccupancy: Math.round((totalOcc / n) * 100) / 100,
      avgScore: Math.round(totalScore / n),
      avgDensity,
      seenHashes: new Set(this.seenHashes),
      totalScenes: this.fingerprints.length,
    };
  }

  /** Suggest a composition style that hasn't been overused. */
  suggestStyle(): SceneMetadata['compositionStyle'] {
    const tendencies = this.getTendencies();
    const all: Array<NonNullable<SceneMetadata['compositionStyle']>> = ['editorial', 'minimal', 'bold', 'cinematic', 'modular'];
    const used = new Map(tendencies.preferredStyles.map((s) => [s.style, s.count]));

    // Pick the least-used style
    const scored = all.map((s) => ({ style: s, count: used.get(s) || 0 }));
    scored.sort((a, b) => a.count - b.count);
    return scored[0].style;
  }

  /** Export memory for persistence. */
  export(): BrandMemory {
    return {
      fingerprints: [...this.fingerprints],
      tendencies: this.getTendencies(),
    };
  }

  /** Import previously persisted memory. */
  import(memory: BrandMemory): void {
    this.fingerprints = [...memory.fingerprints];
    this.seenHashes = new Set(this.fingerprints.map((f) => f.hash));
  }

  get size(): number {
    return this.fingerprints.length;
  }
}
