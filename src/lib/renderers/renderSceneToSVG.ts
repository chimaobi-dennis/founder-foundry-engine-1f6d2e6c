/**
 * renderSceneToSVG.ts
 *
 * Converts a SceneDocument to an SVG string.
 * Deterministic — output must visually match renderSceneToCanvas.
 */

import type {
  SceneDocument,
  SceneNode,
  TextNode,
  ImageNode,
  ShapeNode,
  GroupNode,
} from '@/types/scene';
import { resolveFontFamily, resolveFontWeight } from '@/lib/fonts/fontRegistry';

// ─── Options ──────────────────────────────────────────────────

export interface RenderToSVGOptions {
  /** Embed images as base64 data URIs (requires fetch). Default false. */
  embedImages?: boolean;
}

// ─── State passed during render ───────────────────────────────

interface RenderCtx {
  defs: string[];
  defCounter: number;
  embedImages: boolean;
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Render a SceneDocument to a self-contained SVG string.
 */
export async function renderSceneToSVG(
  scene: SceneDocument,
  options: RenderToSVGOptions = {}
): Promise<string> {
  const ctx: RenderCtx = { defs: [], defCounter: 0, embedImages: options.embedImages ?? false };

  const sortedNodes = [...scene.nodes].sort((a, b) => a.zIndex - b.zIndex);

  const children: string[] = [];
  for (const node of sortedNodes) {
    children.push(await safeRenderNodeToSVG(ctx, node));
  }

  const bgElement = renderBackgroundSVG(ctx, scene.width, scene.height, scene.background || '#ffffff');

  const defsBlock = ctx.defs.length > 0 ? `  <defs>\n${ctx.defs.join('\n')}\n  </defs>\n` : '';

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${scene.width}" height="${scene.height}" viewBox="0 0 ${scene.width} ${scene.height}">`,
    defsBlock,
    bgElement,
    children.join('\n'),
    `</svg>`,
  ].join('\n');
}

// ─── Background ──────────────────────────────────────────────

function renderBackgroundSVG(ctx: RenderCtx, width: number, height: number, bg: string): string {
  const gradientMatch = bg.match(/^linear-gradient\(\s*([\d.]+)deg\s*,\s*(.+)\s*\)$/i);
  if (gradientMatch) {
    const id = `bg_grad_${ctx.defCounter++}`;
    const angle = parseFloat(gradientMatch[1]) || 0;
    const stops = gradientMatch[2].split(',').map((s) => s.trim());
    const rad = (angle * Math.PI) / 180;
    const x1 = 50 - Math.cos(rad) * 50;
    const y1 = 50 - Math.sin(rad) * 50;
    const x2 = 50 + Math.cos(rad) * 50;
    const y2 = 50 + Math.sin(rad) * 50;
    let def = `    <linearGradient id="${id}" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%">`;
    stops.forEach((stop, i) => {
      const offset = (i / Math.max(1, stops.length - 1)) * 100;
      def += `\n      <stop offset="${offset}%" stop-color="${esc(stop)}" />`;
    });
    def += `\n    </linearGradient>`;
    ctx.defs.push(def);
    return `  <rect width="${width}" height="${height}" fill="url(#${id})" />`;
  }
  return `  <rect width="${width}" height="${height}" fill="${esc(bg)}" />`;
}

// ─── Safe Wrapper ─────────────────────────────────────────────

async function safeRenderNodeToSVG(ctx: RenderCtx, node: SceneNode): Promise<string> {
  try {
    return await renderNodeToSVG(ctx, node);
  } catch (err) {
    console.warn(`[renderSceneToSVG] Failed to render node ${node.id} (${node.type}):`, err);
    return `<!-- failed node ${esc(node.id)} -->`;
  }
}

// ─── Node Dispatcher ──────────────────────────────────────────

async function renderNodeToSVG(ctx: RenderCtx, node: SceneNode): Promise<string> {
  const transform = buildTransform(node);
  const opacityAttr = node.opacity < 1 ? ` opacity="${node.opacity}"` : '';

  switch (node.type) {
    case 'text':
      return renderTextSVG(node, transform, opacityAttr);
    case 'image':
      return await renderImageSVG(ctx, node, transform, opacityAttr);
    case 'shape':
      return renderShapeSVG(ctx, node, transform, opacityAttr);
    case 'group':
      return await renderGroupSVG(ctx, node, transform, opacityAttr);
  }
}

// ─── Text ─────────────────────────────────────────────────────

