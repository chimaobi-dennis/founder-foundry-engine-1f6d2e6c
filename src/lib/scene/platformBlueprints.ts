/**
 * platformBlueprints.ts
 *
 * Platform-specific composition blueprints.
 * Each platform defines safe zones, preferred layouts, typography ratios,
 * visual occupancy targets, CTA positioning, and visual rhythm.
 */

// ─── Types ────────────────────────────────────────────────────

export interface PlatformBlueprint {
  slug: string;
  name: string;
  width: number;
  height: number;
  /** Preferred layout pattern. */
  layout: 'editorial' | 'split' | 'centered' | 'cinematic' | 'modular';
  /** Typography scale ratio. */
  typographyRatio: number;
  /** Ideal occupancy fraction (0–1). */
  occupancyTarget: number;
  /** CTA positioning. */
  ctaPosition: 'bottom-center' | 'bottom-right' | 'center' | 'none';
  /** Visual rhythm description for AI guidance. */
  rhythm: string;
  /** Maximum recommended node count. */
  maxNodes: number;
  /** Base font size recommendation. */
  baseFontSize: number;
  /** Whether hero imagery is strongly recommended. */
  preferHeroImage: boolean;
}

// ─── Blueprint Registry ──────────────────────────────────────

const BLUEPRINTS: PlatformBlueprint[] = [
  {
    slug: 'instagram_post',
    name: 'Instagram Post',
    width: 1080,
    height: 1080,
    layout: 'editorial',
    typographyRatio: 1.25,
    occupancyTarget: 0.6,
    ctaPosition: 'bottom-center',
    rhythm: 'Bold headline with strong visual anchor. Text should be punchy and scannable. Use contrast between image and text zones.',
    maxNodes: 25,
    baseFontSize: 24,
    preferHeroImage: true,
  },
  {
    slug: 'instagram_story',
    name: 'Instagram Story',
    width: 1080,
    height: 1920,
    layout: 'cinematic',
    typographyRatio: 1.333,
    occupancyTarget: 0.5,
    ctaPosition: 'bottom-center',
    rhythm: 'Cinematic vertical rhythm. Strong mid-composition focal point. Large typography. Full-bleed imagery. Keep bottom 200px clear for swipe-up CTA zone.',
    maxNodes: 20,
    baseFontSize: 28,
    preferHeroImage: true,
  },
  {
    slug: 'instagram_reels',
    name: 'Instagram Reels Cover',
    width: 1080,
    height: 1920,
    layout: 'cinematic',
    typographyRatio: 1.333,
    occupancyTarget: 0.45,
    ctaPosition: 'none',
    rhythm: 'Single powerful visual moment. Minimal text overlay. Subject-centered composition. Bright, attention-grabbing palette.',
    maxNodes: 15,
    baseFontSize: 32,
    preferHeroImage: true,
  },
  {
    slug: 'facebook_ad',
    name: 'Facebook Ad',
    width: 1200,
    height: 628,
    layout: 'split',
    typographyRatio: 1.25,
    occupancyTarget: 0.6,
    ctaPosition: 'bottom-right',
    rhythm: 'Split composition — image left, copy right. Clear value proposition hierarchy. Prominent CTA button. Professional and trust-forward.',
    maxNodes: 25,
    baseFontSize: 20,
    preferHeroImage: true,
  },
  {
    slug: 'facebook_feed',
    name: 'Facebook Feed Post',
    width: 1200,
    height: 628,
    layout: 'editorial',
    typographyRatio: 1.25,
    occupancyTarget: 0.55,
    ctaPosition: 'bottom-center',
    rhythm: 'Content-first layout. Clear headline, supporting imagery. Conversational tone supported by clean visual hierarchy.',
    maxNodes: 20,
    baseFontSize: 22,
    preferHeroImage: false,
  },
  {
    slug: 'linkedin_post',
    name: 'LinkedIn Post',
    width: 1200,
    height: 628,
    layout: 'modular',
    typographyRatio: 1.2,
    occupancyTarget: 0.55,
    ctaPosition: 'bottom-right',
    rhythm: 'Editorial modular structure. Trust-heavy hierarchy. Data-forward when possible. Professional typography with generous whitespace. Subtle brand integration.',
    maxNodes: 25,
    baseFontSize: 20,
    preferHeroImage: false,
  },
  {
    slug: 'twitter',
    name: 'Twitter/X Post',
    width: 1200,
    height: 675,
    layout: 'centered',
    typographyRatio: 1.2,
    occupancyTarget: 0.5,
    ctaPosition: 'none',
    rhythm: 'Concise punchy composition. Single strong message. High contrast. Minimal elements. Impact over complexity.',
    maxNodes: 15,
    baseFontSize: 24,
    preferHeroImage: false,
  },
  {
    slug: 'pinterest',
    name: 'Pinterest Pin',
    width: 1000,
    height: 1500,
    layout: 'editorial',
    typographyRatio: 1.25,
    occupancyTarget: 0.65,
    ctaPosition: 'bottom-center',
    rhythm: 'Tall vertical format. Lead with aspirational imagery. Text overlay at bottom. Clean brand badge. Saveable and inspirational.',
    maxNodes: 20,
    baseFontSize: 22,
    preferHeroImage: true,
  },
  {
    slug: 'youtube_thumbnail',
    name: 'YouTube Thumbnail',
    width: 1280,
    height: 720,
    layout: 'split',
    typographyRatio: 1.333,
    occupancyTarget: 0.7,
    ctaPosition: 'none',
    rhythm: 'Maximum visual impact. Large face/subject on one side, bold text on the other. High saturation. 3 words max on text. Bottom-right clear for duration badge.',
    maxNodes: 10,
    baseFontSize: 36,
    preferHeroImage: true,
  },
  {
    slug: 'email_header',
    name: 'Email Header',
    width: 600,
    height: 300,
    layout: 'centered',
    typographyRatio: 1.2,
    occupancyTarget: 0.55,
    ctaPosition: 'center',
    rhythm: 'Clean centered layout. Brand logo prominent. Single headline. Supporting subtext. Subtle background treatment.',
    maxNodes: 15,
    baseFontSize: 18,
    preferHeroImage: false,
  },
];

