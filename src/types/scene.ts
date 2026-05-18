/**
 * Scene JSON type definitions for structured rendering.
 *
 * These types define the shape of a SceneDocument — a canvas-like
 * representation of a creative that can be rendered, edited, and exported
 * without relying on arbitrary HTML.
 *
 * The scene renderer operates alongside the existing HTML renderer.
 * `render_engine` on each record determines which pipeline the frontend uses.
 */

// ─── Render Engine ────────────────────────────────────────────

/** Discriminator stored in the database to tell the frontend which renderer to use. */
export type RenderEngine = 'html' | 'scene';

// ─── Base Node ────────────────────────────────────────────────

/** All node type discriminators. */
export type NodeType = 'text' | 'image' | 'shape' | 'group' | 'frame' | 'stack' | 'svg' | 'icon' | 'button';

/** Common properties shared by every node on the canvas. */
export interface BaseNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  zIndex: number;
}

// ─── Text Node ────────────────────────────────────────────────

export interface TextNode extends BaseNode {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: number;
  color: string;
  align: 'left' | 'center' | 'right' | 'justify';
}

// ─── Image Node ───────────────────────────────────────────────

export interface ImageNode extends BaseNode {
  type: 'image';
  src: string;
  objectFit: 'cover' | 'contain' | 'fill' | 'none';
  borderRadius: number;
}

// ─── Shape Node ───────────────────────────────────────────────

export interface ShapeNode extends BaseNode {
  type: 'shape';
  fill: string;
  stroke: string;
  strokeWidth: number;
  radius: number;
}

// ─── Group Node ───────────────────────────────────────────────

export interface GroupNode extends BaseNode {
  type: 'group';
  children: SceneNode[];
}

// ─── Frame Node ──────────────────────────────────────────────

/** Container with clipping, background, and nested children. */
export interface FrameNode extends BaseNode {
  type: 'frame';
  children: SceneNode[];
  fill: string;
  stroke: string;
  strokeWidth: number;
  radius: number;
  /** Clip children to frame bounds. Default true. */
  clipContent: boolean;
}

// ─── Stack Node ──────────────────────────────────────────────

/** Auto-layout container with direction and gap. */
export interface StackNode extends BaseNode {
  type: 'stack';
  children: SceneNode[];
  direction: 'horizontal' | 'vertical';
  gap: number;
  /** How children are aligned on the cross-axis. */
  align: 'start' | 'center' | 'end' | 'stretch';
  /** How children are distributed on the main axis. */
  justify: 'start' | 'center' | 'end' | 'space-between';
  padding: number;
}

// ─── SVG Node ────────────────────────────────────────────────

/** Reusable scalable vector graphic. */
export interface SvgNode extends BaseNode {
  type: 'svg';
  /** Raw SVG markup or a data URI. */
  svgContent: string;
  /** Preserve aspect ratio on resize. */
  preserveAspectRatio: boolean;
}

// ─── Icon Node ───────────────────────────────────────────────

/** Semantic icon from an icon library (e.g. Lucide). */
export interface IconNode extends BaseNode {
  type: 'icon';
  /** Icon name from the library (e.g. 'arrow-right'). */
  iconName: string;
  /** Icon library identifier. */
  iconLibrary: 'lucide' | 'custom';
  color: string;
  /** Stroke width for line icons. */
  strokeWidth: number;
}

// ─── Button Node ─────────────────────────────────────────────

/** CTA-aware button with label, optional icon, and background. */
export interface ButtonNode extends BaseNode {
  type: 'button';
  label: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  textColor: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
  radius: number;
  /** Optional icon name (from icon library). */
  iconName?: string;
  /** Icon position relative to label. */
  iconPosition?: 'left' | 'right';
}

// ─── Union Type ───────────────────────────────────────────────

export type SceneNode =
  | TextNode
  | ImageNode
  | ShapeNode
  | GroupNode
  | FrameNode
  | StackNode
  | SvgNode
  | IconNode
  | ButtonNode;

// ─── Scene Document ───────────────────────────────────────────

// ─── Scene Metadata ──────────────────────────────────────────

/** Optional intelligence metadata for AI-generated scenes. */
export interface SceneMetadata {
  compositionStyle?: 'editorial' | 'minimal' | 'bold' | 'cinematic' | 'modular';
  visualDensity?: 'sparse' | 'balanced' | 'dense';
  focalPoints?: Array<{ x: number; y: number; weight: number }>;
  campaignIntent?: string;
  aiConfidence?: number;
  generationModel?: string;
  generationStrategy?: string;
}

/** Top-level document stored in the `scene_json` JSONB column. */
export interface SceneDocument {
  version: string;
  width: number;
  height: number;
  background: string;
  nodes: SceneNode[];
  /** Optional AI/composition metadata. */
  meta?: SceneMetadata;
}

// ─── Session Payload ──────────────────────────────────────────

/**
 * Unified payload returned when fetching a studio session.
 * The frontend uses `renderEngine` to decide which renderer to mount.
 */
export interface StudioSessionPayload {
  renderEngine: RenderEngine;
  visualHtml: string | null;
  sceneJson: SceneDocument | null;
}

// ─── Helpers ──────────────────────────────────────────────────

/** Type-guard: is the node a TextNode? */
export function isTextNode(node: SceneNode): node is TextNode {
  return node.type === 'text';
}

/** Type-guard: is the node an ImageNode? */
export function isImageNode(node: SceneNode): node is ImageNode {
  return node.type === 'image';
}

/** Type-guard: is the node a ShapeNode? */
export function isShapeNode(node: SceneNode): node is ShapeNode {
  return node.type === 'shape';
}

/** Type-guard: is the node a GroupNode? */
export function isGroupNode(node: SceneNode): node is GroupNode {
  return node.type === 'group';
}

/** Type-guard: is the node a FrameNode? */
export function isFrameNode(node: SceneNode): node is FrameNode {
  return node.type === 'frame';
}

/** Type-guard: is the node a StackNode? */
export function isStackNode(node: SceneNode): node is StackNode {
  return node.type === 'stack';
}

/** Type-guard: is the node a SvgNode? */
export function isSvgNode(node: SceneNode): node is SvgNode {
  return node.type === 'svg';
}

/** Type-guard: is the node an IconNode? */
export function isIconNode(node: SceneNode): node is IconNode {
  return node.type === 'icon';
}

/** Type-guard: is the node a ButtonNode? */
export function isButtonNode(node: SceneNode): node is ButtonNode {
  return node.type === 'button';
}

/** Create a minimal empty SceneDocument with sensible defaults. */
export function createEmptyScene(
  width: number,
  height: number,
  background = '#ffffff'
): SceneDocument {
  return {
    version: 'v1',
    width,
    height,
    background,
    nodes: [],
  };
}
