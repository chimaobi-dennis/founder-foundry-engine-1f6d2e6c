/**
 * renderSceneToCanvas.ts
 *
 * Deterministic Canvas2D renderer for SceneDocument.
 * This is the SINGLE SOURCE OF TRUTH for scene rendering — both
 * the editor preview and all exports (PNG/JPEG/PDF) use this pipeline.
 *
 * No DOM measurement, no html2canvas, no browser-dependent layout.
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
import { loadSceneFonts, waitForFontsReady, resolveFontFamily, resolveFontWeight } from '@/lib/fonts/fontRegistry';

// ─── Options ──────────────────────────────────────────────────

export interface RenderToCanvasOptions {
  /** Device pixel ratio for high-DPI output. Default 2. */
  pixelRatio?: number;
  /** Override the background colour (otherwise uses document.background). */
  background?: string;
  /** Skip font preloading (e.g. when fonts are already loaded). */
  skipFontLoad?: boolean;
}

// ─── Image Cache ──────────────────────────────────────────────

const imageCache = new Map<string, HTMLImageElement>();

function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached && cached.complete && cached.naturalWidth > 0) {
    return Promise.resolve(cached);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

/** Clear the image cache (useful for testing / memory management). */
export function clearImageCache(): void {
  imageCache.clear();
}

// ─── Background Rendering ─────────────────────────────────────

function renderBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  background: string
): void {
  // Gradient support: linear-gradient(deg, #color1, #color2)
  const gradientMatch = background.match(
    /^linear-gradient\(\s*([\d.]+)deg\s*,\s*(.+)\s*\)$/i
  );
  if (gradientMatch) {
    const angle = parseFloat(gradientMatch[1]) || 0;
    const stops = gradientMatch[2].split(',').map((s) => s.trim());
    const rad = (angle * Math.PI) / 180;
    const cx = width / 2;
    const cy = height / 2;
    const len = Math.max(width, height);
    const x0 = cx - Math.cos(rad) * len;
    const y0 = cy - Math.sin(rad) * len;
    const x1 = cx + Math.cos(rad) * len;
    const y1 = cy + Math.sin(rad) * len;
    const grad = ctx.createLinearGradient(x0, y0, x1, y1);
    stops.forEach((stop, i) => {
      grad.addColorStop(i / Math.max(1, stops.length - 1), stop);
    });
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = background || '#ffffff';
  }
  ctx.fillRect(0, 0, width, height);
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Render a SceneDocument to an HTMLCanvasElement.
 * Deterministic — no DOM measurement, shared by editor + export.
 */
export async function renderSceneToCanvas(
  scene: SceneDocument,
  options: RenderToCanvasOptions = {}
): Promise<HTMLCanvasElement> {
  const { pixelRatio = 2, background, skipFontLoad = false } = options;

  // Preload fonts
  if (!skipFontLoad) {
    await loadSceneFonts(scene);
    await waitForFontsReady();
  }

  // Preload all images in parallel
  await preloadSceneImages(scene.nodes);

  const canvas = document.createElement('canvas');
  canvas.width = scene.width * pixelRatio;
  canvas.height = scene.height * pixelRatio;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2d context');

  ctx.scale(pixelRatio, pixelRatio);

  // Background
  renderBackground(ctx, scene.width, scene.height, background || scene.background || '#ffffff');

  // Render nodes sorted by zIndex
  const sortedNodes = [...scene.nodes].sort((a, b) => a.zIndex - b.zIndex);
  for (const node of sortedNodes) {
    await safeRenderNode(ctx, node);
  }

  return canvas;
}

// ─── Image Preloading ─────────────────────────────────────────

async function preloadSceneImages(nodes: SceneNode[]): Promise<void> {
  const srcs: string[] = [];
  function collect(list: SceneNode[]) {
    for (const n of list) {
      if (n.type === 'image' && n.src) srcs.push(n.src);
      if (n.type === 'group') collect(n.children);
    }
  }
  collect(nodes);
  await Promise.allSettled(srcs.map(loadImage));
}

// ─── Safe Wrapper ─────────────────────────────────────────────

/**
 * Render a single node. If it fails, log a warning and continue.
 * The renderer must NEVER blank entire exports due to one bad node.
 */
async function safeRenderNode(ctx: CanvasRenderingContext2D, node: SceneNode): Promise<void> {
  try {
    await renderNode(ctx, node);
  } catch (err) {
    console.warn(`[renderSceneToCanvas] Failed to render node ${node.id} (${node.type}):`, err);
  }
}

// ─── Node Dispatcher ──────────────────────────────────────────

async function renderNode(ctx: CanvasRenderingContext2D, node: SceneNode): Promise<void> {
  ctx.save();
  applyTransforms(ctx, node);

  switch (node.type) {
    case 'text':
      renderTextNode(ctx, node);
      break;
    case 'image':
      await renderImageNode(ctx, node);
      break;
    case 'shape':
      renderShapeNode(ctx, node);
      break;
    case 'group':
      await renderGroupNode(ctx, node);
      break;
    case 'frame':
      await renderFrameNode(ctx, node);
      break;
    case 'stack':
      await renderStackNode(ctx, node);
      break;
    case 'svg':
      await renderSvgNode(ctx, node);
      break;
    case 'icon':
      renderIconNode(ctx, node);
      break;
    case 'button':
      renderButtonNode(ctx, node);
      break;
  }

  ctx.restore();
}

// ─── Common Transforms ───────────────────────────────────────

function applyTransforms(ctx: CanvasRenderingContext2D, node: SceneNode): void {
  ctx.translate(node.x + node.width / 2, node.y + node.height / 2);
  if (node.rotation !== 0) {
    ctx.rotate((node.rotation * Math.PI) / 180);
  }
  ctx.globalAlpha *= node.opacity;
  ctx.translate(-node.width / 2, -node.height / 2);
}

// ─── Text Rendering ──────────────────────────────────────────

function renderTextNode(ctx: CanvasRenderingContext2D, node: TextNode): void {
  if (!node.text) return;

  const family = resolveFontFamily(node.fontFamily);
  const weight = resolveFontWeight(family, node.fontWeight);
  const fontSize = Math.max(1, node.fontSize);
  const lineHeight = Math.max(0.5, node.lineHeight);
  const lineHeightPx = fontSize * lineHeight;
  const letterSpacing = node.letterSpacing || 0;

  ctx.font = `${weight} ${fontSize}px "${family}"`;
  ctx.fillStyle = node.color || '#000000';
  ctx.textBaseline = 'top';

  // Text alignment
  let textAlign: CanvasTextAlign = 'left';
  let xOffset = 0;
  if (node.align === 'center') {
    textAlign = 'center';
    xOffset = node.width / 2;
  } else if (node.align === 'right') {
    textAlign = 'right';
    xOffset = node.width;
  }
  ctx.textAlign = textAlign;

  // Word-wrap text to fit within node.width
  const lines = wrapText(ctx, node.text, node.width, letterSpacing);

  // Render each line
  for (let i = 0; i < lines.length; i++) {
    const y = i * lineHeightPx;
    if (y > node.height) break; // Don't render past the node box

    if (letterSpacing !== 0) {
      drawTextWithSpacing(ctx, lines[i], xOffset, y, letterSpacing);
    } else {
      ctx.fillText(lines[i], xOffset, y);
    }
  }
}

/** Word-wrap text to fit within maxWidth. */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  letterSpacing: number
): string[] {
  const paragraphs = text.split('\n');
  const result: string[] = [];

  for (const paragraph of paragraphs) {
    if (paragraph === '') {
      result.push('');
      continue;
    }

    const words = paragraph.split(/\s+/);
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = measureTextWidth(ctx, testLine, letterSpacing);

      if (testWidth > maxWidth && currentLine) {
        result.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) result.push(currentLine);
  }

  return result.length > 0 ? result : [''];
}

