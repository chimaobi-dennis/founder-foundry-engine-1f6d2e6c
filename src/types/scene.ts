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

/** Common properties shared by every node on the canvas. */
export interface BaseNode {
  id: string;
  type: 'text' | 'image' | 'shape' | 'group';
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

// ─── Union Type ───────────────────────────────────────────────

export type SceneNode = TextNode | ImageNode | ShapeNode | GroupNode;

// ─── Scene Document ───────────────────────────────────────────

/** Top-level document stored in the `scene_json` JSONB column. */
export interface SceneDocument {
  version: string;
  width: number;
  height: number;
  background: string;
  nodes: SceneNode[];
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
