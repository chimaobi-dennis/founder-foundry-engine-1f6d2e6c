/**
 * sceneGenerationBridge.ts
 *
 * Bridges the Scene JSON engine into the existing Content Studio
 * generation pipeline. This is the ONLY integration layer — it
 * does NOT redesign, replace, or duplicate anything.
 *
 * Responsibilities:
 *   1. Generation mode resolution (html / scene / hybrid)
 *   2. Scene JSON validation + repair + refinement + scoring
 *   3. Quality gate (score → status mapping)
 *   4. Safe generation constraints enforcement
 *   5. Fallback from scene → HTML on failure
 *   6. Export parity validation
 *   7. Telemetry capture
 *
 * NEVER throws. Returns structured results.
 */

import type { SceneDocument, RenderEngine } from '@/types/scene';
import { parseAISceneResponse, type AISceneResult } from '@/lib/scene/parseAISceneResponse';
import { validateScene, type SceneValidationResult } from '@/lib/scene/sceneValidationGateway';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export type GenerationMode = 'html' | 'scene' | 'hybrid';

export type CreativeStatus = 'ready' | 'failed';

export interface SceneBridgeResult {
  /** Final render engine for this creative. */
  renderEngine: RenderEngine;
  /** Final visual HTML (null in pure scene mode). */
  visualHtml: string | null;
  /** Validated/repaired/refined scene JSON (null in pure HTML mode). */
  sceneJson: SceneDocument | null;
  /** Creative status derived from quality gate. */
  status: CreativeStatus;
  /** Whether a scene → HTML fallback occurred. */
  fellBackToHtml: boolean;
  /** Fallback reason if any. */
  fallbackReason: string | null;
  /** Telemetry data for this generation. */
  telemetry: GenerationTelemetry;
  /** Validation result (null if HTML-only). */
  validation: SceneValidationResult | null;
}

export interface GenerationTelemetry {
  generationMode: GenerationMode;
  qualityScore: number;
  retryCount: number;
  repairCount: number;
  fallbackUsed: boolean;
  renderDurationMs: number;
  validationDurationMs: number;
  validationWarnings: string[];
  mutationCount: number;
  exportStable: boolean;
  parityScore: number;
  constraintsApplied: string[];
  timestamp: string;
}

export interface SceneBridgeOptions {
  /** Generation mode. Default 'hybrid'. */
  mode?: GenerationMode;
  /** Platform slug for safe-zone-aware validation. */
  platformSlug?: string;
  /** Platform dimensions for constraint enforcement. */
  platformWidth?: number;
  platformHeight?: number;
  /** Maximum retries on score < 70 in scene mode. Default 1. */
  maxRetries?: number;
  /** Existing visual HTML (for hybrid fallback). */
  existingHtml?: string | null;
}

// ═══════════════════════════════════════════════════════════════
// SAFE GENERATION CONSTRAINTS
// ═══════════════════════════════════════════════════════════════

/** Allowed node types for initial rollout. */
const SAFE_NODE_TYPES = new Set(['text', 'image', 'shape', 'button', 'stack', 'group']);

/** Hard limits. */
const MAX_NODES = 80;
const MAX_GROUP_DEPTH = 6;

/**
 * Enforce safe generation constraints on a SceneDocument.
 * Returns the constrained scene and a list of constraints applied.
 */
function enforceConstraints(scene: SceneDocument): { scene: SceneDocument; applied: string[] } {
  const applied: string[] = [];
  let nodes = scene.nodes;

  // Strip disallowed node types
  const before = countNodes(nodes);
  nodes = filterNodeTypes(nodes, SAFE_NODE_TYPES);
  const after = countNodes(nodes);
  if (after < before) {
    applied.push(`Stripped ${before - after} disallowed node type(s)`);
  }

  // Enforce max nodes
  if (after > MAX_NODES) {
    nodes = truncateNodes(nodes, MAX_NODES);
    applied.push(`Truncated to ${MAX_NODES} nodes (was ${after})`);
  }

  // Enforce max group depth
  const depth = measureDepth(nodes, 0);
  if (depth > MAX_GROUP_DEPTH) {
    nodes = flattenDeepGroups(nodes, 0, MAX_GROUP_DEPTH);
    applied.push(`Flattened groups beyond depth ${MAX_GROUP_DEPTH} (was ${depth})`);
  }

  return {
    scene: { ...scene, nodes },
    applied,
  };
}

