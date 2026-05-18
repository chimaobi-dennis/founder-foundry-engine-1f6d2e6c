/**
 * repairScene.ts
 *
 * Automatically fixes common AI generation defects.
 * Runs after AI generation, before rendering.
 * All transformations are immutable.
 */

import type { SceneDocument, SceneNode, TextNode } from '@/types/scene';
import { getSafeRegion } from './composition/safeZones';
import { resolveFontFamily, resolveFontWeight } from '@/lib/fonts/fontRegistry';
import { sanitizeColor } from './validateSceneDocument';

// ─── Types ────────────────────────────────────────────────────

export interface RepairResult {
  scene: SceneDocument;
  repairsApplied: RepairAction[];
  totalRepairs: number;
}

export interface RepairAction {
  type: string;
  nodeId?: string;
  description: string;
}

export interface RepairOptions {
  platformSlug?: string;
  minFontSize?: number;
  maxFontSize?: number;
  /** Fix overlapping text nodes. Default true. */
  fixOverlaps?: boolean;
  /** Fix off-canvas elements. Default true. */
  fixOffCanvas?: boolean;
  /** Fix safe zone violations. Default true. */
  fixSafeZones?: boolean;
  /** Fix unreadable text. Default true. */
  fixReadability?: boolean;
  /** Fix invalid fonts. Default true. */
  fixFonts?: boolean;
  /** Fix invalid colors. Default true. */
  fixColors?: boolean;
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Auto-repair a scene. Returns a new scene with all fixes applied.
 */
export function repairScene(
  scene: SceneDocument,
  options: RepairOptions = {}
): RepairResult {
  const {
    platformSlug = 'generic',
    minFontSize = 10,
    maxFontSize = 200,
    fixOverlaps = true,
    fixOffCanvas = true,
    fixSafeZones = true,
    fixReadability = true,
    fixFonts = true,
    fixColors = true,
  } = options;

  const repairs: RepairAction[] = [];
  let result = scene;

  // 1. Fix invalid colors
  if (fixColors) result = repairColors(result, repairs);

  // 2. Fix invalid fonts
  if (fixFonts) result = repairFonts(result, repairs);

  // 3. Fix unreadable text (too small / too large)
  if (fixReadability) result = repairReadability(result, minFontSize, maxFontSize, repairs);

  // 4. Fix off-canvas elements
  if (fixOffCanvas) result = repairOffCanvas(result, repairs);

  // 5. Fix safe zone violations
  if (fixSafeZones) result = repairSafeZones(result, platformSlug, repairs);

  // 6. Fix overlapping text
  if (fixOverlaps) result = repairOverlaps(result, repairs);

  // 7. Fix broken hierarchy (duplicate zIndex)
  result = repairZIndex(result, repairs);

  return {
    scene: result,
    repairsApplied: repairs,
    totalRepairs: repairs.length,
  };
}

// ─── Repair Functions ────────────────────────────────────────

function repairColors(scene: SceneDocument, repairs: RepairAction[]): SceneDocument {
  const bg = sanitizeColor(scene.background || '#ffffff');
  if (bg !== scene.background) {
    repairs.push({ type: 'fix_color', description: `Fixed invalid background: ${scene.background} → ${bg}` });
  }

  const nodes = scene.nodes.map((n) => repairNodeColors(n, repairs));
  return { ...scene, background: bg, nodes };
}

function repairNodeColors(node: SceneNode, repairs: RepairAction[]): SceneNode {
  let fixed = { ...node };

  if (node.type === 'text') {
    const c = sanitizeColor(node.color);
    if (c !== node.color) {
      repairs.push({ type: 'fix_color', nodeId: node.id, description: `Fixed text color: ${node.color} → ${c}` });
      fixed = { ...fixed, color: c } as SceneNode;
    }
  }

  if ('fill' in node) {
    const f = sanitizeColor((node as { fill: string }).fill);
    if (f !== (node as { fill: string }).fill) {
      repairs.push({ type: 'fix_color', nodeId: node.id, description: `Fixed fill color` });
      fixed = { ...fixed, fill: f } as SceneNode;
    }
  }

  if ('children' in fixed && Array.isArray((fixed as { children: SceneNode[] }).children)) {
    fixed = { ...fixed, children: (fixed as { children: SceneNode[] }).children.map((c) => repairNodeColors(c, repairs)) } as SceneNode;
  }

  return fixed;
}

function repairFonts(scene: SceneDocument, repairs: RepairAction[]): SceneDocument {
  const nodes = scene.nodes.map((n) => repairNodeFonts(n, repairs));
  return { ...scene, nodes };
}

function repairNodeFonts(node: SceneNode, repairs: RepairAction[]): SceneNode {
  if (node.type === 'text') {
    const resolved = resolveFontFamily(node.fontFamily);
    const weight = resolveFontWeight(resolved, node.fontWeight);
    if (resolved !== node.fontFamily || weight !== node.fontWeight) {
      repairs.push({ type: 'fix_font', nodeId: node.id, description: `Font: ${node.fontFamily} → ${resolved}` });
      return { ...node, fontFamily: resolved, fontWeight: weight };
    }
  }
  if (node.type === 'button') {
    const resolved = resolveFontFamily(node.fontFamily);
    const weight = resolveFontWeight(resolved, node.fontWeight);
    if (resolved !== node.fontFamily || weight !== node.fontWeight) {
      repairs.push({ type: 'fix_font', nodeId: node.id, description: `Button font: ${node.fontFamily} → ${resolved}` });
      return { ...node, fontFamily: resolved, fontWeight: weight };
    }
  }
  if ('children' in node && Array.isArray(node.children)) {
    return { ...node, children: node.children.map((c) => repairNodeFonts(c, repairs)) } as SceneNode;
  }
  return node;
}

function repairReadability(
  scene: SceneDocument,
  minFontSize: number,
  maxFontSize: number,
  repairs: RepairAction[]
): SceneDocument {
  const nodes = scene.nodes.map((n) => repairNodeReadability(n, minFontSize, maxFontSize, repairs));
  return { ...scene, nodes };
}

function repairNodeReadability(
  node: SceneNode,
  min: number,
  max: number,
  repairs: RepairAction[]
): SceneNode {
  if (node.type === 'text') {
    let fontSize = node.fontSize;
    if (fontSize < min) {
      repairs.push({ type: 'fix_readability', nodeId: node.id, description: `Font too small: ${fontSize}px → ${min}px` });
      fontSize = min;
    }
    if (fontSize > max) {
      repairs.push({ type: 'fix_readability', nodeId: node.id, description: `Font too large: ${fontSize}px → ${max}px` });
      fontSize = max;
    }
    if (fontSize !== node.fontSize) return { ...node, fontSize };
  }
  if ('children' in node && Array.isArray(node.children)) {
    return { ...node, children: node.children.map((c) => repairNodeReadability(c, min, max, repairs)) } as SceneNode;
  }
  return node;
}

function repairOffCanvas(scene: SceneDocument, repairs: RepairAction[]): SceneDocument {
  const nodes = scene.nodes.map((node) => {
    if (node.x + node.width < 0 || node.y + node.height < 0 || node.x > scene.width || node.y > scene.height) {
      const newX = Math.max(0, Math.min(node.x, scene.width - node.width));
      const newY = Math.max(0, Math.min(node.y, scene.height - node.height));
      repairs.push({ type: 'fix_position', nodeId: node.id, description: `Moved off-canvas element back` });
      return { ...node, x: newX, y: newY };
    }
    return node;
  });
  return { ...scene, nodes };
}

function repairSafeZones(scene: SceneDocument, platformSlug: string, repairs: RepairAction[]): SceneDocument {
  const safe = getSafeRegion(scene.width, scene.height, platformSlug);

  const nodes = scene.nodes.map((node) => {
    // Only enforce safe zones for important content
    if (node.type !== 'text' && node.type !== 'button') return node;

    let newX = node.x;
    let newY = node.y;
    let changed = false;

    if (node.x < safe.x) { newX = safe.x; changed = true; }
    if (node.y < safe.y) { newY = safe.y; changed = true; }
    if (node.x + node.width > safe.x + safe.width) { newX = Math.max(safe.x, safe.x + safe.width - node.width); changed = true; }
    if (node.y + node.height > safe.y + safe.height) { newY = Math.max(safe.y, safe.y + safe.height - node.height); changed = true; }

    if (changed) {
      repairs.push({ type: 'fix_safe_zone', nodeId: node.id, description: `Moved into safe zone` });
      return { ...node, x: newX, y: newY };
    }
    return node;
  });
  return { ...scene, nodes };
}

function repairOverlaps(scene: SceneDocument, repairs: RepairAction[]): SceneDocument {
  // Only fix text-on-text overlaps
  const textIndices: number[] = [];
  scene.nodes.forEach((n, i) => { if (n.type === 'text') textIndices.push(i); });

  if (textIndices.length < 2) return scene;

  const newNodes = [...scene.nodes];
  for (let i = 1; i < textIndices.length; i++) {
    const prev = newNodes[textIndices[i - 1]];
    const curr = newNodes[textIndices[i]];

    if (rectsOverlap(prev, curr)) {
      const pushY = prev.y + prev.height + 8;
      if (pushY !== curr.y) {
        repairs.push({ type: 'fix_overlap', nodeId: curr.id, description: `Pushed down to avoid text overlap` });
        newNodes[textIndices[i]] = { ...curr, y: pushY };
      }
    }
  }

  return { ...scene, nodes: newNodes };
}

function repairZIndex(scene: SceneDocument, repairs: RepairAction[]): SceneDocument {
  const seen = new Set<number>();
  let hasDupes = false;
  for (const node of scene.nodes) {
    if (seen.has(node.zIndex)) { hasDupes = true; break; }
    seen.add(node.zIndex);
  }
  if (!hasDupes) return scene;

  repairs.push({ type: 'fix_zindex', description: 'Re-assigned duplicate zIndex values' });
  const nodes = scene.nodes.map((n, i) => ({ ...n, zIndex: i }));
  return { ...scene, nodes };
}

function rectsOverlap(a: SceneNode, b: SceneNode): boolean {
  return !(a.x + a.width < b.x || b.x + b.width < a.x || a.y + a.height < b.y || b.y + b.height < a.y);
}
