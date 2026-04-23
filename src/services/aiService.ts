import { supabase } from '@/integrations/supabase/client';
import { logAIError, type ErrorModule } from './errorService';
import { GoogleGenAI } from '@google/genai';

// ─── System Prompt Functions ─────────────────────────────

// Fetch active system prompt for a task type
export const getSystemPrompt = async (
  taskType: TaskType
): Promise<string | null> => {
  const { data } = await (supabase as any)
    .from('ai_system_prompts')
    .select('system_prompt')
    .eq('task_type', taskType)
    .eq('is_active', true)
    .single();

  return data?.system_prompt ?? null;
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

  return updateSystemPrompt(
    version.ai_system_prompts.task_type,
    version.system_prompt,
    `Restored from version ${version.version}`,
    adminId
  );
};

// ─── Types ───────────────────────────────────────────────

export type TaskType = 
  | 'mentor_chat'
  | 'template_generation'
  | 'image_generation'
  | 'document_generation'
  | 'reel_script'
  | 'campaign_copy';

export interface AIProvider {
  id: string;
  name: string;
  slug: string;
  description: string;
  base_url: string;
  auth_header_name: string;
  auth_header_prefix: string;
  api_key: string | null;
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
  taskType: TaskType;
  userId?: string;
  systemPrompt?: string;
  messages: { role: string; content: any }[];
  imageBase64?: string;
  imageMimeType?: string;
  maxTokens?: number;
  overrideModelId?: string;
  userAction?: string;
  onChunk?: (text: string) => void; // streaming callback
}

export interface AICallResult {
  text?: string;
  imageUrl?: string;
  success: boolean;
  error?: string;
  modelUsed?: string;
  providerUsed?: string;
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

  // Null check — model or provider missing
  if (!defaultTask?.ai_models) {
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

// ─── Provider-specific call builders ─────────────────────

const callGoogleAI = async (
  apiKey: string,
  modelId: string,
  messages: any[],
  systemPrompt?: string,
  maxTokens: number = 2000
): Promise<AICallResult> => {
  try {
    if (!apiKey) {
      return {
        success: false,
        error: 'Google AI API key is empty. Add it in admin dashboard → AI Models → Providers.'
      };
    }

    const ai = new GoogleGenAI({ apiKey });

    // Convert messages to Gemini contents format
    const contents = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{
        text: typeof msg.content === 'string'
          ? msg.content
          : msg.content?.[1]?.text ?? ''
      }]
    }));

    // Filter empty messages
    const filteredContents = contents.filter(
      m => m.parts[0].text.trim().length > 0
    );

    // Merge consecutive same-role messages
    // Google requires strict user/model alternation
    const dedupedContents = filteredContents.reduce((acc: any[], msg) => {
      if (acc.length === 0) return [msg];
      const last = acc[acc.length - 1];
      if (last.role === msg.role) {
        last.parts[0].text += '\n' + msg.parts[0].text;
        return acc;
      }
      return [...acc, msg];
    }, []);

    // Must start with user message
    if (dedupedContents.length > 0 && dedupedContents[0].role === 'model') {
      dedupedContents.shift();
    }

    if (dedupedContents.length === 0) {
      return { success: false, error: 'No valid messages to send' };
    }

    console.log('Google GenAI call:', {
      model: modelId,
      messageCount: dedupedContents.length,
      hasSystemPrompt: !!systemPrompt
    });

    const config: any = {
      maxOutputTokens: maxTokens,
      temperature: 0.8
    };

    if (systemPrompt) {
      config.systemInstruction = systemPrompt;
    }

    const response = await ai.models.generateContent({
      model: modelId,
      contents: dedupedContents,
      config
    });

    const text = response.text;

    if (!text) {
      return {
        success: false,
        error: 'Google AI returned empty response'
      };
    }

    console.log('Google GenAI response received, length:', text.length);

    return {
      success: true,
      text,
      modelUsed: modelId,
      providerUsed: 'google-ai-studio'
    };

  } catch (error: any) {
    console.error('Google GenAI error:', error);
    return {
      success: false,
      error: error.message ?? 'Google AI call failed'
    };
  }
};

