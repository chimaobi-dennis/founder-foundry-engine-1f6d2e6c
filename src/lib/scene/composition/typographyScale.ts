/**
 * typographyScale.ts
 *
 * Platform-aware typography scaling system.
 * Computes font sizes, line heights, and hierarchy for a given canvas.
 */

// ─── Types ────────────────────────────────────────────────────

export interface TypographyTier {
  role: 'hero' | 'heading' | 'subheading' | 'body' | 'caption' | 'cta' | 'label';
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: number;
}

export interface TypographyScaleOptions {
  /** Canvas width in px. */
  canvasWidth: number;
  /** Canvas height in px. */
  canvasHeight: number;
  /** Base font size override. Auto-calculated if not provided. */
  baseFontSize?: number;
  /** Scale ratio (golden = 1.618, major third = 1.25). Default 1.25. */
  scaleRatio?: number;
  /** Minimum readable font size. Default 10. */
  minimumSize?: number;
}

// ─── Scale Generator ──────────────────────────────────────────

/**
 * Generate a full typography scale for a canvas.
 * Sizes are calibrated so text is readable at the platform's natural viewing size.
 */
export function generateTypographyScale(options: TypographyScaleOptions): TypographyTier[] {
  const {
    canvasWidth,
    canvasHeight,
    scaleRatio = 1.25,
    minimumSize = 10,
  } = options;

  // Auto-calculate base size from canvas dimensions
  // Heuristic: ~2.5% of the smaller dimension, clamped
  const baseFontSize = options.baseFontSize ?? Math.max(
    minimumSize,
    Math.min(24, Math.round(Math.min(canvasWidth, canvasHeight) * 0.025))
  );

  const scale = (steps: number) => Math.max(minimumSize, Math.round(baseFontSize * Math.pow(scaleRatio, steps)));

  return [
    { role: 'hero', fontSize: scale(4), fontWeight: 700, lineHeight: 1.1, letterSpacing: -1 },
    { role: 'heading', fontSize: scale(3), fontWeight: 700, lineHeight: 1.2, letterSpacing: -0.5 },
    { role: 'subheading', fontSize: scale(2), fontWeight: 600, lineHeight: 1.3, letterSpacing: 0 },
    { role: 'body', fontSize: scale(1), fontWeight: 400, lineHeight: 1.5, letterSpacing: 0 },
    { role: 'caption', fontSize: scale(0), fontWeight: 400, lineHeight: 1.4, letterSpacing: 0.2 },
    { role: 'cta', fontSize: scale(1), fontWeight: 700, lineHeight: 1.2, letterSpacing: 0.5 },
    { role: 'label', fontSize: scale(-1), fontWeight: 500, lineHeight: 1.3, letterSpacing: 0.5 },
  ];
}

/**
 * Get a specific tier from the scale.
 */
export function getTier(
  tiers: TypographyTier[],
  role: TypographyTier['role']
): TypographyTier | undefined {
  return tiers.find((t) => t.role === role);
}

/**
 * Compute recommended maximum characters per line for a given width and font size.
 * Based on the typographic ideal of 45–75 characters per line.
 */
export function recommendedMaxChars(width: number, fontSize: number): number {
  // Approximate character width ≈ fontSize * 0.55
  const charWidth = fontSize * 0.55;
  return Math.min(75, Math.max(20, Math.floor(width / charWidth)));
}

/**
 * Check if a font size is readable at a given canvas size.
 * Returns true if the font size is at least minimumSize.
 */
export function isReadable(fontSize: number, minimumSize = 10): boolean {
  return fontSize >= minimumSize;
}
