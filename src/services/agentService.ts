/**
 * Agent Service — hiring agents, giving them tasks, and reviewing their work.
 *
 * Definitions live in `agents` (admin-managed). A founder hires an agent for
 * a brand (`agent_hires`), gives it a task (`automation_runs` + steps), and
 * the run-step edge function executes it. Approvals are the "needs you" inbox.
 *
 * Quotes come from pricingService so the number the founder sees is the one
 * the runner reserves.
 */

import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_CONFIG } from '@/config/supabaseConfig';
import { quoteAction, type Quote } from './pricingService';
import {
  planSingleAgentRun,
  planHiveRun,
  hiveBudget,
  normalizeUnits,
  nextRunAt,
  DEFAULT_BUDGET,
  DEFAULT_POLICY,
  type ScheduleInterval,
  type HiveStage,
  type AgentDefinition,
  type RunBudget,
  type RunPolicy,
  type RunStatus,
  type StepStatus,
  type StepType,
  type TaskInput,
} from '@shared/runner';

export type { AgentDefinition, RunPolicy, RunBudget, TaskInput, RunStatus, StepStatus, ScheduleInterval, HiveStage } from '@shared/runner';
export { SCHEDULE_INTERVALS } from '@shared/runner';

const db = supabase as any;

// ─── Types ──────────────────────────────────────────────────

export interface Agent extends AgentDefinition {
  tagline: string | null;
  description: string | null;
  suited_stages: string[];
  is_active: boolean;
  sort_order: number;
}

export interface AgentHire {
  id: string;
  brand_id: string;
  user_id: string;
  agent_id: string;
  status: 'active' | 'paused';
  monthly_budget_credits: number | null;
  nickname: string | null;
  created_at: string;
  agent: Agent;
}

export interface RunStep {
  id: string;
  run_id: string;
  step_index: number;
  type: StepType;
  name: string;
  status: StepStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  credits_captured: number;
  cost_usd: number;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
}

export interface AutomationRun {
  id: string;
  automation_id: string | null;
  brand_id: string;
  user_id: string;
  agent_id: string | null;
  name: string;
  trigger_type: string;
  status: RunStatus;
  input: TaskInput;
  output: Record<string, unknown> | null;
  policy: RunPolicy;
  budget: RunBudget;
  credits_quoted: number;
  credits_reserved: number;
  credits_captured: number;
  current_step: number;
  paused_reason: string | null;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  agent?: Agent | null;
  steps?: RunStep[];
}

export interface Approval {
  id: string;
  run_id: string;
  step_id: string | null;
  brand_id: string;
  user_id: string;
  kind: string;
  title: string;
  payload: { output?: Record<string, unknown> | null; step_name?: string | null };
  status: 'pending' | 'approved' | 'rejected';
  note: string | null;
  decided_at: string | null;
  created_at: string;
  run?: Pick<AutomationRun, 'id' | 'name' | 'agent_id' | 'credits_captured' | 'status'> & { agent?: Pick<Agent, 'name' | 'slug'> | null };
}

// ─── Agents and hires ──────────────────────────────────────

export async function listAgents(): Promise<Agent[]> {
  const { data, error } = await db.from('agents').select('*').eq('is_active', true).order('sort_order');
  if (error) {
    console.error('[Agents] listAgents error:', error.message);
    return [];
  }
  return data ?? [];
}

export async function listHires(brandId: string): Promise<AgentHire[]> {
  const { data, error } = await db
    .from('agent_hires')
    .select('*, agent:agents(*)')
    .eq('brand_id', brandId)
    .order('created_at');
  if (error) {
    console.error('[Agents] listHires error:', error.message);
    return [];
  }
  return (data ?? []).filter((h: any) => h.agent);
}

export async function hireAgent(brandId: string, userId: string, agentId: string): Promise<{ success: boolean; error?: string; hire?: AgentHire }> {
  const { data, error } = await db
    .from('agent_hires')
    .upsert({ brand_id: brandId, user_id: userId, agent_id: agentId, status: 'active' }, { onConflict: 'brand_id,agent_id' })
    .select('*, agent:agents(*)')
    .single();
  if (error) return { success: false, error: error.message };
  return { success: true, hire: data };
}

