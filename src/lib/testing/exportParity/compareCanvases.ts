/**
 * compareCanvases.ts
 *
 * Pixel-level comparison between two rendered canvases.
 * Calculates mismatch %, missing pixels, color drift,
 * layout drift, and generates difference heatmaps.
 *
 * NO DOM screenshots. Canvas ImageData comparison only.
 */

// ─── Types ────────────────────────────────────────────────────

export interface CanvasComparisonResult {
  /** Are the canvases identical? */
  identical: boolean;
  /** Mismatch percentage (0–100). */
  mismatchPercent: number;
  /** Number of pixels that differ. */
  mismatchedPixels: number;
  /** Total number of pixels compared. */
  totalPixels: number;
  /** Number of pixels present in A but missing/transparent in B. */
  missingPixels: number;
  /** Average color drift per mismatched pixel (0–255 scale). */
  avgColorDrift: number;
  /** Max color drift encountered. */
  maxColorDrift: number;
  /** Bounding box of the mismatched region (null if identical). */
  mismatchRegion: { x: number; y: number; width: number; height: number } | null;
  /** Difference heatmap as a data URL (PNG). */
  heatmapDataUrl: string | null;
  /** Difference heatmap as ImageData (for further analysis). */
  heatmapImageData: ImageData | null;
}

export interface CompareOptions {
  /** Per-channel tolerance (0–255). Pixels within this tolerance are considered matching. Default 2. */
  tolerance?: number;
  /** Generate heatmap overlay. Default true. */
  generateHeatmap?: boolean;
  /** Heatmap highlight color for mismatches. Default [255, 0, 0] (red). */
  heatmapColor?: [number, number, number];
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Compare two ImageData objects pixel-by-pixel.
 * Both must have the same dimensions.
 */
export function compareCanvases(
  a: ImageData,
  b: ImageData,
  options: CompareOptions = {}
): CanvasComparisonResult {
  const {
    tolerance = 2,
    generateHeatmap = true,
    heatmapColor = [255, 0, 0],
  } = options;

  if (a.width !== b.width || a.height !== b.height) {
    return dimensionMismatchResult(a, b);
  }

  const width = a.width;
  const height = a.height;
  const totalPixels = width * height;
  const dataA = a.data;
  const dataB = b.data;

  let mismatchedPixels = 0;
  let missingPixels = 0;
  let totalDrift = 0;
  let maxDrift = 0;

  // Mismatch bounding box
  let minX = width, minY = height, maxX = -1, maxY = -1;

  // Heatmap data
  let heatmapData: Uint8ClampedArray | null = null;
  if (generateHeatmap) {
    heatmapData = new Uint8ClampedArray(totalPixels * 4);
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;

      const rA = dataA[i], gA = dataA[i + 1], bA = dataA[i + 2], aA = dataA[i + 3];
      const rB = dataB[i], gB = dataB[i + 1], bB = dataB[i + 2], aB = dataB[i + 3];

      const dr = Math.abs(rA - rB);
      const dg = Math.abs(gA - gB);
      const db = Math.abs(bA - bB);
      const da = Math.abs(aA - aB);

      const pixelDrift = Math.max(dr, dg, db, da);
      const isMismatch = pixelDrift > tolerance;

      if (isMismatch) {
        mismatchedPixels++;
        totalDrift += pixelDrift;
        maxDrift = Math.max(maxDrift, pixelDrift);

        // Check for "missing" — visible in A, transparent in B
        if (aA > 128 && aB < 32) {
          missingPixels++;
        }

        // Bounding box
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }

      // Heatmap pixel
      if (heatmapData) {
        if (isMismatch) {
          const intensity = Math.min(255, Math.round((pixelDrift / 255) * 255));
          heatmapData[i] = heatmapColor[0];
          heatmapData[i + 1] = heatmapColor[1];
          heatmapData[i + 2] = heatmapColor[2];
          heatmapData[i + 3] = Math.max(60, intensity);
        } else {
          // Semi-transparent white background for context
          heatmapData[i] = Math.round(rA * 0.3 + rB * 0.3);
          heatmapData[i + 1] = Math.round(gA * 0.3 + gB * 0.3);
          heatmapData[i + 2] = Math.round(bA * 0.3 + bB * 0.3);
          heatmapData[i + 3] = 80;
        }
      }
    }
  }

