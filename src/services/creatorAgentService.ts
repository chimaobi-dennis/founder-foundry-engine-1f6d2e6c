/**
 * Creator Agent Service — the marketplace side of agents.
 *
 * An approved creator drafts an agent, submits it for review, and an admin
 * publishes it. The database trigger guard_creator_agent() decides what a
 * creator may set; this service only shapes rows and reads earnings.
 */

import { supabase } from '@/integrations/supabase/client';
import { creatorAgentSlug, customActionType } from '@shared/runner';
import type { Agent } from '@/services/agentService';

const db = supabase as any;

export type AgentStatus = 'draft' | 'pending_review' | 'published' | 'unpublished';

export interface CreatorAgent extends Agent {
  creator_id: string | null;
  status: AgentStatus;
  admin_notes: string | null;
  revenue_share_pct: number;
  uses_count: number;
  submitted_at: string | null;
  reviewed_at: string | null;
  creator?: { display_name: string } | null;
}

export interface CreatorAgentInput {
  name: string;
  role: string;
  tagline: string;
  description: string;
  system_prompt: string;
  model_tier: 'fast' | 'standard' | 'reasoning';
  unit_label: string;
  suited_stages: string[];
  per_run_credit_ceiling: number;
}

export const STATUS_LABEL: Record<AgentStatus, string> = {
  draft: 'Draft',
  pending_review: 'In review',
  published: 'Published',
  unpublished: 'Unpublished',
};

/** Validation shared by the editor and the submit button. */
export function validateAgentInput(a: CreatorAgentInput): string | null {
  if (a.name.trim().length < 3) return 'Give the agent a name of at least 3 characters.';
  if (a.role.trim().length < 3) return 'Say what role it plays (e.g. "Email writer").';
  if (a.description.trim().length < 40) return 'Describe what it does in at least 40 characters; founders choose from this.';
  if (a.system_prompt.trim().length < 120) return 'The instructions need at least 120 characters.';
  if (/\b(ignore|disregard)\b.*\b(brand|context|instructions)\b/i.test(a.system_prompt)) return 'Instructions must not tell the model to ignore the brand context.';
  if (!a.unit_label.trim()) return 'Name the unit of work (caption, email, brief…).';
  return null;
}

export async function listMyAgents(creatorId: string): Promise<CreatorAgent[]> {
  const { data, error } = await db.from('agents').select('*').eq('creator_id', creatorId).order('created_at', { ascending: false });
  if (error) { console.error('[CreatorAgents] list error:', error.message); return []; }
  return data ?? [];
}

export async function getMyAgent(id: string): Promise<CreatorAgent | null> {
  const { data } = await db.from('agents').select('*').eq('id', id).maybeSingle();
  return data ?? null;
}

function rowFrom(creatorId: string, a: CreatorAgentInput, seed: string) {
  return {
    creator_id: creatorId,
    slug: creatorAgentSlug(a.name, seed),
    name: a.name.trim(),
    role: a.role.trim(),
    tagline: a.tagline.trim() || null,
    description: a.description.trim(),
    system_prompt: a.system_prompt.trim(),
    model_tier: a.model_tier,
    action_type: customActionType(a.model_tier),
    unit_label: a.unit_label.trim().toLowerCase(),
    per_run_credit_ceiling: Math.min(300, Math.max(10, Math.floor(a.per_run_credit_ceiling) || 150)),
    suited_stages: a.suited_stages,
    output_spec: { type: 'items', fields: ['title', 'body'] },
  };
}

export async function createMyAgent(creatorId: string, a: CreatorAgentInput, submit = false): Promise<{ success: boolean; error?: string; agent?: CreatorAgent }> {
  const v = validateAgentInput(a);
  if (v) return { success: false, error: v };
  const seed = crypto.randomUUID();
  const { data, error } = await db.from('agents').insert({ ...rowFrom(creatorId, a, seed), status: submit ? 'pending_review' : 'draft' }).select('*').single();
  if (error) return { success: false, error: friendly(error.message) };
  return { success: true, agent: data };
}