export async function setHireStatus(hireId: string, status: 'active' | 'paused'): Promise<boolean> {
  const { error } = await db.from('agent_hires').update({ status }).eq('id', hireId);
  return !error;
}

export async function removeHire(hireId: string): Promise<boolean> {
  const { error } = await db.from('agent_hires').delete().eq('id', hireId);
  return !error;
}

// ─── Quotes ─────────────────────────────────────────────────

/** Quote a task for an agent: the number shown before the founder clicks Run. */
export async function quoteAgentTask(agent: Pick<Agent, 'action_type'>, input: TaskInput): Promise<Quote> {
  return quoteAction({ actionType: agent.action_type, units: normalizeUnits(input.units) });
}

// ─── Runs ───────────────────────────────────────────────────

export interface CreateRunInput {
  brandId: string;
  userId: string;
  agent: Agent;
  name: string;
  input: TaskInput;
  policy?: RunPolicy;
  budget?: Partial<RunBudget>;
  automationId?: string | null;
}

/**
 * Create a run and kick the runner. The quote's max is what gets reserved, so
 * the founder is never charged more than they were shown.
 */
export async function createRun(params: CreateRunInput): Promise<{ success: boolean; error?: string; run?: AutomationRun; quote?: Quote }> {
  const { brandId, userId, agent, name, input } = params;
  const policy = params.policy ?? DEFAULT_POLICY;
  const quote = await quoteAgentTask(agent, input);
  if (!quote.fromRule) return { success: false, error: `No pricing rule for ${agent.name} (${agent.action_type}). Ask an admin to add one.` };

  const budget: RunBudget = {
    ...DEFAULT_BUDGET,
    credits_per_run: Math.min(DEFAULT_BUDGET.credits_per_run, agent.per_run_credit_ceiling),
    ...(params.budget ?? {}),
  };
  const steps = planSingleAgentRun(agent, input, policy);

  const { data: run, error } = await db
    .from('automation_runs')
    .insert({
      brand_id: brandId,
      user_id: userId,
      agent_id: agent.id,
      automation_id: params.automationId ?? null,
      name: name.trim() || `${agent.name} task`,
      trigger_type: 'manual',
      status: 'queued',
      input: { ...input, units: normalizeUnits(input.units) },
      policy,
      budget,
      credits_quoted: quote.estimate,
      credits_reserved: quote.max,
    })
    .select('*')
    .single();
  if (error) return { success: false, error: error.message };

  const { error: stepErr } = await db.from('automation_run_steps').insert(
    steps.map((s) => ({ run_id: run.id, step_index: s.step_index, type: s.type, name: s.name, input: s.input }))
  );
  if (stepErr) {
    await db.from('automation_runs').update({ status: 'failed', error: stepErr.message }).eq('id', run.id);
    return { success: false, error: stepErr.message };
  }

  // Fire and forget: the run is durable in the database and the tick picks
  // up anything the direct kick misses.
  void kickRun(run.id);
  return { success: true, run, quote };
}

/** Ask the runner to advance a run now. Returns what the runner reported. */
export async function kickRun(runId: string): Promise<{ success: boolean; status?: string; error?: string }> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { success: false, error: 'Not signed in' };
    const res = await fetch(`${SUPABASE_CONFIG.url}/functions/v1/run-step`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_CONFIG.anonKey, Authorization: `Bearer ${token}` },
      body: JSON.stringify({ runId }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.success) return { success: false, error: body?.error ?? `run-step returned ${res.status}` };
    return { success: true, status: body.status };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Could not reach the runner' };
  }
}

export async function listRuns(brandId: string, limit = 20): Promise<AutomationRun[]> {
  const { data, error } = await db
    .from('automation_runs')
    .select('*, agent:agents(id, slug, name, role, cost_indicator, unit_label, action_type)')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[Agents] listRuns error:', error.message);
    return [];
  }
  return data ?? [];
}