  const mismatchPercent = totalPixels > 0 ? (mismatchedPixels / totalPixels) * 100 : 0;
  const avgColorDrift = mismatchedPixels > 0 ? totalDrift / mismatchedPixels : 0;

  const mismatchRegion = maxX >= 0
    ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
    : null;

  let heatmapImageData: ImageData | null = null;
  let heatmapDataUrl: string | null = null;

  if (heatmapData && mismatchedPixels > 0) {
    heatmapImageData = createImageData(heatmapData, width, height);
    if (heatmapImageData) {
      heatmapDataUrl = imageDataToDataUrl(heatmapImageData, width, height);
    }
  }

  return {
    identical: mismatchedPixels === 0,
    mismatchPercent,
    mismatchedPixels,
    totalPixels,
    missingPixels,
    avgColorDrift,
    maxColorDrift: maxDrift,
    mismatchRegion,
    heatmapDataUrl,
    heatmapImageData,
  };
}

/**
 * Compare two canvases from HTMLCanvasElement objects.
 */
export function compareCanvasElements(
  a: HTMLCanvasElement,
  b: HTMLCanvasElement,
  options: CompareOptions = {}
): CanvasComparisonResult {
  const ctxA = a.getContext('2d');
  const ctxB = b.getContext('2d');
  if (!ctxA || !ctxB) {
    return errorResult('Cannot get 2D context from canvas');
  }

  const dataA = ctxA.getImageData(0, 0, a.width, a.height);
  const dataB = ctxB.getImageData(0, 0, b.width, b.height);
  return compareCanvases(dataA, dataB, options);
}

// ─── Helpers ──────────────────────────────────────────────────

function dimensionMismatchResult(a: ImageData, b: ImageData): CanvasComparisonResult {
  return {
    identical: false,
    mismatchPercent: 100,
    mismatchedPixels: Math.max(a.width * a.height, b.width * b.height),
    totalPixels: Math.max(a.width * a.height, b.width * b.height),
    missingPixels: Math.abs((a.width * a.height) - (b.width * b.height)),
    avgColorDrift: 255,
    maxColorDrift: 255,
    mismatchRegion: { x: 0, y: 0, width: Math.max(a.width, b.width), height: Math.max(a.height, b.height) },
    heatmapDataUrl: null,
    heatmapImageData: null,
  };
}

function errorResult(_msg: string): CanvasComparisonResult {
  return {
    identical: false,
    mismatchPercent: 100,
    mismatchedPixels: 0,
    totalPixels: 0,
    missingPixels: 0,
    avgColorDrift: 0,
    maxColorDrift: 0,
    mismatchRegion: null,
    heatmapDataUrl: null,
    heatmapImageData: null,
  };
}

function createImageData(rawData: Uint8ClampedArray, width: number, height: number): ImageData | null {
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const id = ctx.createImageData(width, height);
      id.data.set(rawData);
      return id;
    }
  }
  // Fallback: try constructor directly (may fail in strict TS environments)
  try {
    return new (ImageData as unknown as new (data: Uint8ClampedArray, w: number, h: number) => ImageData)(rawData, width, height);
  } catch {
    return null;
  }
}

function imageDataToDataUrl(data: ImageData, width: number, height: number): string {
  // Use OffscreenCanvas if available, otherwise try document.createElement
  if (typeof OffscreenCanvas !== 'undefined') {
    const offscreen = new OffscreenCanvas(width, height);
    const ctx = offscreen.getContext('2d');
    if (ctx) {
      ctx.putImageData(data, 0, 0);
      // OffscreenCanvas doesn't have toDataURL; convert via Blob synchronously is not possible.
      // Fall back to regular canvas if in browser environment.
    }
  }

  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.putImageData(data, 0, 0);
      return canvas.toDataURL('image/png');
    }
  }

  // Return empty data URL if no canvas environment
  return '';
}
