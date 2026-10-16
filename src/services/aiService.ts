import { supabase } from '@/integrations/supabase/client';
import { composePrompt, fillVars, promptDef, type PromptExample } from '@shared/prompts';
import { logAIError, type ErrorModule } from './errorService';
import { SUPABASE_CONFIG } from '@/config/supabaseConfig';

// ─── System Prompt Functions ─────────────────────────────

// Fetch active system prompt for a task type
export const getSystemPrompt = async (
  taskType: TaskType | string
): Promise<string | null> => {
  const { data } = await (supabase as any)
    .from('ai_system_prompts')
    .select('system_prompt, instructions, examples, is_active')
    .eq('task_type', taskType)
    .maybeSingle();
  const def = promptDef(String(taskType));
  try {
    if (def) return composePrompt(def, data ?? null);
  } catch {
    return null;
  }
  return data?.is_active !== false ? data?.system_prompt ?? null : null;
};

/** A prompt that must exist: the composed text with variables filled, or a clear error naming the key. */
export const requirePrompt = async (key: string, vars: Record<string, string> = {}): Promise<string> => {
  const text = await getSystemPrompt(key);
  if (!text) throw new Error(`Prompt "${key}" is not set. Open Admin → Prompts and save it.`);
  return fillVars(text, vars);
};

/** Save a prompt by key: the base override, the instructions and the examples. Creates the row the first time; keeps history. */
export const savePrompt = async (
  key: string,
  fields: { system_prompt: string | null; instructions: string | null; examples: PromptExample[] },
  editNote: string,
  adminId: string
): Promise<{ success: boolean; error?: string }> => {
  const def = promptDef(key);
  const { data: current } = await (supabase as any).from('ai_system_prompts').select('id, version, system_prompt, instructions, examples').eq('task_type', key).maybeSingle();
  if (current) {
    await (supabase as any).from('ai_prompt_versions').insert({ prompt_id: current.id, version: current.version, system_prompt: current.system_prompt, instructions: current.instructions, examples: current.examples, edited_by: adminId, edit_note: editNote || 'Updated' });
    const { error } = await (supabase as any).from('ai_system_prompts').update({ ...fields, version: (current.version ?? 1) + 1, last_edited_by: adminId, updated_at: new Date().toISOString() }).eq('id', current.id);
    return { success: !error, error: error?.message };
  }
  const { error } = await (supabase as any).from('ai_system_prompts').insert({ task_type: key, name: def?.name ?? key, description: def?.description ?? null, ...fields, is_active: true, version: 1, last_edited_by: adminId });
  return { success: !error, error: error?.message };
};

/** Where a task type runs: class, primary model and fallbacks, from the active profile. */
export const getRouteFor = async (taskType: string): Promise<{ profile: string | null; class: string | null; source: string; candidates: { model_id: string; model_name: string; provider: { slug: string } }[] }> => {
  const { data } = await (supabase as any).rpc('resolve_ai_route', { p_task_type: taskType, p_tier: null, p_user_id: null });
  return { profile: data?.profile ?? null, class: data?.class ?? null, source: data?.source ?? 'none', candidates: Array.isArray(data?.candidates) ? data.candidates : [] };
};

export const setTaskClass = async (taskType: string, classSlug: string): Promise<boolean> => {
  const { error } = await (supabase as any).from('ai_task_types').upsert({ task_type: taskType, class_slug: classSlug, last_seen_at: new Date().toISOString() }, { onConflict: 'task_type' });
  return !error;
};

export const listTaskClasses = async (): Promise<{ slug: string; name: string; description: string | null }[]> => {
  const { data } = await (supabase as any).from('ai_task_classes').select('slug, name, description').order('sort_order');
  return data ?? [];
};

// Inject brand context variables into a prompt template
export const injectPromptVariables = (
  promptTemplate: string,
  variables: Record<string, string>
): string => {
  let result = promptTemplate;
  
  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = `{{${key}}}`;
    result = result.split(placeholder).join(value || 'Not yet defined');
  });

  return result;
};

