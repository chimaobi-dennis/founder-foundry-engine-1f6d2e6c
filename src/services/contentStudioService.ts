import { supabase } from '@/integrations/supabase/client';
import { requirePrompt, injectPromptVariables, getSystemPrompt, callAI } from './aiService';
import { logError } from './errorService';
import { getAssetsForAIContext, getBrandProductImages } from './projectAssetsService';
import { saveToLibrary as saveToAssetLibrary, type SaveFormat, type Asset } from './assetService';
import { buildFounderIntelligenceContext } from './founderIntelligenceService';
import { buildPlatformDesignSystem, buildPlatformRenderInstructions } from './platformIntelligenceService';
import { calculateGenerationCredits, CreditBreakdown, CreditCalculationInput } from '@/utils/calculateGenerationCredits';
import { getContentStudioRule } from './pricingService';
import {
  chargeGenerationCredits,
  refundGenerationCredits,
  completeGenerationBilling,
  reserveGenerationCredits,
  captureReservedCredits,
  releaseReservedCredits,
  finalizeGenerationBilling,
  type ChargeResult,
  type ReserveResult,
} from './generationCreditService';
import type { SceneDocument, RenderEngine } from '@/types/scene';
import {
  processSceneGeneration,
  buildScenePromptInstructions,
  type GenerationTelemetry,
} from './sceneGenerationBridge';
import { getContentStudioGenerationSettings } from './platformSettingsService';

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

// ─── AI Generation Result Parser ────────────────────────────────────────────
// Routes through the Scene Generation Bridge for validation, repair, refinement,
// quality gating, and telemetry. Render engine is determined by platform_settings.

interface ParsedGenerationResult {
  visualHtml: string | null;
  sceneJson: SceneDocument | null;
  renderEngine: RenderEngine;
  /** Creative status from quality gate. */
  creativeStatus: 'ready' | 'failed';
  /** Whether scene → HTML fallback was triggered. */
  fellBackToHtml: boolean;
  /** Fallback reason if any. */
  fallbackReason: string | null;
  /** Generation telemetry for this creative. */
  telemetry: GenerationTelemetry | null;
}