function renderTextSVG(node: TextNode, transform: string, opacityAttr: string): string {
  const family = resolveFontFamily(node.fontFamily);
  const weight = resolveFontWeight(family, node.fontWeight);
  const fontSize = Math.max(1, node.fontSize);
  const lineHeightPx = fontSize * Math.max(0.5, node.lineHeight);

  let anchor = 'start';
  let xPos = 0;
  if (node.align === 'center') { anchor = 'middle'; xPos = node.width / 2; }
  else if (node.align === 'right') { anchor = 'end'; xPos = node.width; }

  // Simple line splitting (SVG has no native word-wrap)
  const lines = node.text.split('\n');

  const tspans = lines.map((line, i) =>
    `    <tspan x="${xPos}" dy="${i === 0 ? fontSize : lineHeightPx}">${esc(line)}</tspan>`
  ).join('\n');

  return [
    `  <g${transform}${opacityAttr}>`,
    `    <text font-family="${esc(family)}" font-weight="${weight}" font-size="${fontSize}" fill="${esc(node.color || '#000000')}" text-anchor="${anchor}"${node.letterSpacing ? ` letter-spacing="${node.letterSpacing}"` : ''}>`,
    tspans,
    `    </text>`,
    `  </g>`,
  ].join('\n');
}

// ─── Image ────────────────────────────────────────────────────

async function renderImageSVG(
  ctx: RenderCtx,
  node: ImageNode,
  transform: string,
  opacityAttr: string
): Promise<string> {
  if (!node.src) return `<!-- empty image node ${esc(node.id)} -->`;

  let href = esc(node.src);

  // Optionally embed as base64
  if (ctx.embedImages && !node.src.startsWith('data:')) {
    try {
      const resp = await fetch(node.src, { mode: 'cors' });
      const blob = await resp.blob();
      const dataUrl = await blobToDataUrl(blob);
      href = esc(dataUrl);
    } catch {
      // Fall back to external URL
    }
  }

  // Clip path for border radius
  let clipAttr = '';
  if (node.borderRadius > 0) {
    const clipId = `clip_${ctx.defCounter++}`;
    ctx.defs.push(
      `    <clipPath id="${clipId}">\n      <rect width="${node.width}" height="${node.height}" rx="${node.borderRadius}" />\n    </clipPath>`
    );
    clipAttr = ` clip-path="url(#${clipId})"`;
  }

  // For SVG we use preserveAspectRatio to approximate object-fit
  let par = 'xMidYMid meet'; // contain
  if (node.objectFit === 'cover') par = 'xMidYMid slice';
  else if (node.objectFit === 'fill') par = 'none';
  else if (node.objectFit === 'none') par = 'xMidYMid meet';

  return `  <g${transform}${opacityAttr}${clipAttr}>\n    <image width="${node.width}" height="${node.height}" href="${href}" preserveAspectRatio="${par}" />\n  </g>`;
}

// ─── Shape ────────────────────────────────────────────────────

function renderShapeSVG(
  ctx: RenderCtx,
  node: ShapeNode,
  transform: string,
  opacityAttr: string
): string {
  let fillAttr: string;
  const gradientMatch = node.fill.match(/^linear-gradient\(\s*([\d.]+)deg\s*,\s*(.+)\s*\)$/i);
  if (gradientMatch) {
    const id = `grad_${ctx.defCounter++}`;
    const angle = parseFloat(gradientMatch[1]) || 0;
    const stops = gradientMatch[2].split(',').map((s) => s.trim());
    const rad = (angle * Math.PI) / 180;
    const x1 = 50 - Math.cos(rad) * 50;
    const y1 = 50 - Math.sin(rad) * 50;
    const x2 = 50 + Math.cos(rad) * 50;
    const y2 = 50 + Math.sin(rad) * 50;
    let def = `    <linearGradient id="${id}" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%">`;
    stops.forEach((stop, i) => {
      const offset = (i / Math.max(1, stops.length - 1)) * 100;
      def += `\n      <stop offset="${offset}%" stop-color="${esc(stop)}" />`;
    });
    def += `\n    </linearGradient>`;
    ctx.defs.push(def);
    fillAttr = `url(#${id})`;
  } else {
    fillAttr = esc(node.fill);
  }

  const strokeAttr = node.stroke && node.stroke !== 'transparent' && node.strokeWidth > 0
    ? ` stroke="${esc(node.stroke)}" stroke-width="${node.strokeWidth}"`
    : ' stroke="none"';

  return `  <rect${transform} width="${node.width}" height="${node.height}" fill="${fillAttr}"${strokeAttr} rx="${node.radius}"${opacityAttr} />`;
}

// ─── Group ────────────────────────────────────────────────────

async function renderGroupSVG(
  ctx: RenderCtx,
  node: GroupNode,
  transform: string,
  opacityAttr: string
): Promise<string> {
  const sorted = [...node.children].sort((a, b) => a.zIndex - b.zIndex);
  const childSvg: string[] = [];
  for (const child of sorted) {
    childSvg.push(await safeRenderNodeToSVG(ctx, child));
  }
  return `  <g${transform}${opacityAttr}>\n${childSvg.join('\n')}\n  </g>`;
}

// ─── Helpers ──────────────────────────────────────────────────

function buildTransform(node: SceneNode): string {
  const parts: string[] = [];
  if (node.x !== 0 || node.y !== 0) {
    parts.push(`translate(${node.x}, ${node.y})`);
  }
  if (node.rotation !== 0) {
    const cx = node.width / 2;
    const cy = node.height / 2;
    parts.push(`rotate(${node.rotation}, ${cx}, ${cy})`);
  }
  return parts.length > 0 ? ` transform="${parts.join(' ')}"` : '';
}

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