// Get all system prompts for admin
export const getAllSystemPrompts = async () => {
  const { data, error } = await (supabase as any)
    .from('ai_system_prompts')
    .select('*')
    .order('task_type');
  return { data, error };
};

// Update a system prompt (admin only)
// Automatically saves version history
export const updateSystemPrompt = async (
  taskType: TaskType,
  newPrompt: string,
  editNote: string,
  adminId: string
): Promise<{ success: boolean; error?: string }> => {
  // Get current prompt and version
  const { data: current } = await (supabase as any)
    .from('ai_system_prompts')
    .select('id, version, system_prompt')
    .eq('task_type', taskType)
    .single();

  if (!current) return { success: false, error: 'Prompt not found' };

  // Save current version to history before overwriting
  await (supabase as any)
    .from('ai_prompt_versions')
    .insert({
      prompt_id: current.id,
      version: current.version,
      system_prompt: current.system_prompt,
      edited_by: adminId,
      edit_note: editNote || 'Updated'
    });

  // Update the prompt
  const { error } = await (supabase as any)
    .from('ai_system_prompts')
    .update({
      system_prompt: newPrompt,
      version: current.version + 1,
      last_edited_by: adminId,
      updated_at: new Date().toISOString()
    })
    .eq('task_type', taskType);

  return { success: !error, error: error?.message };
};

// Get version history for a prompt
export const getPromptVersionHistory = async (
  taskType: TaskType
) => {
  const { data: prompt } = await (supabase as any)
    .from('ai_system_prompts')
    .select('id')
    .eq('task_type', taskType)
    .single();

  if (!prompt) return { data: [], error: null };

  const { data, error } = await (supabase as any)
    .from('ai_prompt_versions')
    .select('*')
    .eq('prompt_id', prompt.id)
    .order('version', { ascending: false });

  return { data, error };
};

// Restore a previous version
export const restorePromptVersion = async (
  versionId: string,
  adminId: string
): Promise<{ success: boolean; error?: string }> => {
  const { data: version } = await (supabase as any)
    .from('ai_prompt_versions')
    .select('*, ai_system_prompts(task_type)')
    .eq('id', versionId)
    .single();

  if (!version) return { success: false, error: 'Version not found' };

  // A restore brings back the whole prompt of that version: base, instructions and examples.
  return savePrompt(
    version.ai_system_prompts.task_type,
    { system_prompt: version.system_prompt ?? null, instructions: version.instructions ?? null, examples: Array.isArray(version.examples) ? version.examples : [] },
    `Restored from version ${version.version}`,
    adminId
  );
};

// ─── Types ───────────────────────────────────────────────

export type TaskType = 
  | 'mentor_chat'
  | 'task_chat'
  | 'task_breakdown'
  | 'template_generation'
  | 'image_generation'
  | 'document_generation'
  | 'reel_script'
  | 'campaign_copy'
  | 'logo_generation'
  | 'logo_mutation'
  | 'context_extraction'
  | 'system_ai';

/** Agents resolve models by tier; admins map each tier in Task Defaults. */
export type TierTaskType = 'tier_fast' | 'tier_standard' | 'tier_reasoning';

export interface AIProvider {
  id: string;
  name: string;
  slug: string;
  description: string;
  base_url: string;
  auth_header_name: string;
  auth_header_prefix: string;
  /** Set via setProviderApiKey(); never readable from the browser. */
  has_key?: boolean;
  key_hint?: string | null;
  is_enabled: boolean;
  supports_text: boolean;
  supports_images: boolean;
}

export interface AIModel {
  id: string;
  provider_id: string;
  name: string;
  model_id: string;
  description: string;
  is_enabled: boolean;
  is_default: boolean;
  supports_vision: boolean;
  supports_images_out: boolean;
  best_for: string[];
  cost_per_1k_input: number | null;
  cost_per_1k_output: number | null;
  provider?: AIProvider;
}

