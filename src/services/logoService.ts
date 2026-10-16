import { supabase } from '@/integrations/supabase/client';
import { requirePrompt, callAI, getSystemPrompt, injectPromptVariables, type AICallResult } from '@/services/aiService';
import { logAIError } from '@/services/errorService';
import { parseAISceneResponse } from '@/lib/scene/parseAISceneResponse';
import { applyMutationChain } from '@/lib/scene/mutations/mutateScene';
import type { SceneDocument } from '@/types/scene';
import type { MutationId, MutationParams } from '@/lib/scene/mutations/mutationTypes';

const db = supabase as any;

export interface LogoGenerationOptions {
  brandId: string;
  userId: string;
  name: string;
  prompt: string;
  style?: string;
  colorPalette?: string;
  brandVoice?: string;
  additionalContext?: string;
}

export interface LogoMutationOptions {
  sessionId: string;
  userId: string;
  mutationDescription: string;
  currentSceneJson?: SceneDocument;
  additionalContext?: string;
}

export interface LogoSession {
  id: string;
  asset_id: string | null;
  brand_id: string;
  brief_id: string | null;
  created_at: string;
  creative_id: string | null;
  generation_params: any;
  platform_height: number | null;
  platform_slug: string | null;
  platform_width: number | null;
  render_engine: string | null;
  scene_json: SceneDocument | null;
  source_module: string;
  template_id: string | null;
  template_output_id: string | null;
  user_id: string;
  version: number;
  visual_html: string;
}

const createSessionId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `session-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;
};

const knownMutationIds: Set<string> = new Set([
  'replace_headline',
  'rewrite_cta',
  'swap_typography',
  'change_color_direction',
  'rebalance_layout',
  'increase_density',
  'simplify_composition',
  'modernize_layout',
  'convert_editorial_style',
  'alternative_hierarchy',
  'platform_adaptation',
  'resize_reflow',
  'swap_image',
  'adjust_spacing',
  'boost_contrast',
  'custom'
]);

const buildLogoSystemPrompt = (taskType: 'logo_generation' | 'logo_mutation'): Promise<string> => requirePrompt(taskType);

const stripCodeFences = (text: string): string =>
  text
    .replace(/^```(?:json|html|javascript|typescript)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();

const tryParseJson = (text: string): unknown | null => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const isMutationInstruction = (value: unknown): value is { id: string; params?: Record<string, unknown> } => {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as any).id === 'string'
  );
};

const normalizeMutationId = (id: string): MutationId =>
  knownMutationIds.has(id) ? (id as MutationId) : 'custom';

const parseLogoMutationResponse = (rawText?: string): Array<{ id: MutationId; params: MutationParams }> => {
  if (!rawText) return [];
  const cleaned = stripCodeFences(rawText);
  const json = tryParseJson(cleaned) ?? tryParseJson(cleaned.replace(/^[^\{\[]+/, '').replace(/[^\}\]]+$/, ''));
  const payload = json ?? cleaned;
  const instructions: Array<{ id: MutationId; params: MutationParams }> = [];

  const addInstruction = (value: unknown) => {
    if (!isMutationInstruction(value)) return;
    instructions.push({
      id: normalizeMutationId((value as any).id),
      params: typeof (value as any).params === 'object' && (value as any).params !== null ? (value as any).params : {}
    });
  };

  if (Array.isArray(payload)) {
    payload.forEach(addInstruction);
    return instructions;
  }

  if (isMutationInstruction(payload)) {
    addInstruction(payload);
    return instructions;
  }

  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.mutations)) {
      obj.mutations.forEach(addInstruction);
      return instructions;
    }
    if (typeof obj.mutation_id === 'string') {
      addInstruction({ id: obj.mutation_id, params: obj.params as Record<string, unknown> });
      return instructions;
    }
    if (typeof obj.id === 'string' && obj.params) {
      addInstruction(obj as any);
      return instructions;
    }
  }

  return instructions;
};

const buildBrandContext = (options: LogoGenerationOptions) => {
  const pieces: string[] = [];
  pieces.push(`Brand name: ${options.name}`);
  if (options.brandVoice) pieces.push(`Brand voice: ${options.brandVoice}`);
  if (options.additionalContext) pieces.push(`Brand context: ${options.additionalContext}`);
  return pieces.join('\n');
};

