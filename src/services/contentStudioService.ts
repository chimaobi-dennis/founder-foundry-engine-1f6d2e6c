import { supabase } from '@/integrations/supabase/client';
import { callAI, getSystemPrompt, injectPromptVariables } from './aiService';
import { logError } from './errorService';
import { getAssetsForAIContext, getBrandProductImages } from './projectAssetsService';
import { saveToLibrary as saveToAssetLibrary, type SaveFormat, type Asset } from './assetService';
import { buildFounderIntelligenceContext } from './founderIntelligenceService';
import { buildPlatformDesignSystem, buildPlatformRenderInstructions } from './platformIntelligenceService';

// ─── Founder Intelligence helpers ───────────────────────────────────────────
// Build a token-efficient creative-memory summary suitable for visual prompts.
// This is intentionally NOT raw HTML — only summarized patterns + anti-repetition.
function summarizeCreativeMemoryForVisuals(visualIntelligence: Awaited<ReturnType<typeof buildFounderIntelligenceContext>>): string {
  const cm = visualIntelligence.creativeMemory;
  const sc = visualIntelligence.synthesizedContext;
  const lines: string[] = [];

  if (cm.recurringVisualPatterns.length) {
    lines.push(`Recurring visual patterns: ${cm.recurringVisualPatterns.join('; ')}`);
  }
  if (cm.recurringTypographyPatterns.length) {
    lines.push(`Typography patterns: ${cm.recurringTypographyPatterns.join('; ')}`);
  }
  if (cm.recurringColorDirections.length) {
    lines.push(`Color directions used: ${cm.recurringColorDirections.slice(0, 6).join(', ')}`);
  }
  if (cm.recurringCTAStyles.length) {
    lines.push(`Prior CTA styles: ${cm.recurringCTAStyles.join('; ')}`);
  }
  if (cm.recentCreativeOutputs.length) {
    const recent = cm.recentCreativeOutputs
      .slice(0, 5)
      .map(o => `- [${o.platform}] ${o.headline ?? ''} — ${o.summary ?? ''}`.trim())
      .join('\n');
    lines.push(`Recent creative directions:\n${recent}`);
  }
  if (sc.antiRepetitionInstructions.length) {
    lines.push(`Anti-repetition rules:\n- ${sc.antiRepetitionInstructions.join('\n- ')}`);
  }

  return lines.join('\n\n');
}

const db = supabase as any;

const GENERATION_TIMEOUT_MS = 60000; // 60 seconds

// ─── Timeout wrapper for AI generation calls ────────────────────────────────

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = GENERATION_TIMEOUT_MS,
  errorMessage: string = 'GENERATION_TIMEOUT'
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
  );
  return Promise.race([promise, timeoutPromise]);
}

// ─── Stuck generation detector ───────────────────────────────────────────────

export async function markStuckGenerationsAsFailed(briefId: string): Promise<void> {
  const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();
  
  const { data: stuckCreatives } = await db
    .from('content_studio_creatives')
    .select('id')
    .eq('brief_id', briefId)
    .eq('status', 'generating')
    .lt('updated_at', threeMinutesAgo);
  
  if (stuckCreatives && stuckCreatives.length > 0) {
    const creativeIds = stuckCreatives.map(c => c.id);
    await db
      .from('content_studio_creatives')
      .update({ 
        status: 'failed',
        updated_at: new Date().toISOString()
      })
      .in('id', creativeIds);
    
    await logError({
      errorMessage: `Marked ${creativeIds.length} stuck generations as failed after 3 minutes`,
      errorType: 'ai_call',
      module: 'prostudio',
      componentName: 'contentStudioService',
      callLocation: 'markStuckGenerationsAsFailed',
      pipelineStep: 'cleanup',
      context: { briefId, creativeIds }
    });
  }

  // Also check if the brief itself is stuck
  await db
    .from('content_studio_briefs')
    .update({ status: 'failed', updated_at: new Date().toISOString() })
    .eq('id', briefId)
    .eq('status', 'generating')
    .lt('updated_at', threeMinutesAgo);
}

// ─── Platform management ──────────────────────────────────

export async function getActivePlatforms() {
  const { data, error } = await db
    .from('content_platforms')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  return data;
}

// ─── Brief management ─────────────────────────────────────