export interface AICallOptions {
  taskType: TaskType | TierTaskType;
  /** Agents ask for a tier; admins map tiers to models in Task Defaults. */
  modelTier?: ModelTier;
  userId?: string;
  systemPrompt?: string;
  messages: { role: string; content: any }[];
  imageBase64?: string;
  imageMimeType?: string;
  maxTokens?: number;
  overrideModelId?: string;
  userAction?: string;
  onChunk?: (text: string) => void; // streaming callback
  temperature?: number;
  /** Attach usage + provider cost to this generation row. */
  generationId?: string;
  metadata?: Record<string, unknown>;
}

export interface AICallResult {
  text?: string;
  imageUrl?: string;
  success: boolean;
  error?: string;
  modelUsed?: string;
  providerUsed?: string;
  usage?: AIUsage;
  costUsd?: number;
  creditsEquivalent?: number;
  usageLogId?: string;
}

// ─── Model resolution ────────────────────────────────────

export const resolveModelForTask = async (
  taskType: TaskType,
  userId?: string
): Promise<{ model: AIModel; provider: AIProvider } | null> => {
  // 1. Check user preference first
  if (userId) {
    const { data: pref } = await (supabase as any)
      .from('user_model_preferences')
      .select(`
        model_id,
        ai_models (
          *,
          ai_providers (*)
        )
      `)
      .eq('user_id', userId)
      .eq('task_type', taskType)
      .single();

    if (pref?.ai_models && pref.ai_models.ai_providers) {
      const model = pref.ai_models as any;
      return { model, provider: model.ai_providers };
    }
  }

  // 2. Fall back to system default
  const { data: defaultTask } = await (supabase as any)
    .from('ai_task_defaults')
    .select(`
      model_id,
      ai_models (
        *,
        ai_providers (*)
      )
    `)
    .eq('task_type', taskType)
    .single();

  // Debug log
  const modelId = defaultTask?.ai_models?.model_id;
  const providerId = defaultTask?.ai_models?.ai_providers?.id;
  const providerSlug = defaultTask?.ai_models?.ai_providers?.slug;
  console.log('resolveModelForTask result:', { taskType, modelId, providerId, providerSlug });

  // Null check — model or provider missing
  if (!defaultTask?.ai_models) {
    // For system task types, fall back to system_ai
    const systemTaskTypes: TaskType[] = ['context_extraction', 'system_ai'];
    if (systemTaskTypes.includes(taskType) && taskType !== 'system_ai') {
      console.log(`No model found for task type ${taskType}, falling back to system_ai`);
      
      const { data: systemDefault } = await (supabase as any)
        .from('ai_task_defaults')
        .select(`
          model_id,
          ai_models (
            *,
            ai_providers (*)
          )
        `)
        .eq('task_type', 'system_ai')
        .single();

      if (!systemDefault?.ai_models) {
        const error = 'No model configured. Please set a System AI model in Admin → AI Models → Task Defaults.';
        console.error(error);
        return null;
      }

      const systemModel = systemDefault.ai_models as any;
      if (!systemModel.ai_providers) {
        console.error(
          `System AI model found but provider is null. ` +
          `Model: ${systemModel.name} (${systemModel.model_id}). ` +
          `Check that the provider exists and is enabled.` 
        );
        return null;
      }

      if (!systemModel.ai_providers.is_enabled) {
        console.error(
          `System AI provider ${systemModel.ai_providers.slug} is disabled. ` +
          `Enable it in admin dashboard or update task defaults.` 
        );
        return null;
      }

      console.log('resolveModelForTask fallback result:', { 
        originalTask: taskType, 
        fallbackTask: 'system_ai', 
        modelId: systemModel.model_id, 
        providerId: systemModel.ai_providers.id,
        providerSlug: systemModel.ai_providers.slug
      });

      return { model: systemModel, provider: systemModel.ai_providers };
    }

    console.error(`No model found for task type: ${taskType}`);
    return null;
  }

  const model = defaultTask.ai_models as any;

  if (!model.ai_providers) {
    console.error(
      `Model found for ${taskType} but provider is null. ` +
      `Model: ${model.name} (${model.model_id}). ` +
      `Check that the provider exists and is enabled.` 
    );
    return null;
  }

  if (!model.ai_providers.is_enabled) {
    console.error(
      `Provider ${model.ai_providers.slug} is disabled. ` +
      `Enable it in admin dashboard or update task defaults.` 
    );
    return null;
  }

  return { model, provider: model.ai_providers };
};

