/**
 * parseAISceneResponse.ts
 *
 * Production-safe parser for AI-generated scene output.
 * Handles three response formats:
 *   1. Pure scene JSON
 *   2. Wrapped platform JSON (e.g. { instagram_post: { scene_json: ... } })
 *   3. Legacy HTML fallback
 *
 * Never throws — always returns a typed result the pipeline can act on.
 */

import type { SceneDocument, RenderEngine } from '@/types/scene';
import { normalizeSceneDocument, validateSceneDocument } from './validateSceneDocument';
import { migrateScene } from './sceneMigrations';

// ─── Result Types ─────────────────────────────────────────────

export type AISceneResultType = 'scene' | 'html' | 'empty';

export interface AISceneResult {
  type: AISceneResultType;
  renderEngine: RenderEngine;
  /** Validated + normalized SceneDocument. Null when type is 'html' or 'empty'. */
  sceneJson: SceneDocument | null;
  /** Raw HTML string. Null when type is 'scene' or 'empty'. */
  visualHtml: string | null;
  /** Version string from the scene document. */
  sceneVersion: string;
  /** Warnings from validation/normalization. */
  warnings: string[];
}

// ─── AI Output Contract ──────────────────────────────────────

/**
 * Expected wrapped AI output per-platform:
 * {
 *   "instagram_post": {
 *     "render_engine": "scene",
 *     "scene_version": "v1",
 *     "scene_json": { ... SceneDocument ... }
 *   }
 * }
 *
 * Or a single platform object directly:
 * {
 *   "render_engine": "scene",
 *   "scene_version": "v1",
 *   "scene_json": { ... }
 * }
 */

interface WrappedScenePayload {
  render_engine?: string;
  scene_version?: string;
  scene_json?: unknown;
  visual_html?: string;
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Parse raw AI response text into a structured AISceneResult.
 * Detects scene JSON, wrapped JSON, or falls back to HTML.
 */
export function parseAISceneResponse(rawText: string | null | undefined): AISceneResult {
  if (!rawText || rawText.trim().length === 0) {
    return emptyResult();
  }

  const cleaned = stripCodeFences(rawText);

  // Attempt 1: Parse as JSON
  const jsonObj = tryParseJson(cleaned);

  if (jsonObj !== null && typeof jsonObj === 'object') {
    // Check if it's a direct SceneDocument
    const directScene = tryExtractSceneDocument(jsonObj);
    if (directScene) return directScene;

    // Check if it's a wrapped platform payload
    const wrappedScene = tryExtractWrappedPayload(jsonObj as Record<string, unknown>);
    if (wrappedScene) return wrappedScene;
  }

  // Attempt 2: Treat as HTML
  if (looksLikeHtml(cleaned)) {
    return htmlResult(cleaned);
  }

  // Attempt 3: Try to find JSON embedded in text
  const embeddedJson = tryExtractEmbeddedJson(cleaned);
  if (embeddedJson) {
    const embedded = tryExtractSceneDocument(embeddedJson);
    if (embedded) return embedded;

    const embeddedWrapped = tryExtractWrappedPayload(embeddedJson as Record<string, unknown>);
    if (embeddedWrapped) return embeddedWrapped;
  }

  // Last resort — if it has any HTML-like content, return as HTML
  if (cleaned.includes('<')) {
    return htmlResult(cleaned);
  }

  return emptyResult();
}

/**
 * Parse a per-platform AI output object.
 * Expects the format: { render_engine, scene_version, scene_json }
 */
export function parseAIPlatformOutput(payload: unknown): AISceneResult {
  if (!payload || typeof payload !== 'object') return emptyResult();

  const p = payload as WrappedScenePayload;

  // Scene path
  if (p.render_engine === 'scene' && p.scene_json) {
    return buildSceneResult(p.scene_json, p.scene_version);
  }

  // HTML path
  if (p.visual_html && typeof p.visual_html === 'string') {
    return htmlResult(p.visual_html);
  }

  // Might be a bare SceneDocument
  const bare = tryExtractSceneDocument(payload);
  if (bare) return bare;

  return emptyResult();
}

/**
 * Parse a multi-platform AI response.
 * Returns a map of platform slug → AISceneResult.
 */
export function parseMultiPlatformResponse(
  rawText: string | null | undefined
): Record<string, AISceneResult> {
  const results: Record<string, AISceneResult> = {};

  if (!rawText) return results;

  const cleaned = stripCodeFences(rawText);
  const jsonObj = tryParseJson(cleaned);

  if (!jsonObj || typeof jsonObj !== 'object') return results;

  const obj = jsonObj as Record<string, unknown>;

  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === 'object') {
      results[key] = parseAIPlatformOutput(value);
    }
  }

  return results;
}

// ─── Internal Helpers ─────────────────────────────────────────

function emptyResult(): AISceneResult {
  return {
    type: 'empty',
    renderEngine: 'html',
    sceneJson: null,
    visualHtml: null,
    sceneVersion: 'v1',
    warnings: ['No usable content found in AI response'],
  };
}

function htmlResult(html: string): AISceneResult {
  return {
    type: 'html',
    renderEngine: 'html',
    sceneJson: null,
    visualHtml: html,
    sceneVersion: 'v1',
    warnings: [],
  };
}

function buildSceneResult(raw: unknown, version?: string): AISceneResult {
  const warnings: string[] = [];

  const validation = validateSceneDocument(raw);
  if (!validation.valid) {
    warnings.push(...validation.warnings);
  }

  const normalized = normalizeSceneDocument(raw);
  const migrated = migrateScene(normalized);

  return {
    type: 'scene',
    renderEngine: 'scene',
    sceneJson: migrated,
    visualHtml: null,
    sceneVersion: version || migrated.version || 'v1',
    warnings,
  };
}

function stripCodeFences(text: string): string {
  return text
    .replace(/^```(?:json|html|javascript|typescript)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
}

function tryParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Check if an object looks like a SceneDocument:
 * Must have `version`, `nodes` array, and `width`/`height`.
 */
function isSceneDocumentShape(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  return (
    'nodes' in o &&
    Array.isArray(o.nodes) &&
    ('width' in o || 'height' in o || 'version' in o)
  );
}

function tryExtractSceneDocument(obj: unknown): AISceneResult | null {
  if (isSceneDocumentShape(obj)) {
    return buildSceneResult(obj);
  }
  return null;
}

function tryExtractWrappedPayload(obj: Record<string, unknown>): AISceneResult | null {
  // Direct wrapped: { render_engine: "scene", scene_json: {...} }
  if (obj.render_engine === 'scene' && obj.scene_json) {
    return buildSceneResult(obj.scene_json, obj.scene_version as string | undefined);
  }

  // Platform-keyed: { instagram_post: { render_engine: "scene", scene_json: {...} } }
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') {
      const v = value as WrappedScenePayload;
      if (v.render_engine === 'scene' && v.scene_json) {
        return buildSceneResult(v.scene_json, v.scene_version);
      }
    }
  }

  return null;
}

function tryExtractEmbeddedJson(text: string): unknown | null {
  // Find the first { ... } or [ ... ] block in the text
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let end = -1;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  if (end === -1) return null;
  return tryParseJson(text.slice(start, end + 1));
}

function looksLikeHtml(text: string): boolean {
  const trimmed = text.trim();
  return (
    trimmed.startsWith('<') &&
    (trimmed.includes('</') || trimmed.includes('/>'))
  );
}