/** Measure text width accounting for letter spacing. */
function measureTextWidth(ctx: CanvasRenderingContext2D, text: string, letterSpacing: number): number {
  if (letterSpacing === 0) return ctx.measureText(text).width;
  return ctx.measureText(text).width + letterSpacing * (text.length - 1);
}

/** Draw text with manual letter spacing. */
function drawTextWithSpacing(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number
): void {
  const savedAlign = ctx.textAlign;
  ctx.textAlign = 'left';

  // Compute starting x for centered/right text
  let startX = x;
  if (savedAlign === 'center') {
    const totalWidth = measureTextWidth(ctx, text, spacing);
    startX = x - totalWidth / 2;
  } else if (savedAlign === 'right') {
    const totalWidth = measureTextWidth(ctx, text, spacing);
    startX = x - totalWidth;
  }

  let curX = startX;
  for (const char of text) {
    ctx.fillText(char, curX, y);
    curX += ctx.measureText(char).width + spacing;
  }

  ctx.textAlign = savedAlign;
}

// ─── Image Rendering ─────────────────────────────────────────

async function renderImageNode(ctx: CanvasRenderingContext2D, node: ImageNode): Promise<void> {
  if (!node.src) return;

  let img: HTMLImageElement;
  try {
    img = await loadImage(node.src);
  } catch {
    // Draw a placeholder rectangle if image fails to load
    ctx.fillStyle = '#eeeeee';
    roundRect(ctx, 0, 0, node.width, node.height, node.borderRadius);
    ctx.fill();
    return;
  }

  // Clip to border radius
  if (node.borderRadius > 0) {
    ctx.beginPath();
    roundRect(ctx, 0, 0, node.width, node.height, node.borderRadius);
    ctx.clip();
  }

  const imgW = img.naturalWidth;
  const imgH = img.naturalHeight;

  switch (node.objectFit) {
    case 'fill':
      ctx.drawImage(img, 0, 0, node.width, node.height);
      break;
    case 'contain': {
      const scale = Math.min(node.width / imgW, node.height / imgH);
      const w = imgW * scale;
      const h = imgH * scale;
      ctx.drawImage(img, (node.width - w) / 2, (node.height - h) / 2, w, h);
      break;
    }
    case 'none':
      ctx.drawImage(img, (node.width - imgW) / 2, (node.height - imgH) / 2);
      break;
    case 'cover':
    default: {
      const scaleC = Math.max(node.width / imgW, node.height / imgH);
      const wC = imgW * scaleC;
      const hC = imgH * scaleC;
      ctx.drawImage(img, (node.width - wC) / 2, (node.height - hC) / 2, wC, hC);
      break;
    }
  }
}