// ─── Gateway client ──────────────────────────────────────
//
// All inference goes through the ai-gateway edge function. The browser never
// holds a provider key: it sends a task type (or model tier), the gateway
// resolves the model, calls the provider, logs usage + cost, and returns text.

export type ModelTier = 'fast' | 'standard' | 'reasoning';

export interface AIUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
}

interface GatewayPayload {
  taskType: string;
  modelTier?: ModelTier;
  messages: { role: string; content: any }[];
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  overrideModelId?: string;
  imageBase64?: string;
  imageMimeType?: string;
  stream?: boolean;
  generationId?: string;
  cacheContext?: boolean;
  metadata?: Record<string, unknown>;
}

interface GatewayResponse {
  success: boolean;
  text?: string;
  error?: string;
  modelUsed?: string;
  providerUsed?: string;
  usage?: AIUsage;
  costUsd?: number;
  creditsEquivalent?: number;
  usageLogId?: string | null;
}

const GATEWAY_URL = `${SUPABASE_CONFIG.url}/functions/v1/ai-gateway`;

const gatewayHeaders = async (): Promise<Record<string, string>> => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('You need to be signed in to use AI features.');
  return {
    'Content-Type': 'application/json',
    apikey: SUPABASE_CONFIG.anonKey,
    Authorization: `Bearer ${token}`,
  };
};

const callGateway = async (
  payload: GatewayPayload,
  onChunk?: (text: string) => void
): Promise<GatewayResponse> => {
  const headers = await gatewayHeaders();
  const wantStream = !!onChunk;
  const res = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...payload, stream: wantStream }),
  });

  if (!wantStream) {
    const data = (await res.json().catch(() => null)) as GatewayResponse | null;
    if (!data) return { success: false, error: `AI gateway returned ${res.status}` };
    return data;
  }

  if (!res.ok || !res.body) {
    const data = (await res.json().catch(() => null)) as GatewayResponse | null;
    return { success: false, error: data?.error ?? `AI gateway returned ${res.status}` };
  }

  // SSE: {type:'chunk', text} … {type:'done'|'error', ...GatewayResponse}
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let final: GatewayResponse | null = null;
  let streamed = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line.startsWith('data:')) continue;
      try {
        const ev = JSON.parse(line.slice(5).trim());
        if (ev.type === 'chunk' && typeof ev.text === 'string') {
          streamed += ev.text;
          onChunk!(ev.text);
        } else if (ev.type === 'done' || ev.type === 'error') {
          final = ev;
        }
      } catch {
        // ignore partial lines
      }
    }
  }
  if (!final) return { success: !!streamed, text: streamed, error: streamed ? undefined : 'Stream ended without a result' };
  return { ...final, text: final.text || streamed };
};

// ─── Helper functions ─────────────────────────────────────

const getModuleFromTaskType = (taskType?: string): ErrorModule => {
  const map: Record<string, ErrorModule> = {
    mentor_chat: 'mentor',
    template_generation: 'prostudio',
    image_generation: 'prostudio',
    logo_generation: 'prostudio',
    logo_mutation: 'prostudio',
    document_generation: 'docstudio',
    reel_script: 'reelbuilder',
    campaign_copy: 'campaignkit'
  };
  return map[taskType ?? ''] ?? 'other';
};

// ─── Main AI call function ────────────────────────────────