export const getLogoSessions = async (userId: string, brandId?: string): Promise<LogoSession[]> => {
  let query = db
    .from('studio_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('source_module', 'logo_studio');

  if (brandId) {
    query = query.eq('brand_id', brandId);
  }

  const { data } = await query.order('created_at', { ascending: false });
  return data ?? [];
};

export const getLogoSessionById = async (sessionId: string): Promise<LogoSession | null> => {
  const { data, error } = await db
    .from('studio_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (error) return null;
  return data;
};

export const getLogoSessionByVersion = async (
  rootSessionId: string,
  version: number
): Promise<LogoSession | null> => {
  try {
    const { data, error } = await db
      .from('studio_sessions')
      .select('*')
      .contains('generation_params', { root_session_id: rootSessionId })
      .eq('version', version)
      .single();

    if (error) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
};

export const generateLogoVariants = async (
  options: LogoGenerationOptions
): Promise<{ success: boolean; error?: string; sessions?: LogoSession[] }> => {
  try {
    const systemPrompt = await buildLogoSystemPrompt('logo_generation');
    const brandContext = buildBrandContext(options);

    const requests = Array.from({ length: 4 }, (_value, index) => {
      const prompt = injectPromptVariables(systemPrompt, {
        brand_context: brandContext,
        brief: options.prompt,
        style: options.style || 'Modern and memorable',
        color_palette: options.colorPalette || 'Bold, simple palette',
        brand_voice: options.brandVoice || 'Confident and refined',
        additional_context: options.additionalContext || 'No additional context',
        variant_index: index + 1
      });

      return callAI({
        taskType: 'logo_generation',
        userId: options.userId,
        messages: [
          {
            role: 'user',
            content: await requirePrompt('logo_generation_request', { index: String(index + 1) })
          }
        ],
        systemPrompt: prompt,
        maxTokens: 1600,
        userAction: 'generate_logo_variant'
      });
    });

    const results = await Promise.all(requests);
    const sessions: LogoSession[] = [];

    await Promise.all(results.map(async (result, index) => {
      if (!result.success) return;

      const parsed = parseAISceneResponse(result.text);
      const sceneJson = parsed.type === 'scene' ? parsed.sceneJson : null;
      const sessionId = createSessionId();
      const generationParams = {
        root_session_id: sessionId,
        variant_index: index + 1,
        variant_label: `Concept ${index + 1}`,
        prompt: options.prompt,
        style: options.style || null,
        color_palette: options.colorPalette || null,
        brand_voice: options.brandVoice || null,
        additional_context: options.additionalContext || null,
        brand_context: brandContext
      };

      const { data, error } = await db
        .from('studio_sessions')
        .insert({
          id: sessionId,
          brand_id: options.brandId,
          user_id: options.userId,
          source_module: 'logo_studio',
          render_engine: 'logo_generation',
          visual_html: '',
          scene_json: sceneJson,
          generation_params: generationParams,
          platform_slug: null,
          platform_width: 800,
          platform_height: 800,
          version: 1
        })
        .select('*')
        .single();

      if (error) {
        console.error('[logoService.generateLogoVariants] Failed to persist variant:', error);
        await logAIError(
          options.userId,
          'prostudio',
          'Failed to persist logo variant',
          { taskType: 'logo_generation', index, error: error.message },
          'logo_generation',
          undefined,
          undefined,
          'persist_variant',
          'generate_logo_variant'
        );
        return;
      }

      if (data) {
        sessions.push(data);
      }
    }));

    if (sessions.length === 0) {
      return { success: false, error: 'No logo variants could be generated.' };
    }

    return { success: true, sessions };
  } catch (error: any) {
    console.error('[logoService.generateLogoVariants] Error:', error);
    await logAIError(
      options.userId,
      'prostudio',
      error?.message ?? 'Unexpected error generating logo variants',
      { taskType: 'logo_generation' },
      'logo_generation',
      undefined,
      undefined,
      'generate_logo_variants',
      'generate_logo_variant'
    );
    return { success: false, error: error?.message ?? 'Unexpected error generating logo variants' };
  }
};

export const mutateLogoScene = async (
  options: LogoMutationOptions
): Promise<{
  success: boolean;
  error?: string;
  session?: LogoSession;
  mutations?: Array<{ id: MutationId; params: MutationParams }>;
}> => {
  try {
    const { data: existingSession, error: sessionError } = await db
      .from('studio_sessions')
      .select('*')
      .eq('id', options.sessionId)
      .single();

    if (sessionError || !existingSession) {
      const message = sessionError?.message || 'Logo session not found';
      console.error('[logoService.mutateLogoScene]', message);
      return { success: false, error: message };
    }

    const systemPrompt = await buildLogoSystemPrompt('logo_mutation');
    const filledPrompt = injectPromptVariables(systemPrompt, {
      session_id: options.sessionId,
      mutation_description: options.mutationDescription,
      additional_context: options.additionalContext || 'None provided',
      current_scene: JSON.stringify(options.currentSceneJson || existingSession.scene_json || {})
    });

    const result = await callAI({
      taskType: 'logo_mutation',
      userId: options.userId,
      messages: [
        {
          role: 'user',
          content: await requirePrompt('logo_mutation_request', { change: options.mutationDescription })
        }
      ],
      systemPrompt: filledPrompt,
      maxTokens: 1600,
      userAction: 'mutate_logo_scene'
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    const sceneResult = parseAISceneResponse(result.text);
    const mutationInstructions = parseLogoMutationResponse(result.text);
    const startingScene: SceneDocument | null = options.currentSceneJson || existingSession.scene_json;

    if (!startingScene) {
      return { success: false, error: 'No scene available to mutate.' };
    }

    let mutatedScene: SceneDocument | null = null;
    let appliedMutations: Array<{ id: MutationId; params: MutationParams }> = [];

    if (sceneResult.type === 'scene' && sceneResult.sceneJson) {
      mutatedScene = sceneResult.sceneJson;
    } else if (mutationInstructions.length > 0) {
      const chain = applyMutationChain(startingScene, mutationInstructions);
      mutatedScene = chain.finalScene;
      appliedMutations = mutationInstructions;
    }

    if (!mutatedScene) {
      return {
        success: false,
        error: 'AI response did not include a valid scene or mutation instructions.'
      };
    }

    const sessionId = createSessionId();
    const rootSessionId = existingSession.generation_params?.root_session_id || existingSession.id;
    const generationParams = {
      ...(existingSession.generation_params || {}),
      parent_session_id: existingSession.id,
      root_session_id: rootSessionId,
      mutation_description: options.mutationDescription,
      mutation_timestamp: new Date().toISOString(),
      mutation_chain: appliedMutations
    };

    const { data, error: insertError } = await db
      .from('studio_sessions')
      .insert({
        id: sessionId,
        asset_id: null,
        brand_id: existingSession.brand_id,
        user_id: existingSession.user_id,
        source_module: 'logo_studio',
        visual_html: '',
        scene_json: mutatedScene,
        render_engine: 'scene',
        platform_slug: existingSession.platform_slug,
        platform_width: existingSession.platform_width,
        platform_height: existingSession.platform_height,
        generation_params: generationParams,
        version: (existingSession.version || 1) + 1
      })
      .select('*')
      .single();

    if (insertError || !data) {
      console.error('[logoService.mutateLogoScene] Failed to persist mutated session:', insertError);
      return { success: false, error: insertError?.message ?? 'Failed to save mutated session.' };
    }

    return {
      success: true,
      session: data,
      mutations: appliedMutations
    };
  } catch (error: any) {
    console.error('[logoService.mutateLogoScene] Error:', error);
    await logAIError(
      options.userId,
      'prostudio',
      error?.message ?? 'Unexpected error mutating logo scene',
      { taskType: 'logo_mutation' },
      'logo_mutation',
      undefined,
      undefined,
      'mutate_logo_scene',
      'mutate_logo_scene'
    );
    return { success: false, error: error?.message ?? 'Unexpected error mutating logo scene' };
  }
};

export const saveLogoToLibrary = async (
  options: {
    brandId: string;
    userId: string;
    sessionId: string;
    name?: string;
  }
): Promise<{ success: boolean; error?: string }> => {
  try {
    const session = await getLogoSessionById(options.sessionId);
    if (!session) {
      return { success: false, error: 'Logo session not found.' };
    }

    if (!session.scene_json) {
      return { success: false, error: 'No scene available to save.' };
    }

    const assetName = options.name || `Logo studio asset ${session.id.slice(0, 8)}`;
    const { data: asset, error: assetError } = await db
      .from('assets')
      .insert({
        name: assetName,
        brand_id: options.brandId,
        user_id: options.userId,
        source_module: 'logo_studio',
        type: 'template_output',
        file_url: null,
        file_path: null,
        mime_type: 'application/json',
        width: session.platform_width,
        height: session.platform_height,
        platform: null,
        template_id: null,
        is_trashed: false,
        version: 1,
        version_label: 'v1'
      })
      .select('*')
      .single();

    if (assetError || !asset) {
      return { success: false, error: assetError?.message ?? 'Failed to create library asset.' };
    }

    const { error: sessionError } = await db
      .from('studio_sessions')
      .insert({
        asset_id: asset.id,
        brand_id: options.brandId,
        user_id: options.userId,
        source_module: 'logo_studio',
        visual_html: '',
        scene_json: session.scene_json,
        render_engine: 'scene',
        platform_slug: session.platform_slug,
        platform_width: session.platform_width,
        platform_height: session.platform_height,
        template_id: null,
        brief_id: null,
        creative_id: null,
        template_output_id: null,
        generation_params: session.generation_params || null,
        version: session.version || 1
      });

    if (sessionError) {
      return { success: false, error: sessionError.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('[logoService.saveLogoToLibrary] Error:', error);
    return { success: false, error: error?.message ?? 'Unexpected error saving to library.' };
  }
};
