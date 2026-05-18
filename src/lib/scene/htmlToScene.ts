/**
 * htmlToScene.ts
 *
 * Converts legacy HTML creatives into SceneDocument.
 * This is a best-effort converter — not pixel-perfect.
 * Goal: salvage editable structure from old HTML assets.
 *
 * Runs in the browser (needs DOMParser).
 */

import type { SceneDocument, SceneNode, TextNode, ImageNode, ShapeNode } from '@/types/scene';
import { resolveFontFamily } from '@/lib/fonts/fontRegistry';

// ─── Options ──────────────────────────────────────────────────

export interface HtmlToSceneOptions {
  /** Canvas width. Default 600. */
  width?: number;
  /** Canvas height. Default 600. */
  height?: number;
  /** Default background if none detected. Default '#ffffff'. */
  defaultBackground?: string;
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Convert an HTML string into a SceneDocument.
 * Best-effort — extracts text blocks, images, backgrounds, and basic layout.
 */
export function htmlToScene(
  html: string,
  options: HtmlToSceneOptions = {}
): SceneDocument {
  const {
    width = 600,
    height = 600,
    defaultBackground = '#ffffff',
  } = options;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const body = doc.body;

  if (!body) {
    return { version: 'v1', width, height, background: defaultBackground, nodes: [] };
  }

  // Extract background
  const background = extractBackground(body) || defaultBackground;

  // Walk DOM and extract nodes
  const nodes: SceneNode[] = [];
  let zIndex = 0;
  const yTracker = { current: 24 }; // vertical cursor for flow layout

  walkDom(body, nodes, yTracker, width, () => zIndex++);

  return {
    version: 'v1',
    width,
    height,
    background,
    nodes,
  };
}

// ─── DOM Walker ───────────────────────────────────────────────

function walkDom(
  element: Element,
  nodes: SceneNode[],
  yTracker: { current: number },
  canvasWidth: number,
  nextZ: () => number
): void {
  for (const child of Array.from(element.children)) {
    const tag = child.tagName.toLowerCase();

    // Skip script/style/meta
    if (['script', 'style', 'meta', 'link', 'head'].includes(tag)) continue;

    // Image
    if (tag === 'img') {
      const imgNode = extractImageNode(child as HTMLImageElement, yTracker, canvasWidth, nextZ());
      if (imgNode) {
        nodes.push(imgNode);
        yTracker.current += imgNode.height + 12;
      }
      continue;
    }

    // SVG — treat as image with data URI
    if (tag === 'svg') {
      const svgNode = extractSvgNode(child as SVGElement, yTracker, canvasWidth, nextZ());
      if (svgNode) {
        nodes.push(svgNode);
        yTracker.current += svgNode.height + 12;
      }
      continue;
    }

    // Text-bearing elements
    if (isTextElement(tag)) {
      const textNode = extractTextNode(child, tag, yTracker, canvasWidth, nextZ());
      if (textNode) {
        nodes.push(textNode);
        yTracker.current += textNode.height + 8;
      }
      continue;
    }

    // Button
    if (tag === 'button' || tag === 'a') {
      const btnNode = extractButtonNode(child, yTracker, canvasWidth, nextZ);
      if (btnNode.length > 0) {
        nodes.push(...btnNode);
        const lastNode = btnNode[btnNode.length - 1];
        yTracker.current = lastNode.y + lastNode.height + 12;
      }
      continue;
    }

    // Container (div, section, etc.) — recurse
    if (child.children.length > 0) {
      // Check if container has a background
      const bgColor = extractBackground(child);
      if (bgColor && bgColor !== 'transparent') {
        const containerHeight = estimateContainerHeight(child, canvasWidth);
        const shapeNode: ShapeNode = {
          id: makeId('shape'),
          type: 'shape',
          x: 16,
          y: yTracker.current,
          width: canvasWidth - 32,
          height: containerHeight,
          rotation: 0,
          opacity: 1,
          zIndex: nextZ(),
          fill: bgColor,
          stroke: 'transparent',
          strokeWidth: 0,
          radius: extractBorderRadius(child),
        };
        nodes.push(shapeNode);
      }

      walkDom(child, nodes, yTracker, canvasWidth, nextZ);
      continue;
    }

    // Bare text content
    const text = child.textContent?.trim();
    if (text) {
      const node = createTextNode(text, 'p', yTracker, canvasWidth, nextZ());
      nodes.push(node);
      yTracker.current += node.height + 8;
    }
  }
}

// ─── Extractors ───────────────────────────────────────────────

function extractTextNode(
  el: Element,
  tag: string,
  yTracker: { current: number },
  canvasWidth: number,
  zIndex: number
): TextNode | null {
  const text = el.textContent?.trim();
  if (!text) return null;
  return createTextNode(text, tag, yTracker, canvasWidth, zIndex, el);
}

function createTextNode(
  text: string,
  tag: string,
  yTracker: { current: number },
  canvasWidth: number,
  zIndex: number,
  el?: Element
): TextNode {
  const style = el ? getComputedStyleSafe(el) : null;

  const fontSizeMap: Record<string, number> = {
    h1: 42, h2: 32, h3: 26, h4: 22, h5: 18, h6: 16,
    p: 16, span: 14, li: 15, label: 13,
  };
  const weightMap: Record<string, number> = {
    h1: 700, h2: 700, h3: 600, h4: 600, h5: 500, h6: 500,
  };

  const fontSize = parseFloat(style?.fontSize || '') || fontSizeMap[tag] || 16;
  const fontWeight = parseFloat(style?.fontWeight || '') || weightMap[tag] || 400;
  const fontFamily = resolveFontFamily(style?.fontFamily?.replace(/['"]/g, '').split(',')[0]?.trim() || 'Inter');
  const color = style?.color || '#000000';
  const textAlign = (style?.textAlign || 'left') as TextNode['align'];
  const lineHeight = parseFloat(style?.lineHeight || '') / fontSize || 1.4;

  // Estimate height from text length and font size
  const charsPerLine = Math.max(1, Math.floor((canvasWidth - 48) / (fontSize * 0.55)));
  const estimatedLines = Math.max(1, Math.ceil(text.length / charsPerLine));
  const height = Math.max(fontSize * 1.5, estimatedLines * fontSize * lineHeight);

  return {
    id: makeId('text'),
    type: 'text',
    x: 24,
    y: yTracker.current,
    width: canvasWidth - 48,
    height: Math.round(height),
    rotation: 0,
    opacity: 1,
    zIndex,
    text,
    fontSize: Math.round(fontSize),
    fontFamily,
    fontWeight: Math.round(fontWeight),
    lineHeight: Number.isFinite(lineHeight) ? Math.round(lineHeight * 100) / 100 : 1.4,
    letterSpacing: 0,
    color: normalizeColor(color),
    align: ['left', 'center', 'right', 'justify'].includes(textAlign) ? textAlign : 'left',
  };
}

function extractImageNode(
  img: HTMLImageElement,
  yTracker: { current: number },
  canvasWidth: number,
  zIndex: number
): ImageNode | null {
  const src = img.src || img.getAttribute('src');
  if (!src) return null;

  const w = img.width || canvasWidth - 48;
  const h = img.height || Math.round(w * 0.6);

  return {
    id: makeId('img'),
    type: 'image',
    x: 24,
    y: yTracker.current,
    width: Math.min(w, canvasWidth - 48),
    height: h,
    rotation: 0,
    opacity: 1,
    zIndex,
    src,
    objectFit: 'cover',
    borderRadius: 0,
  };
}

function extractSvgNode(
  svg: SVGElement,
  yTracker: { current: number },
  canvasWidth: number,
  zIndex: number
): ImageNode | null {
  try {
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const dataUri = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgStr)))}`;

    const viewBox = svg.getAttribute('viewBox');
    let w = parseFloat(svg.getAttribute('width') || '') || 100;
    let h = parseFloat(svg.getAttribute('height') || '') || 100;
    if (viewBox) {
      const parts = viewBox.split(/\s+/).map(Number);
      if (parts.length === 4) {
        w = parts[2] || w;
        h = parts[3] || h;
      }
    }

    const maxW = canvasWidth - 48;
    const scale = w > maxW ? maxW / w : 1;

    return {
      id: makeId('svg'),
      type: 'image',
      x: 24,
      y: yTracker.current,
      width: Math.round(w * scale),
      height: Math.round(h * scale),
      rotation: 0,
      opacity: 1,
      zIndex,
      src: dataUri,
      objectFit: 'contain',
      borderRadius: 0,
    };
  } catch {
    return null;
  }
}

function extractButtonNode(
  el: Element,
  yTracker: { current: number },
  canvasWidth: number,
  nextZ: () => number
): SceneNode[] {
  const text = el.textContent?.trim();
  if (!text) return [];

  const style = getComputedStyleSafe(el);
  const bgColor = style?.backgroundColor || '#333333';
  const textColor = style?.color || '#ffffff';
  const radius = extractBorderRadius(el);

  const btnWidth = Math.min(300, canvasWidth - 80);
  const btnHeight = 48;
  const x = Math.round((canvasWidth - btnWidth) / 2);

  const bgNode: ShapeNode = {
    id: makeId('btn_bg'),
    type: 'shape',
    x,
    y: yTracker.current,
    width: btnWidth,
    height: btnHeight,
    rotation: 0,
    opacity: 1,
    zIndex: nextZ(),
    fill: normalizeColor(bgColor),
    stroke: 'transparent',
    strokeWidth: 0,
    radius: radius || 8,
  };

  const labelNode: TextNode = {
    id: makeId('btn_txt'),
    type: 'text',
    x: x + 16,
    y: yTracker.current + 12,
    width: btnWidth - 32,
    height: 24,
    rotation: 0,
    opacity: 1,
    zIndex: nextZ(),
    text,
    fontSize: 16,
    fontFamily: 'Inter',
    fontWeight: 600,
    lineHeight: 1.2,
    letterSpacing: 0.5,
    color: normalizeColor(textColor),
    align: 'center',
  };

  return [bgNode, labelNode];
}

// ─── Helpers ──────────────────────────────────────────────────

function makeId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

function isTextElement(tag: string): boolean {
  return ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'li', 'label', 'strong', 'em', 'b', 'i'].includes(tag);
}

function extractBackground(el: Element): string | null {
  const style = getComputedStyleSafe(el);
  if (!style) return null;
  const bg = style.backgroundColor;
  if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return normalizeColor(bg);
  // Check inline style
  const inline = (el as HTMLElement).style?.backgroundColor;
  if (inline && inline !== 'transparent') return normalizeColor(inline);
  return null;
}

function extractBorderRadius(el: Element): number {
  const style = getComputedStyleSafe(el);
  if (!style) return 0;
  return parseFloat(style.borderRadius || '0') || 0;
}

function getComputedStyleSafe(el: Element): CSSStyleDeclaration | null {
  try {
    if (typeof window !== 'undefined' && el instanceof HTMLElement) {
      return window.getComputedStyle(el);
    }
  } catch { /* noop */ }
  // Fallback: try inline styles
  if ((el as HTMLElement).style) {
    return (el as HTMLElement).style as unknown as CSSStyleDeclaration;
  }
  return null;
}

function normalizeColor(color: string): string {
  if (!color) return '#000000';
  const trimmed = color.trim();
  if (trimmed.startsWith('#')) return trimmed;
  if (trimmed.startsWith('rgb')) return rgbToHex(trimmed);
  return trimmed;
}

function rgbToHex(rgb: string): string {
  const match = rgb.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!match) return '#000000';
  const [, r, g, b] = match.map(Number);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function estimateContainerHeight(el: Element, canvasWidth: number): number {
  let h = 0;
  for (const child of Array.from(el.children)) {
    const tag = child.tagName.toLowerCase();
    if (isTextElement(tag)) {
      const text = child.textContent?.trim() || '';
      const fontSize = 16;
      const lines = Math.max(1, Math.ceil(text.length / Math.max(1, (canvasWidth - 48) / (fontSize * 0.55))));
      h += lines * fontSize * 1.5 + 8;
    } else if (tag === 'img') {
      h += Math.round((canvasWidth - 48) * 0.6) + 12;
    } else {
      h += 40;
    }
  }
  return Math.max(40, h);
}