export async function getBriefs(brandId: string) {
  const { data, error } = await db
    .from('content_studio_briefs')
    .select(`
      *,
      content_studio_creatives (id, status, platform_id)
    `)
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getBriefWithCreatives(briefId: string) {
  // Clean up stuck generations before fetching
  await markStuckGenerationsAsFailed(briefId);
  
  const { data, error } = await db
    .from('content_studio_briefs')
    .select(`
      *,
      content_studio_creatives (
        *,
        content_platforms (*)
      )
    `)
    .eq('id', briefId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createBrief(brandId: string, userId: string, brief: {
  name: string;
  brief?: string;
  campaign_goal?: string;
  is_series?: boolean;
  series_interval?: string;
  selected_platform_ids: string[];
  // AI Workspace Configuration
  visual_direction?: string;
  visual_assets?: string[];
  layout_complexity?: string;
  creative_mode?: string;
  ai_freedom?: number;
  image_density?: number;
}) {
  const nextGenAt = brief.is_series
    ? calculateNextGenerationTime(brief.series_interval || 'weekly')
    : null;

  // Build generation settings with defaults
  const generationSettings = buildGenerationSettings({
    visual_direction: brief.visual_direction,
    visual_assets: brief.visual_assets,
    layout_complexity: brief.layout_complexity,
    creative_mode: brief.creative_mode,
    ai_freedom: brief.ai_freedom,
    image_density: brief.image_density,
  });

  // Calculate estimated credits
  const { estimatedCredits } = calculateGenerationCredits({
    platformCount: brief.selected_platform_ids.length,
    visualGenerationEnabled: true,
    complexityLevel: generationSettings.layout_complexity,
    creativeMode: generationSettings.creative_mode,
    aiFreedom: generationSettings.ai_freedom,
    visualAssets: generationSettings.visual_assets,
    variationCount: 1,
  });

  const { data, error } = await db
    .from('content_studio_briefs')
    .insert({
      brand_id: brandId,
      user_id: userId,
      name: brief.name,
      brief: brief.brief,
      campaign_goal: brief.campaign_goal,
      is_series: brief.is_series,
      series_interval: brief.series_interval,
      selected_platform_ids: brief.selected_platform_ids,
      // AI Workspace Configuration
      visual_direction: generationSettings.visual_direction,
      visual_assets: generationSettings.visual_assets,
      layout_complexity: generationSettings.layout_complexity,
      creative_mode: generationSettings.creative_mode,
      ai_freedom: generationSettings.ai_freedom,
      image_density: generationSettings.image_density,
      generation_settings: generationSettings,
      estimated_credits: estimatedCredits,
      actual_credits_used: null, // Will be updated after generation
      series_active: brief.is_series || false,
      next_generation_at: nextGenAt,
      status: 'draft'
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

// ─── Credit Calculation Utility ─────────────────────────

export interface CreditBreakdown {
  baseCredits: number;
  complexityMultiplier: number;
  aiVisualsMultiplier: number;
  svgCost: number;
  experimentalMultiplier: number;
  aiFreedomMultiplier: number;
  totalCredits: number;
}

export interface CreditCalculationInput {
  platformCount: number;
  visualGenerationEnabled: boolean;
  complexityLevel: string;
  creativeMode: string;
  aiFreedom: number;
  visualAssets: string[];
  variationCount?: number;
}

export function calculateGenerationCredits(input: CreditCalculationInput): {
  estimatedCredits: number;
  breakdown: CreditBreakdown;
} {
  const {
    platformCount,
    complexityLevel,
    creativeMode,
    aiFreedom,
    visualAssets,
    variationCount = 1,
  } = input;

  // Base credits: 1 per platform
  let baseCredits = platformCount * variationCount;
  let totalCredits = baseCredits;

  // Complexity multiplier
  const complexityMultipliers: Record<string, number> = {
    simple: 0.75,
    balanced: 1,
    advanced: 1.5,
    experimental: 2,
  };
  const complexityMultiplier = complexityMultipliers[complexityLevel] || 1;
  totalCredits *= complexityMultiplier;

  // AI visuals multiplier
  const aiVisualsMultiplier = visualAssets.includes('ai_generated') ? 1.5 : 1;
  totalCredits *= aiVisualsMultiplier;

  // SVG generation cost
  const svgCost = visualAssets.includes('svg_graphics') ? platformCount * 0.5 * variationCount : 0;
  totalCredits += svgCost;

  // Experimental mode multiplier
  const experimentalMultiplier = creativeMode === 'experimental' ? 1.3 : 1;
  totalCredits *= experimentalMultiplier;

  // AI freedom multiplier (above 70%)
  const aiFreedomMultiplier = aiFreedom > 70 ? 1.2 : 1;
  totalCredits *= aiFreedomMultiplier;

  const breakdown: CreditBreakdown = {
    baseCredits,
    complexityMultiplier,
    aiVisualsMultiplier,
    svgCost,
    experimentalMultiplier,
    aiFreedomMultiplier,
    totalCredits: Math.ceil(totalCredits),
  };

  return {
    estimatedCredits: Math.ceil(totalCredits),
    breakdown,
  };
}

// ─── Visual Asset Instruction Builder ───────────────────

export function buildVisualAssetInstructions(visualAssets: string[] | null | undefined): string {
  if (!visualAssets || visualAssets.length === 0) {
    return 'Use brand-appropriate imagery and graphics.';
  }

  const instructions: string[] = [];
  const assetMap: Record<string, string> = {
    ai_generated: 'Generate custom AI visuals that match the brand aesthetic and campaign theme.',
    brand_images: 'Incorporate uploaded brand images where appropriate for authenticity.',
    product_photos: 'Feature product photography prominently to showcase offerings.',
    svg_graphics: 'Use editable SVG vector graphics for scalable, crisp design elements.',
    illustrations: 'Include custom illustrations to add personality and visual interest.',
    abstract_shapes: 'Use abstract geometric shapes and patterns as design accents.',
  };

  for (const asset of visualAssets) {
    if (assetMap[asset]) {
      instructions.push(assetMap[asset]);
    }
  }

  return instructions.join(' ') || 'Use brand-appropriate imagery and graphics.';
}

// ─── Generation Settings Builder ────────────────────────

export interface GenerationSettings {
  visual_direction: string;
  visual_assets: string[];
  layout_complexity: string;
  creative_mode: string;
  ai_freedom: number;
  image_density: number;
}

export function buildGenerationSettings(
  brief: Partial<GenerationSettings>
): GenerationSettings {
  return {
    visual_direction: brief.visual_direction || 'balanced',
    visual_assets: brief.visual_assets || ['product_photos', 'brand_images'],
    layout_complexity: brief.layout_complexity || 'balanced',
    creative_mode: brief.creative_mode || 'on_brand',
    ai_freedom: brief.ai_freedom ?? 50,
    image_density: brief.image_density ?? 50,
  };
}

export async function prefillBriefFromBrand(brandId: string) {
  const { data: dna } = await db
    .from('brand_dna')
    .select('target_audience, core_promise, brand_voice, campaign_strategy')
    .eq('brand_id', brandId)
    .single();

  const { data: brand } = await db
    .from('brands')
    .select('name, journey_stage')
    .eq('id', brandId)
    .single();

  const { data: stageData } = await db
    .from('brand_stage_data')
    .select('field_key, value')
    .eq('brand_id', brandId);

  const stageMap = Object.fromEntries((stageData || []).map(s => [s.field_key, s.value]));

  return {
    name: `${brand?.name || 'My Brand'} — Content`,
    campaign_goal: dna?.campaign_strategy || stageMap['campaign_strategy'] || '',
    brief: ''
  };
}

// ─── Content generation ───────────────────────────────────

export async function generateContentForBrief(
  briefId: string,
  onPlatformComplete?: (platformId: string, creative: any) => void
) {
  try {
    // Fetch brief with brand context
    const { data: brief } = await db
      .from('content_studio_briefs')
      .select(`*, brands(*, brand_dna(*))`)
      .eq('id', briefId)
      .single();

    if (!brief) throw new Error('Brief not found');

    // Get selected platforms
    const { data: platforms } = await db
      .from('content_platforms')
      .select('*')
      .in('id', brief.selected_platform_ids || [])
      .order('sort_order');

    if (!platforms || platforms.length === 0) throw new Error('No platforms selected');

    // Update brief status
    await db
      .from('content_studio_briefs')
      .update({ status: 'generating' })
      .eq('id', briefId);

    const brand = brief.brands;
    const dna = brand?.brand_dna?.[0];

    // ─── Founder intelligence: cumulative, structured, anti-repetition aware ──
    // Replaces ad-hoc raw memory blobs (mentorContext, capturedContext) with a
    // synthesized intelligence layer prioritized per module.
    const [intelligence, visualIntelligence] = await Promise.all([
      buildFounderIntelligenceContext(brand.id, 'campaign_generation'),
      buildFounderIntelligenceContext(brand.id, 'visual_generation'),
    ]);

    const visualMemorySummary = summarizeCreativeMemoryForVisuals(visualIntelligence);

    // Generate session ID
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    const sessionId = `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;

    // Generate copy for all platforms in one AI call
    // Build explicit platform context so the AI uses the correct slug as JSON key
    const platformDescriptions = platforms.map(p =>
      `Platform slug (use as JSON key): "${p.slug}"\n` +
      `  Platform name: ${p.name}\n` +
      `  Character limit: ${p.character_limit || 'unlimited'}\n` +
      `  Guidelines: ${p.copy_guidelines || ''}`
    ).join('\n\n');

    const platformKeys = platforms.map(p =>
      `"${p.slug}": { "headline": "...", "copy_text": "...", "subject_line": "...", "hashtags": [] }`
    ).join(',\n');

    // Fetch campaign_copy system prompt from DB
    const copySystemPrompt = await getSystemPrompt('campaign_copy');
    if (!copySystemPrompt) {
      throw new Error(
        'campaign_copy system prompt not found in database. Please configure it in Admin → Knowledge Base.'
      );
    }

    // Build generation settings with safe defaults
    const generationSettings = buildGenerationSettings({
      visual_direction: brief.visual_direction,
      visual_assets: brief.visual_assets,
      layout_complexity: brief.layout_complexity,
      creative_mode: brief.creative_mode,
      ai_freedom: brief.ai_freedom,
      image_density: brief.image_density,
    });

    // Build visual asset instructions for copy generation context
    const visualAssetInstructions = buildVisualAssetInstructions(generationSettings.visual_assets);

    const copyPrompt = injectPromptVariables(copySystemPrompt, {
      brand_name: brand.name,
      brand_voice: dna?.brand_voice || '',
      core_promise: dna?.core_promise || '',
      target_audience: dna?.target_audience || '',
      positioning_statement: dna?.positioning_statement || '',
      campaign_goal: brief.campaign_goal || 'Build awareness',
      brief: brief.brief || 'Create engaging brand content',
      founder_intelligence_context: intelligence.promptContext,
      mentor_memory: intelligence.promptContext,
      captured_stage_data: intelligence.promptContext,
      platform_list: platformDescriptions,
      platform_keys: platformKeys,
      // New AI Workspace Configuration variables
      visual_direction: generationSettings.visual_direction,
      layout_complexity: generationSettings.layout_complexity,
      creative_mode: generationSettings.creative_mode,
      ai_freedom: generationSettings.ai_freedom.toString(),
      image_density: generationSettings.image_density.toString(),
      visual_assets: generationSettings.visual_assets.join(', '),
      visual_asset_instructions: visualAssetInstructions,
    });

    // Append strict JSON-only instruction + slug enforcement
    const slugList = platforms.map(p => `"${p.slug}"`).join(', ');
    const strictCopyPrompt = copyPrompt +
      '\n\nIMPORTANT: Return ONLY a valid JSON object. No explanation, ' +
      'no markdown, no code fences, no text before or after the JSON. ' +
      'Start your response with { and end with }\n' +
      'CRITICAL: Use EXACTLY these JSON keys (platform slugs): ' + slugList + '. ' +
      'Do not use platform display names as keys. Use the slug values above.';

    const copyResult = await withTimeout(
      callAI({
        taskType: 'campaign_copy',
        messages: [{ role: 'user', content: strictCopyPrompt }],
        maxTokens: 4000
      })
    );

    console.log('[ContentStudio] === Copy Generation Step ===');
    console.log('[ContentStudio] FULL PROMPT SENT TO AI (campaign_copy):');
    console.log('--- PROMPT START ---');
    console.log(strictCopyPrompt);
    console.log('--- PROMPT END ---');
    console.log('[ContentStudio] AI response received:', copyResult.success ? 'SUCCESS' : 'FAILED');
    if (copyResult.text) {
      console.log('[ContentStudio] Copy result:', copyResult.text);
    }

    if (!copyResult.success || !copyResult.text) {
      await db
        .from('content_studio_briefs')
        .update({ status: 'failed' })
        .eq('id', briefId);
      throw new Error('Copy generation failed');
    }

    const rawText = copyResult.text || '';

    // Try multiple extraction strategies to parse JSON reliably
    let copyData: Record<string, any> = {};
    let parsed = false;

    // Strategy 1: find JSON object between first { and last }
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        copyData = JSON.parse(jsonMatch[0]);
        parsed = true;
      } catch (e: any) {
        // Strategy 1 failed
      }
    }

    // Strategy 2: strip markdown fences and retry
    if (!parsed) {
      try {
        const clean = rawText
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/\s*```$/i, '')
          .trim();
        copyData = JSON.parse(clean);
        parsed = true;
      } catch (e: any) {
        // Strategy 2 failed
      }
    }

    // Strategy 3: find JSON after any preamble text
    if (!parsed) {
      const lines = rawText.split('\n');
      const jsonStart = lines.findIndex(l => l.trim().startsWith('{'));
      if (jsonStart >= 0) {
        try {
          const jsonOnly = lines.slice(jsonStart).join('\n');
          copyData = JSON.parse(jsonOnly);
          parsed = true;
        } catch (e: any) {
          // Strategy 3 failed
        }
      }
    }

    // Fallback: use empty copy so visual generation still runs
    if (!parsed) {
      copyData = {};
      platforms.forEach((p: any) => {
        copyData[p.slug] = {
          headline: brief.name || '',
          copy_text: brief.brief || '',
          hashtags: [],
          subject_line: '',
        };
      });
    }

    // Fetch primary product image once, shared across all platform creatives
    const productImages = await getBrandProductImages(brand.id);
    const primaryImage = productImages?.find((img: any) => img.is_primary);
    const productImageUrl = primaryImage?.file_url || '';

    console.log('[ContentStudio] Copy parsed successfully, platforms:', Object.keys(copyData).join(', '));

    // Fuzzy matcher for AI-returned copy keys (handles slug vs name mismatches)
    function findCopyForPlatform(
      data: Record<string, any>,
      platform: any
    ): Record<string, any> {
      console.log('[findCopyForPlatform]', {
        platformSlug: platform.slug,
        platformName: platform.name,
        availableKeys: Object.keys(data),
        exactMatch: !!data[platform.slug]
      });

      // Exact slug match
      if (data[platform.slug]) {
        console.log('[findCopyForPlatform] Found exact slug match:', platform.slug);
        return data[platform.slug];
      }

      // Platform name as lowercase_underscored
      const nameLower = platform.name?.toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/\//g, '_');
      if (nameLower && data[nameLower]) {
        console.log('[findCopyForPlatform] Found name match:', nameLower);
        return data[nameLower];
      }

      // Partial match — base word from slug
      const slugBase = platform.slug.split('_')[0]; // 'instagram' from 'instagram_post'
      const partialMatch = Object.keys(data).find(key =>
        key.includes(slugBase) || slugBase.includes(key)
      );
      if (partialMatch) {
        console.log('[findCopyForPlatform] Found partial match:', partialMatch);
        return data[partialMatch];
      }

      // Name word match
      const nameWords = (platform.name?.toLowerCase() || '').split(/\s+/);
      const nameMatch = Object.keys(data).find(key =>
        nameWords.some((word: string) => key.includes(word))
      );
      if (nameMatch) {
        console.log('[findCopyForPlatform] Found name word match:', nameMatch);
        return data[nameMatch];
      }

      console.log('[findCopyForPlatform] No match found, returning empty object');
      return {};
    }

    // Now generate visuals for each platform in parallel
    const creatives: any[] = [];

    await Promise.all(platforms.map(async (platform) => {
      const platformCopy = findCopyForPlatform(copyData, platform);

      // Find suitable ProStudio template for this platform
      const { data: templates } = await db
        .from('prostudio_templates')
        .select('id, name, generation_prompt, template_type')
        .eq('status', 'published')
        .limit(20);

      // Ask AI to select best template or generate from scratch
      let visualHtml = null;
      let selectedTemplateId = null;

      const templateOptions = (templates || [])
        .map((t: any) => `ID: ${t.id} | Name: ${t.name} | Prompt: ${t.generation_prompt?.slice(0, 100)}`)
        .join('\n');

      const visualSystemPrompt = await getSystemPrompt('template_generation');
      if (!visualSystemPrompt) {
        throw new Error(
          'template_generation system prompt not found in database. Please configure it in Admin → Knowledge Base.'
        );
      }

      // ── Platform intelligence: DB-driven design system ──
      const platformSystem = buildPlatformDesignSystem(platform);
      const platformInstructions = buildPlatformRenderInstructions(platformSystem);

      // Build visual generation prompt with AI workspace configuration
      const visualAssetInstructions = buildVisualAssetInstructions(generationSettings.visual_assets);

      const visualPrompt = injectPromptVariables(visualSystemPrompt, {
        generation_prompt: `Platform: ${platform.name}\n\n${platformInstructions}\n\nCampaign: ${brief.brief || brief.campaign_goal || brand.name}\nHeadline to feature: "${platformCopy.headline || ''}"\nCopy snippet: "${(platformCopy.copy_text || '').slice(0, 80)}"`,
        aspectRatio: platform.aspect_ratio || '1:1',
        styleIntensity: generationSettings.visual_direction === 'bold' ? 'bold' : 'balanced',
        variant_index: '1',
        variant_count: '1',
        brand_voice: dna?.brand_voice || '',
        core_promise: dna?.core_promise || '',
        target_audience: dna?.target_audience || '',
        positioning_statement: dna?.positioning_statement || '',
        primary_color: brand.primary_color || '#000000',
        secondary_color: brand.secondary_color || '#ffffff',
        product_image_url: productImageUrl,
        design_brief: `${platform.name} content for: ${brief.brief || brief.name}`,
        platform_design_system: JSON.stringify(platformSystem, null, 2),
        platform_render_instructions: platformInstructions,
        founder_intelligence_context: visualIntelligence.promptContext,
        creative_memory: visualMemorySummary,
        mentor_memory: visualIntelligence.promptContext,
        journey_stage: brand.journey_stage || 'spark',
        captured_stage_data: visualIntelligence.promptContext,
        image_width: platformSystem.dimensions.width.toString(),
        image_height: platformSystem.dimensions.height.toString(),
        // New AI Workspace Configuration variables
        visual_direction: generationSettings.visual_direction,
        layout_complexity: generationSettings.layout_complexity,
        creative_mode: generationSettings.creative_mode,
        ai_freedom: generationSettings.ai_freedom.toString(),
        image_density: generationSettings.image_density.toString(),
        visual_assets: generationSettings.visual_assets.join(', '),
        visual_asset_instructions: visualAssetInstructions,
      });

      const visualResult = await withTimeout(
        callAI({
          taskType: 'template_generation',
          messages: [{ role: 'user', content: visualPrompt }],
          maxTokens: 8000
        })
      );

      console.log('[ContentStudio] === Visual Generation Step ===');
      console.log('[ContentStudio] Platform:', platform.name);
      console.log('[ContentStudio] Task type used: template_generation');
      console.log('[ContentStudio] Model used:', visualResult.modelUsed);
      console.log('[ContentStudio] Provider used:', visualResult.providerUsed);
      console.log('[ContentStudio] FULL PROMPT SENT TO AI (template_generation):');
      console.log('--- PROMPT START ---');
      console.log(visualPrompt);
      console.log('--- PROMPT END ---');
      console.log('[ContentStudio] AI response received:', visualResult.success ? 'SUCCESS' : 'FAILED');
      if (visualResult.text) {
        console.log('[ContentStudio] Visual result length:', visualResult.text.length);
      }

      if (visualResult.success && visualResult.text) {
        visualHtml = visualResult.text.replace(/^```(?:html)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
      }

      // Prepare creative payload
      const creativePayload = {
        brief_id: briefId,
        platform_id: platform.id,
        generation_session_id: sessionId,
        headline: platformCopy.headline || null,
        copy_text: platformCopy.copy_text || null,
        subject_line: platformCopy.subject_line || null,
        hashtags: platformCopy.hashtags || [],
        visual_html: visualHtml,
        template_id: selectedTemplateId,
        status: visualHtml ? 'ready' : 'failed',
        updated_at: new Date().toISOString()
      };

      console.log('[creative payload]', {
        platformId: platform.id,
        platformSlug: platform.slug,
        headline: creativePayload.headline,
        copyTextLength: creativePayload.copy_text?.length,
        hashtagsCount: creativePayload.hashtags?.length,
        subjectLine: creativePayload.subject_line
      });

      // Upsert creative row - prevents duplicates per generation session
      const conflictColumns = sessionId 
        ? 'generation_session_id,platform_id' 
        : 'brief_id,platform_id';

      console.log('[creative upsert]', {
        generationSessionId: sessionId,
        platformId: platform.id,
        conflictColumns,
        status: creativePayload.status
      });

      const { data: creative, error } = await db
        .from('content_studio_creatives')
        .upsert(creativePayload, {
          onConflict: conflictColumns
        })
        .select('*, content_platforms(*)')
        .single();

      if (error) {
        console.error('[creative upsert failed]', {
          error: error.message,
          generationSessionId: sessionId,
          platformId: platform.id
        });

        await logError({
          errorMessage: error.message,
          errorType: 'ai_call',
          module: 'prostudio',
          componentName: 'contentStudioService'
        });

        // Ensure this specific creative is marked failed
        await db
          .from('content_studio_creatives')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('brief_id', briefId)
          .eq('platform_id', platform.id)
          .eq('status', 'generating');
      } else {
        console.log('[creative upsert success]', {
          creativeId: creative?.id,
          platformId: platform.id,
          status: creative?.status
        });
        creatives.push(creative);
        onPlatformComplete?.(platform.id, creative);
      }
    }));

    // Calculate brief status based on creatives (partial-success resilience)
    const readyCount = creatives.filter(c => c.status === 'ready').length;
    const failedCount = creatives.filter(c => c.status === 'failed').length;
    const totalPlatforms = platforms.length;

    let briefStatus: string;
    if (readyCount === totalPlatforms) {
      briefStatus = 'ready';
    } else if (readyCount === 0) {
      briefStatus = 'failed';
    } else {
      briefStatus = 'partial_failed'; // Some succeeded, some failed
    }

    // Update brief status and last generated time
    await db
      .from('content_studio_briefs')
      .update({
        status: briefStatus,
        last_generated_at: new Date().toISOString(),
        next_generation_at: brief.is_series
          ? calculateNextGenerationTime(brief.series_interval || 'weekly')
          : null
      })
      .eq('id', briefId);

    console.log('[ContentStudio] === Generation Complete ===');
    console.log('[ContentStudio] Brief status:', briefStatus);
    console.log('[ContentStudio] Platforms ready:', readyCount, '/', totalPlatforms);
    console.log('[ContentStudio] Platforms failed:', failedCount, '/', totalPlatforms);

    // Create notification
    await createNotification(
      brief.user_id,
      brief.brand_id,
      'campaign_generated',
      'Content ready for review',
      `Your ${platforms.length} platform creatives for "${brief.name}" are ready to review and approve.`,
      `/content-studio/${briefId}` 
    );

    return creatives;
  } catch (error: any) {
    // Update brief status to failed on error
    await db
      .from('content_studio_briefs')
      .update({ status: 'failed' })
      .eq('id', briefId);
    
    // Check for rate limit
    const isRateLimit =
      error.message?.includes('429') ||
      error.message?.includes('rate limit') ||
      error.message?.includes('quota') ||
      error.status === 429;

    if (isRateLimit) {
      await logError({
        errorMessage: 'AI rate limit hit during generation',
        errorType: 'ai_call',
        module: 'prostudio',
        componentName: 'contentStudioService',
        callLocation: 'generateContentForBrief',
        pipelineStep: 'rate_limit',
        context: { briefId }
      });
      // Update brief with failed status so UI knows to stop polling
      await db
        .from('content_studio_briefs')
        .update({ status: 'failed' })
        .eq('id', briefId);
    } else if (error.message === 'GENERATION_TIMEOUT') {
      await logError({
        errorMessage: 'Generation timed out after 60 seconds',
        errorType: 'ai_call',
        module: 'prostudio',
        componentName: 'contentStudioService',
        callLocation: 'generateContentForBrief',
        pipelineStep: 'timeout'
      });
    } else {
      await logError({
        errorMessage: error.message || 'Generation failed',
        errorType: 'ai_call',
        module: 'prostudio',
        componentName: 'contentStudioService',
        callLocation: 'generateContentForBrief',
        pipelineStep: 'ai_generation',
        context: { briefId }
      });
    }
    throw error;
  }
}

// ─── Notifications ────────────────────────────────────────

export async function createNotification(
  userId: string,
  brandId: string,
  type: string,
  title: string,
  body: string,
  actionUrl?: string,
  relatedId?: string
) {
  const { error } = await db
    .from('notifications')
    .insert({
      user_id: userId,
      brand_id: brandId,
      type,
      title,
      body,
      action_url: actionUrl || null,
      related_id: relatedId || null
    });
  if (error) { /* notification creation failed */ }
}

export async function getNotifications(userId: string, unreadOnly = false) {
  let query = db
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (unreadOnly) query = query.eq('is_read', false);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function markNotificationRead(notificationId: string) {
  await db
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);
}

export async function markAllNotificationsRead(userId: string) {
  await db
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);
}

export async function getUnreadCount(userId: string): Promise<number> {
  const { count } = await db
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  return count || 0;
}

// ─── Approve and schedule ─────────────────────────────────

export async function approveCreativeToCalendar(
  creativeId: string,
  scheduledAt: string
) {
  // Get creative with platform and brief info
  const { data: creative } = await db
    .from('content_studio_creatives')
    .select('*, content_studio_briefs(brand_id, user_id, name), content_platforms(*)')
    .eq('id', creativeId)
    .single();

  if (!creative) throw new Error('Creative not found');

  // Insert into calendar_posts
  const { data: calendarPost, error } = await db
    .from('calendar_posts')
    .insert({
      brand_id: creative.content_studio_briefs.brand_id,
      platform: creative.content_platforms.slug,
      content: creative.copy_text,
      scheduled_date: scheduledAt,
      status: 'scheduled',
      visual_html: creative.visual_html
    })
    .select('id')
    .single();

  if (error) throw error;

  // Update creative with approval and calendar link
  await db
    .from('content_studio_creatives')
    .update({
      is_approved: true,
      scheduled_at: scheduledAt,
      calendar_post_id: calendarPost.id,
      status: 'scheduled'
    })
    .eq('id', creativeId);

  return calendarPost.id;
}

export async function regenerateCreative(
  creativeId: string,
  brandId: string
) {
  try {
    // Fetch the creative with full context
    const { data: creative } = await db
      .from('content_studio_creatives')
      .select('*, content_platforms(*), content_studio_briefs(*, brands(*, brand_dna(*)))')
      .eq('id', creativeId)
      .single();

    if (!creative) throw new Error('Creative not found');

    const platform = creative.content_platforms;
    const brief = creative.content_studio_briefs;
    const brand = brief.brands;
    const dna = brand?.brand_dna?.[0];

    // Mark as generating
    await db
      .from('content_studio_creatives')
      .update({ status: 'generating' })
      .eq('id', creativeId);

    // ─── Founder intelligence for regeneration ──
    // Visual-module context gives the AI awareness of prior creative outputs,
    // recurring patterns, typography, color directions, and anti-repetition rules.
    const visualIntelligence = await buildFounderIntelligenceContext(brand.id, 'visual_generation');
    const regenVisualMemory = summarizeCreativeMemoryForVisuals(visualIntelligence);

    // Fetch primary product image
    const productImages = await getBrandProductImages(brand.id);
    const primaryImage = productImages?.find(img => img.is_primary);
    const productImageUrl = primaryImage?.file_url || '';

    // Generate new session ID for this regeneration
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    const sessionId = `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;

    // Get the same system prompt used in initial generation — no fallback allowed
    const visualSystemPrompt = await getSystemPrompt('template_generation');
    if (!visualSystemPrompt) {
      throw new Error(
        'template_generation system prompt not found in database. Please configure it in Admin → Knowledge Base.'
      );
    }

    // Build the copy context from the existing creative
    const copyContext = creative.headline || creative.copy_text
      ? `\n\nEXISTING COPY TO MATCH:\nHeadline: ${creative.headline || ''}\nCopy: ${creative.copy_text || ''}\nHashtags: ${(creative.hashtags || []).join(', ')}\nSubject line: ${creative.subject_line || ''}`
      : '';

    // ── Platform intelligence: DB-driven design system for regeneration ──
    const regenPlatformSystem = buildPlatformDesignSystem(platform);
    const regenPlatformInstructions = buildPlatformRenderInstructions(regenPlatformSystem);

    // Inject all the same variables as initial generation — powered by founder + platform intelligence
    const visualPrompt = injectPromptVariables(visualSystemPrompt, {
      generation_prompt: `Platform: ${platform.name}\n\n${regenPlatformInstructions}\n\nThis is a REGENERATION — create a fresh layout variation that stays on-brand and matches the existing copy below. Vary the composition but maintain brand identity.\nHeadline to feature: "${creative.headline || ''}"\nCopy snippet: "${(creative.copy_text || '').slice(0, 80)}"`,
      aspectRatio: platform.aspect_ratio || '1:1',
      styleIntensity: brief.visual_direction === 'bold' ? 'bold' : 'balanced',
      variant_index: '1',
      variant_count: '1',
      brand_voice: dna?.brand_voice || '',
      core_promise: dna?.core_promise || '',
      target_audience: dna?.target_audience || '',
      positioning_statement: dna?.positioning_statement || '',
      primary_color: brand.primary_color || '#000000',
      secondary_color: brand.secondary_color || '#ffffff',
      product_image_url: productImageUrl,
      design_brief: `${platform.name} content for: ${brief.brief || brief.name}${copyContext}`,
      platform_design_system: JSON.stringify(regenPlatformSystem, null, 2),
      platform_render_instructions: regenPlatformInstructions,
      founder_intelligence_context: visualIntelligence.promptContext,
      creative_memory: regenVisualMemory,
      mentor_memory: visualIntelligence.promptContext,
      journey_stage: brand.journey_stage || 'spark',
      captured_stage_data: visualIntelligence.promptContext,
      image_width: regenPlatformSystem.dimensions.width.toString(),
      image_height: regenPlatformSystem.dimensions.height.toString(),
      // AI Workspace Configuration (from brief)
      visual_direction: brief.visual_direction || 'balanced',
      layout_complexity: brief.layout_complexity || 'balanced',
      creative_mode: brief.creative_mode || 'on_brand',
      ai_freedom: (brief.ai_freedom ?? 50).toString(),
      image_density: (brief.image_density ?? 50).toString(),
      visual_assets: (brief.visual_assets || ['product_photos', 'brand_images']).join(', '),
      visual_asset_instructions: buildVisualAssetInstructions(brief.visual_assets),
    });

    const visualResult = await withTimeout(
        callAI({
          taskType: 'template_generation',
          messages: [{ role: 'user', content: visualPrompt }],
          maxTokens: 8000
        })
      );

    console.log('[ContentStudio] === Regenerate Visual Step ===');
    console.log('[ContentStudio] Platform:', platform.name);
    console.log('[ContentStudio] Creative ID:', creativeId);
    console.log('[ContentStudio] Task type used: template_generation');
    console.log('[ContentStudio] Model used:', visualResult.modelUsed);
    console.log('[ContentStudio] Provider used:', visualResult.providerUsed);
    console.log('[ContentStudio] FULL PROMPT SENT TO AI (regenerate):');
    console.log('--- PROMPT START ---');
    console.log(visualPrompt);
    console.log('--- PROMPT END ---');
    console.log('[ContentStudio] AI response received:', visualResult.success ? 'SUCCESS' : 'FAILED');
    if (visualResult.text) {
      console.log('[ContentStudio] Visual result length:', visualResult.text.length);
    }

    const visualHtml = visualResult.success && visualResult.text
      ? visualResult.text.replace(/^```(?:html)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
      : creative.visual_html;

    console.log('[creative regenerate update]', {
      creativeId,
      newSessionId: sessionId,
      status: 'ready',
      hasVisualHtml: !!visualHtml
    });

    const { error: regenUpdateError } = await db
      .from('content_studio_creatives')
      .update({
        visual_html: visualHtml,
        status: 'ready',
        generation_session_id: sessionId,
        updated_at: new Date().toISOString()
      })
      .eq('id', creativeId);

    if (regenUpdateError) {
      console.error('[creative regenerate update failed]', {
        creativeId,
        error: regenUpdateError.message
      });
    } else {
      console.log('[creative regenerate update success]', {
        creativeId,
        status: 'ready'
      });
    }

    return visualHtml;
  } catch (error: any) {
    // Update creative status to failed on error
    await db
      .from('content_studio_creatives')
      .update({ 
        status: 'failed',
        updated_at: new Date().toISOString()
      })
      .eq('id', creativeId);
    
    // Handle timeout specifically
    if (error.message === 'GENERATION_TIMEOUT') {
      await logError({
        errorMessage: 'Regeneration timed out after 60 seconds',
        errorType: 'ai_call',
        module: 'prostudio',
        componentName: 'contentStudioService',
        callLocation: 'regenerateCreative',
        pipelineStep: 'timeout',
        context: { creativeId, brandId }
      });
    } else {
      await logError({
        errorMessage: error.message || 'Regeneration failed',
        errorType: 'ai_call',
        module: 'prostudio',
        componentName: 'contentStudioService',
        callLocation: 'regenerateCreative',
        userAction: 'regenerate_creative',
        pipelineStep: 'ai_generation',
        context: { creativeId, brandId }
      });
    }
    throw error;
  }
}

/**
 * Retry only failed creatives for a brief (partial-success resilience)
 * Preserves successful outputs and only regenerates failed platforms
 */
export async function retryFailedCreatives(
  briefId: string,
  onPlatformComplete?: (platformId: string, creative: any) => void
): Promise<void> {
  try {
    // Fetch brief with brand and DNA
    const { data: brief, error: briefError } = await db
      .from('content_studio_briefs')
      .select('*, brands(*), founder_dna(*)')
      .eq('id', briefId)
      .single();

    if (briefError || !brief) {
      throw new Error('Brief not found');
    }

    const brand = brief.brands;
    const dna = brief.founder_dna;

    // Fetch only failed creatives
    const { data: failedCreatives, error: failedError } = await db
      .from('content_studio_creatives')
      .select('*, content_platforms(*)')
      .eq('brief_id', briefId)
      .eq('status', 'failed');

    if (failedError || !failedCreatives || failedCreatives.length === 0) {
      console.log('[ContentStudio] No failed creatives to retry');
      return;
    }

    console.log('[ContentStudio] === Retrying Failed Creatives ===');
    console.log('[ContentStudio] Failed creatives count:', failedCreatives.length);

    // Generate session ID for this retry batch
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    const sessionId = `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;

    // Build intelligence context
    const intelligence = await buildFounderIntelligenceContext(brand.id);
    const visualIntelligence = await buildFounderIntelligenceContext(brand.id);
    const visualMemorySummary = summarizeCreativeMemoryForVisuals(visualIntelligence);

    // Fetch primary product image
    const productImages = await getBrandProductImages(brand.id);
    const primaryImage = productImages?.find((img: any) => img.is_primary);
    const productImageUrl = primaryImage?.file_url || '';

    // Fetch visual system prompt
    const visualSystemPrompt = await getSystemPrompt('template_generation');
    if (!visualSystemPrompt) {
      throw new Error('template_generation system prompt not found');
    }

    // Retry each failed creative in parallel
    await Promise.all(failedCreatives.map(async (creative) => {
      const platform = creative.content_platforms;

      // Mark as retrying
      await db
        .from('content_studio_creatives')
        .update({ status: 'retrying', updated_at: new Date().toISOString() })
        .eq('id', creative.id);

      // Build platform intelligence
      const platformSystem = buildPlatformDesignSystem(platform);
      const platformInstructions = buildPlatformRenderInstructions(platformSystem);

      const visualPrompt = injectPromptVariables(visualSystemPrompt, {
        generation_prompt: `Platform: ${platform.name}\n\n${platformInstructions}\n\nRETRY GENERATION — create a fresh layout variation that stays on-brand and matches the existing copy below.\nHeadline to feature: "${creative.headline || ''}"\nCopy snippet: "${(creative.copy_text || '').slice(0, 80)}"`,
        aspectRatio: platform.aspect_ratio || '1:1',
        styleIntensity: brief.visual_direction === 'bold' ? 'bold' : 'balanced',
        variant_index: '1',
        variant_count: '1',
        brand_voice: dna?.brand_voice || '',
        core_promise: dna?.core_promise || '',
        target_audience: dna?.target_audience || '',
        positioning_statement: dna?.positioning_statement || '',
        primary_color: brand.primary_color || '#000000',
        secondary_color: brand.secondary_color || '#ffffff',
        product_image_url: productImageUrl,
        design_brief: `${platform.name} content for: ${brief.brief || brief.name}`,
        platform_design_system: JSON.stringify(platformSystem, null, 2),
        platform_render_instructions: platformInstructions,
        founder_intelligence_context: visualIntelligence.promptContext,
        creative_memory: visualMemorySummary,
        mentor_memory: visualIntelligence.promptContext,
        journey_stage: brand.journey_stage || 'spark',
        captured_stage_data: visualIntelligence.promptContext,
        image_width: platformSystem.dimensions.width.toString(),
        image_height: platformSystem.dimensions.height.toString(),
        // AI Workspace Configuration (from brief)
        visual_direction: brief.visual_direction || 'balanced',
        layout_complexity: brief.layout_complexity || 'balanced',
        creative_mode: brief.creative_mode || 'on_brand',
        ai_freedom: (brief.ai_freedom ?? 50).toString(),
        image_density: (brief.image_density ?? 50).toString(),
        visual_assets: (brief.visual_assets || ['product_photos', 'brand_images']).join(', '),
        visual_asset_instructions: buildVisualAssetInstructions(brief.visual_assets),
      });

      const visualResult = await withTimeout(
        callAI({
          taskType: 'template_generation',
          messages: [{ role: 'user', content: visualPrompt }],
          maxTokens: 8000
        })
      );

      console.log('[ContentStudio] === Retry Visual Generation Step ===');
      console.log('[ContentStudio] Platform:', platform.name);
      console.log('[ContentStudio] Creative ID:', creative.id);
      console.log('[ContentStudio] Task type used: template_generation');
      console.log('[ContentStudio] Model used:', visualResult.modelUsed);
      console.log('[ContentStudio] Provider used:', visualResult.providerUsed);
      console.log('[ContentStudio] FULL PROMPT SENT TO AI (retry):');
      console.log('--- PROMPT START ---');
      console.log(visualPrompt);
      console.log('--- PROMPT END ---');
      console.log('[ContentStudio] AI response received:', visualResult.success ? 'SUCCESS' : 'FAILED');
      if (visualResult.text) {
        console.log('[ContentStudio] Visual result length:', visualResult.text.length);
      }

      const visualHtml = visualResult.success && visualResult.text
        ? visualResult.text.replace(/^```(?:html)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
        : null;

      // Update the creative with new result
      console.log('[creative retry update]', {
        creativeId: creative.id,
        platformId: platform.id,
        newSessionId: sessionId,
        status: visualHtml ? 'ready' : 'failed'
      });

      const { error: retryUpdateError } = await db
        .from('content_studio_creatives')
        .update({
          visual_html: visualHtml,
          status: visualHtml ? 'ready' : 'failed',
          generation_session_id: sessionId,
          updated_at: new Date().toISOString()
        })
        .eq('id', creative.id);

      if (retryUpdateError) {
        console.error('[creative retry update failed]', {
          creativeId: creative.id,
          error: retryUpdateError.message
        });
      } else {
        console.log('[creative retry update success]', {
          creativeId: creative.id,
          platformId: platform.id,
          status: visualHtml ? 'ready' : 'failed'
        });
      }

      if (visualHtml) {
        onPlatformComplete?.(platform.id, creative);
      }
    }));

    // Recalculate brief status after retry
    const { data: allCreatives } = await db
      .from('content_studio_creatives')
      .select('status')
      .eq('brief_id', briefId);

    if (allCreatives) {
      const readyCount = allCreatives.filter(c => c.status === 'ready').length;
      const failedCount = allCreatives.filter(c => c.status === 'failed').length;
      const total = allCreatives.length;

      let briefStatus: string;
      if (readyCount === total) {
        briefStatus = 'ready';
      } else if (readyCount === 0) {
        briefStatus = 'failed';
      } else {
        briefStatus = 'partial_failed';
      }

      await db
        .from('content_studio_briefs')
        .update({ status: briefStatus })
        .eq('id', briefId);

      console.log('[ContentStudio] === Retry Complete ===');
      console.log('[ContentStudio] Brief status:', briefStatus);
      console.log('[ContentStudio] Platforms ready:', readyCount, '/', total);
      console.log('[ContentStudio] Platforms failed:', failedCount, '/', total);
    }
  } catch (error: any) {
    await logError({
      errorMessage: error.message || 'Retry failed creatives failed',
      errorType: 'ai_call',
      module: 'prostudio',
      componentName: 'contentStudioService',
      callLocation: 'retryFailedCreatives',
      userAction: 'retry_failed',
      pipelineStep: 'ai_generation',
      context: { briefId }
    });
    throw error;
  }
}

// ─── Save creative to Library (render HTML to PNG upload) ─────────────

/**
 * Save creative to Library using the new asset service.
 * This renders HTML to image/PDF, uploads to storage, and creates entries in
 * assets and studio_sessions tables.
 */
export async function saveCreativeToLibrary({
  creativeId,
  brandId,
  format = 'png',
  parentAssetId,
}: {
  creativeId: string;
  brandId: string;
  format?: SaveFormat;
  parentAssetId?: string;
}): Promise<{ publicUrl: string; asset?: Asset }> {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return null;
      throw new Error('Not authenticated');
    }


    // Fetch the creative with platform dimensions and brief
    const { data: creative, error: creativeError } = await db
      .from('content_studio_creatives')
      .select('*, content_platforms(*), content_studio_briefs(*)')
      .eq('id', creativeId)
      .single();

    if (creativeError) {
      return null;
      throw creativeError;
    }

    if (!creative) {
      return null;
      throw new Error('Creative not found');
    }
    if (!creative.visual_html) {
      return null;
      throw new Error('No visual HTML to save');
    }

    const platform = creative.content_platforms;
    const brief = creative.content_studio_briefs;
    const renderWidth = platform?.image_width || 600;
    const renderHeight = platform?.image_height || 600;

    // Call the new asset service to save to library
    const asset = await saveToAssetLibrary({
      brandId,
      userId: user.id,
      name: platform?.name || 'Design',
      sourceModule: 'contentstudio',
      visualHtml: creative.visual_html,
      format,
      platformWidth: renderWidth,
      platformHeight: renderHeight,
      platformSlug: platform?.slug || platform?.name?.toLowerCase().replace(/\s+/g, '-'),
      briefId: brief?.id,
      creativeId: creativeId,
      parentAssetId,
    });

    if (!asset) {
      return null;
      throw new Error('Failed to save asset - asset service returned null');
    }


    // Update the creative row to mark it as saved
    const { error: updateErr } = await db
      .from('content_studio_creatives')
      .update({
        is_saved_to_library: true,
        visual_thumbnail_url: asset.file_url,
      })
      .eq('id', creativeId);

    if (updateErr) {
      return null;
      throw updateErr;
    }


    return { publicUrl: asset.file_url, asset };
  } catch (error: any) {
    return null;
    await logError({
      errorMessage: error.message || 'Save to library failed',
      errorType: 'storage',
      module: 'prostudio',
      componentName: 'contentStudioService',
      callLocation: 'saveCreativeToLibrary',
      userAction: 'save_to_library',
      pipelineStep: 'render_and_upload',
      context: { creativeId, brandId }
    });
    throw error; // Re-throw so UI can show error
  }
}

// ─── Series scheduling helpers ────────────────────────────

// ─── Approve and Schedule functions ───────────────────────

export async function approveSingleCreative(creativeId: string): Promise<void> {
  try {
    const { error } = await db
      .from('content_studio_creatives')
      .update({
        is_approved: true,
        status: 'approved',
        updated_at: new Date().toISOString(),
      })
      .eq('id', creativeId);

    if (error) {
      throw error;
      throw error;
    }
  } catch (error: any) {
    throw error;
    await logError({
      errorMessage: error.message || 'Failed to approve creative',
      errorType: 'database',
      module: 'prostudio',
      componentName: 'contentStudioService',
      callLocation: 'approveSingleCreative',
      userAction: 'approve_creative',
      pipelineStep: 'update_database',
      context: { creativeId }
    });
    throw error;
  }
}

export interface ScheduleCreativeParams {
  creativeId: string;
  briefId: string;
  brandId: string;
  userId: string;
  platformSlug: string;
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string; // HH:MM
  copyText?: string;
  headline?: string;
  visualHtml?: string;
}

export interface CalendarPost {
  id: string;
  brand_id: string;
  user_id: string;
  platform: string;
  scheduled_date: string;
  scheduled_time: string;
  copy_text?: string;
  headline?: string;
  visual_html?: string;
  content_studio_creative_id?: string;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export async function scheduleCreative(params: ScheduleCreativeParams): Promise<CalendarPost> {
  try {
    const {
      creativeId,
      briefId,
      brandId,
      userId,
      platformSlug,
      scheduledDate,
      scheduledTime,
      copyText,
      headline,
      visualHtml,
    } = params;


    // a. Fetch platform record to confirm it exists
    const { data: platform, error: platformError } = await db
      .from('content_platforms')
      .select('*')
      .eq('slug', platformSlug)
      .single();

    if (platformError) {
      return null;
      throw new Error(`Platform '${platformSlug}' not found`);
    }

    // b. Insert into calendar_posts
    const { data: calendarPost, error: insertError } = await db
      .from('calendar_posts')
      .insert({
        brand_id: brandId,
        user_id: userId,
        platform: platformSlug,
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        copy_text: copyText,
        headline: headline,
        visual_html: visualHtml,
        content: copyText, // Duplicate for backward compatibility with calendar display
        content_studio_creative_id: creativeId,
        campaign_creative_id: null, // Deprecated, always null for new records
        status: 'scheduled',
      })
      .select()
      .single();

    if (insertError) {
      return null;
      throw insertError;
    }

    // c. Update content_studio_creatives
    const scheduledAt = `${scheduledDate} ${scheduledTime}`;
    const { error: updateError } = await db
      .from('content_studio_creatives')
      .update({
        is_approved: true,
        scheduled_at: scheduledAt,
        calendar_post_id: calendarPost.id,
        status: 'scheduled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', creativeId);

    if (updateError) {
      return null;
      throw updateError;
    }

    return calendarPost;
  } catch (error: any) {
    return null;
    await logError({
      errorMessage: error.message || 'Failed to schedule creative',
      errorType: 'database',
      module: 'prostudio',
      componentName: 'contentStudioService',
      callLocation: 'scheduleCreative',
      userAction: 'schedule_creative',
      pipelineStep: 'create_calendar_post',
      context: { params }
    });
    throw error;
  }
}

export async function approveAllCreatives(briefId: string): Promise<void> {
  try {
    const { error } = await db
      .from('content_studio_creatives')
      .update({
        is_approved: true,
        status: 'approved',
        updated_at: new Date().toISOString(),
      })
      .eq('brief_id', briefId)
      .eq('status', 'ready');

    if (error) {
      throw error;
      throw error;
    }
  } catch (error: any) {
    throw error;
    await logError({
      errorMessage: error.message || 'Failed to approve all creatives',
      errorType: 'database',
      module: 'prostudio',
      componentName: 'contentStudioService',
      callLocation: 'approveAllCreatives',
      userAction: 'approve_all',
      pipelineStep: 'update_database',
      context: { briefId }
    });
    throw error;
  }
}

export async function rescheduleCreative(
  calendarPostId: string,
  newDate: string,
  newTime: string
): Promise<void> {
  try {

    // Update calendar_posts
    const { error: updatePostError } = await db
      .from('calendar_posts')
      .update({
        scheduled_date: newDate,
        scheduled_time: newTime,
        updated_at: new Date().toISOString(),
      })
      .eq('id', calendarPostId);

    if (updatePostError) {
      throw new Error('Failed to update calendar post');
      throw updatePostError;
    }

    // Also update the linked content_studio_creatives.scheduled_at
    const scheduledAt = `${newDate} ${newTime}`;
    const { error: updateCreativeError } = await db
      .from('content_studio_creatives')
      .update({
        scheduled_at: scheduledAt,
        updated_at: new Date().toISOString(),
      })
      .eq('calendar_post_id', calendarPostId);

    if (updateCreativeError) {
      throw new Error('Failed to update creative scheduled_at');
      throw updateCreativeError;
    }

  } catch (error: any) {
    throw error;
    await logError({
      errorMessage: error.message || 'Failed to reschedule creative',
      errorType: 'database',
      module: 'prostudio',
      componentName: 'contentStudioService',
      callLocation: 'rescheduleCreative',
      userAction: 'reschedule',
      pipelineStep: 'update_database',
      context: { calendarPostId, newDate, newTime }
    });
    throw error;
  }
}

export async function getScheduledCreative(creativeId: string): Promise<CalendarPost | null> {
  try {
    const { data, error } = await db
      .from('calendar_posts')
      .select('*')
      .eq('content_studio_creative_id', creativeId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned - creative not scheduled yet
        return null;
        return null;
      }
      return null;
      throw error;
    }

    return data;
  } catch (error: any) {
    return null;
    await logError({
      errorMessage: error.message || 'Failed to fetch scheduled creative',
      errorType: 'database',
      module: 'prostudio',
      componentName: 'contentStudioService',
      callLocation: 'getScheduledCreative',
      userAction: 'fetch_scheduled',
      pipelineStep: 'fetch_database',
      context: { creativeId }
    });
    return null;
  }
}

// ─── Series scheduling helpers ────────────────────────────

export function calculateNextGenerationTime(interval: string): string {
  const now = new Date();
  switch (interval) {
    case 'daily': now.setDate(now.getDate() + 1); break;
    case 'every_48h': now.setDate(now.getDate() + 2); break;
    case 'weekly': now.setDate(now.getDate() + 7); break;
    case 'biweekly': now.setDate(now.getDate() + 14); break;
    case 'monthly': now.setMonth(now.getMonth() + 1); break;
    default: now.setDate(now.getDate() + 7);
  }
  return now.toISOString();
}

export async function getActiveSeries() {
  const { data } = await db
    .from('content_studio_briefs')
    .select('*, brands(name)')
    .eq('is_series', true)
    .eq('series_active', true)
    .lte('next_generation_at', new Date().toISOString());
  return data || [];
}