function parseAIGenerationResult(
  rawText: string | null,
  options?: {
    renderEngine?: RenderEngine;
    platformSlug?: string;
    platformWidth?: number;
    platformHeight?: number;
  }
): ParsedGenerationResult {
  // Run through the Scene Generation Bridge
  const bridge = processSceneGeneration(rawText, {
    renderEngine: options?.renderEngine ?? 'html',
    platformSlug: options?.platformSlug,
    platformWidth: options?.platformWidth,
    platformHeight: options?.platformHeight,
  });

  return {
    visualHtml: bridge.visualHtml,
    sceneJson: bridge.sceneJson,
    renderEngine: bridge.renderEngine,
    creativeStatus: bridge.status,
    fellBackToHtml: bridge.fellBackToHtml,
    fallbackReason: bridge.fallbackReason,
    telemetry: bridge.telemetry,
  };
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
  // Selected library assets for visual context
  selected_library_assets?: { id: string; type: string; imageUrl: string | null }[];
  /** When the brief is a plan task's canvas: the task and the Designer run it came from. */
  plan_task_id?: string;
  run_id?: string;
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

  // Calculate estimated credits from the database rule
  const pricingRule = await getContentStudioRule();
  const { estimatedCredits } = calculateGenerationCredits({
    platformCount: brief.selected_platform_ids.length,
    complexityLevel: generationSettings.layout_complexity,
    creativeMode: generationSettings.creative_mode,
    aiFreedom: generationSettings.ai_freedom,
    visualAssets: generationSettings.visual_assets,
    variationCount: 1,
  }, pricingRule);

  const insertPayload = {
    brand_id: brandId,
    user_id: userId,
    name: brief.name,
    brief: brief.brief,
    campaign_goal: brief.campaign_goal,
    is_series: brief.is_series,
    plan_task_id: brief.plan_task_id ?? null,
    run_id: brief.run_id ?? null,
    series_interval: brief.series_interval,
    selected_platform_ids: brief.selected_platform_ids,
    // AI Workspace Configuration
    visual_direction: [generationSettings.visual_direction], // Array format for DB
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
    status: 'draft',
    // Selected library assets for visual context
    selected_library_assets: brief.selected_library_assets || null,
  };

  console.log('[ContentStudio] DEBUG: Inserting brief with values:', insertPayload);
  console.log('[ContentStudio] DEBUG: ai_freedom:', insertPayload.ai_freedom, 'image_density:', insertPayload.image_density, 'estimated_credits:', insertPayload.estimated_credits);

  const { data, error } = await db
    .from('content_studio_briefs')
    .insert(insertPayload)
    .select('id')
    .single();
  if (error) {
    console.error('[ContentStudio] DEBUG: Brief insert error:', error);
    throw error;
  }
  return data.id;
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

// ─── Selected Assets Instruction Builder ─────────────────

export function buildSelectedAssetsInstructions(selectedAssets: any[] | null | undefined): string {
  if (!selectedAssets || selectedAssets.length === 0) {
    return '';
  }

  const productImages = selectedAssets.filter(a => a.type === 'product_image');
  const creativeOutputs = selectedAssets.filter(a => a.type === 'output');

  const instructions: string[] = [];

  if (productImages.length > 0) {
    instructions.push(`SELECTED PRODUCT IMAGES (${productImages.length}):`);
    instructions.push('Study the product composition, lighting, and angles in the selected images.');
    instructions.push('Incorporate products naturally into the design as hero or contextual elements.');
    instructions.push('Remove or extend backgrounds if needed to improve visual fit.');
    instructions.push('Maintain product authenticity — do not alter core product features.');
  }

  if (creativeOutputs.length > 0) {
    instructions.push(`SELECTED CREATIVE REFERENCES (${creativeOutputs.length}):`);
    instructions.push('Use these as style references for visual continuity across the campaign.');
    instructions.push('Match composition patterns, typography rhythm, and color usage.');
    instructions.push('Adapt successful layout approaches to new platform dimensions.');
  }

  return instructions.join('\n');
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
  // Scale 0-100 values to 0.00-1.00 to fit NUMERIC(3,2) database field
  const aiFreedom = brief.ai_freedom ?? 50;
  const imageDensity = brief.image_density ?? 50;
  return {
    visual_direction: brief.visual_direction || 'balanced',
    visual_assets: brief.visual_assets || ['product_photos', 'brand_images'],
    layout_complexity: brief.layout_complexity || 'balanced',
    creative_mode: brief.creative_mode || 'on_brand',
    ai_freedom: parseFloat((aiFreedom / 100).toFixed(2)), // 50 -> 0.50
    image_density: parseFloat((imageDensity / 100).toFixed(2)), // 50 -> 0.50
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
  let billingEventId: string | undefined;
  let chargeCreditsAmount: number | undefined;
  let aiCalled = false; // tracks whether AI inference has begun (irreversible billing moment)
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

    // ─── Runtime render engine from platform_settings ──
    const genSettings = await getContentStudioGenerationSettings();
    const runtimeRenderEngine: RenderEngine = genSettings.render_engine;

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

    // ─── BILLING: Reserve credits before generation ──
    const billingInput: CreditCalculationInput = {
      platformCount: platforms.length,
      complexityLevel: generationSettings.layout_complexity,
      creativeMode: generationSettings.creative_mode,
      aiFreedom: generationSettings.ai_freedom,
      visualAssets: generationSettings.visual_assets,
      variationCount: 1,
    };

    const reserveResult = await reserveGenerationCredits({
      userId: brief.user_id,
      briefId,
      sessionId,
      platformCount: platforms.length,
      renderEngine: runtimeRenderEngine,
      calculationInput: billingInput,
    });

    if (!reserveResult.success) {
      // Insufficient balance or duplicate — abort before any AI calls
      await db
        .from('content_studio_briefs')
        .update({ status: 'failed' })
        .eq('id', briefId);

      const errorMsg = reserveResult.error === 'INSUFFICIENT_BALANCE'
        ? `Insufficient credits. Required: ${reserveResult.creditsReserved}, Available: ${reserveResult.balance}`
        : reserveResult.message || 'Credit reservation failed';

      throw new Error(errorMsg);
    }

    billingEventId = reserveResult.billingEventId!;
    chargeCreditsAmount = reserveResult.creditsReserved;
    console.log('[CreditBilling] Credits reserved:', {
      billingEventId,
      creditsReserved: reserveResult.creditsReserved,
      availableAfter: reserveResult.availableAfter,
    });

    // Update brief with actual credits used
    await db
      .from('content_studio_briefs')
      .update({ actual_credits_used: reserveResult.creditsReserved })
      .eq('id', briefId);

    // Build visual asset instructions for copy generation context
    const visualAssetInstructions = buildVisualAssetInstructions(generationSettings.visual_assets);
    const selectedAssetsInstructions = buildSelectedAssetsInstructions(brief.selected_library_assets);

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
      // Selected library assets from Content Studio
      selected_assets_context: selectedAssetsInstructions,
    });

    // Append strict JSON-only instruction + scene format enforcement
    const exampleTemplate =
      '{\n' +
      platforms.map(p =>
        `  "${p.slug}": {\n` +
        `    "render_engine": "scene",\n` +
        `    "scene_version": "v1",\n` +
        `    "copy": {\n` +
        `      "headline": "YOUR COMPELLING HEADLINE HERE",\n` +
        `      "caption": "YOUR ENGAGING CAPTION/COPY TEXT HERE - 2-3 sentences max",\n` +
        `      "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3"],\n` +
        `      "cta": "YOUR CALL TO ACTION HERE"\n` +
        `    },\n` +
        `    "scene": {\n` +
        `      "width": 1080,\n` +
        `      "height": 1350,\n` +
        `      "background": "#hexcolor",\n` +
        `      "nodes": []\n` +
        `    }\n` +
        `  }`
      ).join(',\n') +
      '\n}';

    const strictCopyPrompt = copyPrompt + '\n\n' + (await requirePrompt('template_scene_contract', { template: exampleTemplate }));

    // ─── BILLING: Capture reservation → irreversible billing moment ──
    // After this point, credits remain consumed regardless of generation outcome.
    if (billingEventId) {
      await captureReservedCredits({
        billingEventId,
        aiProvider: 'anthropic',
        aiModel: 'claude-sonnet',
      });
    }
    aiCalled = true;

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
    console.log('[ContentStudio] RAW AI OUTPUT (copyData):', JSON.stringify(copyData, null, 2));

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
        const found = data[platform.slug];
        console.log('[findCopyForPlatform] Found exact slug match:', platform.slug);
        console.log('[findCopyForPlatform] Returning object:', JSON.stringify(found, null, 2));
        console.log('[findCopyForPlatform] Has copy.copy?', !!found?.copy);
        console.log('[findCopyForPlatform] copy.copy.headline:', found?.copy?.headline);
        console.log('[findCopyForPlatform] copy.copy.caption:', found?.copy?.caption?.substring(0, 50));
        return found;
      }

      // Platform name as lowercase_underscored
      const nameLower = platform.name?.toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/\//g, '_');
      if (nameLower && data[nameLower]) {
        console.log('[findCopyForPlatform] Found name match:', nameLower);
        const found = data[nameLower];
        console.log('[findCopyForPlatform] Name match object:', JSON.stringify(found, null, 2)?.substring(0, 200));
        return found;
      }

      // Partial match — base word from slug
      const slugBase = platform.slug.split('_')[0]; // 'instagram' from 'instagram_post'
      const partialMatch = Object.keys(data).find(key =>
        key.includes(slugBase) || slugBase.includes(key)
      );
      if (partialMatch) {
        console.log('[findCopyForPlatform] Found partial match:', partialMatch);
        const found = data[partialMatch];
        console.log('[findCopyForPlatform] Partial match object:', JSON.stringify(found, null, 2)?.substring(0, 200));
        return found;
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
      console.log('[findCopyForPlatform] Platform slug was:', platform.slug);
      console.log('[findCopyForPlatform] Available keys were:', Object.keys(data).join(', '));
      return {};
    }

    // Validate and enforce copy fields are never empty
    function validateCopyFields(
      copy: Record<string, any>,
      platform: any,
      brief: any
    ): { headline: string; copy_text: string; subject_line: string | null; hashtags: string[] } {
      const platformName = platform.name || platform.slug;
      const briefText = brief.brief || brief.name || brief.campaign_goal || '';

      console.log('[validateCopyFields] RAW platform copy input:', JSON.stringify(copy, null, 2));

      // Handle scene format where copy is nested under 'copy' key
      // Format: { "render_engine": "scene", "copy": { "headline": "...", "caption": "...", "hashtags": [], "cta": "" } }
      const copyContainer = copy.copy || copy;

      // Ensure headline exists and is meaningful
      let headline = copyContainer.headline?.trim() || copy.headline?.trim();
      if (!headline || headline.length < 3) {
        headline = `${platformName} Campaign`;
      }

      // Ensure copy_text exists and is meaningful (check both 'copy_text' and 'caption')
      let copyText = copyContainer.copy_text?.trim() || copyContainer.caption?.trim() || copy.copy_text?.trim() || copy.caption?.trim();
      if (!copyText || copyText.length < 10) {
        copyText = briefText || `Discover our ${platformName} content designed for your audience.`;
      }

      // Subject line - only for email platforms
      let subjectLine: string | null = copy.subject_line?.trim() || null;
      if (platform.slug?.includes('email') || platform.name?.toLowerCase().includes('email')) {
        if (!subjectLine || subjectLine.length < 3) {
          subjectLine = headline;
        }
      }

      // Ensure hashtags exist (check both copyContainer and copy for scene format)
      let hashtags: string[] = copyContainer.hashtags || copy.hashtags || [];
      if (!Array.isArray(hashtags) || hashtags.length === 0) {
        // Generate default hashtags based on campaign/brief
        const brandName = brief.brand?.name || 'Brand';
        hashtags = ['#marketing', '#growth', `#${brandName.replace(/\s+/g, '')}`].filter(Boolean);
      }
      // Clean hashtags - ensure they start with # and are lowercase
      hashtags = hashtags
        .map((tag: string) => tag.toString().toLowerCase().trim())
        .map((tag: string) => tag.startsWith('#') ? tag : `#${tag}`)
        .filter((tag: string) => tag.length > 1);

      console.log('[validateCopyFields]', {
        platform: platform.slug,
        headlineLength: headline.length,
        copyTextLength: copyText.length,
        subjectLine: subjectLine ? 'present' : 'null',
        hashtagCount: hashtags.length,
        wasValidated: !copyContainer.headline || !(copyContainer.copy_text || copyContainer.caption) || !copyContainer.hashtags,
        extractedFrom: copy.copy ? 'copy.copy (scene format)' : 'direct (legacy format)'
      });

      return { headline, copy_text: copyText, subject_line: subjectLine, hashtags };
    }

    // Now generate visuals for each platform in parallel
    const creatives: any[] = [];

    await Promise.all(platforms.map(async (platform) => {
      const platformCopy = findCopyForPlatform(copyData, platform);

      console.log('[ContentStudio] platformCopy before validation:', {
        platform: platform.slug,
        hasCopy: !!platformCopy?.copy,
        copyHeadline: platformCopy?.copy?.headline,
        copyCaption: platformCopy?.copy?.caption?.substring(0, 30),
        directHeadline: platformCopy?.headline,
        directCopyText: platformCopy?.copy_text?.substring(0, 30),
        keys: Object.keys(platformCopy || {})
      });

      // Validate copy fields immediately - ensure AI returned valid content
      const validatedCopy = validateCopyFields(platformCopy, platform, brief);

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

      // Build scene prompt instructions if scene mode
      const sceneInstructions = await buildScenePromptInstructions(
        runtimeRenderEngine,
        platformSystem.dimensions.width,
        platformSystem.dimensions.height
      );

      const visualPrompt = injectPromptVariables(visualSystemPrompt, {
        generation_prompt: `Platform: ${platform.name}\n\n${platformInstructions}\n\nCampaign: ${brief.brief || brief.campaign_goal || brand.name}\nHeadline to feature: "${validatedCopy.headline}"\nCopy snippet: "${validatedCopy.copy_text.slice(0, 80)}"`,
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
        // Runtime generation mode from platform_settings
        generation_mode: runtimeRenderEngine,
        // New AI Workspace Configuration variables
        visual_direction: generationSettings.visual_direction,
        layout_complexity: generationSettings.layout_complexity,
        creative_mode: generationSettings.creative_mode,
        ai_freedom: generationSettings.ai_freedom.toString(),
        image_density: generationSettings.image_density.toString(),
        visual_assets: generationSettings.visual_assets.join(', '),
        visual_asset_instructions: visualAssetInstructions,
      }) + sceneInstructions;

      const visualResult = await withTimeout(
        callAI({
          taskType: 'template_generation',
          messages: [{ role: 'user', content: visualPrompt }],
          maxTokens: 8000
        })
      );

      const logTag = runtimeRenderEngine === 'scene' ? '[SceneGeneration]' : '[HtmlGeneration]';
      console.log(`${logTag} === Visual Generation Step ===`);
      console.log(`${logTag} Platform: ${platform.name}`);
      console.log(`${logTag} Render engine: ${runtimeRenderEngine}`);
      console.log(`${logTag} Model used: ${visualResult.modelUsed}`);
      console.log(`${logTag} Provider used: ${visualResult.providerUsed}`);
      console.log(`${logTag} AI response: ${visualResult.success ? 'SUCCESS' : 'FAILED'}`);
      if (visualResult.text) {
        console.log(`${logTag} Response length: ${visualResult.text.length}`);
      }

      // Parse + validate + repair + refine + quality gate via Scene Bridge
      // render_engine sourced from platform_settings (loaded once above the loop)
      const parsedResult = parseAIGenerationResult(
        visualResult.success ? visualResult.text : null,
        {
          renderEngine: runtimeRenderEngine,
          platformSlug: platform.slug,
          platformWidth: platformSystem.dimensions.width,
          platformHeight: platformSystem.dimensions.height,
        }
      );
      visualHtml = parsedResult.visualHtml;

      // Prepare creative payload — status driven by quality gate
      const hasContent = !!(parsedResult.visualHtml || parsedResult.sceneJson);
      const qualityStatus = parsedResult.creativeStatus;
      // Enforce strict null separation: scene → no html, html → no scene_json
      const persistVisualHtml = parsedResult.renderEngine === 'scene' ? null : parsedResult.visualHtml;
      const persistSceneJson = parsedResult.renderEngine === 'html' ? null : parsedResult.sceneJson;
      const persistSceneVersion = parsedResult.renderEngine === 'scene' ? 'v1' : null;

      const creativePayload: Record<string, unknown> = {
        brief_id: briefId,
        platform_id: platform.id,
        generation_session_id: sessionId,
        headline: validatedCopy.headline,
        copy_text: validatedCopy.copy_text,
        subject_line: validatedCopy.subject_line,
        hashtags: validatedCopy.hashtags,
        visual_html: persistVisualHtml,
        scene_json: persistSceneJson,
        render_engine: parsedResult.renderEngine,
        scene_version: persistSceneVersion,
        generation_quality_score: parsedResult.telemetry?.qualityScore ?? null,
        generation_telemetry: parsedResult.telemetry ?? null,
        generation_fallback_reason: parsedResult.fallbackReason ?? null,
        export_unstable: parsedResult.telemetry ? parsedResult.telemetry.parityScore < 92 : false,
        template_id: selectedTemplateId,
        // Use 'ready' whenever content exists; export_unstable flag signals quality concerns
        status: hasContent ? 'ready' : 'failed',
        updated_at: new Date().toISOString()
      };

      console.log('[ContentStudio] SAVING CREATIVE TO DB:', {
        platform: platform.slug,
        headline: creativePayload.headline,
        copy_text: creativePayload.copy_text,
        subject_line: creativePayload.subject_line,
        hashtags: creativePayload.hashtags,
        copy_source: validatedCopy.headline === platformCopy?.copy?.headline ? 'AI (scene format)' : validatedCopy.headline === platformCopy?.headline ? 'AI (legacy format)' : 'FALLBACK/GENERATED',
        status: creativePayload.status,
      });

      // Structured logging per engine
      if (parsedResult.renderEngine === 'scene') {
        console.log('[SceneValidation]', {
          platform: platform.slug,
          qualityScore: parsedResult.telemetry?.qualityScore,
          status: qualityStatus,
          repairCount: parsedResult.telemetry?.repairCount,
          constraintsApplied: parsedResult.telemetry?.constraintsApplied,
          warnings: parsedResult.telemetry?.validationWarnings?.length ?? 0,
        });
      } else {
        console.log('[HtmlGeneration] Parsed result:', {
          platform: platform.slug,
          hasHtml: !!parsedResult.visualHtml,
          status: qualityStatus,
        });
      }

      console.log('[ScenePersistence] Payload:', {
        platformId: platform.id,
        platformSlug: platform.slug,
        renderEngine: creativePayload.render_engine,
        sceneVersion: creativePayload.scene_version,
        hasVisualHtml: !!creativePayload.visual_html,
        hasSceneJson: !!creativePayload.scene_json,
        headline: creativePayload.headline,
        status: creativePayload.status,
      });

      // ═══════════════════════════════════════════════════════════════════════
      // PERSISTENCE — Upsert into content_studio_creatives
      // ON CONFLICT (generation_session_id, platform_id)
      // One platform + one session = one creative record.
      // ═══════════════════════════════════════════════════════════════════════

      const { data: savedCreative, error: persistError } = await db
        .from('content_studio_creatives')
        .upsert(creativePayload, {
          onConflict: 'generation_session_id,platform_id',
        })
        .select('*, content_platforms(*)')
        .single();

      if (persistError) {
        console.error('[creative upsert failed]', {
          error: persistError.message,
          generationSessionId: sessionId,
          platformId: platform.id,
        });

        await logError({
          errorMessage: persistError.message,
          errorType: 'database',
          module: 'prostudio',
          componentName: 'contentStudioService',
          context: { briefId, platformId: platform.id, sessionId }
        });

        // Persist failure → status 'failed', diagnostics in telemetry
        creatives.push({
          ...creativePayload,
          id: `upsert-failed-${platform.id}`,
          status: 'failed',
          content_platforms: { name: platform.name, slug: platform.slug },
        });
        onPlatformComplete?.(platform.id, { ...creativePayload, status: 'failed' });
      } else {
        console.log('[creative upsert success]', {
          creativeId: savedCreative?.id,
          platformId: platform.id,
          status: savedCreative?.status,
        });
        creatives.push(savedCreative);
        onPlatformComplete?.(platform.id, savedCreative);
      }
    }));

    // Calculate brief status based on creatives (partial-success resilience)
    const readyCount = creatives.filter(c => c.status === 'ready').length;
    const failedCount = creatives.filter(c => c.status === 'failed').length;
    const totalPlatforms = platforms.length;

    let briefStatus: string;
    if (readyCount === totalPlatforms) {
      briefStatus = 'ready';
    } else if (readyCount === 0 && failedCount > 0) {
      briefStatus = 'failed';
    } else {
      briefStatus = 'partial_failed';
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

    // ─── BILLING: Finalize billing — release any uncaptured remainder ──
    // After AI was called, credits stay captured (no refund for post-cost failures).
    // Finalize sets final status and releases any uncaptured reservation remainder.
    if (billingEventId) {
      await finalizeGenerationBilling({
        billingEventId,
        platformsSucceeded: readyCount,
        platformsFailed: failedCount,
      });
    }

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
    // ─── BILLING: Release or finalize on error ──
    if (billingEventId) {
      if (!aiCalled) {
        // Pre-cost failure: release reservation (credits return to available)
        await releaseReservedCredits({
          billingEventId,
          reason: error.message || 'Generation failed before AI inference',
        }).catch(releaseErr => {
          console.error('[CreditBilling] Reservation release failed:', releaseErr.message);
        });
      } else {
        // Post-cost failure: AI was called, credits stay captured
        await finalizeGenerationBilling({
          billingEventId,
          platformsSucceeded: 0,
          platformsFailed: 0,
        }).catch(finalizeErr => {
          console.error('[CreditBilling] Post-cost finalize failed:', finalizeErr.message);
        });
      }
    }

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
  let regenBillingEventId: string | undefined;
  let regenAiCalled = false;
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

    // Render engine from platform_settings (needed for billing + prompt)
    const regenSettings = await getContentStudioGenerationSettings();
    const regenRenderEngine: RenderEngine = regenSettings.render_engine;

    // ─── BILLING: Reserve 1-platform regeneration credits ──
    const regenBillingInput: CreditCalculationInput = {
      platformCount: 1,
      complexityLevel: brief.layout_complexity || 'balanced',
      creativeMode: brief.creative_mode || 'on_brand',
      aiFreedom: brief.ai_freedom ?? 50,
      visualAssets: brief.visual_assets || ['product_photos'],
      variationCount: 1,
    };

    const regenReserveResult = await reserveGenerationCredits({
      userId: brief.user_id,
      briefId: brief.id,
      sessionId,
      platformCount: 1,
      renderEngine: regenRenderEngine,
      calculationInput: regenBillingInput,
    });

    if (!regenReserveResult.success) {
      const errorMsg = regenReserveResult.error === 'INSUFFICIENT_BALANCE'
        ? `Insufficient credits for regeneration. Required: ${regenReserveResult.creditsReserved}, Available: ${regenReserveResult.balance}`
        : regenReserveResult.message || 'Credit reservation failed';
      throw new Error(errorMsg);
    }

    regenBillingEventId = regenReserveResult.billingEventId!;
    console.log('[CreditBilling] Regeneration reserved:', {
      billingEventId: regenBillingEventId,
      creditsReserved: regenReserveResult.creditsReserved,
    });

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

    // Build scene prompt instructions if scene mode
    const regenSceneInstructions = await buildScenePromptInstructions(
      regenRenderEngine,
      regenPlatformSystem.dimensions.width,
      regenPlatformSystem.dimensions.height
    );

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
      // Runtime generation mode from platform_settings
      generation_mode: regenRenderEngine,
      // AI Workspace Configuration (from brief)
      visual_direction: brief.visual_direction || 'balanced',
      layout_complexity: brief.layout_complexity || 'balanced',
      creative_mode: brief.creative_mode || 'on_brand',
      ai_freedom: (brief.ai_freedom ?? 50).toString(),
      image_density: (brief.image_density ?? 50).toString(),
      visual_assets: (brief.visual_assets || ['product_photos', 'brand_images']).join(', '),
      visual_asset_instructions: buildVisualAssetInstructions(brief.visual_assets),
    }) + regenSceneInstructions;

    // ─── BILLING: Capture reservation → irreversible billing moment ──
    if (regenBillingEventId) {
      await captureReservedCredits({
        billingEventId: regenBillingEventId,
        aiProvider: 'anthropic',
        aiModel: 'claude-sonnet',
      });
    }
    regenAiCalled = true;

    const visualResult = await withTimeout(
        callAI({
          taskType: 'template_generation',
          messages: [{ role: 'user', content: visualPrompt }],
          maxTokens: 8000
        })
      );

    const regenLogTag = regenRenderEngine === 'scene' ? '[SceneGeneration]' : '[HtmlGeneration]';
    console.log(`${regenLogTag} === Regenerate Visual Step ===`);
    console.log(`${regenLogTag} Platform: ${platform.name}`);
    console.log(`${regenLogTag} Creative ID: ${creativeId}`);
    console.log(`${regenLogTag} Render engine: ${regenRenderEngine}`);
    console.log(`${regenLogTag} Model used: ${visualResult.modelUsed}`);
    console.log(`${regenLogTag} Provider used: ${visualResult.providerUsed}`);
    console.log(`${regenLogTag} AI response: ${visualResult.success ? 'SUCCESS' : 'FAILED'}`);
    if (visualResult.text) {
      console.log(`${regenLogTag} Response length: ${visualResult.text.length}`);
    }

    // Parse + validate + repair + refine + quality gate via Scene Bridge
    const parsedRegen = parseAIGenerationResult(
      visualResult.success ? visualResult.text : null,
      {
        renderEngine: regenRenderEngine,
        platformSlug: platform.slug,
        platformWidth: regenPlatformSystem.dimensions.width,
        platformHeight: regenPlatformSystem.dimensions.height,
      }
    );
    // Fall back to existing visual_html if generation returned nothing (HTML mode only)
    const hasContent = !!(parsedRegen.visualHtml || parsedRegen.sceneJson);
    const regenQualityStatus = parsedRegen.creativeStatus;

    // Enforce strict null separation: scene → no html, html → no scene_json
    const regenPersistHtml = parsedRegen.renderEngine === 'scene' ? null : (parsedRegen.visualHtml || creative.visual_html);
    const regenPersistScene = parsedRegen.renderEngine === 'html' ? null : parsedRegen.sceneJson;
    const regenPersistVersion = parsedRegen.renderEngine === 'scene' ? 'v1' : null;

    if (parsedRegen.renderEngine === 'scene') {
      console.log('[SceneValidation] Regenerate:', {
        creativeId,
        qualityScore: parsedRegen.telemetry?.qualityScore,
        status: regenQualityStatus,
        repairCount: parsedRegen.telemetry?.repairCount,
      });
    }

    console.log('[ContentStudio] REGENERATE - copy fields kept from DB (visual-only regen):', {
      creativeId,
      headline: creative.headline,
      copy_text: creative.copy_text,
      subject_line: creative.subject_line,
      hashtags: creative.hashtags,
    });

    console.log('[ScenePersistence] Regenerate:', {
      creativeId,
      renderEngine: parsedRegen.renderEngine,
      sceneVersion: regenPersistVersion,
      hasVisualHtml: !!regenPersistHtml,
      hasSceneJson: !!regenPersistScene,
      // Use 'ready' whenever content exists; export_unstable flag signals quality concerns
      status: hasContent ? 'ready' : 'failed',
    });

    const { error: regenUpdateError } = await db
      .from('content_studio_creatives')
      .update({
        visual_html: regenPersistHtml,
        scene_json: regenPersistScene,
        render_engine: parsedRegen.renderEngine,
        scene_version: regenPersistVersion,
        generation_quality_score: parsedRegen.telemetry?.qualityScore ?? null,
        generation_telemetry: parsedRegen.telemetry ?? null,
        generation_fallback_reason: parsedRegen.fallbackReason ?? null,
        export_unstable: parsedRegen.telemetry ? parsedRegen.telemetry.parityScore < 92 : false,
        // Use 'ready' whenever content exists; export_unstable flag signals quality concerns
        status: hasContent ? 'ready' : 'failed',
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

    // ─── BILLING: Finalize regeneration billing ──
    if (regenBillingEventId) {
      await finalizeGenerationBilling({
        billingEventId: regenBillingEventId,
        platformsSucceeded: hasContent ? 1 : 0,
        platformsFailed: hasContent ? 0 : 1,
      });
    }

    return regenPersistHtml;
  } catch (error: any) {
    // ─── BILLING: Release or finalize on error ──
    if (regenBillingEventId) {
      if (!regenAiCalled) {
        await releaseReservedCredits({
          billingEventId: regenBillingEventId,
          reason: error.message || 'Regeneration failed before AI inference',
        }).catch(releaseErr => {
          console.error('[CreditBilling] Regen release failed:', releaseErr.message);
        });
      } else {
        await finalizeGenerationBilling({
          billingEventId: regenBillingEventId,
          platformsSucceeded: 0,
          platformsFailed: 1,
        }).catch(finalizeErr => {
          console.error('[CreditBilling] Regen post-cost finalize failed:', finalizeErr.message);
        });
      }
    }

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
  let retryBillingEventId: string | undefined;
  let retryAiCalled = false;
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

    // Fetch failed creatives for retry
    const { data: failedCreatives } = await db
      .from('content_studio_creatives')
      .select('*, content_platforms(*)')
      .eq('brief_id', briefId)
      .eq('status', 'failed');

    if (!failedCreatives || failedCreatives.length === 0) {
      console.log('[ContentStudio] No failed creatives to retry');
      return;
    }

    console.log('[ContentStudio] Retry targets:', {
      failed: failedCreatives.length,
    });

    console.log('[ContentStudio] === Retrying Failed Creatives ===');
    console.log('[ContentStudio] Failed creatives count:', failedCreatives.length);

    // Generate session ID for this retry batch
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    const sessionId = `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;

    // ─── BILLING: Reserve credits for retry batch ──
    const retryBillingInput: CreditCalculationInput = {
      platformCount: failedCreatives.length,
      complexityLevel: brief.layout_complexity || 'balanced',
      creativeMode: brief.creative_mode || 'on_brand',
      aiFreedom: brief.ai_freedom ?? 50,
      visualAssets: brief.visual_assets || ['product_photos'],
      variationCount: 1,
    };

    const retryReserveResult = await reserveGenerationCredits({
      userId: brief.user_id,
      briefId,
      sessionId,
      platformCount: failedCreatives.length,
      renderEngine: 'html',
      calculationInput: retryBillingInput,
    });

    if (!retryReserveResult.success) {
      const errorMsg = retryReserveResult.error === 'INSUFFICIENT_BALANCE'
        ? `Insufficient credits for retry. Required: ${retryReserveResult.creditsReserved}, Available: ${retryReserveResult.balance}`
        : retryReserveResult.message || 'Credit reservation failed';
      throw new Error(errorMsg);
    }

    retryBillingEventId = retryReserveResult.billingEventId!;
    console.log('[CreditBilling] Retry batch reserved:', {
      billingEventId: retryBillingEventId,
      creditsReserved: retryReserveResult.creditsReserved,
      failedPlatforms: failedCreatives.length,
    });

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

    // ─── BILLING: Capture reservation → irreversible billing moment ──
    if (retryBillingEventId) {
      await captureReservedCredits({
        billingEventId: retryBillingEventId,
        aiProvider: 'anthropic',
        aiModel: 'claude-sonnet',
      });
    }
    retryAiCalled = true;

    // Retry each failed creative in parallel
    await Promise.all(failedCreatives.map(async (creative) => {
      const platform = creative.content_platforms;

      // Mark as generating ('retrying' is not in the DB status constraint)
      await db
        .from('content_studio_creatives')
        .update({ status: 'generating', updated_at: new Date().toISOString() })
        .eq('id', creative.id);

      // Build platform intelligence
      const platformSystem = buildPlatformDesignSystem(platform);
      const platformInstructions = buildPlatformRenderInstructions(platformSystem);

      // Render engine from platform_settings
      const retrySettings = await getContentStudioGenerationSettings();
      const retryRenderEngine: RenderEngine = retrySettings.render_engine;

      // Build scene prompt instructions if scene mode
      const retrySceneInstructions = await buildScenePromptInstructions(
        retryRenderEngine,
        platformSystem.dimensions.width,
        platformSystem.dimensions.height
      );

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
        // Runtime generation mode from platform_settings
        generation_mode: retryRenderEngine,
        // AI Workspace Configuration (from brief)
        visual_direction: brief.visual_direction || 'balanced',
        layout_complexity: brief.layout_complexity || 'balanced',
        creative_mode: brief.creative_mode || 'on_brand',
        ai_freedom: (brief.ai_freedom ?? 50).toString(),
        image_density: (brief.image_density ?? 50).toString(),
        visual_assets: (brief.visual_assets || ['product_photos', 'brand_images']).join(', '),
        visual_asset_instructions: buildVisualAssetInstructions(brief.visual_assets),
      }) + retrySceneInstructions;

      const visualResult = await withTimeout(
        callAI({
          taskType: 'template_generation',
          messages: [{ role: 'user', content: visualPrompt }],
          maxTokens: 8000
        })
      );

      const retryLogTag = retryRenderEngine === 'scene' ? '[SceneGeneration]' : '[HtmlGeneration]';
      console.log(`${retryLogTag} === Retry Visual Generation Step ===`);
      console.log(`${retryLogTag} Platform: ${platform.name}`);
      console.log(`${retryLogTag} Creative ID: ${creative.id}`);
      console.log(`${retryLogTag} Render engine: ${retryRenderEngine}`);
      console.log(`${retryLogTag} Model used: ${visualResult.modelUsed}`);
      console.log(`${retryLogTag} Provider used: ${visualResult.providerUsed}`);
      console.log(`${retryLogTag} AI response: ${visualResult.success ? 'SUCCESS' : 'FAILED'}`);
      if (visualResult.text) {
        console.log(`${retryLogTag} Response length: ${visualResult.text.length}`);
      }

      // Parse + validate + repair + refine + quality gate via Scene Bridge
      const parsedRetry = parseAIGenerationResult(
        visualResult.success ? visualResult.text : null,
        {
          renderEngine: retryRenderEngine,
          platformSlug: platform.slug,
          platformWidth: platformSystem.dimensions.width,
          platformHeight: platformSystem.dimensions.height,
        }
      );
      const retryHasContent = !!(parsedRetry.visualHtml || parsedRetry.sceneJson);
      const retryQualityStatus = parsedRetry.creativeStatus;

      // Enforce strict null separation: scene → no html, html → no scene_json
      const retryPersistHtml = parsedRetry.renderEngine === 'scene' ? null : parsedRetry.visualHtml;
      const retryPersistScene = parsedRetry.renderEngine === 'html' ? null : parsedRetry.sceneJson;
      const retryPersistVersion = parsedRetry.renderEngine === 'scene' ? 'v1' : null;

      if (parsedRetry.renderEngine === 'scene') {
        console.log('[SceneValidation] Retry:', {
          creativeId: creative.id,
          qualityScore: parsedRetry.telemetry?.qualityScore,
          status: retryQualityStatus,
          repairCount: parsedRetry.telemetry?.repairCount,
        });
      }

      console.log('[ScenePersistence] Retry:', {
        creativeId: creative.id,
        platformId: platform.id,
        renderEngine: parsedRetry.renderEngine,
        sceneVersion: retryPersistVersion,
        hasVisualHtml: !!retryPersistHtml,
        hasSceneJson: !!retryPersistScene,
        status: retryHasContent ? 'ready' : 'failed',
      });

      const { error: retryUpdateError } = await db
        .from('content_studio_creatives')
        .update({
          visual_html: retryPersistHtml,
          scene_json: retryPersistScene,
          render_engine: parsedRetry.renderEngine,
          scene_version: retryPersistVersion,
          generation_quality_score: parsedRetry.telemetry?.qualityScore ?? null,
          generation_telemetry: parsedRetry.telemetry ?? null,
          generation_fallback_reason: parsedRetry.fallbackReason ?? null,
          export_unstable: parsedRetry.telemetry ? parsedRetry.telemetry.parityScore < 92 : false,
          // Use 'ready' whenever content exists; export_unstable flag signals quality concerns
          status: retryHasContent ? 'ready' : 'failed',
          generation_session_id: sessionId,
          updated_at: new Date().toISOString()
        })
        .eq('id', creative.id);

      if (retryUpdateError) {
        console.error('[ScenePersistence] Retry update failed:', {
          creativeId: creative.id,
          error: retryUpdateError.message
        });
      } else {
        console.log('[ScenePersistence] Retry update success:', {
          creativeId: creative.id,
          platformId: platform.id,
          status: retryHasContent ? retryQualityStatus : 'failed'
        });
      }

      if (retryHasContent) {
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

      // ─── BILLING: Finalize retry batch billing ──
      if (retryBillingEventId) {
        await finalizeGenerationBilling({
          billingEventId: retryBillingEventId,
          platformsSucceeded: readyCount,
          platformsFailed: failedCount,
        });
      }

      console.log('[ContentStudio] === Retry Complete ===');
      console.log('[ContentStudio] Brief status:', briefStatus);
      console.log('[ContentStudio] Platforms ready:', readyCount, '/', total);
      console.log('[ContentStudio] Platforms failed:', failedCount, '/', total);
    }
  } catch (error: any) {
    // ─── BILLING: Release or finalize on error ──
    if (retryBillingEventId) {
      if (!retryAiCalled) {
        await releaseReservedCredits({
          billingEventId: retryBillingEventId,
          reason: error.message || 'Retry failed before AI inference',
        }).catch(releaseErr => {
          console.error('[CreditBilling] Retry release failed:', releaseErr.message);
        });
      } else {
        await finalizeGenerationBilling({
          billingEventId: retryBillingEventId,
          platformsSucceeded: 0,
          platformsFailed: 0,
        }).catch(finalizeErr => {
          console.error('[CreditBilling] Retry post-cost finalize failed:', finalizeErr.message);
        });
      }
    }

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

/**
 * Retry persistence for failed creatives.
 * Re-persists existing creative data without re-calling AI.
 * Uses upsert on (generation_session_id, platform_id).
 */
export async function retryPersistFailedCreatives(
  briefId: string,
  onPlatformComplete?: (platformId: string, creative: any) => void
): Promise<void> {
  console.log('[ContentStudio] === Starting Persistence Retry ===', { briefId });

  const { data: brief } = await db
    .from('content_studio_briefs')
    .select('*')
    .eq('id', briefId)
    .single();

  if (!brief) {
    throw new Error('Brief not found');
  }

  // Get all failed creatives that have content (AI succeeded, persistence failed)
  const { data: failedCreatives } = await db
    .from('content_studio_creatives')
    .select('*, content_platforms(*)')
    .eq('brief_id', briefId)
    .eq('status', 'failed');

  // Only retry those that already have visual content
  const retryable = (failedCreatives || []).filter(
    (c: any) => c.visual_html || c.scene_json
  );

  if (retryable.length === 0) {
    console.log('[ContentStudio] No retryable creatives found');
    return;
  }

  console.log('[ContentStudio] Persistence retry targets:', {
    count: retryable.length,
    platforms: retryable.map((c: any) => c.content_platforms?.name)
  });

  await Promise.all(retryable.map(async (creative: any) => {
    const platform = creative.content_platforms;
    if (!platform) return;

    const { data: savedCreative, error: persistError } = await db
      .from('content_studio_creatives')
      .update({
        status: 'ready',
        updated_at: new Date().toISOString(),
      })
      .eq('id', creative.id)
      .select('*, content_platforms(*)')
      .single();

    if (persistError) {
      console.error('[ContentStudio] Persistence retry failed:', {
        platformId: platform.id,
        error: persistError.message,
      });
      await logError({
        errorMessage: persistError.message,
        errorType: 'database',
        module: 'prostudio',
        componentName: 'contentStudioService',
        callLocation: 'retryPersistFailedCreatives',
        context: { briefId, platformId: platform.id, creativeId: creative.id }
      });
    } else {
      console.log('[ContentStudio] Persistence retry success:', {
        platformId: platform.id,
        creativeId: savedCreative?.id,
      });
      onPlatformComplete?.(platform.id, savedCreative);
    }
  }));

  // Recalculate brief status
  const { data: allCreatives } = await db
    .from('content_studio_creatives')
    .select('status')
    .eq('brief_id', briefId);

  if (allCreatives) {
    const readyCount = allCreatives.filter((c: any) => c.status === 'ready').length;
    const total = allCreatives.length;

    const briefStatus = readyCount === total ? 'ready' : readyCount === 0 ? 'failed' : 'partial_failed';

    await db
      .from('content_studio_briefs')
      .update({ status: briefStatus })
      .eq('id', briefId);

    console.log('[ContentStudio] === Persistence Retry Complete ===');
    console.log('[ContentStudio] Brief status:', briefStatus);
    console.log('[ContentStudio] Platforms ready:', readyCount, '/', total);
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
    if (!creative.visual_html && !creative.scene_json) {
      return null;
      throw new Error('No visual content to save (neither HTML nor scene_json)');
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

// Re-export credit calculation types from shared utility for backward compatibility
export type { CreditBreakdown, CreditCalculationInput } from '@/utils/calculateGenerationCredits';