/**
 * sceneValidationGateway.ts
 *
 * Phase 6A — The Reliability Layer.
 *
 * Unified validation gateway. Every scene must pass through this pipeline
 * before it can be rendered, exported, persisted, or accepted from AI.
 *
 * Pipeline:
 *   validate → normalize → migrate → repair → refine → score →
 *   export safety checks → accept/reject
 *
 * NEVER throws. Always returns structured SceneValidationResult.
 */

import type { SceneDocument, SceneNode, TextNode } from '@/types/scene';
import { prepareScene } from './safeRenderScene';
import { repairScene, type RepairResult, type RepairOptions } from './repairScene';
import { refineComposition, type RefinementResult } from './refineComposition';
import { evaluateSceneQuality, type QualityEvaluation, type EvaluationOptions } from './evaluateSceneQuality';
import { isFontAllowed } from '@/lib/fonts/fontRegistry';
import { sanitizeColor } from './validateSceneDocument';

// ─── Types ────────────────────────────────────────────────────

export interface SceneValidationResult {
  accepted: boolean;
  repaired: boolean;
  refined: boolean;
  score: number;
  qualityTier: QualityTier;
  warnings: string[];
  errors: string[];
  scene: SceneDocument;
  rejectedReason?: string;
  metrics: SceneMetrics;
  /** Detailed sub-results for consumers that need them. */
  detail: {
    validation: { valid: boolean; warnings: string[] };
    repair: RepairResult | null;
    refinement: RefinementResult | null;
    evaluation: QualityEvaluation | null;
    exportSafety: ExportSafetyResult;
  };
  /** Pipeline duration in ms. */
  durationMs: number;
}

export interface SceneMetrics {
  occupancy: number;
  balance: number;
  readability: number;
  contrast: number;
  hierarchy: number;
  exportSafety: number;
}

export type QualityTier = 'premium' | 'good' | 'acceptable' | 'weak' | 'rejected';

export interface GatewayOptions {
  /** Auto-repair defects. Default true. */
  autoRepair?: boolean;
  /** Auto-refine if score < refineThreshold. Default true. */
  autoRefine?: boolean;
  /** Score threshold below which auto-refine triggers. Default 75. */
  refineThreshold?: number;
  /** Minimum score to accept. Default 45. */
  minimumScore?: number;
  /** Platform slug for safe zones / evaluation. */
  platformSlug?: string;
  /** Repair options override. */
  repairOptions?: Partial<RepairOptions>;
  /** Evaluation options override. */
  evaluationOptions?: Partial<EvaluationOptions>;
  /** Skip export safety checks (e.g. for editor preview). Default false. */
  skipExportSafety?: boolean;
  /** Maximum group nesting depth before rejection. Default 10. */
  maxGroupDepth?: number;
}

// ─── Export Safety ────────────────────────────────────────────

export interface ExportSafetyResult {
  safe: boolean;
  score: number;
  issues: ExportSafetyIssue[];
}

export interface ExportSafetyIssue {
  severity: 'error' | 'warning';
  category: string;
  message: string;
  nodeId?: string;
}

// ─── Quality Tiers ───────────────────────────────────────────