const callGoogleAIStreaming = async (
  apiKey: string,
  modelId: string,
  messages: any[],
  systemPrompt?: string,
  maxTokens: number = 2000,
  onChunk?: (text: string) => void
): Promise<AICallResult> => {
  try {
    if (!apiKey) {
      return { success: false, error: 'Google AI API key is empty.' };
    }

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    const contents = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{
        text: typeof msg.content === 'string' ? msg.content : ''
      }]
    })).filter(m => m.parts[0].text.trim().length > 0);

    // Merge consecutive same-role messages
    const dedupedContents = contents.reduce((acc: any[], msg) => {
      if (acc.length === 0) return [msg];
      const last = acc[acc.length - 1];
      if (last.role === msg.role) {
        last.parts[0].text += '\n' + msg.parts[0].text;
        return acc;
      }
      return [...acc, msg];
    }, []);

    if (dedupedContents[0]?.role === 'model') dedupedContents.shift();
    if (dedupedContents.length === 0) {
      return { success: false, error: 'No valid messages' };
    }

    const config: any = {
      maxOutputTokens: maxTokens,
      temperature: 0.8
    };
    if (systemPrompt) config.systemInstruction = systemPrompt;

    let fullText = '';

    if (onChunk) {
      // Streaming mode
      const streamResult = await ai.models.generateContentStream({
        model: modelId,
        contents: dedupedContents,
        config
      });

      for await (const chunk of streamResult) {
        const chunkText = chunk.text ?? '';
        if (chunkText) {
          fullText += chunkText;
          // Strip partial CHOICE_PROMPT blocks from streaming display
          const displayText = fullText.replace(
            /<CHOICE_PROMPT>[\s\S]*?(<\/CHOICE_PROMPT>|$)/g, 
            ''
          ).trim();
          onChunk(displayText);
        }
      }
    } else {
      // Non-streaming fallback
      const response = await ai.models.generateContent({
        model: modelId,
        contents: dedupedContents,
        config
      });
      fullText = response.text ?? '';
    }

    if (!fullText) {
      return { success: false, error: 'Empty response from Google AI' };
    }

    return {
      success: true,
      text: fullText,
      modelUsed: modelId,
      providerUsed: 'google-ai-studio'
    };

  } catch (error: any) {
    console.error('Google GenAI error:', error);
    return { success: false, error: error.message ?? 'Google AI call failed' };
  }
};