// ─── Shape Rendering ──────────────────────────────────────────

function renderShapeNode(ctx: CanvasRenderingContext2D, node: ShapeNode): void {
  ctx.beginPath();
  roundRect(ctx, 0, 0, node.width, node.height, node.radius);

  // Fill — support gradients
  if (node.fill && node.fill !== 'transparent') {
    const gradient = parseGradient(ctx, node.fill, node.width, node.height);
    ctx.fillStyle = gradient || node.fill;
    ctx.fill();
  }

  // Stroke
  if (node.stroke && node.stroke !== 'transparent' && node.strokeWidth > 0) {
    ctx.strokeStyle = node.stroke;
    ctx.lineWidth = node.strokeWidth;
    ctx.stroke();
  }
}

// ─── Group Rendering ──────────────────────────────────────────

async function renderGroupNode(ctx: CanvasRenderingContext2D, node: GroupNode): Promise<void> {
  const sortedChildren = [...node.children].sort((a, b) => a.zIndex - b.zIndex);
  for (const child of sortedChildren) {
    await safeRenderNode(ctx, child);
  }
}

// ─── Frame Rendering ───────────────────────────────────────

async function renderFrameNode(ctx: CanvasRenderingContext2D, node: FrameNode): Promise<void> {
  // Draw frame background
  ctx.beginPath();
  roundRect(ctx, 0, 0, node.width, node.height, node.radius);
  if (node.fill && node.fill !== 'transparent') {
    const gradient = parseGradient(ctx, node.fill, node.width, node.height);
    ctx.fillStyle = gradient || node.fill;
    ctx.fill();
  }
  if (node.stroke && node.stroke !== 'transparent' && node.strokeWidth > 0) {
    ctx.strokeStyle = node.stroke;
    ctx.lineWidth = node.strokeWidth;
    ctx.stroke();
  }

  // Clip children if needed
  if (node.clipContent) {
    ctx.save();
    ctx.beginPath();
    roundRect(ctx, 0, 0, node.width, node.height, node.radius);
    ctx.clip();
  }

  const sorted = [...node.children].sort((a, b) => a.zIndex - b.zIndex);
  for (const child of sorted) {
    await safeRenderNode(ctx, child);
  }

  if (node.clipContent) {
    ctx.restore();
  }
}

