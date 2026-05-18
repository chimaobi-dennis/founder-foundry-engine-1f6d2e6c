/**
 * validateSceneDocument.ts
 *
 * Zod-based validation and normalization for SceneDocument.
 * AI-generated scenes WILL be malformed — this layer ensures the renderer
 * never crashes and always receives structurally sound data.
 */

import { z } from 'zod';
import type { SceneDocument, SceneNode } from '@/types/scene';
import { resolveFontFamily, resolveFontWeight } from '@/lib/fonts/fontRegistry';

// ─── Helpers ──────────────────────────────────────────────────

/** Clamp a number between min and max. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Coerce a value to a finite number, or return the fallback. */
function finiteOr(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Snap a number to the nearest even pixel. */
function snapToEven(value: number): number {
  return Math.round(value / 2) * 2;
}

// ─── Color Validation ─────────────────────────────────────────

const HEX_RE = /^#([0-9a-fA-F]{3,8})$/;
const RGB_RE = /^rgba?\(\s*\d/;

/** Sanitize a CSS color string. Returns fallback if invalid. */
export function sanitizeColor(color: unknown, fallback = '#000000'): string {
  if (typeof color !== 'string' || color.length === 0) return fallback;
  const trimmed = color.trim();
  if (HEX_RE.test(trimmed)) return trimmed;
  if (RGB_RE.test(trimmed)) return trimmed;
  // Named CSS colors — allow a small safe set
  const named = trimmed.toLowerCase();
  const safe = [
    'transparent', 'white', 'black', 'red', 'green', 'blue', 'yellow',
    'orange', 'purple', 'pink', 'gray', 'grey', 'brown', 'cyan', 'magenta',
  ];
  if (safe.includes(named)) return named;
  return fallback;
}

// ─── Zod Schemas ──────────────────────────────────────────────

const BaseNodeSchema = z.object({
  id: z.string().min(1).catch('node_' + Math.random().toString(36).slice(2, 9)),
  type: z.enum(['text', 'image', 'shape', 'group', 'frame', 'stack', 'svg', 'icon', 'button']),
  x: z.number().catch(0),
  y: z.number().catch(0),
  width: z.number().positive().catch(100),
  height: z.number().positive().catch(100),
  rotation: z.number().finite().catch(0),
  opacity: z.number().min(0).max(1).catch(1),
  zIndex: z.number().int().catch(0),
});

const TextNodeSchema = BaseNodeSchema.extend({
  type: z.literal('text'),
  text: z.string().catch(''),
  fontSize: z.number().positive().catch(16),
  fontFamily: z.string().catch('Inter'),
  fontWeight: z.number().int().min(100).max(900).catch(400),
  lineHeight: z.number().positive().catch(1.4),
  letterSpacing: z.number().finite().catch(0),
  color: z.string().catch('#000000'),
  align: z.enum(['left', 'center', 'right', 'justify']).catch('left'),
});

const ImageNodeSchema = BaseNodeSchema.extend({
  type: z.literal('image'),
  src: z.string().catch(''),
  objectFit: z.enum(['cover', 'contain', 'fill', 'none']).catch('cover'),
  borderRadius: z.number().min(0).catch(0),
});

const ShapeNodeSchema = BaseNodeSchema.extend({
  type: z.literal('shape'),
  fill: z.string().catch('#cccccc'),
  stroke: z.string().catch('transparent'),
  strokeWidth: z.number().min(0).catch(0),
  radius: z.number().min(0).catch(0),
});

const FrameNodeSchema = BaseNodeSchema.extend({
  type: z.literal('frame'),
  fill: z.string().catch('transparent'),
  stroke: z.string().catch('transparent'),
  strokeWidth: z.number().min(0).catch(0),
  radius: z.number().min(0).catch(0),
  clipContent: z.boolean().catch(true),
});

const StackNodeSchema = BaseNodeSchema.extend({
  type: z.literal('stack'),
  direction: z.enum(['horizontal', 'vertical']).catch('vertical'),
  gap: z.number().min(0).catch(0),
  align: z.enum(['start', 'center', 'end', 'stretch']).catch('start'),
  justify: z.enum(['start', 'center', 'end', 'space-between']).catch('start'),
  padding: z.number().min(0).catch(0),
});

const SvgNodeSchema = BaseNodeSchema.extend({
  type: z.literal('svg'),
  svgContent: z.string().catch(''),
  preserveAspectRatio: z.boolean().catch(true),
});

const IconNodeSchema = BaseNodeSchema.extend({
  type: z.literal('icon'),
  iconName: z.string().catch('circle'),
  iconLibrary: z.enum(['lucide', 'custom']).catch('lucide'),
  color: z.string().catch('#000000'),
  strokeWidth: z.number().min(0).catch(2),
});

const ButtonNodeSchema = BaseNodeSchema.extend({
  type: z.literal('button'),
  label: z.string().catch('Button'),
  fontSize: z.number().positive().catch(16),
  fontFamily: z.string().catch('Inter'),
  fontWeight: z.number().int().min(100).max(900).catch(600),
  textColor: z.string().catch('#ffffff'),
  fill: z.string().catch('#333333'),
  stroke: z.string().catch('transparent'),
  strokeWidth: z.number().min(0).catch(0),
  radius: z.number().min(0).catch(8),
  iconName: z.string().optional(),
  iconPosition: z.enum(['left', 'right']).optional(),
});

// Group/Frame/Stack are recursive — we define them with z.lazy
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SceneNodeSchema: z.ZodType<any> = z.lazy(() =>
  z.discriminatedUnion('type', [
    TextNodeSchema,
    ImageNodeSchema,
    ShapeNodeSchema,
    BaseNodeSchema.extend({
      type: z.literal('group'),
      children: z.array(SceneNodeSchema).catch([]),
    }),
    FrameNodeSchema.extend({
      children: z.array(SceneNodeSchema).catch([]),
    }),
    StackNodeSchema.extend({
      children: z.array(SceneNodeSchema).catch([]),
    }),
    SvgNodeSchema,
    IconNodeSchema,
    ButtonNodeSchema,
  ])
);

const SceneMetadataSchema = z.object({
  compositionStyle: z.enum(['editorial', 'minimal', 'bold', 'cinematic', 'modular']).optional(),
  visualDensity: z.enum(['sparse', 'balanced', 'dense']).optional(),
  focalPoints: z.array(z.object({ x: z.number(), y: z.number(), weight: z.number() })).optional(),
  campaignIntent: z.string().optional(),
  aiConfidence: z.number().min(0).max(1).optional(),
  generationModel: z.string().optional(),
  generationStrategy: z.string().optional(),
}).optional();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SceneDocumentSchema: z.ZodType<any> = z.object({
  version: z.string().catch('v1'),
  width: z.number().positive().catch(600),
  height: z.number().positive().catch(600),
  background: z.string().catch('#ffffff'),
  nodes: z.array(SceneNodeSchema).catch([]),
  meta: SceneMetadataSchema,
});

// ─── Validation ───────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  document: SceneDocument;
  warnings: string[];
}

/**
 * Validate and coerce a raw object into a safe SceneDocument.
 * Never throws — always returns a usable document + warnings.
 */
export function validateSceneDocument(raw: unknown): ValidationResult {
  const warnings: string[] = [];

  if (raw === null || raw === undefined || typeof raw !== 'object') {
    warnings.push('Input is not an object — returning empty scene');
    return {
      valid: false,
      document: { version: 'v1', width: 600, height: 600, background: '#ffffff', nodes: [] },
      warnings,
    };
  }

  const result = SceneDocumentSchema.safeParse(raw);

  if (!result.success) {
    for (const issue of result.error.issues) {
      warnings.push(`Validation: ${issue.path.join('.')} — ${issue.message}`);
    }
    // Still try to coerce with catch defaults
    const coerced = SceneDocumentSchema.parse(raw) as SceneDocument;
    return { valid: false, document: coerced, warnings };
  }

  return { valid: true, document: result.data as SceneDocument, warnings };
}

// ─── Normalization ────────────────────────────────────────────

/**
 * Clamp a node's bounds so it stays within the canvas.
 * Ensures width/height are positive and position is finite.
 */
export function clampBounds(
  node: SceneNode,
  canvasWidth: number,
  canvasHeight: number
): SceneNode {
  const x = finiteOr(node.x, 0);
  const y = finiteOr(node.y, 0);
  const width = Math.max(1, finiteOr(node.width, 100));
  const height = Math.max(1, finiteOr(node.height, 100));

  // Clamp so at least 1px of the node is visible on canvas
  const clampedX = clamp(x, -width + 1, canvasWidth - 1);
  const clampedY = clamp(y, -height + 1, canvasHeight - 1);

  return { ...node, x: clampedX, y: clampedY, width, height };
}

/**
 * Normalize a single node:
 * - Fix missing IDs
 * - Snap positions to even pixels
 * - Clamp opacity
 * - Sanitize colors
 * - Resolve fonts
 * - Ensure finite transforms
 * - Remove unknown properties
 */
export function normalizeNode(
  node: SceneNode,
  canvasWidth: number,
  canvasHeight: number,
  usedIds: Set<string>
): SceneNode {
  // Fix missing or duplicate IDs
  let id = node.id;
  if (!id || usedIds.has(id)) {
    id = `node_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
  }
  usedIds.add(id);

  // Common normalization
  const base = {
    id,
    type: node.type,
    x: snapToEven(finiteOr(node.x, 0)),
    y: snapToEven(finiteOr(node.y, 0)),
    width: Math.max(1, finiteOr(node.width, 100)),
    height: Math.max(1, finiteOr(node.height, 100)),
    rotation: finiteOr(node.rotation, 0),
    opacity: clamp(finiteOr(node.opacity, 1), 0, 1),
    zIndex: Math.max(0, Math.floor(finiteOr(node.zIndex, 0))),
  };

  switch (node.type) {
    case 'text': {
      const family = resolveFontFamily(node.fontFamily || 'Inter');
      const weight = resolveFontWeight(family, finiteOr(node.fontWeight, 400));
      return {
        ...base,
        type: 'text' as const,
        text: typeof node.text === 'string' ? node.text : '',
        fontSize: Math.max(1, finiteOr(node.fontSize, 16)),
        fontFamily: family,
        fontWeight: weight,
        lineHeight: Math.max(0.5, finiteOr(node.lineHeight, 1.4)),
        letterSpacing: finiteOr(node.letterSpacing, 0),
        color: sanitizeColor(node.color, '#000000'),
        align: (['left', 'center', 'right', 'justify'] as const).includes(node.align) ? node.align : 'left',
      };
    }
    case 'image':
      return {
        ...base,
        type: 'image' as const,
        src: typeof node.src === 'string' ? node.src : '',
        objectFit: (['cover', 'contain', 'fill', 'none'] as const).includes(node.objectFit) ? node.objectFit : 'cover',
        borderRadius: Math.max(0, finiteOr(node.borderRadius, 0)),
      };
    case 'shape':
      return {
        ...base,
        type: 'shape' as const,
        fill: sanitizeColor(node.fill, '#cccccc'),
        stroke: sanitizeColor(node.stroke, 'transparent'),
        strokeWidth: Math.max(0, finiteOr(node.strokeWidth, 0)),
        radius: Math.max(0, finiteOr(node.radius, 0)),
      };
    case 'group':
      return {
        ...base,
        type: 'group' as const,
        children: (node.children || []).map((child) =>
          normalizeNode(child, canvasWidth, canvasHeight, usedIds)
        ),
      };
    case 'frame':
      return {
        ...base,
        type: 'frame' as const,
        children: (node.children || []).map((child) =>
          normalizeNode(child, canvasWidth, canvasHeight, usedIds)
        ),
        fill: sanitizeColor(node.fill, 'transparent'),
        stroke: sanitizeColor(node.stroke, 'transparent'),
        strokeWidth: Math.max(0, finiteOr(node.strokeWidth, 0)),
        radius: Math.max(0, finiteOr(node.radius, 0)),
        clipContent: node.clipContent !== false,
      };
    case 'stack':
      return {
        ...base,
        type: 'stack' as const,
        children: (node.children || []).map((child) =>
          normalizeNode(child, canvasWidth, canvasHeight, usedIds)
        ),
        direction: (['horizontal', 'vertical'] as const).includes(node.direction) ? node.direction : 'vertical',
        gap: Math.max(0, finiteOr(node.gap, 0)),
        align: (['start', 'center', 'end', 'stretch'] as const).includes(node.align) ? node.align : 'start',
        justify: (['start', 'center', 'end', 'space-between'] as const).includes(node.justify) ? node.justify : 'start',
        padding: Math.max(0, finiteOr(node.padding, 0)),
      };
    case 'svg':
      return {
        ...base,
        type: 'svg' as const,
        svgContent: typeof node.svgContent === 'string' ? node.svgContent : '',
        preserveAspectRatio: node.preserveAspectRatio !== false,
      };
    case 'icon':
      return {
        ...base,
        type: 'icon' as const,
        iconName: typeof node.iconName === 'string' ? node.iconName : 'circle',
        iconLibrary: node.iconLibrary === 'custom' ? 'custom' as const : 'lucide' as const,
        color: sanitizeColor(node.color, '#000000'),
        strokeWidth: Math.max(0, finiteOr(node.strokeWidth, 2)),
      };
    case 'button': {
      const btnFamily = resolveFontFamily(node.fontFamily || 'Inter');
      const btnWeight = resolveFontWeight(btnFamily, finiteOr(node.fontWeight, 600));
      return {
        ...base,
        type: 'button' as const,
        label: typeof node.label === 'string' ? node.label : 'Button',
        fontSize: Math.max(1, finiteOr(node.fontSize, 16)),
        fontFamily: btnFamily,
        fontWeight: btnWeight,
        textColor: sanitizeColor(node.textColor, '#ffffff'),
        fill: sanitizeColor(node.fill, '#333333'),
        stroke: sanitizeColor(node.stroke, 'transparent'),
        strokeWidth: Math.max(0, finiteOr(node.strokeWidth, 0)),
        radius: Math.max(0, finiteOr(node.radius, 8)),
        iconName: typeof node.iconName === 'string' ? node.iconName : undefined,
        iconPosition: node.iconPosition === 'right' ? 'right' as const : node.iconPosition === 'left' ? 'left' as const : undefined,
      };
    }
    default:
      return { ...base, type: 'shape' as const, fill: '#cccccc', stroke: 'transparent', strokeWidth: 0, radius: 0 };
  }
}

/**
 * Full normalization pass on a SceneDocument.
 * Validates, normalizes every node, deduplicates IDs,
 * and ensures deterministic zIndex ordering.
 */
export function normalizeSceneDocument(raw: unknown): SceneDocument {
  const { document: doc } = validateSceneDocument(raw);

  const usedIds = new Set<string>();
  const normalizedNodes = doc.nodes.map((node) =>
    normalizeNode(node, doc.width, doc.height, usedIds)
  );

  // Ensure deterministic zIndex ordering
  const sorted = [...normalizedNodes].sort((a, b) => a.zIndex - b.zIndex);
  const reindexed = sorted.map((node, i) => ({ ...node, zIndex: i }));

  return {
    version: doc.version || 'v1',
    width: Math.max(1, finiteOr(doc.width, 600)),
    height: Math.max(1, finiteOr(doc.height, 600)),
    background: sanitizeColor(doc.background, '#ffffff'),
    nodes: reindexed,
  };
}
