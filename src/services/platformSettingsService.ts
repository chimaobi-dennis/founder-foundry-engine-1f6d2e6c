/**
 * platformSettingsService.ts
 *
 * Centralized runtime configuration for Kinika.
 * Source of truth: public.platform_settings table.
 *
 * Controls:
 *   - Content Studio generation render engine (html | scene)
 *   - Future platform-wide runtime flags
 *
 * DO NOT create alternative config tables or duplicate systems.
 */

import { supabase } from '@/integrations/supabase/client';
import { adminSupabase } from './adminServiceSupabase';
import type { RenderEngine } from '@/types/scene';

const db = supabase as any;

/**
 * Get the best available Supabase client.
 * Prefers adminSupabase (service role, bypasses RLS) when available.
 * Falls back to regular client (subject to RLS).
 */
function getClient() {
  return (adminSupabase ?? db) as any;
}

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface PlatformSetting {
  id: string;
  setting_key: string;
  setting_value: Record<string, unknown>;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContentStudioGenerationSettings {
  render_engine: RenderEngine;
}

// ─── Setting keys ──────────────────────────────────────────

export const SETTING_KEYS = {
  CONTENT_STUDIO_GENERATION: 'content_studio_generation',
  BILLING: 'billing',
} as const;

// ─── Defaults ──────────────────────────────────────────────

const DEFAULT_CONTENT_STUDIO_GENERATION: ContentStudioGenerationSettings = {
  render_engine: 'html',
};

// ═══════════════════════════════════════════════════════════════
// GENERIC CRUD
// ═══════════════════════════════════════════════════════════════

/**
 * Get a single setting by key. Returns null if not found.
 */
export async function getSetting(key: string): Promise<PlatformSetting | null> {
  const client = getClient();
  const { data, error } = await client
    .from('platform_settings')
    .select('*')
    .eq('setting_key', key)
    .maybeSingle();

  if (error) {
    console.error('[PlatformSettings] getSetting error:', error.message);
    return null;
  }
  return data ?? null;
}

/**
 * Create or replace a setting by key.
 */
export async function setSetting(
  key: string,
  value: Record<string, unknown>,
  description?: string
): Promise<PlatformSetting | null> {
  const client = getClient();
  const { data, error } = await client
    .from('platform_settings')
    .upsert(
      {
        setting_key: key,
        setting_value: value,
        description: description ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'setting_key' }
    )
    .select('*')
    .single();

  if (error) {
    console.error('[PlatformSettings] setSetting error:', error.message);
    return null;
  }
  return data;
}

/**
 * Partial-merge update of an existing setting's value.
 * Merges `partialValue` into the existing `setting_value` object.
 */
export async function updateSetting(
  key: string,
  partialValue: Record<string, unknown>
): Promise<PlatformSetting | null> {
  const existing = await getSetting(key);
  if (!existing) {
    console.warn('[PlatformSettings] updateSetting: key not found, creating:', key);
    return setSetting(key, partialValue);
  }

  const merged = { ...existing.setting_value, ...partialValue };

  const client = getClient();
  const { data, error } = await client
    .from('platform_settings')
    .update({
      setting_value: merged,
      updated_at: new Date().toISOString(),
    })
    .eq('setting_key', key)
    .select('*')
    .single();

  if (error) {
    console.error('[PlatformSettings] updateSetting error:', error.message);
    return null;
  }
  return data;
}

/**
 * Remove a setting by key.
 */
export async function removeSetting(key: string): Promise<boolean> {
  const client = getClient();
  const { error } = await client
    .from('platform_settings')
    .delete()
    .eq('setting_key', key);

  if (error) {
    console.error('[PlatformSettings] removeSetting error:', error.message);
    return false;
  }
  return true;
}

/**
 * Get all settings.
 */
export async function getAllSettings(): Promise<PlatformSetting[]> {
  const client = getClient();
  const { data, error } = await client
    .from('platform_settings')
    .select('*')
    .order('setting_key');

  if (error) {
    console.error('[PlatformSettings] getAllSettings error:', error.message);
    return [];
  }
  return data ?? [];
}

// ═══════════════════════════════════════════════════════════════
// TYPED HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Get Content Studio generation settings.
 * Returns the default ({ render_engine: 'html' }) if not configured.
 */
export async function getContentStudioGenerationSettings(): Promise<ContentStudioGenerationSettings> {
  const setting = await getSetting(SETTING_KEYS.CONTENT_STUDIO_GENERATION);

  if (!setting) {
    // No row yet — return default without blocking on write
    // (ensureDefaultSettings can be called separately by admin UI)
    return { ...DEFAULT_CONTENT_STUDIO_GENERATION };
  }

  const value = setting.setting_value as Partial<ContentStudioGenerationSettings>;
  const renderEngine = value.render_engine;

  // Validate render_engine is a known value
  if (renderEngine === 'html' || renderEngine === 'scene') {
    return { render_engine: renderEngine };
  }

  // Unknown value — return default
  console.warn('[PlatformSettings] Unknown render_engine value:', renderEngine, '— defaulting to html');
  return { ...DEFAULT_CONTENT_STUDIO_GENERATION };
}

// ═══════════════════════════════════════════════════════════════
// DEFAULT INITIALIZATION
// ═══════════════════════════════════════════════════════════════

/**
 * Ensure default settings exist. Called on first read or at app init.
 * Safe to call multiple times — uses upsert with ignoreDuplicates.
 */
export async function ensureDefaultSettings(): Promise<void> {
  const client = getClient();
  const { error } = await client
    .from('platform_settings')
    .upsert(
      {
        setting_key: SETTING_KEYS.CONTENT_STUDIO_GENERATION,
        setting_value: DEFAULT_CONTENT_STUDIO_GENERATION,
        description: 'Content Studio generation engine configuration. Controls whether creatives are generated as HTML or Scene JSON.',
      },
      { onConflict: 'setting_key', ignoreDuplicates: true }
    );

  if (error) {
    console.error('[PlatformSettings] ensureDefaultSettings error:', error.message);
  }
}