// ─── Stack Rendering ───────────────────────────────────────

async function renderStackNode(ctx: CanvasRenderingContext2D, node: StackNode): Promise<void> {
  const isH = node.direction === 'horizontal';
  const pad = node.padding || 0;
  let cursor = pad;

  const sorted = [...node.children].sort((a, b) => a.zIndex - b.zIndex);

  for (const child of sorted) {
    ctx.save();
    if (isH) {
      ctx.translate(cursor, pad);
    } else {
      ctx.translate(pad, cursor);
    }
    await safeRenderNode(ctx, child);
    ctx.restore();

    cursor += (isH ? child.width : child.height) + (node.gap || 0);
  }
}

// ─── SVG Node Rendering ─────────────────────────────────────

async function renderSvgNode(ctx: CanvasRenderingContext2D, node: SvgNode): Promise<void> {
  if (!node.svgContent) return;

  let dataUri: string;
  if (node.svgContent.startsWith('data:')) {
    dataUri = node.svgContent;
  } else {
    dataUri = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(node.svgContent)))}`;
  }

  try {
    const img = await loadImage(dataUri);
    ctx.drawImage(img, 0, 0, node.width, node.height);
  } catch {
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, node.width, node.height);
  }
}

// ─── Icon Node Rendering ─────────────────────────────────────

function renderIconNode(ctx: CanvasRenderingContext2D, node: IconNode): void {
  // Render placeholder — actual icon SVG resolution will be handled by sceneAssetResolver
  const size = Math.min(node.width, node.height);
  const cx = node.width / 2;
  const cy = node.height / 2;

  ctx.strokeStyle = node.color || '#000000';
  ctx.lineWidth = node.strokeWidth || 2;
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2 - 4, 0, Math.PI * 2);
  ctx.stroke();

  // Draw icon name as text fallback
  ctx.fillStyle = node.color || '#000000';
  ctx.font = `${Math.max(8, size * 0.2)}px "Inter"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(node.iconName || '?', cx, cy);
}

// ─── Button Node Rendering ───────────────────────────────────

function renderButtonNode(ctx: CanvasRenderingContext2D, node: ButtonNode): void {
  // Background
  ctx.beginPath();
  roundRect(ctx, 0, 0, node.width, node.height, node.radius);
  if (node.fill && node.fill !== 'transparent') {
    ctx.fillStyle = node.fill;
    ctx.fill();
  }
  if (node.stroke && node.stroke !== 'transparent' && node.strokeWidth > 0) {
    ctx.strokeStyle = node.stroke;
    ctx.lineWidth = node.strokeWidth;
    ctx.stroke();
  }

  // Label
  if (node.label) {
    const family = resolveFontFamily(node.fontFamily);
    const weight = resolveFontWeight(family, node.fontWeight);
    ctx.font = `${weight} ${node.fontSize}px "${family}"`;
    ctx.fillStyle = node.textColor || '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(node.label, node.width / 2, node.height / 2);
  }
}

// ─── Geometry Helpers ─────────────────────────────────────────

/** Draw a rounded rectangle path. Works on all modern browsers. */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  if (radius <= 0) {
    ctx.rect(x, y, w, h);
    return;
  }
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/** Try to parse a CSS gradient string into a CanvasGradient. */
function parseGradient(
  ctx: CanvasRenderingContext2D,
  value: string,
  width: number,
  height: number
): CanvasGradient | null {
  const match = value.match(
    /^linear-gradient\(\s*([\d.]+)deg\s*,\s*(.+)\s*\)$/i
  );
  if (!match) return null;

  const angle = parseFloat(match[1]) || 0;
  const stops = match[2].split(',').map((s) => s.trim());
  const rad = (angle * Math.PI) / 180;
  const cx = width / 2;
  const cy = height / 2;
  const len = Math.max(width, height);
  const grad = ctx.createLinearGradient(
    cx - Math.cos(rad) * len,
    cy - Math.sin(rad) * len,
    cx + Math.cos(rad) * len,
    cy + Math.sin(rad) * len
  );
  stops.forEach((stop, i) => {
    grad.addColorStop(i / Math.max(1, stops.length - 1), stop);
  });
  return grad;
}