export const callAI = async (options: AICallOptions): Promise<AICallResult> => {
  const {
    taskType,
    modelTier,
    userId,
    systemPrompt,
    messages,
    imageBase64,
    imageMimeType,
    maxTokens = 2000,
    temperature,
    overrideModelId,
    userAction,
    onChunk,
    generationId,
    metadata,
  } = options;

  let currentPipelineStep = 'calling_gateway';

  try {
    const result = await callGateway(
      {
        taskType,
        modelTier,
        messages,
        systemPrompt,
        maxTokens,
        temperature,
        overrideModelId,
        imageBase64,
        imageMimeType,
        generationId,
        metadata: { ...(metadata ?? {}), userAction },
      },
      onChunk
    );

    currentPipelineStep = 'processing_response';

    if (!result.success && userId) {
      await logAIError(
        userId,
        getModuleFromTaskType(taskType),
        result.error ?? 'AI call failed with no error message',
        { taskType, modelTier, modelId: result.modelUsed, messageCount: messages.length },
        taskType,
        result.modelUsed,
        result.providerUsed,
        currentPipelineStep,
        userAction
      );
    }

    return {
      success: result.success,
      text: result.text,
      error: result.error,
      modelUsed: result.modelUsed,
      providerUsed: result.providerUsed,
      usage: result.usage,
      costUsd: result.costUsd,
      creditsEquivalent: result.creditsEquivalent,
      usageLogId: result.usageLogId ?? undefined,
    };
  } catch (error: any) {
    const errorMessage = error?.message ?? 'Unexpected error in AI pipeline';

    if (userId) {
      await logAIError(
        userId,
        getModuleFromTaskType(taskType),
        errorMessage,
        { taskType, pipelineStep: currentPipelineStep },
        taskType,
        undefined,
        undefined,
        currentPipelineStep,
        userAction
      );
    }

    return { success: false, error: errorMessage };
  }
};

// ─── User preference management ──────────────────────────

export const getUserModelPreferences = async (
  userId: string
): Promise<Record<TaskType, AIModel | null>> => {
  const { data } = await (supabase as any)
    .from('user_model_preferences')
    .select(`
      task_type,
      ai_models (*, ai_providers (*))
    `)
    .eq('user_id', userId);

  const prefs: Record<string, AIModel | null> = {};
  data?.forEach((p: any) => {
    prefs[p.task_type] = p.ai_models;
  });

  return prefs as Record<TaskType, AIModel | null>;
};

export const setUserModelPreference = async (
  userId: string,
  taskType: TaskType,
  modelId: string
): Promise<{ success: boolean; error?: string }> => {
  const { error } = await (supabase as any)
    .from('user_model_preferences')
    .upsert({
      user_id: userId,
      task_type: taskType,
      model_id: modelId,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,task_type'
    });

  return { success: !error, error: error?.message };
};

// ─── Admin — provider and model management ───────────────

export const getAllProviders = async (): Promise<AIProvider[]> => {
  const { data } = await (supabase as any)
    .from('ai_providers')
    .select('*')
    .order('created_at');
  return data ?? [];
};

export const getAllModels = async (): Promise<AIModel[]> => {
  const { data } = await (supabase as any)
    .from('ai_models')
    .select('*, ai_providers(*)')
    .order('sort_order');
  return data ?? [];
};

const stripKeyFields = (p: Partial<AIProvider> & { api_key?: string }) => {
  const { api_key: _k, has_key: _h, key_hint: _hint, ...rest } = p;
  return rest;
};

export const createProvider = async (
  provider: Partial<AIProvider> & { api_key?: string }
): Promise<{ success: boolean; error?: string; id?: string }> => {
  const { data, error } = await (supabase as any)
    .from('ai_providers')
    .insert(stripKeyFields(provider))
    .select('id')
    .single();
  if (error) return { success: false, error: error.message };
  if (provider.api_key && data?.id) {
    const keyResult = await setProviderApiKey(data.id, provider.api_key);
    if (!keyResult.success) return { success: false, error: keyResult.error, id: data.id };
  }
  return { success: true, id: data?.id };
};

/** Store a provider key server-side. Empty string clears it. Admin only. */
export const setProviderApiKey = async (
  providerId: string,
  apiKey: string
): Promise<{ success: boolean; error?: string; hasKey?: boolean }> => {
  const { data, error } = await (supabase as any).rpc('admin_set_provider_api_key', {
    p_provider_id: providerId,
    p_api_key: apiKey,
  });
  if (error) return { success: false, error: error.message };
  if (!data?.success) return { success: false, error: data?.error ?? 'Failed to save key' };
  return { success: true, hasKey: !!data.has_key };
};

