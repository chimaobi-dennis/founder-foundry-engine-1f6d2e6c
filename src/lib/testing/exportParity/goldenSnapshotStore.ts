/**
 * goldenSnapshotStore.ts
 *
 * In-memory store for golden (reference) snapshots.
 * Used to persist known-good renders for regression comparison.
 *
 * In development: stores in memory.
 * Could be extended to localStorage or IndexedDB for persistence.
 */

// ─── Types ────────────────────────────────────────────────────

export interface GoldenSnapshot {
  /** Unique key (e.g. "typographyStress_1x"). */
  key: string;
  /** Data URL of the golden render. */
  dataUrl: string;
  /** ImageData width. */
  width: number;
  /** ImageData height. */
  height: number;
  /** Pixel ratio used. */
  pixelRatio: number;
  /** ISO timestamp when captured. */
  capturedAt: string;
  /** Scene hash for identity verification. */
  sceneHash: string;
  /** Raw RGBA data encoded as base64. */
  pixelDataBase64: string;
}

export interface GoldenStoreStats {
  totalSnapshots: number;
  keys: string[];
  totalBytes: number;
}

// ─── Store ───────────────────────────────────────────────────

const store = new Map<string, GoldenSnapshot>();

// ─── Public API ───────────────────────────────────────────────

/**
 * Save a golden snapshot.
 */
export function saveGoldenSnapshot(snapshot: GoldenSnapshot): void {
  store.set(snapshot.key, snapshot);
}

/**
 * Retrieve a golden snapshot by key.
 */
export function getGoldenSnapshot(key: string): GoldenSnapshot | null {
  return store.get(key) ?? null;
}

/**
 * Check if a golden snapshot exists.
 */
export function hasGoldenSnapshot(key: string): boolean {
  return store.has(key);
}

/**
 * Delete a golden snapshot.
 */
export function deleteGoldenSnapshot(key: string): boolean {
  return store.delete(key);
}

/**
 * List all golden snapshot keys.
 */
export function listGoldenSnapshots(): string[] {
  return [...store.keys()];
}

/**
 * Clear all golden snapshots.
 */
export function clearGoldenSnapshots(): void {
  store.clear();
}

/**
 * Get store stats.
 */
export function getGoldenStoreStats(): GoldenStoreStats {
  let totalBytes = 0;
  for (const snap of store.values()) {
    totalBytes += snap.dataUrl.length + snap.pixelDataBase64.length;
  }
  return {
    totalSnapshots: store.size,
    keys: [...store.keys()],
    totalBytes,
  };
}

/**
 * Create a golden snapshot from an ImageData + metadata.
 */
export function createGoldenFromImageData(
  key: string,
  imageData: ImageData,
  dataUrl: string,
  pixelRatio: number,
  sceneHash: string
): GoldenSnapshot {
  // Encode pixel data as base64
  const uint8 = new Uint8Array(imageData.data.buffer);
  const binaryStr = Array.from(uint8, (b) => String.fromCharCode(b)).join('');
  const pixelDataBase64 = typeof btoa === 'function' ? btoa(binaryStr) : '';

  return {
    key,
    dataUrl,
    width: imageData.width,
    height: imageData.height,
    pixelRatio,
    capturedAt: new Date().toISOString(),
    sceneHash,
    pixelDataBase64,
  };
}

/**
 * Decode golden snapshot pixel data back to Uint8ClampedArray.
 */
export function decodeGoldenPixelData(snapshot: GoldenSnapshot): Uint8ClampedArray | null {
  if (!snapshot.pixelDataBase64) return null;

  try {
    const binaryStr = typeof atob === 'function' ? atob(snapshot.pixelDataBase64) : '';
    if (!binaryStr) return null;

    const bytes = new Uint8ClampedArray(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}
