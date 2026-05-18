/**
 * smartComponents.ts
 *
 * Semantic scene composition primitives.
 * These are NOT React components — they are scene node factories
 * that produce structured SceneNode trees.
 *
 * The AI should generate these directly.
 */

import type { SceneNode, TextNode, ShapeNode, ImageNode, ButtonNode, FrameNode } from '@/types/scene';

// ─── ID Generator ─────────────────────────────────────────────

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;
}

// ─── Component Options ───────────────────────────────────────

export interface HeroSectionOptions {
  x: number; y: number; width: number; height: number;
  imageSrc: string;
  headline: string;
  subheadline?: string;
  headlineColor?: string;
  overlayColor?: string;
  overlayOpacity?: number;
}

export interface CTASectionOptions {
  x: number; y: number; width: number; height: number;
  label: string;
  fill?: string;
  textColor?: string;
  radius?: number;
  supportingText?: string;
}

export interface MetricsRowOptions {
  x: number; y: number; width: number;
  metrics: Array<{ value: string; label: string }>;
  color?: string;
  accentColor?: string;
}

export interface QuoteBlockOptions {
  x: number; y: number; width: number;
  quote: string;
  attribution?: string;
  accentColor?: string;
}

export interface TestimonialCardOptions {
  x: number; y: number; width: number; height: number;
  quote: string;
  authorName: string;
  authorTitle?: string;
  avatarSrc?: string;
  bgColor?: string;
}

export interface FeatureGridOptions {
  x: number; y: number; width: number;
  features: Array<{ title: string; description: string }>;
  columns?: number;
  accentColor?: string;
}

export interface SplitPanelOptions {
  x: number; y: number; width: number; height: number;
  leftContent: SceneNode[];
  rightContent: SceneNode[];
  splitRatio?: number;
  gap?: number;
}

export interface EditorialHeaderOptions {
  x: number; y: number; width: number;
  kicker?: string;
  headline: string;
  subheadline?: string;
  headlineFont?: string;
  accentColor?: string;
}

// ─── Component Factories ─────────────────────────────────────

/** Full-bleed hero section with image, overlay, and headline. */
export function createHeroSection(opts: HeroSectionOptions): FrameNode {
  const children: SceneNode[] = [];
  let z = 0;

  // Background image
  children.push({
    id: uid('hero_img'), type: 'image',
    x: 0, y: 0, width: opts.width, height: opts.height,
    rotation: 0, opacity: 1, zIndex: z++,
    src: opts.imageSrc, objectFit: 'cover', borderRadius: 0,
  } as ImageNode);

  // Dark overlay
  if (opts.overlayColor) {
    children.push({
      id: uid('hero_overlay'), type: 'shape',
      x: 0, y: 0, width: opts.width, height: opts.height,
      rotation: 0, opacity: opts.overlayOpacity ?? 0.4, zIndex: z++,
      fill: opts.overlayColor, stroke: 'transparent', strokeWidth: 0, radius: 0,
    } as ShapeNode);
  }

  // Headline
  children.push({
    id: uid('hero_headline'), type: 'text',
    x: 40, y: Math.round(opts.height * 0.55), width: opts.width - 80, height: Math.round(opts.height * 0.25),
    rotation: 0, opacity: 1, zIndex: z++,
    text: opts.headline, fontSize: Math.round(opts.width * 0.06),
    fontFamily: 'DM Sans', fontWeight: 700, lineHeight: 1.15, letterSpacing: -0.5,
    color: opts.headlineColor || '#ffffff', align: 'left',
  } as TextNode);

  // Subheadline
  if (opts.subheadline) {
    children.push({
      id: uid('hero_sub'), type: 'text',
      x: 40, y: Math.round(opts.height * 0.8), width: opts.width - 80, height: Math.round(opts.height * 0.1),
      rotation: 0, opacity: 0.85, zIndex: z++,
      text: opts.subheadline, fontSize: Math.round(opts.width * 0.025),
      fontFamily: 'Inter', fontWeight: 400, lineHeight: 1.5, letterSpacing: 0,
      color: opts.headlineColor || '#ffffff', align: 'left',
    } as TextNode);
  }

  return {
    id: uid('hero_section'), type: 'frame',
    x: opts.x, y: opts.y, width: opts.width, height: opts.height,
    rotation: 0, opacity: 1, zIndex: 0,
    children, fill: 'transparent', stroke: 'transparent', strokeWidth: 0, radius: 0, clipContent: true,
  };
}

