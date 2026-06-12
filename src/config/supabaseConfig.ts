/**
 * supabaseConfig.ts
 *
 * Dedicated, NON-managed source of truth for Supabase connection settings.
 *
 * Why this exists:
 *   `.env` (VITE_SUPABASE_*) is auto-managed by Lovable Cloud and may be
 *   regenerated, which can revert the project away from the external
 *   Supabase instance used in preview. This file is hand-maintained and
 *   takes precedence so the external project stays consistent.
 *
 * Resolution order (first defined wins):
 *   1. Runtime override on `window.__KINIKA_SUPABASE__`
 *      (useful for staging/QA without a rebuild)
 *   2. Hardcoded EXTERNAL_SUPABASE constants below
 *   3. Vite env vars (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
 *
 * The anon/publishable key is safe to commit (it's public by design and
 * gated by RLS). Never put service_role keys here.
 */

// ─── Hardcoded external project (preferred) ──────────────────
const EXTERNAL_SUPABASE_URL = 'https://ypwfruanfcaleuqhgskw.supabase.co';
const EXTERNAL_SUPABASE_ANON_KEY = 'sb_publishable_G9GgIMCKLehQTmRuMVOnPA_i85Nbd-O';

// ─── Runtime override type ──────────────────────────────────
declare global {
  interface Window {
    __KINIKA_SUPABASE__?: {
      url?: string;
      anonKey?: string;
    };
  }
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  source: 'runtime' | 'hardcoded' | 'env';
}

function readRuntimeOverride(): Partial<SupabaseConfig> {
  if (typeof window === 'undefined') return {};
  const o = window.__KINIKA_SUPABASE__;
  if (!o) return {};
  return { url: o.url, anonKey: o.anonKey };
}

export function getSupabaseConfig(): SupabaseConfig {
  const runtime = readRuntimeOverride();
  if (runtime.url && runtime.anonKey) {
    return { url: runtime.url, anonKey: runtime.anonKey, source: 'runtime' };
  }

  if (EXTERNAL_SUPABASE_URL && EXTERNAL_SUPABASE_ANON_KEY) {
    return {
      url: EXTERNAL_SUPABASE_URL,
      anonKey: EXTERNAL_SUPABASE_ANON_KEY,
      source: 'hardcoded',
    };
  }

  const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (envUrl && envKey) {
    return { url: envUrl, anonKey: envKey, source: 'env' };
  }

  throw new Error(
    '[supabaseConfig] No Supabase configuration found. Set EXTERNAL_SUPABASE_* in src/config/supabaseConfig.ts or VITE_SUPABASE_* in .env.'
  );
}

export const SUPABASE_CONFIG = getSupabaseConfig();

if (import.meta.env.DEV) {
  // eslint-disable-next-line no-console
  console.info(`[supabaseConfig] Using ${SUPABASE_CONFIG.source} config → ${SUPABASE_CONFIG.url}`);
}
