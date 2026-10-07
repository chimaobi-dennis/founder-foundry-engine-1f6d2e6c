/**
 * Model routing — which model serves which kind of work.
 *
 * Classes group task types (fast, writing, reasoning, coding, vision). A
 * profile maps every class to a primary model and ordered fallbacks; one
 * profile is active. Switching profiles moves every call at once. All of it
 * is admin-editable; the gateway reads it through resolve_ai_route().
 */

import { supabase } from '@/integrations/supabase/client';
import type { AIModel } from '@/services/aiService';

const db = supabase as any;

export interface TaskClass { slug: string; name: string; description: string | null; sort_order: number }
export interface TaskTypeRow { task_type: string; class_slug: string | null; description: string | null; is_system: boolean; last_seen_at: string | null }
export interface RoutingProfile { id: string; slug: string; name: string; description: string | null; is_active: boolean }
export interface RoutingRule { id: string; profile_id: string; class_slug: string; model_id: string; fallback_model_ids: string[] }
export interface TaskOverride { id: string; profile_id: string; task_type: string; model_id: string }

export interface RoutingSnapshot {
  classes: TaskClass[];
  taskTypes: TaskTypeRow[];
  profiles: RoutingProfile[];
  rules: RoutingRule[];
  overrides: TaskOverride[];
}

export async function getRoutingSnapshot(): Promise<RoutingSnapshot> {
  const [c, t, p, r, o] = await Promise.all([
    db.from('ai_task_classes').select('*').order('sort_order'),
    db.from('ai_task_types').select('*').order('task_type'),
    db.from('ai_routing_profiles').select('*').order('created_at'),
    db.from('ai_routing_rules').select('*'),
    db.from('ai_task_overrides').select('*'),
  ]);
  return { classes: c.data ?? [], taskTypes: t.data ?? [], profiles: p.data ?? [], rules: r.data ?? [], overrides: o.data ?? [] };
}

export async function activateProfile(profileId: string): Promise<{ success: boolean; error?: string; classes?: string[] }> {
  const { data, error } = await db.rpc('activate_routing_profile', { p_profile_id: profileId });
  if (error) return { success: false, error: error.message };
  if (data?.success) return { success: true };
  if (data?.error === 'CLASSES_UNROUTED') return { success: false, error: `These classes have no usable model in this profile: ${(data.classes ?? []).join(', ')}. Pick models whose provider is enabled and has a key.`, classes: data.classes };
  return { success: false, error: data?.error ?? 'Could not activate' };
}

export async function createProfile(input: { slug: string; name: string; description?: string; copyFromProfileId?: string }): Promise<{ success: boolean; error?: string; profile?: RoutingProfile }> {
  const slug = input.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!slug || !input.name.trim()) return { success: false, error: 'Name and slug are required' };
  const { data, error } = await db.from('ai_routing_profiles').insert({ slug, name: input.name.trim(), description: input.description ?? null }).select('*').single();
  if (error) return { success: false, error: error.message };
  if (input.copyFromProfileId) {
    const { data: rules } = await db.from('ai_routing_rules').select('class_slug, model_id, fallback_model_ids').eq('profile_id', input.copyFromProfileId);
    if (rules?.length) await db.from('ai_routing_rules').insert(rules.map((r: any) => ({ ...r, profile_id: data.id })));
    const { data: ov } = await db.from('ai_task_overrides').select('task_type, model_id').eq('profile_id', input.copyFromProfileId);
    if (ov?.length) await db.from('ai_task_overrides').insert(ov.map((r: any) => ({ ...r, profile_id: data.id })));
  }
  return { success: true, profile: data };
}

export async function deleteProfile(profileId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await db.from('ai_routing_profiles').delete().eq('id', profileId).eq('is_active', false);
  return error ? { success: false, error: error.message } : { success: true };
}

export async function setClassRule(profileId: string, classSlug: string, modelId: string, fallbackModelIds: string[]): Promise<{ success: boolean; error?: string }> {
  const fallbacks = fallbackModelIds.filter((id, i, arr) => id && id !== modelId && arr.indexOf(id) === i);
  const { error } = await db.from('ai_routing_rules').upsert({ profile_id: profileId, class_slug: classSlug, model_id: modelId, fallback_model_ids: fallbacks, updated_at: new Date().toISOString() }, { onConflict: 'profile_id,class_slug' });
  return error ? { success: false, error: error.message } : { success: true };
}

export async function setTaskOverride(profileId: string, taskType: string, modelId: string | null): Promise<{ success: boolean; error?: string }> {
  if (!modelId) {
    const { error } = await db.from('ai_task_overrides').delete().eq('profile_id', profileId).eq('task_type', taskType);
    return error ? { success: false, error: error.message } : { success: true };
  }
  const { error } = await db.from('ai_task_overrides').upsert({ profile_id: profileId, task_type: taskType, model_id: modelId }, { onConflict: 'profile_id,task_type' });
  return error ? { success: false, error: error.message } : { success: true };
}

export async function setTaskClass(taskType: string, classSlug: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await db.from('ai_task_types').update({ class_slug: classSlug }).eq('task_type', taskType);
  return error ? { success: false, error: error.message } : { success: true };
}

/** Blended $ per 1M tokens for a model, assuming 3 input tokens per output token. */
export function blendedPer1M(m: Pick<AIModel, 'cost_per_1k_input' | 'cost_per_1k_output'>): number | null {
  if (m.cost_per_1k_input == null && m.cost_per_1k_output == null) return null;
  const i = (m.cost_per_1k_input ?? 0) * 1000;
  const o = (m.cost_per_1k_output ?? 0) * 1000;
  return (i * 3 + o) / 4;
}

/** Providers that serve open models through an OpenAI-compatible API; one click to add. */
export const PROVIDER_PRESETS: { slug: string; name: string; base_url: string; description: string; keyUrl: string }[] = [
  { slug: 'openrouter', name: 'OpenRouter', base_url: 'https://openrouter.ai/api/v1', description: 'One key, most open and proprietary models. Easiest for development.', keyUrl: 'https://openrouter.ai/keys' },
  { slug: 'groq', name: 'Groq', base_url: 'https://api.groq.com/openai/v1', description: 'Very fast open models (Llama, GPT-OSS, Qwen).', keyUrl: 'https://console.groq.com/keys' },
  { slug: 'together', name: 'Together AI', base_url: 'https://api.together.xyz/v1', description: 'Open models at scale.', keyUrl: 'https://api.together.xyz/settings/api-keys' },
  { slug: 'fireworks', name: 'Fireworks', base_url: 'https://api.fireworks.ai/inference/v1', description: 'Open models, fast serving.', keyUrl: 'https://fireworks.ai/account/api-keys' },
  { slug: 'deepinfra', name: 'DeepInfra', base_url: 'https://api.deepinfra.com/v1/openai', description: 'Low-cost open model hosting.', keyUrl: 'https://deepinfra.com/dash/api_keys' },
  { slug: 'cerebras', name: 'Cerebras', base_url: 'https://api.cerebras.ai/v1', description: 'Fastest tokens per second for a few open models.', keyUrl: 'https://cloud.cerebras.ai/' },
];
