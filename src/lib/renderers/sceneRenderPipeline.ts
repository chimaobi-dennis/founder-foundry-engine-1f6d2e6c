/**
 * sceneRenderPipeline.ts
 *
 * Canonical render pipeline for SceneDocument.
 * ALL geometry calculations flow through here — editor, preview, and export
 * consume the same RenderInstruction[] output.
 *
 * This file owns:
 * - normalizeForRender(): clamp, sanitize, resolve geometry
 * - compileRenderInstructions(): SceneDocument → RenderInstruction[]
 * - clampRadius(): single source of truth for border-radius clamping
 * - resolveTransform(): single source of truth for rotation + opacity
 *
 * NO rendering happens here. Consumers (Canvas2D, React/CSS) interpret
 * these instructions in their own medium.
 */

import type {
  SceneDocument,
  SceneNode,
  TextNode,
  ImageNode,
  ShapeNode,
  GroupNode,
  FrameNode,
  StackNode,
  SvgNode,
  IconNode,
  ButtonNode,
} from '@/types/scene';
import { resolveFontFamily, resolveFontWeight } from '@/lib/fonts/fontRegistry';

// ─── Render Target ────────────────────────────────────────────

export type RenderTarget = 'editor' | 'preview' | 'export';

// ─── Render Instructions ──────────────────────────────────────

export interface RenderTransform {
  /** X position (CSS left / canvas translate) */
  x: number;
  /** Y position (CSS top / canvas translate) */
  y: number;
  /** Width in CSS pixels */
  width: number;
  /** Height in CSS pixels */
  height: number;
  /** Rotation in degrees */
  rotation: number;
  /** Opacity 0-1 (clamped) */
  opacity: number;
  /** Z-index for ordering */
  zIndex: number;
}

export interface RenderRadius {
  /** Clamped border-radius in px. Never exceeds min(w,h)/2. */
  radius: number;
  /** True if radius === min(w,h)/2 (perfect circle/pill) */
  isCircular: boolean;
}

export interface RenderFill {
  /** Resolved fill color or gradient string */
  fill: string;
  /** True if fill is 'transparent' or empty */
  isTransparent: boolean;
}

export interface RenderStroke {
  color: string;
  width: number;
  isVisible: boolean;
}

export interface RenderFont {
  /** Resolved (whitelisted) font family */
  family: string;
  /** Resolved (closest allowed) weight */
  weight: number;
  /** Font size in px (min 1) */
  size: number;
  /** Line height as multiplier (min 0.5) */
  lineHeight: number;
  /** Letter spacing in px */
  letterSpacing: number;
  /** CSS font shorthand: "weight sizepx family" */
  cssFont: string;
}

export interface RenderText {
  content: string;
  font: RenderFont;
  color: string;
  align: 'left' | 'center' | 'right' | 'justify';
}

export type RenderInstructionType =
  | 'shape'
  | 'text'
  | 'image'
  | 'group'
  | 'frame'
  | 'stack'
  | 'svg'
  | 'icon'
  | 'button';

export interface RenderInstructionBase {
  id: string;
  type: RenderInstructionType;
  transform: RenderTransform;
}

export interface ShapeRenderInstruction extends RenderInstructionBase {
  type: 'shape';
  fill: RenderFill;
  stroke: RenderStroke;
  radius: RenderRadius;
}

export interface TextRenderInstruction extends RenderInstructionBase {
  type: 'text';
  text: RenderText;
}

export interface ImageRenderInstruction extends RenderInstructionBase {
  type: 'image';
  src: string;
  objectFit: 'cover' | 'contain' | 'fill' | 'none';
  radius: RenderRadius;
}

export interface GroupRenderInstruction extends RenderInstructionBase {
  type: 'group';
  children: RenderInstruction[];
}

export interface FrameRenderInstruction extends RenderInstructionBase {
  type: 'frame';
  fill: RenderFill;
  stroke: RenderStroke;
  radius: RenderRadius;
  clipContent: boolean;
  children: RenderInstruction[];
}

export interface StackRenderInstruction extends RenderInstructionBase {
  type: 'stack';
  direction: 'horizontal' | 'vertical';
  gap: number;
  padding: number;
  align: 'start' | 'center' | 'end' | 'stretch';
  justify: 'start' | 'center' | 'end' | 'space-between';
  children: RenderInstruction[];
}

export interface SvgRenderInstruction extends RenderInstructionBase {
  type: 'svg';
  svgContent: string;
  preserveAspectRatio: boolean;
}

export interface IconRenderInstruction extends RenderInstructionBase {
  type: 'icon';
  iconName: string;
  iconLibrary: 'lucide' | 'custom';
  color: string;
  strokeWidth: number;
}