// ─── Public API ───────────────────────────────────────────────

/**
 * Get the blueprint for a platform.
 * Returns null if the platform is not registered.
 */
export function getBlueprint(slug: string): PlatformBlueprint | null {
  return BLUEPRINTS.find((b) => b.slug === slug) || null;
}

/**
 * Get the blueprint for a platform, falling back to a generic one.
 */
export function getBlueprintOrDefault(slug: string): PlatformBlueprint {
  return getBlueprint(slug) || {
    slug,
    name: slug.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    width: 1080,
    height: 1080,
    layout: 'editorial',
    typographyRatio: 1.25,
    occupancyTarget: 0.55,
    ctaPosition: 'bottom-center',
    rhythm: 'Balanced editorial composition with clear hierarchy.',
    maxNodes: 25,
    baseFontSize: 22,
    preferHeroImage: false,
  };
}

/**
 * Get all registered platform blueprints.
 */
export function getAllBlueprints(): ReadonlyArray<PlatformBlueprint> {
  return BLUEPRINTS;
}

/**
 * Convert a blueprint into a human-readable prompt block for AI guidance.
 */
export function blueprintToPromptBlock(bp: PlatformBlueprint): string {
  return [
    `PLATFORM: ${bp.name} (${bp.width}×${bp.height})`,
    `LAYOUT: ${bp.layout}`,
    `TYPOGRAPHY: ratio=${bp.typographyRatio}, baseFontSize=${bp.baseFontSize}px`,
    `OCCUPANCY TARGET: ${(bp.occupancyTarget * 100).toFixed(0)}%`,
    `CTA: ${bp.ctaPosition}`,
    `MAX NODES: ${bp.maxNodes}`,
    `HERO IMAGE: ${bp.preferHeroImage ? 'recommended' : 'optional'}`,
    `RHYTHM: ${bp.rhythm}`,
  ].join('\n');
}
