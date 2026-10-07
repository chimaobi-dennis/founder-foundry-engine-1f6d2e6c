/**
 * Team memory — read and prune what the agents remember about a brand.
 * Rows are written by the runner; founders can read them and delete any.
 */

import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;

export interface TeamMemory {
  id: string;
  kind: 'run_summary' | 'outcome' | 'feedback';
  title: string;
  summary: string;
  created_at: string;
  run_id: string | null;
}

export const MEMORY_KIND_LABEL: Record<TeamMemory['kind'], string> = {
  run_summary: 'Work',
  outcome: 'Outcome',
  feedback: 'Your feedback',
};

export async function listTeamMemories(brandId: string, limit = 20): Promise<TeamMemory[]> {
  const { data, error } = await db
    .from('brand_memories')
    .select('id, kind, title, summary, created_at, run_id')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    // The table arrives with the step 4 migration; until then there is nothing to show.
    if (!/brand_memories|schema cache|does not exist/i.test(error.message)) console.error('[Memory] list error:', error.message);
    return [];
  }
  return data ?? [];
}

export async function deleteTeamMemory(id: string): Promise<boolean> {
  const { error } = await db.from('brand_memories').delete().eq('id', id);
  return !error;
}
