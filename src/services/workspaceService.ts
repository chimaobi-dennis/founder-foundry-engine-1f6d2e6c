/**
 * Workspace Service — a plan task opened as a place of work. Loads the task,
 * the agent on it, its run with steps and the pending approval, and the
 * document the founder edits; the founder's version is what approval keeps.
 */

import { supabase } from '@/integrations/supabase/client';
import { getRun, outputToText, type Agent, type Approval, type AutomationRun } from '@/services/agentService';
import type { Deliverable, PlanTask } from '@/services/planService';
import { SUPABASE_CONFIG } from '@/config/supabaseConfig';

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

export interface WorkBrief {
  id: string;
  name: string;
  status: string | null;
}

export interface Workspace {
  task: WorkspaceTask;
  agent: Agent | null;
  run: AutomationRun | null;
  approval: Approval | null;
  document: WorkDocument | null;
  /** A ContentStudio brief made from this task: the canvas surface. */
  brief: WorkBrief | null;
  /** Three lines of the task's brand record, for the rail. */
  using: string[];
}

export async function getWorkspace(taskId: string): Promise<Workspace | null> {
  const { data: t } = await db.from('plan_tasks').select('*, plan_targets!inner(title, position), brand_plans!inner(title)').eq('id', taskId).maybeSingle();
  if (!t) return null;
  const task: WorkspaceTask = { ...t, target_title: t.plan_targets.title, target_position: t.plan_targets.position, plan_title: t.brand_plans.title };
  const [agentRes, run, docRes, briefRes, dnaRes] = await Promise.all([
    task.agent_slug ? db.from('agents').select('*').eq('slug', task.agent_slug).maybeSingle() : Promise.resolve({ data: null }),
    task.run_id ? getRun(task.run_id) : Promise.resolve(null),
    db.from('documents').select('id, name, body_md, body_edited_at, run_id, updated_at').eq('plan_task_id', taskId).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('content_studio_briefs').select('id, name, status').eq('plan_task_id', taskId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('brand_dna').select('positioning_statement, brand_voice, target_audience').eq('brand_id', task.brand_id).maybeSingle(),
  ]);
  let approval: Approval | null = null;
  if (run) {
    const { data: ap } = await db.from('approvals').select('*, run:automation_runs(id, name, agent_id, credits_captured, status, agent:agents(name, slug))').eq('run_id', run.id).eq('status', 'pending').order('created_at', { ascending: false }).limit(1).maybeSingle();
    approval = ap ?? null;
  }
  const dna = dnaRes.data ?? {};
  const using = [dna.positioning_statement, dna.brand_voice, dna.target_audience]
    .filter((v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && !/[{}"]/.test(v))
    .map((v: string) => (v.length > 90 ? v.slice(0, 88).trimEnd() + '…' : v))
    .slice(0, 3);
  return { task, agent: agentRes.data ?? null, run, approval, document: docRes.data ?? null, brief: briefRes.data ?? null, using };
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

/** A result that belongs on the canvas: a design brief, or a Designer's output. */
export function wantsCanvas(ws: Workspace): boolean {
  if (ws.brief) return true;
  const o = (ws.approval?.payload?.output ?? ws.run?.output ?? null) as Record<string, unknown> | null;
  const slug = ws.agent?.slug ?? ws.task.agent_slug ?? "";
  return /design/i.test(slug) || !!(o && (o.visual_direction || Array.isArray((o as { headlines?: unknown }).headlines)));
}

// ─── Founder tasks worked with Kinika ───────────────────────

/** Ask Kinika for the deliverables that complete a founder task (reused if they exist). */
export async function breakdownTask(brandId: string, taskId: string): Promise<{ success: true; deliverables: Deliverable[] } | { success: false; error: string }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { success: false, error: 'Not signed in' };
  try {
    const res = await fetch(`${SUPABASE_CONFIG.url}/functions/v1/founder-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_CONFIG.anonKey, Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'breakdown', brandId, taskId }),
    });
    const json = await res.json().catch(() => null);
    return json ?? { success: false, error: `Kinika did not answer (${res.status})` };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : 'Could not reach Kinika' };
  }
}

/** Write the task's deliverables back (done flags, linked documents). Database truth; returns what was saved. */
export async function saveDeliverables(taskId: string, deliverables: Deliverable[]): Promise<boolean> {
  const { error } = await db.from('plan_tasks').update({ deliverables, updated_at: new Date().toISOString() }).eq('id', taskId);
  return !error;
}

/** A document Kinika wrote for a founder task; the founder edits it on the document surface. */
export async function createTaskDocument(ws: Workspace, userId: string, title: string, body: string): Promise<WorkDocument | null> {
  const { data, error } = await db.from('documents').insert({
    brand_id: ws.task.brand_id, user_id: userId, name: title.slice(0, 120), document_type: 'kinika_output',
    purpose: ws.task.title, plan_task_id: ws.task.id, body_md: body,
  }).select('id, name, body_md, body_edited_at, run_id, updated_at').single();
  if (error) { console.error('[Workspace] createTaskDocument:', error.message); return null; }
  return data;
}
