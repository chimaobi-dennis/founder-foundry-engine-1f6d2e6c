/**
 * Workspace Service — a plan task opened as a place of work. Loads the task,
 * the agent on it, its run with steps and the pending approval, and the
 * document the founder edits; the founder's version is what approval keeps.
 */

import { supabase } from '@/integrations/supabase/client';
import { getRun, outputToText, type Agent, type Approval, type AutomationRun } from '@/services/agentService';
import type { PlanTask } from '@/services/planService';

const db = supabase as any;

export interface WorkspaceTask extends PlanTask {
  target_title: string;
  target_position: number;
  plan_title: string;
  brand_id: string;
}

export interface WorkDocument {
  id: string;
  name: string;
  body_md: string;
  body_edited_at: string | null;
  run_id: string | null;
  updated_at: string;
}

export interface Workspace {
  task: WorkspaceTask;
  agent: Agent | null;
  run: AutomationRun | null;
  approval: Approval | null;
  document: WorkDocument | null;
}

export async function getWorkspace(taskId: string): Promise<Workspace | null> {
  const { data: t } = await db.from('plan_tasks').select('*, plan_targets!inner(title, position), brand_plans!inner(title)').eq('id', taskId).maybeSingle();
  if (!t) return null;
  const task: WorkspaceTask = { ...t, target_title: t.plan_targets.title, target_position: t.plan_targets.position, plan_title: t.brand_plans.title };
  const [agentRes, run, docRes] = await Promise.all([
    task.agent_slug ? db.from('agents').select('*').eq('slug', task.agent_slug).maybeSingle() : Promise.resolve({ data: null }),
    task.run_id ? getRun(task.run_id) : Promise.resolve(null),
    db.from('documents').select('id, name, body_md, body_edited_at, run_id, updated_at').eq('plan_task_id', taskId).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  let approval: Approval | null = null;
  if (run) {
    const { data: ap } = await db.from('approvals').select('*, run:automation_runs(id, name, agent_id, credits_captured, status, agent:agents(name, slug))').eq('run_id', run.id).eq('status', 'pending').order('created_at', { ascending: false }).limit(1).maybeSingle();
    approval = ap ?? null;
  }
  return { task, agent: agentRes.data ?? null, run, approval, document: docRes.data ?? null };
}

/** The text an agent run produced, or what is waiting for approval, as the document's first body. */
export function runBodyMarkdown(run: AutomationRun | null, approval: Approval | null): string {
  const out = approval?.payload?.output ?? run?.output ?? null;
  const text = outputToText(out as Record<string, unknown> | null);
  return text.trim();
}

/** Create the task's document from the run's output once; later opens reuse it. */
export async function ensureDocument(ws: Workspace, userId: string): Promise<WorkDocument | null> {
  if (ws.document) return ws.document;
  const body = runBodyMarkdown(ws.run, ws.approval);
  if (!body) return null;
  const { data, error } = await db.from('documents').insert({
    brand_id: ws.task.brand_id, user_id: userId, name: ws.task.title.slice(0, 120), document_type: 'agent_output',
    purpose: ws.task.detail ?? null, plan_task_id: ws.task.id, run_id: ws.run?.id ?? null, body_md: body,
  }).select('id, name, body_md, body_edited_at, run_id, updated_at').single();
  if (error) { console.error('[Workspace] ensureDocument:', error.message); return null; }
  return data;
}

export async function saveDocumentBody(id: string, body: string): Promise<boolean> {
  const { error } = await db.from('documents').update({ body_md: body, body_edited_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id);
  return !error;
}

/** Shown once per account: the note after the first approved result. */
export function firstApprovalSeen(userId: string): boolean {
  try { return localStorage.getItem(`kinika.firstApproval.${userId}`) === '1'; } catch { return true; }
}
export function markFirstApprovalSeen(userId: string) {
  try { localStorage.setItem(`kinika.firstApproval.${userId}`, '1'); } catch { /* storage unavailable */ }
}
