/**
 * Plan Service — the founder's plan: targets, tasks, and who does them.
 * Mentor builds and revises it (founder-plan function); founders edit rows
 * directly; delegating a task links it to an agent run, and the database
 * marks the task done when the run completes.
 */

import { supabase } from '@/integrations/supabase/client';
import { matchByTitle, type PlanEditOp, type PlaybookChoice } from '@shared/plan';
import { postNarrated, type OnProgress } from '@/services/narrated';
import type { PlanDraft } from '@shared/runner';
import type { BoardQuestion, BoardNeed } from '@shared/boardDraft';

const db = supabase as any;

export type TaskStatus = 'todo' | 'doing' | 'done' | 'skipped';
export type TargetStatus = 'upcoming' | 'current' | 'done';

export interface Deliverable {
  id: string;
  title: string;
  detail: string;
  kind: 'decision' | 'document' | 'list' | 'action';
  done: boolean;
  done_at: string | null;
  document_id: string | null;
  /** The outcome, as Markdown: the list, the decision, what was done. Documents live in `documents`. */
  result?: string | null;
  /** Kinika raised that this needs a specialist or an outside person; cleared when the founder resolves it. */
  needs?: { role: string; label: string; why: string; brief: string; raised_at: string; resolved?: 'hired' | 'own' | 'brief' | 'dismissed' | null } | null;
  /** An agent Kinika hired for this deliverable: its run lands as a tab in the task's workspace. */
  run_id?: string | null;
  agent_slug?: string | null;
  agent_name?: string | null;
}

export interface PlanTask {
  id: string;
  /** What completes a founder task when it is worked with Kinika; empty until the workspace opens. */
  deliverables?: Deliverable[];
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
  /** What this plan was written to achieve. */
  goal: string | null;
  goal_horizon: string | null;
  is_current: boolean;
  status: 'active' | 'done' | 'archived';
  targets: PlanTarget[];
}

export interface PlanSummary {
  id: string;
  title: string;
  goal: string | null;
  goal_horizon: string | null;
  is_current: boolean;
  status: 'active' | 'done' | 'archived';
  built_at: string;
  version: number;
  done: number;
  total: number;
}

/** The current plan, or a specific one. */
export async function getPlan(brandId: string, planId?: string): Promise<FounderPlan | null> {
  let q = db.from('brand_plans').select('*, plan_targets(*, plan_tasks(*))').eq('brand_id', brandId);
  q = planId ? q.eq('id', planId) : q.eq('is_current', true);
  const { data, error } = await q.maybeSingle();
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
    goal: data.goal ?? null, goal_horizon: data.goal_horizon ?? null, is_current: data.is_current ?? true, status: data.status ?? 'active',
    targets,
  };
}

/** Every plan of a business, newest first, with progress. */
export async function listPlans(brandId: string): Promise<PlanSummary[]> {
  const { data, error } = await db.from('brand_plans').select('id, title, goal, goal_horizon, is_current, status, built_at, version, plan_tasks(status)').eq('brand_id', brandId).order('built_at', { ascending: false });
  if (error || !data) return [];
  return data.map((p: any) => {
    const tasks: { status: string }[] = p.plan_tasks ?? [];
    const counted = tasks.filter((t) => t.status !== 'skipped');
    return { id: p.id, title: p.title, goal: p.goal ?? null, goal_horizon: p.goal_horizon ?? null, is_current: !!p.is_current, status: p.status ?? 'active', built_at: p.built_at, version: p.version, done: counted.filter((t) => t.status === 'done').length, total: counted.length };
  });
}

/** Make a plan the current one: Home, Kinika, check-ins and revisions follow it. */
export async function setCurrentPlan(brandId: string, planId: string): Promise<boolean> {
  const off = await db.from('brand_plans').update({ is_current: false }).eq('brand_id', brandId).eq('is_current', true);
  if (off.error) return false;
  const on = await db.from('brand_plans').update({ is_current: true }).eq('id', planId);
  return !on.error;
}

export async function setPlanStatus(planId: string, status: PlanSummary['status']): Promise<boolean> {
  const { error } = await db.from('brand_plans').update({ status }).eq('id', planId);
  return !error;
}

/** A new plan for a goal; Kinika already knows the business. It becomes the current plan. */
export function createPlan(brandId: string, goal: string, goalHorizon?: string, onProgress?: OnProgress) {
  return callPlanFunction({ action: 'new', brandId, goal, goalHorizon }, onProgress);
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

async function callPlanFunction(body: Record<string, unknown>, onProgress?: OnProgress): Promise<{ success: boolean; error?: string; targets?: number; tasks?: number; modelUsed?: string }> {
  return postNarrated<{ success: boolean; error?: string; targets?: number; tasks?: number; modelUsed?: string }>('founder-plan', body, { onProgress, timeoutMs: 170_000 });
}

export interface PlanBoardResult {
  success: boolean;
  error?: string;
  draft?: PlanDraft;
  question?: BoardQuestion | null;
  needs?: BoardNeed[];
  role?: { slug: string; name: string } | null;
}

/**
 * Set up, from a sentence: the board Kinika proposes for an agent task. The
 * draft is the same shape Describe it produces; nothing is created until the
 * founder confirms it (executeDraft in plannerService).
 */
export function planBoard(brandId: string, taskId: string, note?: string, onProgress?: OnProgress): Promise<PlanBoardResult> {
  return postNarrated<PlanBoardResult>('founder-plan', { action: 'plan_board', brandId, taskId, note }, { onProgress, timeoutMs: 150_000 });
}

/** Ask Mentor to write a plan from everything the brand has told it. Replaces any existing plan. */
export function buildPlan(brandId: string, note?: string, playbook: PlaybookChoice = 'auto', onProgress?: OnProgress) {
  return callPlanFunction({ action: 'build', brandId, note, playbook }, onProgress);
}

/** Revise the plan with a note; done tasks and the founder's edits are kept. */
export function revisePlan(brandId: string, note: string, onProgress?: OnProgress) {
  return callPlanFunction({ action: 'revise', brandId, note }, onProgress);
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