function toQualityTier(score: number, accepted: boolean): QualityTier {
  if (!accepted) return 'rejected';
  if (score >= 85) return 'premium';
  if (score >= 70) return 'good';
  if (score >= 55) return 'acceptable';
  return 'weak';
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════

/**
 * Run a scene through the full validation gateway.
 * This is the mandatory entry point before rendering, exporting,
 * persisting, or accepting AI output.
 *
 * NEVER throws — failures return structured results.
 */
export function validateScene(
  raw: unknown,
  options: GatewayOptions = {}
): SceneValidationResult {
  const start = performance.now();

  const {
    autoRepair = true,
    autoRefine = true,
    refineThreshold = 75,
    minimumScore = 45,
    platformSlug,
    repairOptions = {},
    evaluationOptions = {},
    skipExportSafety = false,
    maxGroupDepth = 10,
  } = options;

  const warnings: string[] = [];
  const errors: string[] = [];

  // ── 1. Validate + Normalize + Migrate ─────────────────────
  let scene: SceneDocument;
  let validationValid: boolean;
  let validationWarnings: string[];

  try {
    const prepared = prepareScene(raw);
    scene = prepared.document;
    validationValid = prepared.valid;
    validationWarnings = prepared.warnings;
    warnings.push(...validationWarnings);
  } catch {
    // prepareScene should never throw, but if it does, return empty
    return crashResult('Validation/normalization crashed', performance.now() - start);
  }

  // ── 2. Structural integrity checks ────────────────────────
  const structuralErrors = checkStructuralIntegrity(scene, maxGroupDepth);
  if (structuralErrors.length > 0) {
    errors.push(...structuralErrors);
    // Attempt to fix by stripping corrupted nodes
    scene = stripCorruptedNodes(scene);
  }

  // ── 3. Dimension checks ───────────────────────────────────
  if (scene.width <= 0 || scene.height <= 0 ||
    !Number.isFinite(scene.width) || !Number.isFinite(scene.height)) {
    errors.push(`Invalid dimensions: ${scene.width}×${scene.height}`);
    scene = { ...scene, width: Math.max(1, scene.width || 600), height: Math.max(1, scene.height || 600) };
  }

  if (scene.width > 10000 || scene.height > 10000) {
    warnings.push(`Extreme dimensions: ${scene.width}×${scene.height}`);
  }

  // ── 4. Repair ─────────────────────────────────────────────
  let repair: RepairResult | null = null;
  if (autoRepair) {
    try {
      repair = repairScene(scene, { platformSlug, ...repairOptions });
      scene = repair.scene;
      if (repair.totalRepairs > 0) {
        warnings.push(`Auto-repaired ${repair.totalRepairs} issue(s)`);
      }
    } catch {
      warnings.push('Auto-repair failed (non-fatal)');
    }
  }

  // ── 5. Score (pre-refine) ─────────────────────────────────
  let evaluation: QualityEvaluation | null = null;
  try {
    evaluation = evaluateSceneQuality(scene, {
      platformSlug,
      minimumScore,
      ...evaluationOptions,
    });
  } catch {
    warnings.push('Quality evaluation failed (non-fatal)');
  }

  const preRefineScore = evaluation?.overall ?? 50;

  // ── 6. Refine (if weak) ───────────────────────────────────
  let refinement: RefinementResult | null = null;
  if (autoRefine && preRefineScore < refineThreshold) {
    try {
      refinement = refineComposition(scene, { platformSlug });
      if (refinement.improved) {
        scene = refinement.scene;
        warnings.push(`Auto-refined: ${refinement.scoreBefore.overall} → ${refinement.scoreAfter.overall}`);
      }
    } catch {
      warnings.push('Auto-refinement failed (non-fatal)');
    }
  }

  // ── 7. Score (post-refine) ────────────────────────────────
  if (refinement?.improved) {
    try {
      evaluation = evaluateSceneQuality(scene, {
        platformSlug,
        minimumScore,
        ...evaluationOptions,
      });
    } catch {
      // keep pre-refine evaluation
    }
  }

  const finalScore = evaluation?.overall ?? 50;

  // ── 8. Export safety checks ───────────────────────────────
  let exportSafety: ExportSafetyResult = { safe: true, score: 100, issues: [] };
  if (!skipExportSafety) {
    try {
      exportSafety = checkExportSafety(scene);
      if (!exportSafety.safe) {
        for (const issue of exportSafety.issues) {
          if (issue.severity === 'error') errors.push(`[export] ${issue.message}`);
          else warnings.push(`[export] ${issue.message}`);
        }
      }
    } catch {
      warnings.push('Export safety check failed (non-fatal)');
      exportSafety = { safe: false, score: 0, issues: [{ severity: 'error', category: 'crash', message: 'Export safety check crashed' }] };
    }
  }

  // ── 9. Off-canvas check ───────────────────────────────────
  const offCanvasPct = computeOffCanvasPercent(scene);
  if (offCanvasPct > 0.30) {
    errors.push(`${Math.round(offCanvasPct * 100)}% of content is off-canvas`);
  }

  // ── 10. Accept / Reject ───────────────────────────────────
  let accepted = true;
  let rejectedReason: string | undefined;

  // Rejection rules
  if (finalScore < minimumScore) {
    accepted = false;
    rejectedReason = `Quality score ${finalScore} below minimum ${minimumScore}`;
  }

  if (hasUnreadableTypography(scene)) {
    accepted = false;
    rejectedReason = rejectedReason || 'Scene contains unreadable typography';
  }

  if (hasExcessiveOverlaps(scene)) {
    accepted = false;
    rejectedReason = rejectedReason || 'Scene has excessive node overlaps';
  }

  if (offCanvasPct > 0.30) {
    accepted = false;
    rejectedReason = rejectedReason || `${Math.round(offCanvasPct * 100)}% of content is off-canvas`;
  }

  if (!exportSafety.safe && exportSafety.issues.some((i) => i.severity === 'error')) {
    // Only hard-reject on critical export issues
    const critical = exportSafety.issues.filter((i) => i.severity === 'error' && i.category === 'geometry');
    if (critical.length > 0) {
      accepted = false;
      rejectedReason = rejectedReason || 'Impossible export geometry';
    }
  }

  if (structuralErrors.length > 0 && scene.nodes.length === 0) {
    accepted = false;
    rejectedReason = rejectedReason || 'All nodes were corrupted and stripped';
  }

  // ── Build metrics ─────────────────────────────────────────
  const metrics: SceneMetrics = {
    occupancy: evaluation?.scores.occupancy ?? 0,
    balance: evaluation ? Math.round((evaluation.scores.hierarchy + evaluation.scores.occupancy) / 2) : 0,
    readability: evaluation?.scores.readability ?? 0,
    contrast: evaluation?.scores.contrast ?? 0,
    hierarchy: evaluation?.scores.hierarchy ?? 0,
    exportSafety: exportSafety.score,
  };

  return {
    accepted,
    repaired: (repair?.totalRepairs ?? 0) > 0,
    refined: refinement?.improved ?? false,
    score: finalScore,
    qualityTier: toQualityTier(finalScore, accepted),
    warnings,
    errors,
    scene,
    rejectedReason,
    metrics,
    detail: {
      validation: { valid: validationValid, warnings: validationWarnings },
      repair,
      refinement,
      evaluation,
      exportSafety,
    },
    durationMs: Math.round(performance.now() - start),
  };
}

// ═══════════════════════════════════════════════════════════════
// EXPORT SAFETY
// ═══════════════════════════════════════════════════════════════

/**
 * Check whether a scene is safe for export.
 * Verifies bounds, image URLs, fonts, gradients, SVGs,
 * NaN/Infinity values, and zero-sized critical nodes.
 */
export function checkExportSafety(scene: SceneDocument): ExportSafetyResult {
  const issues: ExportSafetyIssue[] = [];

  // Walk all nodes (including nested children)
  walkNodes(scene.nodes, (node, depth) => {
    // NaN / Infinity in critical numeric fields
    const numericFields: Array<[string, number]> = [
      ['x', node.x], ['y', node.y],
      ['width', node.width], ['height', node.height],
      ['rotation', node.rotation], ['opacity', node.opacity],
    ];

    for (const [field, val] of numericFields) {
      if (!Number.isFinite(val)) {
        issues.push({
          severity: 'error', category: 'numeric',
          message: `${field} is ${val} on node ${node.id}`,
          nodeId: node.id,
        });
      }
    }

    // Zero-sized critical nodes (text, button)
    if ((node.type === 'text' || node.type === 'button') && (node.width <= 0 || node.height <= 0)) {
      issues.push({
        severity: 'error', category: 'geometry',
        message: `Zero-sized ${node.type} node: ${node.width}×${node.height}`,
        nodeId: node.id,
      });
    }

    // Bounds check — entirely outside canvas
    if (node.x >= scene.width || node.y >= scene.height ||
      node.x + node.width <= 0 || node.y + node.height <= 0) {
      issues.push({
        severity: 'warning', category: 'bounds',
        message: `Node ${node.id} is entirely off-canvas`,
        nodeId: node.id,
      });
    }

    // Image URL validation
    if (node.type === 'image') {
      const src = node.src;
      if (!src || src.trim().length === 0) {
        issues.push({
          severity: 'warning', category: 'image',
          message: `Image node ${node.id} has empty src`,
          nodeId: node.id,
        });
      } else if (!isValidImageUrl(src)) {
        issues.push({
          severity: 'warning', category: 'image',
          message: `Image node ${node.id} has suspicious URL: ${src.slice(0, 80)}`,
          nodeId: node.id,
        });
      }
    }

    // Font whitelisting
    if (node.type === 'text') {
      if (!isFontAllowed(node.fontFamily)) {
        issues.push({
          severity: 'warning', category: 'font',
          message: `Font "${node.fontFamily}" not whitelisted`,
          nodeId: node.id,
        });
      }
      // Text-specific font size
      if (node.fontSize <= 0 || !Number.isFinite(node.fontSize)) {
        issues.push({
          severity: 'error', category: 'typography',
          message: `Invalid fontSize ${node.fontSize} on text node ${node.id}`,
          nodeId: node.id,
        });
      }
    }

    if (node.type === 'button') {
      if (!isFontAllowed(node.fontFamily)) {
        issues.push({
          severity: 'warning', category: 'font',
          message: `Button font "${node.fontFamily}" not whitelisted`,
          nodeId: node.id,
        });
      }
    }

    // SVG validation (basic)
    if (node.type === 'svg') {
      if (!node.svgContent || node.svgContent.trim().length === 0) {
        issues.push({
          severity: 'warning', category: 'svg',
          message: `SVG node ${node.id} has empty content`,
          nodeId: node.id,
        });
      } else if (node.svgContent.includes('<script')) {
        issues.push({
          severity: 'error', category: 'svg',
          message: `SVG node ${node.id} contains script tag`,
          nodeId: node.id,
        });
      }
    }

    // Color validation for renderable colors
    if ('fill' in node && typeof (node as { fill: string }).fill === 'string') {
      const fill = (node as { fill: string }).fill;
      if (fill && fill !== 'transparent') {
        const sanitized = sanitizeColor(fill, '');
        if (sanitized === '' && fill !== '') {
          issues.push({
            severity: 'warning', category: 'color',
            message: `Invalid fill color "${fill}" on node ${node.id}`,
            nodeId: node.id,
          });
        }
      }
    }
  });

  // Document-level checks
  if (scene.width <= 0 || scene.height <= 0) {
    issues.push({
      severity: 'error', category: 'geometry',
      message: `Invalid scene dimensions: ${scene.width}×${scene.height}`,
    });
  }

  if (!Number.isFinite(scene.width) || !Number.isFinite(scene.height)) {
    issues.push({
      severity: 'error', category: 'geometry',
      message: `Non-finite scene dimensions: ${scene.width}×${scene.height}`,
    });
  }

  // Background color
  const bgSanitized = sanitizeColor(scene.background, '');
  if (bgSanitized === '' && scene.background && scene.background !== 'transparent') {
    issues.push({
      severity: 'warning', category: 'color',
      message: `Invalid background color: "${scene.background}"`,
    });
  }

  // Score: 100 minus deductions
  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const score = Math.max(0, 100 - errorCount * 20 - warningCount * 5);

  return {
    safe: errorCount === 0,
    score,
    issues,
  };
}

// ═══════════════════════════════════════════════════════════════
// STRUCTURAL INTEGRITY
// ═══════════════════════════════════════════════════════════════

function checkStructuralIntegrity(scene: SceneDocument, maxDepth: number): string[] {
  const errors: string[] = [];

  // Check for recursive/deep groups
  const depthResult = measureMaxDepth(scene.nodes, 0);
  if (depthResult > maxDepth) {
    errors.push(`Group nesting depth ${depthResult} exceeds maximum ${maxDepth}`);
  }

  // Check for duplicate IDs
  const ids = new Set<string>();
  walkNodes(scene.nodes, (node) => {
    if (ids.has(node.id)) {
      errors.push(`Duplicate node ID: ${node.id}`);
    }
    ids.add(node.id);
  });

  // Check for nodes with unknown types
  const knownTypes = new Set(['text', 'image', 'shape', 'group', 'frame', 'stack', 'svg', 'icon', 'button']);
  walkNodes(scene.nodes, (node) => {
    if (!knownTypes.has(node.type)) {
      errors.push(`Unknown node type: ${node.type} (${node.id})`);
    }
  });

  return errors;
}

function stripCorruptedNodes(scene: SceneDocument): SceneDocument {
  const knownTypes = new Set(['text', 'image', 'shape', 'group', 'frame', 'stack', 'svg', 'icon', 'button']);

  function cleanNodes(nodes: SceneNode[]): SceneNode[] {
    return nodes
      .filter((n) => knownTypes.has(n.type) && n.id && Number.isFinite(n.width) && Number.isFinite(n.height))
      .map((n) => {
        if ('children' in n && Array.isArray(n.children)) {
          return { ...n, children: cleanNodes(n.children) } as SceneNode;
        }
        return n;
      });
  }

  return { ...scene, nodes: cleanNodes(scene.nodes) };
}

// ═══════════════════════════════════════════════════════════════
// REJECTION CHECKS
// ═══════════════════════════════════════════════════════════════

function hasUnreadableTypography(scene: SceneDocument): boolean {
  let unreadableCount = 0;
  let textCount = 0;

  walkNodes(scene.nodes, (node) => {
    if (node.type === 'text') {
      textCount++;
      const tn = node as TextNode;
      if (tn.fontSize < 6 || !Number.isFinite(tn.fontSize)) {
        unreadableCount++;
      }
      if (!tn.text || tn.text.trim().length === 0) {
        unreadableCount++;
      }
    }
  });

  // Reject if > 50% of text nodes are unreadable
  return textCount > 0 && unreadableCount / textCount > 0.5;
}

function hasExcessiveOverlaps(scene: SceneDocument): boolean {
  // Collect all leaf node rects
  const rects: Array<{ x: number; y: number; w: number; h: number }> = [];

  walkNodes(scene.nodes, (node) => {
    if (node.type !== 'group' && node.type !== 'frame' && node.type !== 'stack') {
      rects.push({ x: node.x, y: node.y, w: node.width, h: node.height });
    }
  });

  if (rects.length < 2) return false;

  let overlapCount = 0;
  const total = rects.length;

  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      if (!(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y)) {
        // Compute overlap area fraction
        const ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
        const oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
        const overlapArea = ox * oy;
        const smallerArea = Math.min(a.w * a.h, b.w * b.h);
        if (smallerArea > 0 && overlapArea / smallerArea > 0.7) {
          overlapCount++;
        }
      }
    }
  }

  // Reject if > 40% of possible pairs have heavy overlap
  const maxPairs = (total * (total - 1)) / 2;
  return maxPairs > 0 && overlapCount / maxPairs > 0.4;
}

