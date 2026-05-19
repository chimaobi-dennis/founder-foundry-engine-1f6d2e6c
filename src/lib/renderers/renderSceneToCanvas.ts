/**
 * renderSceneToCanvas.ts
 *
 * Deterministic Canvas2D renderer for SceneDocument.
 * Consumes RenderInstruction[] from the canonical sceneRenderPipeline.
 * Does NOT independently interpret scene geometry.
 *
 * No DOM measurement, no html2canvas, no browser-dependent layout.
 */

import type { SceneDocument, SceneNode } from '@/types/scene';
import { loadSceneFonts, waitForFontsReady } from '@/lib/fonts/fontRegistry';
import {
  compileScene,
  type RenderInstruction,
  type RenderTransform,
  type RenderRadius,
  type RenderFill,
  type RenderStroke,
  type RenderFont,
  type RenderText,
  type ShapeRenderInstruction,
  type TextRenderInstruction,
  type ImageRenderInstruction,
  type GroupRenderInstruction,
  type FrameRenderInstruction,
  type StackRenderInstruction,
  type SvgRenderInstruction,
  type IconRenderInstruction,
  type ButtonRenderInstruction,
} from './sceneRenderPipeline';

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
 * Uses the canonical sceneRenderPipeline for all geometry.
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

  // Compile scene through canonical pipeline
  const compiled = compileScene(scene, 'export');

  const canvas = document.createElement('canvas');
  canvas.width = compiled.width * pixelRatio;
  canvas.height = compiled.height * pixelRatio;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2d context');

  ctx.scale(pixelRatio, pixelRatio);

  // Background
  renderBackground(ctx, compiled.width, compiled.height, background || compiled.background);

  // Render compiled instructions
  for (const instr of compiled.instructions) {
    await safeRenderInstruction(ctx, instr);
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

async function safeRenderInstruction(ctx: CanvasRenderingContext2D, instr: RenderInstruction): Promise<void> {
  try {
    await renderInstruction(ctx, instr);
  } catch (err) {
    console.warn(`[renderSceneToCanvas] Failed to render ${instr.id} (${instr.type}):`, err);
  }
}

// ─── Instruction Dispatcher ──────────────────────────────────

async function renderInstruction(ctx: CanvasRenderingContext2D, instr: RenderInstruction): Promise<void> {
  ctx.save();
  applyTransform(ctx, instr.transform);

  switch (instr.type) {
    case 'text':
      renderTextInstr(ctx, instr);
      break;
    case 'image':
      await renderImageInstr(ctx, instr);
      break;
    case 'shape':
      renderShapeInstr(ctx, instr);
      break;
    case 'group':
      await renderGroupInstr(ctx, instr);
      break;
    case 'frame':
      await renderFrameInstr(ctx, instr);
      break;
    case 'stack':
      await renderStackInstr(ctx, instr);
      break;
    case 'svg':
      await renderSvgInstr(ctx, instr);
      break;
    case 'icon':
      renderIconInstr(ctx, instr);
      break;
    case 'button':
      renderButtonInstr(ctx, instr);
      break;
  }

  ctx.restore();
}

// ─── Transform Application ──────────────────────────────────

function applyTransform(ctx: CanvasRenderingContext2D, t: RenderTransform): void {
  ctx.translate(t.x + t.width / 2, t.y + t.height / 2);
  if (t.rotation !== 0) {
    ctx.rotate((t.rotation * Math.PI) / 180);
  }
  ctx.globalAlpha *= t.opacity;
  ctx.translate(-t.width / 2, -t.height / 2);
}

// ─── Text Rendering ──────────────────────────────────────────

function renderTextInstr(ctx: CanvasRenderingContext2D, instr: TextRenderInstruction): void {
  const { text } = instr;
  if (!text.content) return;

  const { font } = text;
  const lineHeightPx = font.size * font.lineHeight;

  ctx.font = font.cssFont;
  ctx.fillStyle = text.color;
  ctx.textBaseline = 'top';

  let textAlign: CanvasTextAlign = 'left';
  let xOffset = 0;
  if (text.align === 'center') {
    textAlign = 'center';
    xOffset = instr.transform.width / 2;
  } else if (text.align === 'right') {
    textAlign = 'right';
    xOffset = instr.transform.width;
  }
  ctx.textAlign = textAlign;

  const lines = wrapText(ctx, text.content, instr.transform.width, font.letterSpacing);

  for (let i = 0; i < lines.length; i++) {
    const y = i * lineHeightPx;
    if (y > instr.transform.height) break;

    if (font.letterSpacing !== 0) {
      drawTextWithSpacing(ctx, lines[i], xOffset, y, font.letterSpacing);
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

async function renderImageInstr(ctx: CanvasRenderingContext2D, instr: ImageRenderInstruction): Promise<void> {
  if (!instr.src) return;
  const { width, height } = instr.transform;
  const r = instr.radius.radius;

  let img: HTMLImageElement;
  try {
    img = await loadImage(instr.src);
  } catch {
    ctx.fillStyle = '#eeeeee';
    ctx.beginPath();
    drawRoundedRectPath(ctx, 0, 0, width, height, r);
    ctx.fill();
    return;
  }

  if (r > 0) {
    ctx.beginPath();
    drawRoundedRectPath(ctx, 0, 0, width, height, r);
    ctx.clip();
  }

  const imgW = img.naturalWidth;
  const imgH = img.naturalHeight;

  switch (instr.objectFit) {
    case 'fill':
      ctx.drawImage(img, 0, 0, width, height);
      break;
    case 'contain': {
      const scale = Math.min(width / imgW, height / imgH);
      const w = imgW * scale;
      const h = imgH * scale;
      ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
      break;
    }
    case 'none':
      ctx.drawImage(img, (width - imgW) / 2, (height - imgH) / 2);
      break;
    case 'cover':
    default: {
      const scaleC = Math.max(width / imgW, height / imgH);
      const wC = imgW * scaleC;
      const hC = imgH * scaleC;
      ctx.drawImage(img, (width - wC) / 2, (height - hC) / 2, wC, hC);
      break;
    }
  }
}

// ─── Shape Rendering ──────────────────────────────────────────

function renderShapeInstr(ctx: CanvasRenderingContext2D, instr: ShapeRenderInstruction): void {
  const { width, height } = instr.transform;
  const r = instr.radius.radius;

  ctx.beginPath();
  drawRoundedRectPath(ctx, 0, 0, width, height, r);

  if (!instr.fill.isTransparent) {
    const gradient = parseGradient(ctx, instr.fill.fill, width, height);
    ctx.fillStyle = gradient || instr.fill.fill;
    ctx.fill();
  }

  if (instr.stroke.isVisible) {
    ctx.strokeStyle = instr.stroke.color;
    ctx.lineWidth = instr.stroke.width;
    ctx.stroke();
  }
}

// ─── Group Rendering ──────────────────────────────────────────

async function renderGroupInstr(ctx: CanvasRenderingContext2D, instr: GroupRenderInstruction): Promise<void> {
  for (const child of instr.children) {
    await safeRenderInstruction(ctx, child);
  }
}

// ─── Frame Rendering ───────────────────────────────────────

async function renderFrameInstr(ctx: CanvasRenderingContext2D, instr: FrameRenderInstruction): Promise<void> {
  const { width, height } = instr.transform;
  const r = instr.radius.radius;

  ctx.beginPath();
  drawRoundedRectPath(ctx, 0, 0, width, height, r);
  if (!instr.fill.isTransparent) {
    const gradient = parseGradient(ctx, instr.fill.fill, width, height);
    ctx.fillStyle = gradient || instr.fill.fill;
    ctx.fill();
  }
  if (instr.stroke.isVisible) {
    ctx.strokeStyle = instr.stroke.color;
    ctx.lineWidth = instr.stroke.width;
    ctx.stroke();
  }

  if (instr.clipContent) {
    ctx.save();
    ctx.beginPath();
    drawRoundedRectPath(ctx, 0, 0, width, height, r);
    ctx.clip();
  }

  for (const child of instr.children) {
    await safeRenderInstruction(ctx, child);
  }

  if (instr.clipContent) {
    ctx.restore();
  }
}

// ─── Stack Rendering ───────────────────────────────────────

async function renderStackInstr(ctx: CanvasRenderingContext2D, instr: StackRenderInstruction): Promise<void> {
  const isH = instr.direction === 'horizontal';
  const pad = instr.padding;
  let cursor = pad;

  for (const child of instr.children) {
    ctx.save();
    if (isH) {
      ctx.translate(cursor, pad);
    } else {
      ctx.translate(pad, cursor);
    }
    await safeRenderInstruction(ctx, child);
    ctx.restore();

    cursor += (isH ? child.transform.width : child.transform.height) + instr.gap;
  }
}

// ─── SVG Rendering ───────────────────────────────────────────

async function renderSvgInstr(ctx: CanvasRenderingContext2D, instr: SvgRenderInstruction): Promise<void> {
  if (!instr.svgContent) return;
  const { width, height } = instr.transform;

  let dataUri: string;
  if (instr.svgContent.startsWith('data:')) {
    dataUri = instr.svgContent;
  } else {
    dataUri = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(instr.svgContent)))}`;
  }

  try {
    const img = await loadImage(dataUri);
    ctx.drawImage(img, 0, 0, width, height);
  } catch {
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, width, height);
  }
}

// ─── Icon Rendering ──────────────────────────────────────────

function renderIconInstr(ctx: CanvasRenderingContext2D, instr: IconRenderInstruction): void {
  const { width, height } = instr.transform;
  const size = Math.min(width, height);
  const cx = width / 2;
  const cy = height / 2;

  ctx.strokeStyle = instr.color;
  ctx.lineWidth = instr.strokeWidth;
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2 - 4, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = instr.color;
  ctx.font = `${Math.max(8, size * 0.2)}px "Inter"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(instr.iconName, cx, cy);
}

// ─── Button Rendering ────────────────────────────────────────

function renderButtonInstr(ctx: CanvasRenderingContext2D, instr: ButtonRenderInstruction): void {
  const { width, height } = instr.transform;
  const r = instr.radius.radius;

  ctx.beginPath();
  drawRoundedRectPath(ctx, 0, 0, width, height, r);
  if (!instr.fill.isTransparent) {
    ctx.fillStyle = instr.fill.fill;
    ctx.fill();
  }
  if (instr.stroke.isVisible) {
    ctx.strokeStyle = instr.stroke.color;
    ctx.lineWidth = instr.stroke.width;
    ctx.stroke();
  }

  if (instr.label) {
    ctx.font = instr.font.cssFont;
    ctx.fillStyle = instr.textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(instr.label, width / 2, height / 2);
  }
}

// ─── Geometry Helpers (CANONICAL) ─────────────────────────────

/**
 * Draw a rounded rectangle path using arc() for CSS-parity.
 * Uses circular arcs (not quadraticCurveTo) to match CSS border-radius exactly.
 * The radius MUST be pre-clamped via clampRadius() from the pipeline.
 */
export function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  if (r <= 0) {
    ctx.rect(x, y, w, h);
    return;
  }
  // Use arc() instead of quadraticCurveTo() for exact CSS border-radius parity
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
  ctx.lineTo(x + w, y + h - r);
  ctx.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  ctx.lineTo(x + r, y + h);
  ctx.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
  ctx.lineTo(x, y + r);
  ctx.arc(x + r, y + r, r, Math.PI, (3 * Math.PI) / 2);
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
