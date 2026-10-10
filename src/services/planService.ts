/**
 * Plan Service — the founder's plan: targets, tasks, and who does them.
 * Mentor builds and revises it (founder-plan function); founders edit rows
 * directly; delegating a task links it to an agent run, and the database
 * marks the task done when the run completes.
 */

import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_CONFIG } from '@/config/supabaseConfig';
import { matchByTitle, type PlanEditOp, type PlaybookChoice } from '@shared/plan';

const db = supabase as any;

export type TaskStatus = 'todo' | 'doing' | 'done' | 'skipped';
export type TargetStatus = 'upcoming' | 'current' | 'done';

export interface PlanTask {
  id: string;
  plan_id: string;
  target_id: string;
  title: string;
  detail: string | null;
  position: number;
  status: TaskStatus;
  owner: 'founder' | 'agent';
  agent_slug: string | null;
  agent_brief: string | null;
  run_id: string | null;
  done_at: string | null;
}

export interface PlanTarget {
  id: string;
  title: string;
  why: string | null;
  position: number;
  status: TargetStatus;
  tasks: PlanTask[];
}

export interface FounderPlan {
  id: string;
  brand_id: string;
  title: string;
  summary: string | null;
  founder_type: string | null;
  version: number;
  built_at: string;
  /** Revise on milestones and stage changes (the runner does it a few minutes later). */
  auto_revise: boolean;
  /** Why the last revision happened: "Milestone reached: …", "You asked: …". */
  last_revision_reason: string | null;
  /** Something happened and a revision is queued. */
  revise_pending: boolean;
  next_checkin_at: string | null;
  targets: PlanTarget[];
}

export async function getPlan(brandId: string): Promise<FounderPlan | null> {
  const { data, error } = await db.from('brand_plans').select('*, plan_targets(*, plan_tasks(*))').eq('brand_id', brandId).maybeSingle();
  if (error) {
    if (!/brand_plans|schema cache|does not exist/i.test(error.message)) console.error('[Plan] getPlan error:', error.message);
    return null;
  }
  if (!data) return null;
  const targets: PlanTarget[] = (data.plan_targets ?? [])
    .map((t: any) => ({ id: t.id, title: t.title, why: t.why, position: t.position, status: t.status, tasks: (t.plan_tasks ?? []).sort((a: any, b: any) => a.position - b.position) }))
    .sort((a: PlanTarget, b: PlanTarget) => a.position - b.position);
  return {
    id: data.id, brand_id: data.brand_id, title: data.title, summary: data.summary, founder_type: data.founder_type, version: data.version, built_at: data.built_at,
    auto_revise: data.auto_revise ?? true, last_revision_reason: data.last_revision_reason ?? null, revise_pending: !!data.revise_note, next_checkin_at: data.next_checkin_at ?? null,
    targets,
  };
}

/** Intake import: a brand that just told Kinika about itself gets a plan without being asked, unless it has one. */
export async function ensurePlan(brandId: string): Promise<void> {
  try {
    const { count } = await db.from('brand_plans').select('id', { count: 'exact', head: true }).eq('brand_id', brandId);
    if (count) return;
    const r = await buildPlan(brandId);
    if (!r.success) console.warn('[Plan] ensurePlan skipped:', r.error);
  } catch (e: any) {
    console.warn('[Plan] ensurePlan failed:', e?.message);
  }
}

export async function setAutoRevise(planId: string, on: boolean): Promise<boolean> {
  const { error } = await db.from('brand_plans').update({ auto_revise: on }).eq('id', planId);
  return !error;
}