export async function getRun(runId: string): Promise<AutomationRun | null> {
  const [{ data: run }, { data: steps }] = await Promise.all([
    db.from('automation_runs').select('*, agent:agents(*)').eq('id', runId).maybeSingle(),
    db.from('automation_run_steps').select('*').eq('run_id', runId).order('step_index'),
  ]);
  if (!run) return null;
  return { ...run, steps: steps ?? [] };
}

/** Resume a paused run (after a top-up, or raising the budget). */
export async function resumeRun(runId: string, budget?: Partial<RunBudget>): Promise<{ success: boolean; error?: string }> {
  const patch: Record<string, unknown> = { status: 'running', paused_reason: null };
  if (budget) {
    const { data: cur } = await db.from('automation_runs').select('budget, generation_id').eq('id', runId).maybeSingle();
    patch.budget = { ...(cur?.budget ?? DEFAULT_BUDGET), ...budget };
    // A run that never reserved (paused for balance) goes back to queued so
    // the runner reserves on its next touch.
    if (!cur?.generation_id) patch.status = 'queued';
  } else {
    const { data: cur } = await db.from('automation_runs').select('generation_id').eq('id', runId).maybeSingle();
    if (!cur?.generation_id) patch.status = 'queued';
  }
  const { error } = await db.from('automation_runs').update(patch).eq('id', runId);
  if (error) return { success: false, error: error.message };
  return kickRun(runId);
}

export async function cancelRun(runId: string): Promise<boolean> {
  const { error } = await db
    .from('automation_runs')
    .update({ status: 'cancelled', finished_at: new Date().toISOString() })
    .eq('id', runId)
    .in('status', ['queued', 'paused', 'waiting_approval']);
  if (error) return false;
  // Let the runner release the reservation if one exists.
  void kickRun(runId);
  return true;
}

// ─── Approvals ──────────────────────────────────────────────

export async function listPendingApprovals(brandId: string): Promise<Approval[]> {
  const { data, error } = await db
    .from('approvals')
    .select('*, run:automation_runs(id, name, agent_id, credits_captured, status, agent:agents(name, slug))')
    .eq('brand_id', brandId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[Agents] listPendingApprovals error:', error.message);
    return [];
  }
  return data ?? [];
}

export async function decideApproval(
  approvalId: string,
  decision: 'approved' | 'rejected',
  userId: string,
  note?: string
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await db
    .from('approvals')
    .update({ status: decision, note: note ?? null, decided_at: new Date().toISOString(), decided_by: userId })
    .eq('id', approvalId)
    .eq('status', 'pending')
    .select('run_id')
    .single();
  if (error) return { success: false, error: error.message };
  return kickRun(data.run_id);
}

// ─── Output helpers for the UI ─────────────────────────────

export interface OutputItem {
  platform?: string;
  title?: string;
  body?: string;
  hashtags?: string[];
  cta?: string;
}

/** Items most agents produce; empty when the output has another shape. */
export function outputItems(output: Record<string, unknown> | null | undefined): OutputItem[] {
  const items = output && Array.isArray((output as any).items) ? (output as any).items : [];
  return items.filter((i: any) => i && typeof i === 'object');
}

/** Flatten an output into plain text for copy/paste. */
export function outputToText(output: Record<string, unknown> | null | undefined): string {
  if (!output) return '';
  const parts: string[] = [];
  if (typeof output.brief === 'string') parts.push(output.brief);
  if (Array.isArray((output as any).headlines)) parts.push(`Headlines:\n- ${(output as any).headlines.join('\n- ')}`);
  for (const it of outputItems(output)) {
    const head = [it.platform, it.title].filter(Boolean).join(' · ');
    parts.push(`${head ? head + '\n' : ''}${it.body ?? ''}${it.hashtags?.length ? '\n' + it.hashtags.map((h) => (h.startsWith('#') ? h : '#' + h)).join(' ') : ''}${it.cta ? '\n' + it.cta : ''}`);
  }
  if (Array.isArray((output as any).findings)) {
    for (const f of (output as any).findings) parts.push(`${f.heading}\n${f.body}`);
  }
  if (Array.isArray((output as any).recommendations)) parts.push(`Recommendations:\n- ${(output as any).recommendations.join('\n- ')}`);
  if (typeof output.notes === 'string' && output.notes) parts.push(`Notes: ${output.notes}`);
  return parts.join('\n\n');
}

