/**
 * Platform-aware rendering utilities.
 *
 * Reads the dynamic configuration from `content_platforms` rows:
 *   - typography_scale (jsonb)         — desktop/min font sizes per role
 *   - min_headline_size / max_headline_size / min_body_size / min_cta_size
 *   - safe_zone_top/bottom/left/right  — px in source-canvas space
 *   - occupancy_target                 — % of canvas the design should occupy
 *   - required_zones (jsonb array)     — labelled regions the design must respect
 *   - preferred_layouts (text[])
 *   - visual_density                   — 'compact' | 'balanced' | 'airy'
 *   - supports_svg                     — prefer SVG output when true
 *   - platform_render_rules (jsonb)    — free-form additional rules
 *
 * Nothing here is hardcoded per platform slug — every value comes from the row.
 */

export interface RequiredZone {
  name?: string;
  label?: string;
  /** Source-pixel coords */
  x?: number;
  y?: number;
  w?: number;
  width?: number;
  h?: number;
  height?: number;
  required?: boolean;
}

export interface TypographyScale {
  headline_min?: number;
  headline_max?: number;
  body_min?: number;
  body_max?: number;
  cta_min?: number;
  cta_max?: number;
  // Free-form additional roles
  [role: string]: number | undefined;
}

export interface PlatformConfig {
  id?: string;
  slug?: string;
  name?: string;
  image_width?: number | null;
  image_height?: number | null;
  aspect_ratio?: string | null;
  character_limit?: number | null;
  copy_guidelines?: string | null;

  min_headline_size?: number | null;
  max_headline_size?: number | null;
  min_body_size?: number | null;
  min_cta_size?: number | null;

  safe_zone_top?: number | null;
  safe_zone_bottom?: number | null;
  safe_zone_left?: number | null;
  safe_zone_right?: number | null;

  occupancy_target?: number | null;
  visual_density?: string | null;
  preferred_layouts?: string[] | null;
  required_zones?: RequiredZone[] | null;
  typography_scale?: TypographyScale | null;
  platform_render_rules?: Record<string, any> | null;
  supports_svg?: boolean | null;
  auto_layout_enabled?: boolean | null;
}

/** Effective canvas dimensions, falling back to a square 600 if not set. */
export function getCanvasDimensions(p: PlatformConfig | null | undefined) {
  return {
    width: p?.image_width || 600,
    height: p?.image_height || 600,
  };
}

/**
 * Detect the native creative dimensions baked into the AI-generated HTML.
 *
 * The AI typically emits a wrapping element with inline `width:1080px;height:1350px`
 * (or attributes). We parse the FIRST element/style/svg tag we find and return
 * `{ width, height }` if both are present, else `null`.
 *
 * Used by the renderer to make the stage adapt to whatever the model produced
 * (1080×1350, 1080×1920, 1200×630, …) instead of stretching to platform spec.
 */
export function detectNativeHtmlDimensions(
  html: string | null | undefined,
): { width: number; height: number } | null {
  if (!html) return null;
  // Strip our own injected <style data-...> blocks before scanning so they
  // don't accidentally match width/height inside CSS rules.
  const cleaned = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // 1) Inline style on first opening tag: style="...; width:1080px; height:1350px; ..."
  const styleMatch = cleaned.match(/<[^>]+style\s*=\s*"([^"]+)"/i);
  if (styleMatch) {
    const style = styleMatch[1];
    const w = style.match(/(?:^|[\s;])width\s*:\s*(\d+(?:\.\d+)?)\s*px/i);
    const h = style.match(/(?:^|[\s;])height\s*:\s*(\d+(?:\.\d+)?)\s*px/i);
    if (w && h) {
      const width = parseFloat(w[1]);
      const height = parseFloat(h[1]);
      if (width >= 100 && height >= 100) return { width, height };
    }
  }

  // 2) <svg width="1080" height="1350"> or attribute pairs on the root element
  const attrMatch = cleaned.match(/<\w+[^>]*\swidth\s*=\s*"(\d+)"[^>]*\sheight\s*=\s*"(\d+)"/i);
  if (attrMatch) {
    const width = parseFloat(attrMatch[1]);
    const height = parseFloat(attrMatch[2]);
    if (width >= 100 && height >= 100) return { width, height };
  }

  // 3) SVG viewBox="0 0 1080 1350"
  const vb = cleaned.match(/viewBox\s*=\s*"\s*0\s+0\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*"/i);
  if (vb) {
    const width = parseFloat(vb[1]);
    const height = parseFloat(vb[2]);
    if (width >= 100 && height >= 100) return { width, height };
  }

  return null;
}