async function callPlanFunction(body: Record<string, unknown>): Promise<{ success: boolean; error?: string; targets?: number; tasks?: number; modelUsed?: string }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { success: false, error: 'Not signed in' };
  try {
    const res = await fetch(`${SUPABASE_CONFIG.url}/functions/v1/founder-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_CONFIG.anonKey, Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    return json ?? { success: false, error: `The plan builder returned ${res.status}` };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Could not reach the plan builder' };
  }
}

/** Ask Mentor to write a plan from everything the brand has told it. Replaces any existing plan. */
export function buildPlan(brandId: string, note?: string, playbook: PlaybookChoice = 'auto') {
  return callPlanFunction({ action: 'build', brandId, note, playbook });
}

/** Revise the plan with a note; done tasks and the founder's edits are kept. */
export function revisePlan(brandId: string, note: string) {
  return callPlanFunction({ action: 'revise', brandId, note });
}

export async function setTaskStatus(task: Pick<PlanTask, 'id' | 'plan_id'>, status: TaskStatus): Promise<boolean> {
  const { error } = await db.from('plan_tasks').update({ status, done_at: status === 'done' ? new Date().toISOString() : null }).eq('id', task.id);
  if (error) return false;
  await db.rpc('plan_mark_done_targets', { p_plan_id: task.plan_id });
  await db.rpc('plan_recompute_current', { p_plan_id: task.plan_id });
  return true;
}

export async function updateTask(id: string, patch: Partial<Pick<PlanTask, 'title' | 'detail' | 'owner' | 'agent_slug' | 'agent_brief'>>): Promise<boolean> {
  const { error } = await db.from('plan_tasks').update(patch).eq('id', id);
  return !error;
}

export async function addTask(plan: Pick<FounderPlan, 'id' | 'brand_id'>, targetId: string, title: string, position: number): Promise<PlanTask | null> {
  const { data, error } = await db.from('plan_tasks').insert({ plan_id: plan.id, target_id: targetId, brand_id: plan.brand_id, title: title.trim(), position }).select('*').single();
  return error ? null : data;
}

export async function deleteTask(id: string): Promise<boolean> {
  const { error } = await db.from('plan_tasks').delete().eq('id', id);
  return !error;
}

/** Tie a task to the run that is doing it; the database flips it to done when the run completes. */
export async function linkTaskToRun(taskId: string, runId: string): Promise<boolean> {
  const { error } = await db.from('plan_tasks').update({ run_id: runId, status: 'doing' }).eq('id', taskId);
  return !error;
}

/** Where "hand this to an agent" sends the founder: the Team page with Describe-it prefilled. */
export function delegateUrl(task: Pick<PlanTask, 'id' | 'title' | 'agent_brief' | 'agent_slug'>): string {
  const brief = task.agent_brief || task.title;
  const p = new URLSearchParams({ describe: brief, task: task.id });
  if (task.agent_slug) p.set('agent', task.agent_slug);
  return `/team?${p.toString()}`;
}

/** The next things to do: current target first, undone tasks in order. */
export function nextTasks(plan: FounderPlan | null, n = 3): { target: PlanTarget; task: PlanTask }[] {
  if (!plan) return [];
  const out: { target: PlanTarget; task: PlanTask }[] = [];
  for (const t of plan.targets) {
    if (t.status === 'done') continue;
    for (const k of t.tasks) {
      if (k.status === 'todo' || k.status === 'doing') out.push({ target: t, task: k });
      if (out.length >= n) return out;
    }
  }
  return out;
}

export function planProgress(plan: FounderPlan | null): { done: number; total: number } {
  if (!plan) return { done: 0, total: 0 };
  const all = plan.targets.flatMap((t) => t.tasks).filter((k) => k.status !== 'skipped');
  return { done: all.filter((k) => k.status === 'done').length, total: all.length };
}

/**
 * Apply edits Mentor made in chat (<PLAN_EDIT> ops). Titles are matched to
 * the plan's rows; anything that does not match is skipped. Returns one short
 * line per change for the founder.
 */
export async function applyPlanEdits(brandId: string, ops: PlanEditOp[]): Promise<string[]> {
  const plan = await getPlan(brandId);
  if (!plan) return [];
  const done: string[] = [];
  const allTasks = () => plan.targets.flatMap((t) => t.tasks);
  for (const op of ops) {
    if (op.op === 'revise') {
      const r = await revisePlan(brandId, op.note);
      if (r.success) done.push('Revised the plan');
      continue;
    }
    if (op.op === 'add') {
      const target = (op.target && matchByTitle(op.target, plan.targets)) || plan.targets.find((t) => t.status === 'current') || plan.targets[0];
      if (!target) continue;
      const task = await addTask(plan, target.id, op.task, target.tasks.length);
      if (task) {
        if (op.owner === 'agent' || op.detail) await updateTask(task.id, { detail: op.detail || null, owner: op.owner, agent_slug: op.agent_slug, agent_brief: op.owner === 'agent' ? op.detail || op.task : null });
        target.tasks.push({ ...task, owner: op.owner, agent_slug: op.agent_slug });
        done.push(`Added "${op.task}" to ${target.title}`);
      }
      continue;
    }
    const task = matchByTitle(op.task, allTasks());
    if (!task) continue;
    if (op.op === 'remove') {
      if (await deleteTask(task.id)) { for (const t of plan.targets) t.tasks = t.tasks.filter((k) => k.id !== task.id); done.push(`Removed "${task.title}"`); }
      continue;
    }
    const status: TaskStatus = op.op === 'done' ? 'done' : op.op === 'skip' ? 'skipped' : 'todo';
    if (task.status !== status && (await setTaskStatus(task, status))) { task.status = status; done.push(`${op.op === 'done' ? 'Marked' : op.op === 'skip' ? 'Skipped' : 'Reopened'} "${task.title}"${op.op === 'done' ? ' done' : ''}`); }
  }
  return done;
}

/** Which plan task each run belongs to, for links from runs and approvals into the workspace. */
export async function tasksForRuns(runIds: string[]): Promise<Record<string, string>> {
  if (!runIds.length) return {};
  const { data } = await db.from('plan_tasks').select('id, run_id').in('run_id', runIds);
  const map: Record<string, string> = {};
  for (const t of data ?? []) map[t.run_id] = t.id;
  return map;
}