// ─── Automations (standing tasks on a schedule) ─────────────

export interface Automation {
  id: string;
  brand_id: string;
  user_id: string;
  agent_id: string | null;
  name: string;
  trigger_type: 'manual' | 'schedule' | 'webhook';
  schedule_interval: ScheduleInterval | null;
  webhook_secret: string | null;
  next_run_at: string | null;
  task_input: TaskInput;
  policy: RunPolicy;
  budget: RunBudget;
  status: 'active' | 'paused' | 'archived';
  last_run_at: string | null;
  created_at: string;
  agent?: Pick<Agent, 'id' | 'slug' | 'name' | 'unit_label' | 'action_type' | 'per_run_credit_ceiling' | 'cost_indicator'> | null;
}

export async function listAutomations(brandId: string): Promise<Automation[]> {
  const { data, error } = await db
    .from('automations')
    .select('*, agent:agents(id, slug, name, unit_label, action_type, per_run_credit_ceiling, cost_indicator)')
    .eq('brand_id', brandId)
    .neq('status', 'archived')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[Agents] listAutomations error:', error.message);
    return [];
  }
  return data ?? [];
}

export interface CreateAutomationInput {
  brandId: string;
  userId: string;
  agent: Agent;
  name: string;
  input: TaskInput;
  interval: ScheduleInterval;
  /** schedule (default) fires on the interval; webhook fires when another system calls in */
  trigger?: 'schedule' | 'webhook';
  policy?: RunPolicy;
  budget?: Partial<RunBudget>;
  /** Also start the first run right away (default true). */
  runNow?: boolean;
}