// ═══════════════════════════════════════════════════════════════
// QUALITY GATE
// ═══════════════════════════════════════════════════════════════

/**
 * Map quality score to creative status.
 * Uses existing statuses only — diagnostics in telemetry JSON.
 *   ≥ 70 → ready
 *   < 70 → retry / fallback
 */
function qualityToStatus(score: number): CreativeStatus {
  if (score >= 70) return 'ready';
  return 'failed';
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════

/**
 * Process an AI raw text response through the Scene JSON bridge.
 *
 * This is the single integration point between Content Studio's
 * generation pipeline and the Scene JSON engine.
 *
 * Call this AFTER AI returns raw text, BEFORE persistence.
 */
export function processSceneGeneration(
  rawAIText: string | null,
  options: SceneBridgeOptions = {}
): SceneBridgeResult {
  const {
    mode = 'hybrid',
    platformSlug,
    platformWidth,
    platformHeight,
    maxRetries = 1,
    existingHtml = null,
  } = options;

  const start = performance.now();
  const telemetry: GenerationTelemetry = {
    generationMode: mode,
    qualityScore: 0,
    retryCount: 0,
    repairCount: 0,
    fallbackUsed: false,
    renderDurationMs: 0,
    validationDurationMs: 0,
    validationWarnings: [],
    mutationCount: 0,
    exportStable: true,
    parityScore: 100,
    constraintsApplied: [],
    timestamp: new Date().toISOString(),
  };

  // ── Mode: html — pass through directly ────────────────────
  if (mode === 'html') {
    return htmlOnlyResult(rawAIText, telemetry);
  }

  // ── Try to parse as SceneDocument JSON ────────────────────
  if (!rawAIText) {
    if (mode === 'hybrid' && existingHtml) {
      telemetry.fallbackUsed = true;
      return htmlFallbackResult(existingHtml, 'AI returned empty response', telemetry);
    }
    return failedResult('AI returned empty response', telemetry);
  }

  let parsed: AISceneResult;
  try {
    parsed = parseAISceneResponse(rawAIText);
  } catch {
    if (mode === 'hybrid') {
      telemetry.fallbackUsed = true;
      return htmlFallbackResult(
        cleanHtml(rawAIText) || existingHtml,
        'Scene JSON parse failed',
        telemetry
      );
    }
    return failedResult('Scene JSON parse failed', telemetry);
  }

  // If no scene JSON found, handle by mode
  if (parsed.type !== 'scene' || !parsed.sceneJson) {
    if (mode === 'hybrid') {
      // HTML came back — use it directly
      const html = parsed.type === 'html' ? rawAIText : existingHtml;
      return htmlFallbackResult(cleanHtml(html), 'AI returned HTML instead of scene JSON', telemetry);
    }
    return failedResult('AI did not return valid SceneDocument JSON', telemetry);
  }

  // ── We have a SceneDocument — run the engine ──────────────
  let scene = parsed.sceneJson;

  // Inject platform dimensions if available
  if (platformWidth && platformHeight) {
    scene = { ...scene, width: platformWidth, height: platformHeight };
  }

  // Enforce safe generation constraints
  const constrained = enforceConstraints(scene);
  scene = constrained.scene;
  telemetry.constraintsApplied = constrained.applied;

  // Run validation gateway
  const validationStart = performance.now();
  let validation: SceneValidationResult;
  try {
    validation = validateScene(scene, {
      autoRepair: true,
      autoRefine: true,
      refineThreshold: 75,
      minimumScore: 45,
      platformSlug,
      maxGroupDepth: MAX_GROUP_DEPTH,
    });
  } catch {
    // Gateway should never throw, but safety first
    if (mode === 'hybrid') {
      telemetry.fallbackUsed = true;
      return htmlFallbackResult(existingHtml, 'Validation gateway crashed', telemetry);
    }
    return failedResult('Validation gateway crashed', telemetry);
  }
  telemetry.validationDurationMs = Math.round(performance.now() - validationStart);

  // Populate telemetry
  telemetry.qualityScore = validation.score;
  telemetry.repairCount = validation.detail.repair?.totalRepairs ?? 0;
  telemetry.validationWarnings = validation.warnings;
  telemetry.exportStable = validation.metrics.exportSafety >= 92;
  telemetry.parityScore = validation.metrics.exportSafety;

  // ── Quality gate ──────────────────────────────────────────
  const status = qualityToStatus(validation.score);

  if (status === 'failed') {
    // Score < 70 — fallback in hybrid, fail in scene-only
    if (mode === 'hybrid' && existingHtml) {
      telemetry.fallbackUsed = true;
      return htmlFallbackResult(
        existingHtml,
        `Scene quality score ${validation.score} below 70`,
        telemetry
      );
    }
    // In scene-only mode, if gateway accepted it (score ≥ 45),
    // mark as ready — diagnostics live in telemetry JSON
    if (validation.accepted) {
      return {
        renderEngine: 'scene',
        visualHtml: null,
        sceneJson: validation.scene,
        status: 'ready',
        fellBackToHtml: false,
        fallbackReason: null,
        telemetry: finalizeTelemetry(telemetry, start),
        validation,
      };
    }

    // Gateway rejected — fail entirely
    return failedResult(
      validation.rejectedReason || `Scene rejected with score ${validation.score}`,
      telemetry
    );
  }

  // ── Success path ──────────────────────────────────────────
  return {
    renderEngine: 'scene',
    visualHtml: null,
    sceneJson: validation.scene,
    status,
    fellBackToHtml: false,
    fallbackReason: null,
    telemetry: finalizeTelemetry(telemetry, start),
    validation,
  };
}

/**
 * Determine the default generation mode for a brief.
 * For initial rollout this returns 'hybrid' for safety.
 */
export function resolveGenerationMode(
  briefMode?: string | null
): GenerationMode {
  if (briefMode === 'html' || briefMode === 'scene' || briefMode === 'hybrid') {
    return briefMode;
  }
  return 'hybrid';
}

/**
 * Build the additional scene-mode instructions for the AI prompt.
 * Appended to the visual generation prompt when mode is 'scene' or 'hybrid'.
 */
export function buildScenePromptInstructions(
  mode: GenerationMode,
  width: number,
  height: number
): string {
  if (mode === 'html') return '';

  const lines = [
    '\n\n=== SCENE JSON OUTPUT MODE ===',
    'Return a valid JSON SceneDocument object instead of HTML.',
    'The SceneDocument must have this exact structure:',
    '{',
    `  "version": "v1",`,
    `  "width": ${width},`,
    `  "height": ${height},`,
    `  "background": "#ffffff",`,
    '  "nodes": [',
    '    // Array of SceneNode objects',
    '  ]',
    '}',
    '',
    'Each node must have: id, type, x, y, width, height, rotation, opacity, zIndex.',
    'Allowed node types: text, image, shape, button, stack, group.',
    '',
    'Text nodes need: text, fontSize, fontFamily, fontWeight, lineHeight, letterSpacing, color, align.',
    'Shape nodes need: fill, stroke, strokeWidth, radius.',
    'Image nodes need: src, objectFit, borderRadius.',
    'Button nodes need: label, fontFamily, fontWeight, fontSize, color, background, borderRadius.',
    '',
    'CRITICAL RULES:',
    '- Return ONLY the JSON object. No explanation, no markdown, no code fences.',
    '- Start your response with { and end with }.',
    '- All positions must be within canvas bounds.',
    `- Canvas size: ${width}×${height}px.`,
    `- Maximum ${MAX_NODES} nodes.`,
    `- Maximum group nesting depth: ${MAX_GROUP_DEPTH}.`,
    '- Typography must be readable (minimum 10px font size).',
    '- Content must visually fill the canvas.',
    '- Do NOT use svg, icon, or frame node types.',
  ];

  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ═══════════════════════════════════════════════════════════════

function htmlOnlyResult(rawText: string | null, telemetry: GenerationTelemetry): SceneBridgeResult {
  return {
    renderEngine: 'html',
    visualHtml: cleanHtml(rawText),
    sceneJson: null,
    status: rawText ? 'ready' : 'failed',
    fellBackToHtml: false,
    fallbackReason: null,
    telemetry: { ...telemetry, renderDurationMs: 0 },
    validation: null,
  };
}

function htmlFallbackResult(
  html: string | null,
  reason: string,
  telemetry: GenerationTelemetry
): SceneBridgeResult {
  return {
    renderEngine: 'html',
    visualHtml: html,
    sceneJson: null,
    status: html ? 'ready' : 'failed',
    fellBackToHtml: true,
    fallbackReason: reason,
    telemetry: { ...telemetry, fallbackUsed: true },
    validation: null,
  };
}

function failedResult(reason: string, telemetry: GenerationTelemetry): SceneBridgeResult {
  return {
    renderEngine: 'html',
    visualHtml: null,
    sceneJson: null,
    status: 'failed',
    fellBackToHtml: false,
    fallbackReason: reason,
    telemetry: { ...telemetry },
    validation: null,
  };
}

function finalizeTelemetry(telemetry: GenerationTelemetry, startMs: number): GenerationTelemetry {
  return {
    ...telemetry,
    renderDurationMs: Math.round(performance.now() - startMs),
  };
}

function cleanHtml(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw
    .replace(/^```(?:html|json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim() || null;
}

// ─── Node tree utilities ──────────────────────────────────────

import type { SceneNode } from '@/types/scene';

function countNodes(nodes: SceneNode[]): number {
  let count = 0;
  for (const n of nodes) {
    count++;
    if ('children' in n && Array.isArray(n.children)) {
      count += countNodes(n.children);
    }
  }
  return count;
}

function filterNodeTypes(nodes: SceneNode[], allowed: Set<string>): SceneNode[] {
  return nodes
    .filter((n) => allowed.has(n.type))
    .map((n) => {
      if ('children' in n && Array.isArray(n.children)) {
        return { ...n, children: filterNodeTypes(n.children, allowed) } as SceneNode;
      }
      return n;
    });
}

function truncateNodes(nodes: SceneNode[], max: number): SceneNode[] {
  const result: SceneNode[] = [];
  let count = 0;
  for (const n of nodes) {
    if (count >= max) break;
    count++;
    if ('children' in n && Array.isArray(n.children)) {
      const remaining = max - count;
      const children = truncateNodes(n.children, remaining);
      count += countNodes(children);
      result.push({ ...n, children } as SceneNode);
    } else {
      result.push(n);
    }
  }
  return result;
}

function measureDepth(nodes: SceneNode[], current: number): number {
  let max = current;
  for (const n of nodes) {
    if ('children' in n && Array.isArray(n.children) && n.children.length > 0) {
      max = Math.max(max, measureDepth(n.children, current + 1));
    }
  }
  return max;
}

function flattenDeepGroups(nodes: SceneNode[], depth: number, maxDepth: number): SceneNode[] {
  return nodes.flatMap((n) => {
    if ('children' in n && Array.isArray(n.children)) {
      if (depth >= maxDepth) {
        // Flatten: return children directly (losing the group wrapper)
        return flattenDeepGroups(n.children, depth, maxDepth);
      }
      return [{ ...n, children: flattenDeepGroups(n.children, depth + 1, maxDepth) } as SceneNode];
    }
    return [n];
  });
}