export interface ButtonRenderInstruction extends RenderInstructionBase {
  type: 'button';
  label: string;
  font: RenderFont;
  textColor: string;
  fill: RenderFill;
  stroke: RenderStroke;
  radius: RenderRadius;
}

export type RenderInstruction =
  | ShapeRenderInstruction
  | TextRenderInstruction
  | ImageRenderInstruction
  | GroupRenderInstruction
  | FrameRenderInstruction
  | StackRenderInstruction
  | SvgRenderInstruction
  | IconRenderInstruction
  | ButtonRenderInstruction;

// ─── Compiled Scene ───────────────────────────────────────────

export interface CompiledScene {
  width: number;
  height: number;
  background: string;
  instructions: RenderInstruction[];
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Compile a SceneDocument into deterministic RenderInstructions.
 * This is the ONLY function that interprets scene geometry.
 * Both the Canvas2D renderer and React/CSS renderer consume its output.
 */
export function compileScene(scene: SceneDocument, _target: RenderTarget = 'editor'): CompiledScene {
  const width = Math.max(1, safeNum(scene.width, 600));
  const height = Math.max(1, safeNum(scene.height, 600));
  const background = scene.background || '#ffffff';

  const sorted = [...scene.nodes].sort((a, b) => a.zIndex - b.zIndex);
  const instructions = sorted.map((node) => compileNode(node));

  return { width, height, background, instructions };
}

// ─── Geometry Helpers (CANONICAL) ─────────────────────────────

/**
 * Clamp a border-radius so it never exceeds min(width, height) / 2.
 * This is the SINGLE SOURCE OF TRUTH for radius clamping.
 * Both Canvas2D roundRect and CSS border-radius must use this value.
 */
export function clampRadius(radius: number, width: number, height: number): RenderRadius {
  const maxR = Math.min(width, height) / 2;
  const clamped = Math.max(0, Math.min(safeNum(radius, 0), maxR));
  return {
    radius: clamped,
    isCircular: clamped > 0 && clamped >= maxR - 0.5,
  };
}

/**
 * Resolve fill color. Handles transparent, empty, and gradient strings.
 */
export function resolveFill(fill: string | undefined | null): RenderFill {
  const f = (fill || '').trim();
  const isTransparent = !f || f === 'transparent' || f === 'none';
  return { fill: isTransparent ? 'transparent' : f, isTransparent };
}

/**
 * Resolve stroke.
 */
export function resolveStroke(
  color: string | undefined | null,
  width: number | undefined | null
): RenderStroke {
  const c = (color || '').trim();
  const w = Math.max(0, safeNum(width, 0));
  const isVisible = w > 0 && !!c && c !== 'transparent' && c !== 'none';
  return { color: isVisible ? c : 'transparent', width: w, isVisible };
}

/**
 * Resolve font properties to deterministic values.
 */
export function resolveFont(
  family: string | undefined,
  weight: number | undefined,
  size: number | undefined,
  lineHeight: number | undefined,
  letterSpacing: number | undefined
): RenderFont {
  const resolvedFamily = resolveFontFamily(family || 'Inter');
  const resolvedWeight = resolveFontWeight(resolvedFamily, safeNum(weight, 400));
  const resolvedSize = Math.max(1, safeNum(size, 16));
  const resolvedLineHeight = Math.max(0.5, safeNum(lineHeight, 1.4));
  const resolvedLetterSpacing = safeNum(letterSpacing, 0);
  const cssFont = `${resolvedWeight} ${resolvedSize}px "${resolvedFamily}"`;

  return {
    family: resolvedFamily,
    weight: resolvedWeight,
    size: resolvedSize,
    lineHeight: resolvedLineHeight,
    letterSpacing: resolvedLetterSpacing,
    cssFont,
  };
}

/**
 * Build the common transform for any node.
 */
function resolveTransform(node: SceneNode): RenderTransform {
  return {
    x: safeNum(node.x, 0),
    y: safeNum(node.y, 0),
    width: Math.max(1, safeNum(node.width, 100)),
    height: Math.max(1, safeNum(node.height, 100)),
    rotation: safeNum(node.rotation, 0),
    opacity: Math.max(0, Math.min(1, safeNum(node.opacity, 1))),
    zIndex: Math.max(0, Math.floor(safeNum(node.zIndex, 0))),
  };
}

// ─── Node Compiler ────────────────────────────────────────────

function compileNode(node: SceneNode): RenderInstruction {
  const transform = resolveTransform(node);
  const base = { id: node.id, transform };

  switch (node.type) {
    case 'text':
      return compileTextNode(base, node);
    case 'image':
      return compileImageNode(base, node);
    case 'shape':
      return compileShapeNode(base, node);
    case 'group':
      return compileGroupNode(base, node);
    case 'frame':
      return compileFrameNode(base, node);
    case 'stack':
      return compileStackNode(base, node);
    case 'svg':
      return compileSvgNode(base, node);
    case 'icon':
      return compileIconNode(base, node);
    case 'button':
      return compileButtonNode(base, node);
    default:
      // Unknown type → render as transparent shape
      return {
        ...base,
        type: 'shape',
        fill: resolveFill('transparent'),
        stroke: resolveStroke('transparent', 0),
        radius: clampRadius(0, transform.width, transform.height),
      };
  }
}

function compileTextNode(base: { id: string; transform: RenderTransform }, node: TextNode): TextRenderInstruction {
  const font = resolveFont(node.fontFamily, node.fontWeight, node.fontSize, node.lineHeight, node.letterSpacing);
  const align = (['left', 'center', 'right', 'justify'] as const).includes(node.align) ? node.align : 'left';

  return {
    ...base,
    type: 'text',
    text: {
      content: node.text || '',
      font,
      color: node.color || '#000000',
      align,
    },
  };
}

function compileImageNode(base: { id: string; transform: RenderTransform }, node: ImageNode): ImageRenderInstruction {
  return {
    ...base,
    type: 'image',
    src: node.src || '',
    objectFit: (['cover', 'contain', 'fill', 'none'] as const).includes(node.objectFit) ? node.objectFit : 'cover',
    radius: clampRadius(node.borderRadius, base.transform.width, base.transform.height),
  };
}

function compileShapeNode(base: { id: string; transform: RenderTransform }, node: ShapeNode): ShapeRenderInstruction {
  return {
    ...base,
    type: 'shape',
    fill: resolveFill(node.fill),
    stroke: resolveStroke(node.stroke, node.strokeWidth),
    radius: clampRadius(node.radius, base.transform.width, base.transform.height),
  };
}

function compileGroupNode(base: { id: string; transform: RenderTransform }, node: GroupNode): GroupRenderInstruction {
  const sorted = [...node.children].sort((a, b) => a.zIndex - b.zIndex);
  return {
    ...base,
    type: 'group',
    children: sorted.map(compileNode),
  };
}

function compileFrameNode(base: { id: string; transform: RenderTransform }, node: FrameNode): FrameRenderInstruction {
  const sorted = [...node.children].sort((a, b) => a.zIndex - b.zIndex);
  return {
    ...base,
    type: 'frame',
    fill: resolveFill(node.fill),
    stroke: resolveStroke(node.stroke, node.strokeWidth),
    radius: clampRadius(node.radius, base.transform.width, base.transform.height),
    clipContent: node.clipContent !== false,
    children: sorted.map(compileNode),
  };
}

function compileStackNode(base: { id: string; transform: RenderTransform }, node: StackNode): StackRenderInstruction {
  const sorted = [...node.children].sort((a, b) => a.zIndex - b.zIndex);
  return {
    ...base,
    type: 'stack',
    direction: node.direction === 'horizontal' ? 'horizontal' : 'vertical',
    gap: Math.max(0, safeNum(node.gap, 0)),
    padding: Math.max(0, safeNum(node.padding, 0)),
    align: (['start', 'center', 'end', 'stretch'] as const).includes(node.align) ? node.align : 'start',
    justify: (['start', 'center', 'end', 'space-between'] as const).includes(node.justify) ? node.justify : 'start',
    children: sorted.map(compileNode),
  };
}

function compileSvgNode(base: { id: string; transform: RenderTransform }, node: SvgNode): SvgRenderInstruction {
  return {
    ...base,
    type: 'svg',
    svgContent: node.svgContent || '',
    preserveAspectRatio: node.preserveAspectRatio !== false,
  };
}

function compileIconNode(base: { id: string; transform: RenderTransform }, node: IconNode): IconRenderInstruction {
  return {
    ...base,
    type: 'icon',
    iconName: node.iconName || 'circle',
    iconLibrary: node.iconLibrary === 'custom' ? 'custom' : 'lucide',
    color: node.color || '#000000',
    strokeWidth: Math.max(0, safeNum(node.strokeWidth, 2)),
  };
}

function compileButtonNode(base: { id: string; transform: RenderTransform }, node: ButtonNode): ButtonRenderInstruction {
  const font = resolveFont(node.fontFamily, node.fontWeight, node.fontSize, 1.2, 0);
  return {
    ...base,
    type: 'button',
    label: node.label || 'Button',
    font,
    textColor: node.textColor || '#ffffff',
    fill: resolveFill(node.fill),
    stroke: resolveStroke(node.stroke, node.strokeWidth),
    radius: clampRadius(node.radius, base.transform.width, base.transform.height),
  };
}

// ─── Utility ──────────────────────────────────────────────────

/** Coerce to finite number or return fallback. */
function safeNum(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
