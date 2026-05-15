/* ========================================================================
   Platform Intelligence Service
   ------------------------------------------------------------------------
   DB-driven design system builder for AI generation prompts.

   Converts raw `content_platforms` DB rows into structured design-system
   objects and human-readable rendering instructions that the AI can follow.

   REUSABLE BY:
   - ContentStudio
   - ProStudio
   - Ad Studio
   - Story Generator
   - Carousel Builder
   - Reel Generator
   - Thumbnail Generator
   - Renderer normalization layer

   SOURCE OF TRUTH: `content_platforms` table in Supabase.
   ======================================================================== */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PlatformDesignSystem {
  dimensions: {
    width: number;
    height: number;
    aspect_ratio: string;
  };

  typography: {
    min_headline_size: number | null;
    max_headline_size: number | null;
    min_body_size: number | null;
    min_cta_size: number | null;
    typography_scale: Record<string, any> | null;
  };

  occupancy_target: number | null;

  visual_density: string | null;

  preferred_layouts: string[];

  required_zones: (string | Record<string, any>)[];

  render_rules: Record<string, any> | null;

  safe_zones: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };

  supports_svg: boolean;

  auto_layout_enabled: boolean;
}

// ─── Design System Builder ──────────────────────────────────────────────────

/**
 * Build a structured design system object from a `content_platforms` DB row.
 * All values derive from the database; no hardcoded platform-specific logic.
 */
export function buildPlatformDesignSystem(platform: any): PlatformDesignSystem {
  return {
    dimensions: {
      width: platform.image_width ?? 600,
      height: platform.image_height ?? 600,
      aspect_ratio: platform.aspect_ratio || '1:1',
    },

    typography: {
      min_headline_size: platform.min_headline_size ?? null,
      max_headline_size: platform.max_headline_size ?? null,
      min_body_size: platform.min_body_size ?? null,
      min_cta_size: platform.min_cta_size ?? null,
      typography_scale: platform.typography_scale ?? null,
    },

    occupancy_target: platform.occupancy_target ?? null,

    visual_density: platform.visual_density ?? null,

    preferred_layouts: normalizeArray(platform.preferred_layouts),

    required_zones: normalizeArray(platform.required_zones),

    render_rules: platform.platform_render_rules ?? null,

    safe_zones: {
      top: platform.safe_zone_top ?? 0,
      bottom: platform.safe_zone_bottom ?? 0,
      left: platform.safe_zone_left ?? 0,
      right: platform.safe_zone_right ?? 0,
    },

    supports_svg: platform.supports_svg ?? false,

    auto_layout_enabled: platform.auto_layout_enabled ?? false,
  };
}

// ─── Render Instructions Builder ────────────────────────────────────────────

/**
 * Generate human-readable AI rendering instructions from a PlatformDesignSystem.
 * These are natural-language constraints the AI can follow during generation.
 * Every instruction derives from DB values — nothing is hardcoded per platform.
 */
export function buildPlatformRenderInstructions(
  system: PlatformDesignSystem
): string {
  const instructions: string[] = [];

  // ── Canvas dimensions ──
  instructions.push(
    `Canvas size: ${system.dimensions.width}×${system.dimensions.height}px (${system.dimensions.aspect_ratio}). ` +
    `Design must fill the FULL canvas with no empty space.`
  );

  // ── Typography constraints ──
  const typo = system.typography;
  if (typo.min_headline_size != null && typo.max_headline_size != null) {
    instructions.push(
      `Headline typography must remain between ${typo.min_headline_size}px and ${typo.max_headline_size}px equivalent.`
    );
  } else if (typo.min_headline_size != null) {
    instructions.push(
      `Headline typography must be at least ${typo.min_headline_size}px equivalent.`
    );
  }

  if (typo.min_body_size != null) {
    instructions.push(
      `Body text must be at least ${typo.min_body_size}px — it must remain readable at mobile preview scale.`
    );
  }

  if (typo.min_cta_size != null) {
    instructions.push(
      `CTA text must be at least ${typo.min_cta_size}px to ensure tap-target readability.`
    );
  }

  if (typo.typography_scale && typeof typo.typography_scale === 'object') {
    const scaleEntries = Object.entries(typo.typography_scale);
    if (scaleEntries.length > 0) {
      const scaleLines = scaleEntries.map(
        ([role, size]) => `- ${humanizeKey(role)}: ${size}`
      );
      instructions.push(
        `Typographic scale for visual hierarchy:\n${scaleLines.join('\n')}`
      );
    }
  }

  // ── Occupancy target ──
  if (system.occupancy_target != null) {
    instructions.push(
      `Canvas occupancy should exceed ${system.occupancy_target}%. Sparse, empty layouts are forbidden.`
    );
  }

  // ── Visual density ──
  if (system.visual_density) {
    instructions.push(
      `Visual density: "${system.visual_density}". Composition must match this density level.`
    );
  }

  // ── Required zones ──
  if (system.required_zones.length > 0) {
    const zoneLabels = system.required_zones.map(z =>
      typeof z === 'object' ? (z as any).name || JSON.stringify(z) : z
    );
    instructions.push(
      `Composition must include these visual zones: ${zoneLabels.join(', ')}.`
    );
  }

  // ── Preferred layouts ──
  if (system.preferred_layouts.length > 0) {
    instructions.push(
      `Prefer these layout approaches: ${system.preferred_layouts.join(', ')}.`
    );
  }

  // ── Safe zones ──
  const sz = system.safe_zones;
  if (sz.top > 0 || sz.bottom > 0 || sz.left > 0 || sz.right > 0) {
    instructions.push(
      `Keep critical content outside safe zones — top: ${sz.top}px, bottom: ${sz.bottom}px, left: ${sz.left}px, right: ${sz.right}px.`
    );
  }

  // ── SVG support ──
  if (system.supports_svg) {
    instructions.push(
      `Prefer SVG-based decorative systems, scalable vector typography accents, ` +
      `vector dividers, vector gradients, SVG masks, SVG patterns, and SVG ` +
      `geometric composition where appropriate.`
    );
  }

  // ── Platform render rules (custom JSON → prose) ──
  if (system.render_rules && typeof system.render_rules === 'object') {
    const ruleEntries = Object.entries(system.render_rules);
    if (ruleEntries.length > 0) {
      const ruleLines = ruleEntries.map(
        ([key, val]) => `- ${humanizeKey(key)}: ${val}`
      );
      instructions.push(
        `Platform render rules:\n${ruleLines.join('\n')}`
      );
    }
  }

  // ── Hard enforcement rules (always present) ──
  instructions.push(
    `HARD CONSTRAINTS:\n` +
    `- Tiny, unreadable typography is forbidden.\n` +
    `- Sparse, empty layouts are forbidden.\n` +
    `- Visual hierarchy must dominate the frame.\n` +
    `- Content must visually fill the canvas.\n` +
    `- Body text must remain readable at mobile preview scale.`
  );

  return instructions.join('\n\n');
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalizeArray(value: any): any[] {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch {
      // Try comma-separated
      return value.split(',').map((s: string) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

function humanizeKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}