const callOpenAICompatible = async (
  baseUrl: string,
  apiKey: string,
  authHeaderName: string,
  authHeaderPrefix: string,
  modelId: string,
  messages: any[],
  systemPrompt?: string,
  maxTokens: number = 2000,
  imageBase64?: string,
  imageMimeType?: string
): Promise<AICallResult> => {
  try {
    const processedMessages = messages.map((msg, index) => {
      if (
        index === messages.length - 1 &&
        msg.role === 'user' &&
        imageBase64 &&
        imageMimeType
      ) {
        return {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${imageMimeType};base64,${imageBase64}` 
              }
            },
            {
              type: 'text',
              text: typeof msg.content === 'string' 
                ? msg.content 
                : msg.content
            }
          ]
        };
      }
      return msg;
    });

    const allMessages = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...processedMessages]
      : processedMessages;

    const authValue = authHeaderPrefix 
      ? `${authHeaderPrefix} ${apiKey}` 
      : apiKey;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [authHeaderName]: authValue
      },
      body: JSON.stringify({
        model: modelId,
        messages: allMessages,
        max_tokens: maxTokens
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return { 
        success: false, 
        error: data.error?.message ?? 'API call failed' 
      };
    }

    return {
      success: true,
      text: data.choices?.[0]?.message?.content ?? null,
      modelUsed: modelId,
      providerUsed: baseUrl
    };
  } catch (error: any) {
    console.error('OpenAI-compatible API call failed:', error);
    return { success: false, error: error.message };
  }
};

const callAnthropicDirect = async (
  apiKey: string,
  modelId: string,
  messages: any[],
  systemPrompt?: string,
  maxTokens: number = 2000
): Promise<AICallResult> => {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return { 
        success: false, 
        error: data.error?.message ?? 'Anthropic API call failed' 
      };
    }

    return {
      success: true,
      text: data.content?.[0]?.text ?? null,
      modelUsed: modelId,
      providerUsed: 'anthropic'
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// ─── Helper functions ─────────────────────────────────────

const getModuleFromTaskType = (taskType?: string): ErrorModule => {
  const map: Record<string, ErrorModule> = {
    mentor_chat: 'mentor',
    template_generation: 'prostudio',
    image_generation: 'prostudio',
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
    userId,
    systemPrompt,
    messages,
    imageBase64,
    imageMimeType,
    maxTokens = 2000,
    overrideModelId,
    userAction,
    onChunk
  } = options;

  let currentPipelineStep = 'resolving_model';

  try {
    // Step 1 — Resolve model
    currentPipelineStep = 'resolving_model';
    const resolved = await resolveModelForTask(taskType, userId);

    if (!resolved) {
      const error = 'No AI model configured for this task';
      if (userId) {
        await logAIError(
          userId,
          getModuleFromTaskType(taskType),
          error,
          { taskType },
          taskType,
          undefined,
          undefined,
          currentPipelineStep,
          userAction
        );
      }
      return { 
        success: false, 
        error 
      };
    }

    const { model, provider } = resolved;
    const modelIdToUse = overrideModelId ?? model.model_id;

    console.log(`AI call: task=${taskType} model=${modelIdToUse} provider=${provider.slug}`);

    // Step 2 — Build request
    currentPipelineStep = 'building_request';
    
    // Step 3 — Call provider
    currentPipelineStep = `calling_provider:${provider.slug}`;
    
    console.log('Provider slug for routing:', `"${provider.slug}"`);
    
    let result: AICallResult;

    switch (provider.slug) {
      case 'google-ai-studio':
        console.log('Routing to callGoogleAI with key length:', 
          provider.api_key?.length ?? 0);
        if (onChunk) {
          result = await callGoogleAIStreaming(
            provider.api_key ?? '',
            modelIdToUse,
            options.messages,
            options.systemPrompt,
            options.maxTokens ?? 2000,
            onChunk
          );
        } else {
          result = await callGoogleAI(
            provider.api_key ?? '',
            modelIdToUse,
            options.messages,
            options.systemPrompt,
            options.maxTokens ?? 2000
          );
        }
        break;

      case 'anthropic':
        result = await callAnthropicDirect(
          provider.api_key ?? '',
          modelIdToUse,
          options.messages,
          options.systemPrompt,
          options.maxTokens ?? 2000
        );
        break;

      case 'lovable-gemini':
        result = {
          success: false,
          error: 'Lovable AI not available in local environment. Switch to Google AI Studio provider in admin dashboard.'
        };
        break;

      case 'openai':
      case 'jojapi':
      default:
        result = await callOpenAICompatible(
          provider.base_url,
          provider.api_key ?? '',
          provider.auth_header_name,
          provider.auth_header_prefix,
          modelIdToUse,
          options.messages,
          options.systemPrompt,
          options.maxTokens ?? 2000,
          options.imageBase64,
          options.imageMimeType
        );
        break;
    }

    // Step 4 — Handle result
    currentPipelineStep = 'processing_response';

    // Log the AI failure
    if (!result.success && userId) {
      await logAIError(
        userId,
        getModuleFromTaskType(taskType),
        result.error ?? 'AI call failed with no error message',
        {
          taskType,
          modelId: model.model_id,
          messageCount: messages.length
        },
        taskType,
        model.model_id,
        provider.slug,
        currentPipelineStep,
        userAction
      );
    }

    return result;
  } catch (error: any) {
    const errorMessage = error?.message ?? 'Unexpected error in AI pipeline';
    
    if (userId) {
      await logAIError(
        userId,
        getModuleFromTaskType(taskType),
        errorMessage,
        {
          taskType,
          pipelineStep: currentPipelineStep
        },
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

export const createProvider = async (
  provider: Partial<AIProvider>
): Promise<{ success: boolean; error?: string }> => {
  const { error } = await (supabase as any)
    .from('ai_providers')
    .insert(provider);
  return { success: !error, error: error?.message };
};

export const updateProvider = async (
  id: string,
  updates: Partial<AIProvider>
): Promise<{ success: boolean; error?: string }> => {
  const { error } = await (supabase as any)
    .from('ai_providers')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  return { success: !error, error: error?.message };
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
  taskType: TaskType,
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

export const getAllEnabledModels = async (): Promise<AIModel[]> => {
  const { data } = await (supabase as any)
    .from('ai_models')
    .select('*, ai_providers(*)')
    .eq('is_enabled', true)
    .order('sort_order');
  return data ?? [];
};
