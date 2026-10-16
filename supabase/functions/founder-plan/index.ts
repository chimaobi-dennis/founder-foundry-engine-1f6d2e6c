/**
 * founder-plan — Mentor builds or revises the founder's plan.
 *
 * POST (user JWT): { action: "build" | "revise" | "breakdown", brandId, note?: string, playbook?: "auto"|"idea"|"running"|"creator", taskId? }
 *   breakdown: the deliverables that complete one founder task, written onto the task
 *   build:  a fresh plan from the brand context (replaces any existing plan)
 *   revise: the existing plan plus a note from the founder; done tasks and
 *           the founder's own edits are kept.
 * The work is in _shared/planBuild.ts, which the runner also uses to revise
 * plans after milestones and stage changes.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { buildOrRevisePlan } from "../_shared/planBuild.ts";
import { playbookFrom } from "../_shared/plan.ts";
import { buildContextPack } from "../_shared/contextPack.ts";
import { parseStructuredOutput } from "../_shared/runner.ts";
import { loadPrompt } from "../_shared/promptLoad.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "POST only" }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ success: false, error: "Unauthorized" }, 401);
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const userId = (await userClient.auth.getUser()).data.user?.id;
  if (!userId) return json({ success: false, error: "Unauthorized" }, 401);
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  let body: { action?: string; brandId?: string; note?: string; playbook?: string; taskId?: string; goal?: string; goalHorizon?: string };
  try { body = await req.json(); } catch { return json({ success: false, error: "Invalid JSON body" }, 400); }
  if (!body.brandId) return json({ success: false, error: "brandId is required" }, 400);
  const action = body.action === "revise" ? "revise" : body.action === "breakdown" ? "breakdown" : body.action === "new" ? "new" : "build";

  // Editors and owners only.
  const { data: allowed } = await userClient.rpc("can_access_brand", { p_brand_id: body.brandId, p_min_role: "editor" });
  if (!allowed) return json({ success: false, error: "You cannot edit this workspace's plan" }, 403);
  const { data: brand } = await admin.from("brands").select("id, user_id, name, journey_stage, business_kind, goal, goal_horizon").eq("id", body.brandId).maybeSingle();
  if (!brand) return json({ success: false, error: "Brand not found" }, 404);

  if (action === "breakdown") {
    if (!body.taskId) return json({ success: false, error: "taskId is required" }, 400);
    try {
      return json(await breakdownTask(admin, brand, String(body.taskId)));
    } catch (e) {
      return json({ success: false, error: (e as Error).message }, 500);
    }
  }

  const note = body.note ? String(body.note) : undefined;
  const goal = action === "new" ? String(body.goal ?? "").trim() : "";
  if (action === "new" && goal.length < 4) return json({ success: false, error: "Say what this plan should achieve." }, 400);
  try {
    const r = await buildOrRevisePlan(admin, brand, action, note, action === "revise" && note ? `You asked: ${note.slice(0, 200)}` : action === "new" ? `New plan: ${goal.slice(0, 200)}` : undefined, playbookFrom(body.playbook), action === "new" ? { goal, horizon: body.goalHorizon ? String(body.goalHorizon) : null } : null);
    if (!r.success) return json({ success: false, error: r.error }, r.status);
    return json(r);
  } catch (e) {
    return json({ success: false, error: (e as Error).message }, 500);
  }
});

type Deliverable = { id: string; title: string; detail: string; kind: "decision" | "document" | "list" | "action"; done: boolean; done_at: string | null; document_id: string | null };

/** Two to five deliverables that, done, make this task complete. Written onto the task; the task moves to doing. */
// deno-lint-ignore no-explicit-any
async function breakdownTask(admin: any, brand: { id: string; name: string; business_kind?: string | null; goal?: string | null }, taskId: string) {
  // deno-lint-ignore no-explicit-any
  const { data: task }: { data: any } = await admin.from("plan_tasks").select("id, title, detail, owner, status, deliverables, plan_targets!inner(title, why)").eq("id", taskId).eq("brand_id", brand.id).maybeSingle();
  if (!task) return { success: false, error: "Task not found" };
  const existing = Array.isArray(task.deliverables) ? task.deliverables as Deliverable[] : [];
  if (existing.length) return { success: true, deliverables: existing, reused: true };

  const pack = await buildContextPack(admin, brand.id);
  const target = (task as any).plan_targets as { title: string; why: string | null };
  const system = await loadPrompt(admin, "task_breakdown");
  const user = [
    `BRAND CONTEXT (pack ${pack.hash}):\n${pack.text.slice(0, 9000)}`,
    brand.goal ? `THE FOUNDER'S GOAL: ${brand.goal}` : "",
    `TARGET: ${target?.title ?? ""}${target?.why ? ` (why: ${target.why})` : ""}`,
    `TASK: ${task.title}${task.detail ? `\n${task.detail}` : ""}`,
    await loadPrompt(admin, "respond_json_only"),
  ].filter(Boolean).join("\n\n");
  const gw = await fetch(`${SUPABASE_URL}/functions/v1/ai-gateway`, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    body: JSON.stringify({ userId: (brand as any).user_id, taskType: "task_breakdown", systemPrompt: system, messages: [{ role: "user", content: user }], maxTokens: 1200, temperature: 0.2, metadata: { brand_id: brand.id, task_id: taskId } }),
  });
  const result = await gw.json().catch(() => null);
  if (!gw.ok || !result?.success) return { success: false, error: result?.error ?? `Kinika could not break this down yet (${gw.status}).` };
  const parsed = parseStructuredOutput(String(result.text ?? ""));
  const raw = parsed.ok && Array.isArray((parsed.value as any).deliverables) ? (parsed.value as any).deliverables : [];
  const kinds = new Set(["decision", "document", "list", "action"]);
  const deliverables: Deliverable[] = raw.slice(0, 5).map((d: any) => ({
    id: crypto.randomUUID(),
    title: String(d?.title ?? "").slice(0, 120).trim(),
    detail: String(d?.detail ?? "").slice(0, 300).trim(),
    kind: kinds.has(d?.kind) ? d.kind : "action",
    done: false, done_at: null, document_id: null,
  })).filter((d: Deliverable) => d.title);
  if (deliverables.length < 2) return { success: false, error: "Kinika could not turn this task into clear deliverables. Try again." };
  const { error } = await admin.from("plan_tasks").update({ deliverables, status: task.status === "todo" ? "doing" : task.status, updated_at: new Date().toISOString() }).eq("id", taskId);
  if (error) return { success: false, error: error.message };
  return { success: true, deliverables };
}