export async function updateMyAgent(id: string, creatorId: string, a: CreatorAgentInput, submit = false): Promise<{ success: boolean; error?: string; agent?: CreatorAgent }> {
  const v = validateAgentInput(a);
  if (v) return { success: false, error: v };
  const { slug: _slug, ...patch } = rowFrom(creatorId, a, id);
  const { data, error } = await db.from('agents').update({ ...patch, ...(submit ? { status: 'pending_review' } : {}) }).eq('id', id).select('*').single();
  if (error) return { success: false, error: friendly(error.message) };
  return { success: true, agent: data };
}

/** Creators may pause and resume a reviewed agent without a new review. */
export async function setMyAgentStatus(id: string, status: 'published' | 'unpublished'): Promise<boolean> {
  const { error } = await db.from('agents').update({ status }).eq('id', id);
  return !error;
}

function friendly(msg: string): string {
  if (/creator_profiles|row-level security/i.test(msg)) return 'Only approved creators can publish agents. Apply from the Creator page first.';
  if (/agents_slug_key/i.test(msg)) return 'An agent with that name already exists; pick another.';
  return msg;
}

// ─── Earnings ───────────────────────────────────────────────

export interface EarningRow {
  id: string;
  agent_id: string | null;
  credits: number;
  share_pct: number;
  amount_usd: number;
  paid_at: string | null;
  created_at: string;
  agent?: { name: string } | null;
}

export interface EarningsSummary {
  totalUsd: number;
  unpaidUsd: number;
  thisMonthUsd: number;
  runs: number;
  rows: EarningRow[];
}

export async function getMyEarnings(creatorId: string, limit = 50): Promise<EarningsSummary> {
  const { data, error } = await db.from('creator_earnings').select('*, agent:agents(name)').eq('creator_id', creatorId).order('created_at', { ascending: false }).limit(500);
  if (error) { console.error('[CreatorAgents] earnings error:', error.message); return { totalUsd: 0, unpaidUsd: 0, thisMonthUsd: 0, runs: 0, rows: [] }; }
  const rows: EarningRow[] = (data ?? []).map((r: any) => ({ ...r, amount_usd: Number(r.amount_usd) || 0 }));
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  return {
    totalUsd: rows.reduce((s, r) => s + r.amount_usd, 0),
    unpaidUsd: rows.filter((r) => !r.paid_at).reduce((s, r) => s + r.amount_usd, 0),
    thisMonthUsd: rows.filter((r) => new Date(r.created_at).getTime() >= monthStart).reduce((s, r) => s + r.amount_usd, 0),
    runs: rows.length,
    rows: rows.slice(0, limit),
  };
}

// ─── Admin review ───────────────────────────────────────────

export async function adminListAgents(status?: AgentStatus): Promise<CreatorAgent[]> {
  let q = db.from('agents').select('*, creator:creator_profiles(display_name)').not('creator_id', 'is', null).order('submitted_at', { ascending: false, nullsFirst: false });
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) { console.error('[CreatorAgents] admin list error:', error.message); return []; }
  return data ?? [];
}

export async function adminReviewAgent(id: string, decision: 'publish' | 'request_changes' | 'unpublish', notes: string, revenueSharePct?: number): Promise<{ success: boolean; error?: string }> {
  const status: AgentStatus = decision === 'publish' ? 'published' : decision === 'unpublish' ? 'unpublished' : 'draft';
  const patch: Record<string, unknown> = { status, admin_notes: notes.trim() || null };
  if (revenueSharePct != null) patch.revenue_share_pct = Math.min(90, Math.max(0, Math.floor(revenueSharePct)));
  const { error } = await db.from('agents').update(patch).eq('id', id);
  return error ? { success: false, error: error.message } : { success: true };
}

export async function adminMarkPaid(creatorId: string): Promise<{ success: boolean; error?: string; count?: number }> {
  const { data, error } = await db.from('creator_earnings').update({ paid_at: new Date().toISOString() }).eq('creator_id', creatorId).is('paid_at', null).select('id');
  return error ? { success: false, error: error.message } : { success: true, count: data?.length ?? 0 };
}
