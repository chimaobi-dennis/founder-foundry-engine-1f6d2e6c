/**
 * safeZones.ts
 *
 * Platform-aware safe zone definitions.
 * Prevents important content from being clipped by platform UI overlays.
 */

// ─── Types ────────────────────────────────────────────────────

export interface SafeZone {
  /** Inset from top edge. */
  top: number;
  /** Inset from right edge. */
  right: number;
  /** Inset from bottom edge. */
  bottom: number;
  /** Inset from left edge. */
  left: number;
}

export interface SafeRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ─── Platform Safe Zones ──────────────────────────────────────

const PLATFORM_SAFE_ZONES: Record<string, SafeZone> = {
  // Instagram Story — username top-left, CTA bottom, icons right
  instagram_story: { top: 120, right: 60, bottom: 200, left: 20 },
  // Instagram Post — minimal UI overlay
  instagram_post: { top: 20, right: 20, bottom: 60, left: 20 },
  // Instagram Reels — similar to story
  instagram_reels: { top: 100, right: 60, bottom: 200, left: 20 },
  // TikTok — heavy bottom UI, right sidebar icons
  tiktok: { top: 80, right: 80, bottom: 240, left: 20 },
  // Facebook Feed
  facebook_feed: { top: 20, right: 20, bottom: 40, left: 20 },
  // Facebook Ad
  facebook_ad: { top: 20, right: 20, bottom: 40, left: 20 },
  // LinkedIn Post
  linkedin_post: { top: 16, right: 16, bottom: 40, left: 16 },
  // Twitter/X
  twitter: { top: 12, right: 12, bottom: 12, left: 12 },
  // Pinterest
  pinterest: { top: 20, right: 20, bottom: 60, left: 20 },
  // YouTube Thumbnail
  youtube_thumbnail: { top: 8, right: 8, bottom: 40, left: 8 },
  // Email Header
  email_header: { top: 8, right: 16, bottom: 8, left: 16 },
  // Generic
  generic: { top: 16, right: 16, bottom: 16, left: 16 },
};

// ─── Public API ───────────────────────────────────────────────

/**
 * Get the safe zone for a platform.
 * Falls back to generic if unknown.
 */
export function getSafeZone(platformSlug: string): SafeZone {
  return PLATFORM_SAFE_ZONES[platformSlug] || PLATFORM_SAFE_ZONES.generic;
}

/**
 * Convert a safe zone into an absolute safe region for a given canvas.
 */
export function getSafeRegion(
  canvasWidth: number,
  canvasHeight: number,
  platformSlug: string
): SafeRegion {
  const zone = getSafeZone(platformSlug);
  return {
    x: zone.left,
    y: zone.top,
    width: Math.max(1, canvasWidth - zone.left - zone.right),
    height: Math.max(1, canvasHeight - zone.top - zone.bottom),
  };
}

/**
 * Check if a rectangular element is fully within the safe zone.
 */
export function isInSafeZone(
  elementX: number,
  elementY: number,
  elementWidth: number,
  elementHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  platformSlug: string
): boolean {
  const region = getSafeRegion(canvasWidth, canvasHeight, platformSlug);
  return (
    elementX >= region.x &&
    elementY >= region.y &&
    elementX + elementWidth <= region.x + region.width &&
    elementY + elementHeight <= region.y + region.height
  );
}

/**
 * Clamp an element position so it stays within the safe zone.
 */
export function clampToSafeZone(
  elementX: number,
  elementY: number,
  elementWidth: number,
  elementHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  platformSlug: string
): { x: number; y: number } {
  const region = getSafeRegion(canvasWidth, canvasHeight, platformSlug);
  return {
    x: Math.max(region.x, Math.min(elementX, region.x + region.width - elementWidth)),
    y: Math.max(region.y, Math.min(elementY, region.y + region.height - elementHeight)),
  };
}

/**
 * Get all registered platform slugs.
 */
export function getAllPlatformSlugs(): string[] {
  return Object.keys(PLATFORM_SAFE_ZONES);
}