/** CTA section with button and optional supporting text. */
export function createCTASection(opts: CTASectionOptions): SceneNode[] {
  const nodes: SceneNode[] = [];
  let z = 0;

  if (opts.supportingText) {
    nodes.push({
      id: uid('cta_support'), type: 'text',
      x: opts.x, y: opts.y, width: opts.width, height: 24,
      rotation: 0, opacity: 0.7, zIndex: z++,
      text: opts.supportingText, fontSize: 14,
      fontFamily: 'Inter', fontWeight: 400, lineHeight: 1.4, letterSpacing: 0,
      color: '#666666', align: 'center',
    } as TextNode);
  }

  const btnY = opts.supportingText ? opts.y + 32 : opts.y;
  const btnW = Math.min(opts.width, 300);

  nodes.push({
    id: uid('cta_btn'), type: 'button',
    x: opts.x + Math.round((opts.width - btnW) / 2), y: btnY,
    width: btnW, height: opts.height,
    rotation: 0, opacity: 1, zIndex: z++,
    label: opts.label, fontSize: 16, fontFamily: 'Inter', fontWeight: 600,
    textColor: opts.textColor || '#ffffff',
    fill: opts.fill || '#333333', stroke: 'transparent', strokeWidth: 0,
    radius: opts.radius ?? 8,
  } as ButtonNode);

  return nodes;
}

/** Metrics row — key numbers displayed horizontally. */
export function createMetricsRow(opts: MetricsRowOptions): FrameNode {
  const count = opts.metrics.length;
  const cellW = Math.round(opts.width / count);
  const children: SceneNode[] = [];

  opts.metrics.forEach((metric, i) => {
    children.push({
      id: uid('metric_val'), type: 'text',
      x: i * cellW, y: 0, width: cellW, height: 40,
      rotation: 0, opacity: 1, zIndex: i * 2,
      text: metric.value, fontSize: 32, fontFamily: 'DM Sans', fontWeight: 700,
      lineHeight: 1.2, letterSpacing: -0.5, color: opts.accentColor || '#1a1a2e', align: 'center',
    } as TextNode);

    children.push({
      id: uid('metric_lbl'), type: 'text',
      x: i * cellW, y: 44, width: cellW, height: 20,
      rotation: 0, opacity: 0.6, zIndex: i * 2 + 1,
      text: metric.label, fontSize: 13, fontFamily: 'Inter', fontWeight: 400,
      lineHeight: 1.3, letterSpacing: 0.5, color: opts.color || '#666666', align: 'center',
    } as TextNode);
  });

  return {
    id: uid('metrics_row'), type: 'frame',
    x: opts.x, y: opts.y, width: opts.width, height: 70,
    rotation: 0, opacity: 1, zIndex: 0,
    children, fill: 'transparent', stroke: 'transparent', strokeWidth: 0, radius: 0, clipContent: false,
  };
}