/** Safe-zone rect in source-pixel space. */
export function getSafeZoneRect(p: PlatformConfig | null | undefined) {
  const { width, height } = getCanvasDimensions(p);
  const top = p?.safe_zone_top ?? 0;
  const right = p?.safe_zone_right ?? 0;
  const bottom = p?.safe_zone_bottom ?? 0;
  const left = p?.safe_zone_left ?? 0;
  return {
    top,
    left,
    width: Math.max(0, width - left - right),
    height: Math.max(0, height - top - bottom),
    canvasWidth: width,
    canvasHeight: height,
  };
}

/** Normalised array of required zones (handles {x,y,w,h} or {x,y,width,height}). */
export function getRequiredZones(p: PlatformConfig | null | undefined) {
  const list = Array.isArray(p?.required_zones) ? p!.required_zones! : [];
  return list.map((z, i) => ({
    name: z.name || z.label || `Zone ${i + 1}`,
    x: Number(z.x ?? 0),
    y: Number(z.y ?? 0),
    width: Number(z.width ?? z.w ?? 0),
    height: Number(z.height ?? z.h ?? 0),
    required: z.required !== false,
  }));
}

/**
 * Preview padding (in CSS pixels, applied to the stage container) chosen so
 * that a fully-occupied creative still leaves comfortable breathing room.
 *
 * Lower occupancy_target means the AI is expected to fill less of the canvas,
 * so we add MORE viewport breathing room (the design itself carries margin).
 * Higher occupancy_target → tighter padding so the creative dominates.
 */
export function getPreviewPadding(p: PlatformConfig | null | undefined) {
  const occupancy = p?.occupancy_target ?? 70; // default 70%
  // Map 50–95 → 28–10 px padding (clamped)
  const clamped = Math.max(40, Math.min(95, occupancy));
  const px = Math.round(28 - ((clamped - 40) / 55) * 18);
  return { x: px, y: px };
}

/**
 * Build a `<style>` block that normalises tiny typography in AI-generated
 * HTML, enforcing the platform's minimum font sizes for headline / body / cta
 * roles. Designs that ignore these rules will be visually corrected.
 */
export function buildTypographyNormalizationCss(p: PlatformConfig | null | undefined): string {
  if (!p) return '';
  const scale = (p.typography_scale || {}) as TypographyScale;
  const headlineMin = p.min_headline_size ?? scale.headline_min ?? 0;
  const headlineMax = p.max_headline_size ?? scale.headline_max ?? 0;
  const bodyMin = p.min_body_size ?? scale.body_min ?? 0;
  const ctaMin = p.min_cta_size ?? scale.cta_min ?? 0;

  const rules: string[] = [];

  // Generic headline normalisation — applies to <h1/h2/h3> + role=headline
  if (headlineMin > 0) {
    rules.push(
      `[data-element-type="text"][data-role="headline"], h1, h2, .headline { font-size: max(var(--__hl, ${headlineMin}px), ${headlineMin}px) !important; }`,
    );
  }
  if (headlineMax > 0) {
    rules.push(
      `[data-element-type="text"][data-role="headline"], h1, h2, .headline { max-font-size: ${headlineMax}px; }`,
    );
  }
  if (bodyMin > 0) {
    rules.push(
      `[data-element-type="text"][data-role="body"], p, .body { font-size: max(var(--__bd, ${bodyMin}px), ${bodyMin}px) !important; }`,
    );
  }
  if (ctaMin > 0) {
    rules.push(
      `[data-element-type="text"][data-role="cta"], .cta, [role="button"], button { font-size: max(var(--__cta, ${ctaMin}px), ${ctaMin}px) !important; }`,
    );
  }

  if (!rules.length) return '';
  return `<style data-platform-typography>\n${rules.join('\n')}\n</style>`;
}