/** Which providers have a key (and a last-4 hint). Admin only. */
export const getProviderKeyStatus = async (): Promise<Record<string, { has_key: boolean; key_hint: string | null }>> => {
  const { data } = await (supabase as any).rpc('admin_provider_key_status');
  const map: Record<string, { has_key: boolean; key_hint: string | null }> = {};
  (data ?? []).forEach((row: any) => {
    map[row.provider_id] = { has_key: !!row.has_key, key_hint: row.key_hint ?? null };
  });
  return map;
};

export const updateProvider = async (
  id: string,
  updates: Partial<AIProvider> & { api_key?: string }
): Promise<{ success: boolean; error?: string }> => {
  const { error } = await (supabase as any)
    .from('ai_providers')
    .update({ ...stripKeyFields(updates), updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { success: false, error: error.message };
  // Only touch the key when the admin typed one; blank means "leave as is".
  if (updates.api_key && updates.api_key.trim()) {
    return setProviderApiKey(id, updates.api_key.trim());
  }
  return { success: true };
};

export const createModel = async (
  model: Partial<AIModel>
): Promise<{ success: boolean; error?: string }> => {
  const { error } = await (supabase as any)
    .from('ai_models')
    .insert(model);
  return { success: !error, error: error?.message };
};

export const updateModel = async (
  id: string,
  updates: Partial<AIModel>
): Promise<{ success: boolean; error?: string }> => {
  const { error } = await (supabase as any)
    .from('ai_models')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  return { success: !error, error: error?.message };
};

export const setTaskDefault = async (
  taskType: TaskType | TierTaskType,
  modelId: string
): Promise<{ success: boolean; error?: string }> => {
  const { error } = await (supabase as any)
    .from('ai_task_defaults')
    .upsert({
      task_type: taskType,
      model_id: modelId,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'task_type'
    });
  return { success: !error, error: error?.message };
};

// Ensure template_generation task has a default model (gemini-2.0-flash via google-ai-studio)
export const ensureTemplateGenerationDefault = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    // Check if template_generation already has a default
    const { data: existingDefault } = await (supabase as any)
      .from('ai_task_defaults')
      .select('model_id')
      .eq('task_type', 'template_generation')
      .single();

    if (existingDefault) {
      return { success: true }; // Already configured
    }

    // Find gemini-2.0-flash model from google-ai-studio provider
    const { data: models } = await (supabase as any)
      .from('ai_models')
      .select(`
        id,
        model_id,
        ai_providers (slug)
      `)
      .eq('model_id', 'gemini-2.0-flash')
      .eq('is_enabled', true)
      .single();

    if (!models || !models.ai_providers || models.ai_providers.slug !== 'google-ai-studio') {
      return { success: false, error: 'gemini-2.0-flash model not found or not enabled under google-ai-studio provider' };
    }

    // Set as default for template_generation
    const { error } = await setTaskDefault('template_generation', models.id);
    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// ─── Get available models for UI selectors ───────────────

export const getModelsForTask = async (
  taskType: TaskType
): Promise<AIModel[]> => {
  const { data } = await (supabase as any)
    .from('ai_models')
    .select('*, ai_providers(*)')
    .eq('is_enabled', true)
    .contains('best_for', [taskType])
    .order('sort_order');
  return data ?? [];
};

export const getAllTaskDefaults = async (): Promise<Record<string, string>> => {
  const { data } = await (supabase as any)
    .from('ai_task_defaults')
    .select('task_type, model_id');
  const map: Record<string, string> = {};
  (data ?? []).forEach((row: any) => {
    if (row?.task_type && row?.model_id) map[row.task_type] = row.model_id;
  });
  return map;
};

export const getAllEnabledModels = async (): Promise<AIModel[]> => {
  const { data } = await (supabase as any)
    .from('ai_models')
    .select('*, ai_providers(*)')
    .eq('is_enabled', true)
    .order('sort_order');
  return data ?? [];
};
