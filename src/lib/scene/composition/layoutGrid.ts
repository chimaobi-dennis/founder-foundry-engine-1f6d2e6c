/**
 * layoutGrid.ts
 *
 * Generate editorial grid systems for scene composition.
 * Provides modular column/row layouts with consistent spacing.
 */

// ─── Types ────────────────────────────────────────────────────

export interface GridCell {
  x: number;
  y: number;
  width: number;
  height: number;
  column: number;
  row: number;
}

export interface GridOptions {
  /** Canvas width. */
  canvasWidth: number;
  /** Canvas height. */
  canvasHeight: number;
  /** Number of columns. Default 1. */
  columns?: number;
  /** Number of rows. Default 1. */
  rows?: number;
  /** Gutter between cells. Default 16. */
  gutter?: number;
  /** Padding around the entire grid. Default 24. */
  padding?: number;
}

export interface LayoutRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  role: 'hero' | 'body' | 'cta' | 'accent' | 'spacer';
}

// ─── Grid Generator ───────────────────────────────────────────

/**
 * Generate a modular grid of cells within a canvas.
 */
export function generateGrid(options: GridOptions): GridCell[] {
  const {
    canvasWidth,
    canvasHeight,
    columns = 1,
    rows = 1,
    gutter = 16,
    padding = 24,
  } = options;

  const availWidth = canvasWidth - padding * 2 - gutter * (columns - 1);
  const availHeight = canvasHeight - padding * 2 - gutter * (rows - 1);
  const cellWidth = Math.max(1, availWidth / columns);
  const cellHeight = Math.max(1, availHeight / rows);

  const cells: GridCell[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      cells.push({
        x: padding + c * (cellWidth + gutter),
        y: padding + r * (cellHeight + gutter),
        width: cellWidth,
        height: cellHeight,
        column: c,
        row: r,
      });
    }
  }

  return cells;
}

// ─── Editorial Layouts ────────────────────────────────────────

/**
 * Generate a hero-body-CTA editorial layout.
 * Common pattern for social ads and campaign creatives.
 */
export function editorialLayout(
  canvasWidth: number,
  canvasHeight: number,
  padding = 24
): LayoutRegion[] {
  const inner = {
    x: padding,
    y: padding,
    w: canvasWidth - padding * 2,
    h: canvasHeight - padding * 2,
  };

  // Proportions: hero 40%, body 35%, CTA 25%
  const heroH = Math.round(inner.h * 0.4);
  const bodyH = Math.round(inner.h * 0.35);
  const ctaH = inner.h - heroH - bodyH;

  return [
    { x: inner.x, y: inner.y, width: inner.w, height: heroH, role: 'hero' },
    { x: inner.x, y: inner.y + heroH, width: inner.w, height: bodyH, role: 'body' },
    { x: inner.x, y: inner.y + heroH + bodyH, width: inner.w, height: ctaH, role: 'cta' },
  ];
}

/**
 * Generate a split layout (image left, text right or vice versa).
 */
export function splitLayout(
  canvasWidth: number,
  canvasHeight: number,
  splitRatio = 0.5,
  padding = 24,
  gutter = 16
): { left: LayoutRegion; right: LayoutRegion } {
  const inner = {
    x: padding,
    y: padding,
    w: canvasWidth - padding * 2 - gutter,
    h: canvasHeight - padding * 2,
  };

  const leftW = Math.round(inner.w * splitRatio);
  const rightW = inner.w - leftW;

  return {
    left: { x: inner.x, y: inner.y, width: leftW, height: inner.h, role: 'hero' },
    right: { x: inner.x + leftW + gutter, y: inner.y, width: rightW, height: inner.h, role: 'body' },
  };
}

/**
 * Generate a centered card layout within a canvas.
 */
export function centeredCardLayout(
  canvasWidth: number,
  canvasHeight: number,
  cardWidthRatio = 0.85,
  cardHeightRatio = 0.8
): LayoutRegion {
  const w = Math.round(canvasWidth * cardWidthRatio);
  const h = Math.round(canvasHeight * cardHeightRatio);
  return {
    x: Math.round((canvasWidth - w) / 2),
    y: Math.round((canvasHeight - h) / 2),
    width: w,
    height: h,
    role: 'body',
  };
}