/** Quote block with attribution. */
export function createQuoteBlock(opts: QuoteBlockOptions): SceneNode[] {
  const nodes: SceneNode[] = [];

  // Accent bar
  nodes.push({
    id: uid('quote_bar'), type: 'shape',
    x: opts.x, y: opts.y, width: 4, height: 60,
    rotation: 0, opacity: 1, zIndex: 0,
    fill: opts.accentColor || '#667eea', stroke: 'transparent', strokeWidth: 0, radius: 2,
  } as ShapeNode);

  // Quote text
  nodes.push({
    id: uid('quote_txt'), type: 'text',
    x: opts.x + 20, y: opts.y, width: opts.width - 20, height: 60,
    rotation: 0, opacity: 1, zIndex: 1,
    text: `"${opts.quote}"`, fontSize: 18, fontFamily: 'Playfair Display', fontWeight: 400,
    lineHeight: 1.5, letterSpacing: 0, color: '#1a1a2e', align: 'left',
  } as TextNode);

  // Attribution
  if (opts.attribution) {
    nodes.push({
      id: uid('quote_attr'), type: 'text',
      x: opts.x + 20, y: opts.y + 68, width: opts.width - 20, height: 20,
      rotation: 0, opacity: 0.6, zIndex: 2,
      text: `— ${opts.attribution}`, fontSize: 13, fontFamily: 'Inter', fontWeight: 500,
      lineHeight: 1.3, letterSpacing: 0.3, color: '#666666', align: 'left',
    } as TextNode);
  }

  return nodes;
}

/** Testimonial card with quote, name, title, optional avatar. */
export function createTestimonialCard(opts: TestimonialCardOptions): FrameNode {
  const children: SceneNode[] = [];
  const pad = 24;
  let z = 0;

  // Card background
  children.push({
    id: uid('test_bg'), type: 'shape',
    x: 0, y: 0, width: opts.width, height: opts.height,
    rotation: 0, opacity: 1, zIndex: z++,
    fill: opts.bgColor || '#f8f9fa', stroke: '#e9ecef', strokeWidth: 1, radius: 16,
  } as ShapeNode);

  // Quote
  children.push({
    id: uid('test_quote'), type: 'text',
    x: pad, y: pad, width: opts.width - pad * 2, height: Math.round(opts.height * 0.5),
    rotation: 0, opacity: 1, zIndex: z++,
    text: `"${opts.quote}"`, fontSize: 16, fontFamily: 'Inter', fontWeight: 400,
    lineHeight: 1.6, letterSpacing: 0, color: '#333333', align: 'left',
  } as TextNode);

  // Author name
  children.push({
    id: uid('test_name'), type: 'text',
    x: pad, y: opts.height - pad - 40, width: opts.width - pad * 2, height: 22,
    rotation: 0, opacity: 1, zIndex: z++,
    text: opts.authorName, fontSize: 15, fontFamily: 'DM Sans', fontWeight: 600,
    lineHeight: 1.3, letterSpacing: 0, color: '#1a1a2e', align: 'left',
  } as TextNode);

  // Author title
  if (opts.authorTitle) {
    children.push({
      id: uid('test_title'), type: 'text',
      x: pad, y: opts.height - pad - 18, width: opts.width - pad * 2, height: 18,
      rotation: 0, opacity: 0.6, zIndex: z++,
      text: opts.authorTitle, fontSize: 13, fontFamily: 'Inter', fontWeight: 400,
      lineHeight: 1.3, letterSpacing: 0, color: '#666666', align: 'left',
    } as TextNode);
  }

  return {
    id: uid('testimonial'), type: 'frame',
    x: opts.x, y: opts.y, width: opts.width, height: opts.height,
    rotation: 0, opacity: 1, zIndex: 0,
    children, fill: 'transparent', stroke: 'transparent', strokeWidth: 0, radius: 0, clipContent: true,
  };
}

