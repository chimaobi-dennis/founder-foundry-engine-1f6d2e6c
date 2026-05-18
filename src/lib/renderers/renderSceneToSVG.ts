/**
 * renderSceneToSVG.ts
 *
 * Converts a SceneDocument to an SVG string.
 * Useful for vector export and print-ready output.
 *
 * STATUS: Scaffold only — full implementation pending.
 */

import type { SceneDocument, SceneNode } from '@/types/scene';

// ─── Options ──────────────────────────────────────────────────

export interface RenderToSVGOptions {
  /** Embed fonts as base64 data URIs. Default false. */
  embedFonts?: boolean;
  /** Embed images as base64 data URIs. Default false. */
  embedImages?: boolean;
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Render a SceneDocument to an SVG string.
 */
export async function renderSceneToSVG(
  scene: SceneDocument,
  options: RenderToSVGOptions = {}
): Promise<string> {
  const { embedFonts: _embedFonts = false, embedImages: _embedImages = false } = options;

  const sortedNodes = [...scene.nodes].sort((a, b) => a.zIndex - b.zIndex);

  const childrenSvg = sortedNodes
    .map((node) => renderNodeToSVG(node))
    .join('\n');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${scene.width}" height="${scene.height}" viewBox="0 0 ${scene.width} ${scene.height}">`,
    `  <rect width="100%" height="100%" fill="${scene.background || '#ffffff'}" />`,
    childrenSvg,
    `</svg>`,
  ].join('\n');
}

// ─── Internal (stubs) ─────────────────────────────────────────

function renderNodeToSVG(node: SceneNode): string {
  const transform = buildTransform(node);

  switch (node.type) {
    case 'text':
      // TODO: Implement rich text SVG rendering
      return `  <text ${transform} font-size="${node.fontSize}" font-family="${node.fontFamily}" fill="${node.color}" opacity="${node.opacity}">${escapeXml(node.text)}</text>`;

    case 'image':
      // TODO: Implement image embedding
      return `  <image ${transform} width="${node.width}" height="${node.height}" href="${escapeXml(node.src)}" opacity="${node.opacity}" />`;

    case 'shape':
      // TODO: Implement shape with border radius
      return `  <rect ${transform} width="${node.width}" height="${node.height}" fill="${node.fill}" stroke="${node.stroke}" stroke-width="${node.strokeWidth}" rx="${node.radius}" opacity="${node.opacity}" />`;

    case 'group':
      const children = node.children.map(renderNodeToSVG).join('\n');
      return `  <g ${transform} opacity="${node.opacity}">\n${children}\n  </g>`;
  }
}

function buildTransform(node: SceneNode): string {
  const parts: string[] = [];
  if (node.x !== 0 || node.y !== 0) parts.push(`translate(${node.x}, ${node.y})`);
  if (node.rotation !== 0) {
    const cx = node.width / 2;
    const cy = node.height / 2;
    parts.push(`rotate(${node.rotation}, ${cx}, ${cy})`);
  }
  return parts.length > 0 ? `transform="${parts.join(' ')}"` : '';
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