function newWebhookSecret(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return 'whk_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * A standing task: the cron tick turns it into a run whenever next_run_at
 * passes. With runNow the first run starts immediately and the schedule
 * counts from now.
 */
export async function createAutomation(params: CreateAutomationInput): Promise<{ success: boolean; error?: string; automation?: Automation; run?: AutomationRun }> {
  const { brandId, userId, agent, name, input, interval } = params;
  const policy = params.policy ?? DEFAULT_POLICY;
  const budget: RunBudget = {
    ...DEFAULT_BUDGET,
    credits_per_run: Math.min(DEFAULT_BUDGET.credits_per_run, agent.per_run_credit_ceiling),
    ...(params.budget ?? {}),
  };
  const trigger = params.trigger ?? 'schedule';
  const runNow = trigger === 'schedule' && params.runNow !== false;
  const { data, error } = await db
    .from('automations')
    .insert({
      brand_id: brandId,
      user_id: userId,
      agent_id: agent.id,
      name: name.trim() || `${agent.name} · ${trigger === 'webhook' ? 'webhook' : interval}`,
      trigger_type: trigger,
      schedule_interval: trigger === 'schedule' ? interval : null,
      next_run_at: trigger === 'schedule' ? nextRunAt(interval, new Date()).toISOString() : null,
      webhook_secret: trigger === 'webhook' ? newWebhookSecret() : null,
      task_input: { ...input, units: normalizeUnits(input.units) },
      policy,
      budget,
      status: 'active',
      last_run_at: runNow ? new Date().toISOString() : null,
    })
    .select('*')
    .single();
  if (error) return { success: false, error: error.message };

  let run: AutomationRun | undefined;
  if (runNow) {
    const r = await createRun({ brandId, userId, agent, name: data.name, input, policy, budget, automationId: data.id });
    if (!r.success) return { success: false, error: r.error, automation: data };
    run = r.run;
  }
  return { success: true, automation: data, run };
}

export async function setAutomationStatus(id: string, status: 'active' | 'paused' | 'archived'): Promise<boolean> {
  const patch: Record<string, unknown> = { status };
  if (status === 'active') {
    // Resuming reschedules from now rather than firing a backlog of missed runs.
    const { data } = await db.from('automations').select('schedule_interval').eq('id', id).maybeSingle();
    if (data?.schedule_interval) patch.next_run_at = nextRunAt(data.schedule_interval, new Date()).toISOString();
  }
  const { error } = await db.from('automations').update(patch).eq('id', id);
  return !error;
}

/** Start a run from an automation now, and push the schedule forward. */
export async function runAutomationNow(automation: Automation, userId: string): Promise<{ success: boolean; error?: string; run?: AutomationRun }> {
  const { data: agent } = await db.from('agents').select('*').eq('id', automation.agent_id).maybeSingle();
  if (!agent) return { success: false, error: 'This automation has no agent attached.' };
  const r = await createRun({
    brandId: automation.brand_id,
    userId,
    agent,
    name: automation.name,
    input: automation.task_input,
    policy: automation.policy,
    budget: automation.budget,
    automationId: automation.id,
  });
  if (r.success && automation.schedule_interval) {
    await db.from('automations').update({ last_run_at: new Date().toISOString(), next_run_at: nextRunAt(automation.schedule_interval, new Date()).toISOString() }).eq('id', automation.id);
  }
  return r;
}

// ─── Hives ──────────────────────────────────────────────────

/** Sum of the stages' quotes; the hive reserves the sum of their maxes. */
export async function quoteHive(stages: HiveStage[]): Promise<Quote> {
  const quotes = await Promise.all(stages.map((st) => quoteAction({ actionType: st.agent.action_type, units: normalizeUnits(st.units) })));
  const estimate = quotes.reduce((a, q) => a + q.estimate, 0);
  const max = quotes.reduce((a, q) => a + q.max, 0);
  const min = quotes.reduce((a, q) => a + q.min, 0);
  return {
    actionType: 'hive',
    mode: quotes.some((q) => q.mode === 'metered') ? 'metered' : 'fixed',
    estimate,
    min,
    max,
    retailUsd: Math.round(quotes.reduce((a, q) => a + q.retailUsd, 0) * 100) / 100,
    breakdown: stages.map((st, i) => ({ label: `${st.agent.name} × ${normalizeUnits(st.units)} ${st.agent.unit_label}${normalizeUnits(st.units) === 1 ? '' : 's'}`, value: `${quotes[i].estimate}` })),
    fromRule: quotes.every((q) => q.fromRule),
  };
}

export interface CreateHiveInput {
  brandId: string;
  userId: string;
  name: string;
  stages: HiveStage[];
  input: TaskInput;
  policy?: RunPolicy;
}

/** A run where several agents hand off in order; the first agent is the run's "owner". */
export async function createHiveRun(params: CreateHiveInput): Promise<{ success: boolean; error?: string; run?: AutomationRun; quote?: Quote }> {
  const { brandId, userId, name, stages, input } = params;
  if (stages.length < 2) return { success: false, error: 'A team task needs at least two agents.' };
  const policy = params.policy ?? DEFAULT_POLICY;
  const quote = await quoteHive(stages);
  if (!quote.fromRule) return { success: false, error: 'One of the agents has no pricing rule.' };
  const steps = planHiveRun(stages, input, policy);
  const budget = hiveBudget(stages);

  const { data: run, error } = await db
    .from('automation_runs')
    .insert({
      brand_id: brandId,
      user_id: userId,
      agent_id: stages[0].agent.id,
      name: name.trim() || stages.map((s) => s.agent.name).join(' → '),
      trigger_type: 'manual',
      status: 'queued',
      input: { ...input, units: normalizeUnits(input.units), hive: stages.map((s) => s.agent.slug) },
      policy,
      budget,
      credits_quoted: quote.estimate,
      credits_reserved: quote.max,
    })
    .select('*')
    .single();
  if (error) return { success: false, error: error.message };
  const { error: stepErr } = await db.from('automation_run_steps').insert(steps.map((st) => ({ run_id: run.id, step_index: st.step_index, type: st.type, name: st.name, input: st.input })));
  if (stepErr) {
    await db.from('automation_runs').update({ status: 'failed', error: stepErr.message }).eq('id', run.id);
    return { success: false, error: stepErr.message };
  }
  void kickRun(run.id);
  return { success: true, run, quote };
}
