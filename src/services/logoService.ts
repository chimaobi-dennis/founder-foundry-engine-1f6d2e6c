import { supabase } from '@/integrations/supabase/client';
import { callAI, getSystemPrompt, injectPromptVariables, type AICallResult } from '@/services/aiService';
import { logAIError } from '@/services/errorService';

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
  currentSceneJson?: any;
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
  scene_json: any;
  source_module: string;
  template_id: string | null;
  template_output_id: string | null;
  user_id: string;
  version: number;
  visual_html: string;
}

const buildLogoSystemPrompt = async (taskType: 'logo_generation' | 'logo_mutation'): Promise<string> => {
  const prompt = await getSystemPrompt(taskType);
  if (prompt) return prompt;

  if (taskType === 'logo_generation') {
    return `You are a logo design assistant.
    Use the brand context and creative brief to generate three distinct logo concepts.
    Return only valid JSON with a concepts array. Each concept should contain a short name, a concise design description, and style notes.`;
  }

  return `You are a logo design assistant.
    Use the existing logo scene and the requested mutation to produce a refined version.
    Return only valid JSON describing the updated scene or generation instructions.`;
};

export const getLogoSessions = async (userId: string): Promise<LogoSession[]> => {
  const { data } = await db
    .from('studio_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('source_module', 'logo_studio')
    .order('created_at', { ascending: false });

  return data ?? [];
};

export const generateLogoVariants = async (
  options: LogoGenerationOptions
): Promise<AICallResult & { sessionId?: string }> => {
  try {
    const systemPrompt = await buildLogoSystemPrompt('logo_generation');
    const filledPrompt = injectPromptVariables(systemPrompt, {
      brand_name: options.name,
      brief: options.prompt,
      style: options.style || 'Not yet defined',
      color_palette: options.colorPalette || 'Not yet defined',
      brand_voice: options.brandVoice || 'Not yet defined',
      additional_context: options.additionalContext || 'None provided'
    });

    const result = await callAI({
      taskType: 'logo_generation',
      userId: options.userId,
      messages: [
        {
          role: 'user',
          content: `Generate logo concepts for ${options.name}. Use the brief and brand context in the system prompt.`
        }
      ],
      systemPrompt: filledPrompt,
      maxTokens: 1600,
      userAction: 'generate_logo_variants'
    });

    if (!result.success) {
      return result;
    }

    const { error, data } = await db
      .from('studio_sessions')
      .insert({
        brand_id: options.brandId,
        user_id: options.userId,
        source_module: 'logo_studio',
        render_engine: 'logo_generation',
        visual_html: result.text ?? '',
        scene_json: null,
        generation_params: {
          prompt: options.prompt,
          style: options.style || null,
          color_palette: options.colorPalette || null,
          brand_voice: options.brandVoice || null,
          additional_context: options.additionalContext || null
        },
        platform_slug: null,
        platform_width: null,
        platform_height: null,
        version: 1
      })
      .select('id')
      .single();

    if (error) {
      console.error('[logoService.generateLogoVariants] Failed to save session:', error);
      await logAIError(
        options.userId,
        'prostudio',
        'Failed to save logo session after generation',
        { taskType: 'logo_generation', error: error.message },
        'logo_generation',
        undefined,
        undefined,
        'persist_session',
        'generate_logo_variants'
      );
      return { success: false, error: error.message };
    }

    return {
      ...result,
      sessionId: data?.id
    };
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
      'generate_logo_variants'
    );
    return { success: false, error: error?.message ?? 'Unexpected error generating logo variants' };
  }
};

export const mutateLogoScene = async (
  options: LogoMutationOptions
): Promise<AICallResult> => {
  try {
    const { data: existingSession, error: sessionError } = await db
      .from('studio_sessions')
      .select('*')
      .eq('id', options.sessionId)
      .single();

    if (sessionError || !existingSession) {
      const message = sessionError?.message || 'Logo session not found';
      console.error('[logoService.mutateLogoScene] ', message);
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
          content: `Mutate the current logo scene according to the requested change: ${options.mutationDescription}`
        }
      ],
      systemPrompt: filledPrompt,
      maxTokens: 1600,
      userAction: 'mutate_logo_scene'
    });

    if (!result.success) {
      return result;
    }

    const updatePayload: any = {
      generation_params: {
        ...(existingSession.generation_params || {}),
        last_mutation: {
          description: options.mutationDescription,
          timestamp: new Date().toISOString(),
          additional_context: options.additionalContext || null
        }
      },
      visual_html: result.text ?? existingSession.visual_html,
      version: (existingSession.version || 1) + 1
    };

    if (options.currentSceneJson) {
      updatePayload.scene_json = options.currentSceneJson;
    }

    const { error: updateError } = await db
      .from('studio_sessions')
      .update(updatePayload)
      .eq('id', options.sessionId);

    if (updateError) {
      console.error('[logoService.mutateLogoScene] Failed to update session:', updateError);
      await logAIError(
        options.userId,
        'prostudio',
        'Failed to update logo session after mutation',
        { taskType: 'logo_mutation', error: updateError.message },
        'logo_mutation',
        undefined,
        undefined,
        'persist_session',
        'mutate_logo_scene'
      );
      return { success: false, error: updateError.message };
    }

    return result;
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