function computeOffCanvasPercent(scene: SceneDocument): number {
  if (scene.nodes.length === 0) return 0;

  let totalArea = 0;
  let offCanvasArea = 0;

  walkNodes(scene.nodes, (node) => {
    if (node.type === 'group' || node.type === 'frame' || node.type === 'stack') return;

    const area = Math.max(0, node.width * node.height);
    totalArea += area;

    // Compute visible portion
    const visibleLeft = Math.max(0, node.x);
    const visibleTop = Math.max(0, node.y);
    const visibleRight = Math.min(scene.width, node.x + node.width);
    const visibleBottom = Math.min(scene.height, node.y + node.height);

    const visibleWidth = Math.max(0, visibleRight - visibleLeft);
    const visibleHeight = Math.max(0, visibleBottom - visibleTop);
    const visibleArea = visibleWidth * visibleHeight;

    offCanvasArea += Math.max(0, area - visibleArea);
  });

  return totalArea > 0 ? offCanvasArea / totalArea : 0;
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function walkNodes(nodes: SceneNode[], fn: (node: SceneNode, depth: number) => void, depth = 0): void {
  for (const node of nodes) {
    fn(node, depth);
    if ('children' in node && Array.isArray(node.children)) {
      walkNodes(node.children, fn, depth + 1);
    }
  }
}

function measureMaxDepth(nodes: SceneNode[], current: number): number {
  let max = current;
  for (const node of nodes) {
    if ('children' in node && Array.isArray(node.children) && node.children.length > 0) {
      max = Math.max(max, measureMaxDepth(node.children, current + 1));
    }
  }
  return max;
}

function isValidImageUrl(src: string): boolean {
  // Accept data URIs, relative paths, and http(s) URLs
  if (src.startsWith('data:image/')) return true;
  if (src.startsWith('/') || src.startsWith('./') || src.startsWith('../')) return true;
  if (src.startsWith('http://') || src.startsWith('https://')) return true;
  if (src.startsWith('blob:')) return true;
  return false;
}

function crashResult(reason: string, elapsed: number): SceneValidationResult {
  return {
    accepted: false,
    repaired: false,
    refined: false,
    score: 0,
    qualityTier: 'rejected',
    warnings: [],
    errors: [reason],
    scene: { version: 'v1', width: 600, height: 600, background: '#ffffff', nodes: [] },
    rejectedReason: reason,
    metrics: { occupancy: 0, balance: 0, readability: 0, contrast: 0, hierarchy: 0, exportSafety: 0 },
    detail: {
      validation: { valid: false, warnings: [] },
      repair: null,
      refinement: null,
      evaluation: null,
      exportSafety: { safe: false, score: 0, issues: [] },
    },
    durationMs: Math.round(elapsed),
  };
}