/** Wrap raw AI HTML with the typography normalisation block. */
export function applyTypographyNormalization(
  html: string | null | undefined,
  p: PlatformConfig | null | undefined,
): string {
  if (!html) return '';
  const css = buildTypographyNormalizationCss(p);
  return css ? css + html : html;
}

/**
 * Build the dynamic per-platform design guidance prompt fed to the visual AI.
 * Replaces the previously hardcoded `platformDesignGuidance` map.
 */
export function buildPlatformDesignGuidance(p: PlatformConfig): string {
  const { width, height } = getCanvasDimensions(p);
  const aspect = p.aspect_ratio || `${width}:${height}`;
  const occupancy = p.occupancy_target ?? 70;
  const density = p.visual_density || 'balanced';
  const safeZones = `top:${p.safe_zone_top ?? 0}px right:${p.safe_zone_right ?? 0}px bottom:${p.safe_zone_bottom ?? 0}px left:${p.safe_zone_left ?? 0}px`;

  const lines: string[] = [];
  lines.push(`Format: ${aspect} — fill a ${width}×${height}px canvas.`);
  lines.push(
    `Occupancy: design must fill at least ${occupancy}% of the canvas (no large empty bands).`,
  );
  lines.push(`Visual density: ${density}.`);
  lines.push(
    `Safe zones (keep critical text/logo INSIDE these insets): ${safeZones}.`,
  );

  // Typography scale
  const scale = (p.typography_scale || {}) as TypographyScale;
  const hlMin = p.min_headline_size ?? scale.headline_min;
  const hlMax = p.max_headline_size ?? scale.headline_max;
  const bdMin = p.min_body_size ?? scale.body_min;
  const ctaMin = p.min_cta_size ?? scale.cta_min;
  const typoBits: string[] = [];
  if (hlMin) typoBits.push(`headline ≥ ${hlMin}px`);
  if (hlMax) typoBits.push(`headline ≤ ${hlMax}px`);
  if (bdMin) typoBits.push(`body ≥ ${bdMin}px`);
  if (ctaMin) typoBits.push(`CTA ≥ ${ctaMin}px`);
  if (typoBits.length) {
    lines.push(`Typography scale (must respect): ${typoBits.join(', ')}.`);
  }

  // Required zones
  const zones = getRequiredZones(p);
  if (zones.length) {
    lines.push(
      `Required zones (must be visually present and non-empty):\n` +
        zones
          .map(
            z =>
              `  - ${z.name}: at (${z.x},${z.y}) ${z.width}×${z.height}px${z.required ? ' [required]' : ''}`,
          )
          .join('\n'),
    );
  }

  // Preferred layouts
  if (p.preferred_layouts && p.preferred_layouts.length) {
    lines.push(`Preferred layouts: ${p.preferred_layouts.join(', ')}.`);
  }

  // SVG preference
  if (p.supports_svg) {
    lines.push(
      `Output preference: this platform supports SVG. Prefer inline <svg> for shapes, icons, and text-on-shape compositions; rasterised <img> only when a real photo is required.`,
    );
  }

  // Free-form render rules
  if (p.platform_render_rules && Object.keys(p.platform_render_rules).length) {
    lines.push(
      `Additional render rules: ${JSON.stringify(p.platform_render_rules)}.`,
    );
  }

  if (p.copy_guidelines) {
    lines.push(`Copy guidelines: ${p.copy_guidelines}`);
  }

  return lines.join('\n');
}