/** Feature grid — N features in M columns. */
export function createFeatureGrid(opts: FeatureGridOptions): FrameNode {
  const cols = opts.columns || 2;
  const gap = 16;
  const cellW = Math.round((opts.width - gap * (cols - 1)) / cols);
  const cellH = 80;
  const children: SceneNode[] = [];

  opts.features.forEach((feat, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * (cellW + gap);
    const y = row * (cellH + gap);

    children.push({
      id: uid('feat_title'), type: 'text',
      x, y, width: cellW, height: 24,
      rotation: 0, opacity: 1, zIndex: i * 2,
      text: feat.title, fontSize: 16, fontFamily: 'DM Sans', fontWeight: 600,
      lineHeight: 1.3, letterSpacing: 0, color: opts.accentColor || '#1a1a2e', align: 'left',
    } as TextNode);

    children.push({
      id: uid('feat_desc'), type: 'text',
      x, y: y + 28, width: cellW, height: cellH - 28,
      rotation: 0, opacity: 0.7, zIndex: i * 2 + 1,
      text: feat.description, fontSize: 13, fontFamily: 'Inter', fontWeight: 400,
      lineHeight: 1.5, letterSpacing: 0, color: '#555555', align: 'left',
    } as TextNode);
  });

  const totalRows = Math.ceil(opts.features.length / cols);
  const totalH = totalRows * cellH + (totalRows - 1) * gap;

  return {
    id: uid('feat_grid'), type: 'frame',
    x: opts.x, y: opts.y, width: opts.width, height: totalH,
    rotation: 0, opacity: 1, zIndex: 0,
    children, fill: 'transparent', stroke: 'transparent', strokeWidth: 0, radius: 0, clipContent: false,
  };
}

/** Split panel — left/right content areas. */
export function createSplitPanel(opts: SplitPanelOptions): FrameNode {
  const ratio = opts.splitRatio ?? 0.5;
  const gap = opts.gap ?? 16;
  const leftW = Math.round((opts.width - gap) * ratio);
  const rightW = opts.width - gap - leftW;

  const leftChildren = opts.leftContent.map((n, i) => ({ ...n, zIndex: i }));
  const rightChildren = opts.rightContent.map((n, i) => ({
    ...n,
    x: n.x + leftW + gap,
    zIndex: i,
  }));

  return {
    id: uid('split_panel'), type: 'frame',
    x: opts.x, y: opts.y, width: opts.width, height: opts.height,
    rotation: 0, opacity: 1, zIndex: 0,
    children: [...leftChildren, ...rightChildren],
    fill: 'transparent', stroke: 'transparent', strokeWidth: 0, radius: 0, clipContent: false,
  };
}

/** Editorial header — kicker + headline + subheadline stack. */
export function createEditorialHeader(opts: EditorialHeaderOptions): SceneNode[] {
  const nodes: SceneNode[] = [];
  let y = opts.y;
  let z = 0;

  if (opts.kicker) {
    nodes.push({
      id: uid('ed_kicker'), type: 'text',
      x: opts.x, y, width: opts.width, height: 18,
      rotation: 0, opacity: 0.7, zIndex: z++,
      text: opts.kicker.toUpperCase(), fontSize: 12, fontFamily: 'Inter', fontWeight: 600,
      lineHeight: 1.3, letterSpacing: 2, color: opts.accentColor || '#667eea', align: 'left',
    } as TextNode);
    y += 28;
  }

  nodes.push({
    id: uid('ed_headline'), type: 'text',
    x: opts.x, y, width: opts.width, height: 60,
    rotation: 0, opacity: 1, zIndex: z++,
    text: opts.headline, fontSize: 36, fontFamily: opts.headlineFont || 'DM Sans', fontWeight: 700,
    lineHeight: 1.15, letterSpacing: -0.5, color: '#1a1a2e', align: 'left',
  } as TextNode);
  y += 68;

  if (opts.subheadline) {
    nodes.push({
      id: uid('ed_sub'), type: 'text',
      x: opts.x, y, width: opts.width, height: 40,
      rotation: 0, opacity: 0.7, zIndex: z++,
      text: opts.subheadline, fontSize: 16, fontFamily: 'Inter', fontWeight: 400,
      lineHeight: 1.5, letterSpacing: 0, color: '#555555', align: 'left',
    } as TextNode);
  }

  return nodes;
}
