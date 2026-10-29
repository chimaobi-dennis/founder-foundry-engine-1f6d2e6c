/**
 * founder-plan — Mentor builds or revises the founder's plan.
 *
 * POST (user JWT): { action: "build" | "revise" | "new" | "breakdown" | "plan_board", brandId, note?: string, playbook?: "auto"|"idea"|"running"|"creator", taskId?, goal? }
 * The answer is NDJSON: `{ progress: [...] }` lines as the steps happen, then
 * `{ result: {...} }` with the same body as before (success, error, ...).
 *   breakdown: the deliverables that complete one founder task, written onto the task
 *   plan_board: Set up on an agent task: the board Kinika proposes for it (a plan
 *           draft, the role, one question where the design forks, what must be
 *           connected). Nothing is created; the browser runs the confirmed draft.
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
import { coercePlanDraft, parseStructuredOutput, plannerSystemPrompt, type PlannerContext } from "../_shared/runner.ts";
import { boardLines, boardToolsFrom } from "../_shared/tools.ts";
import { boardNeeds, coerceBoardQuestion } from "../_shared/boardDraft.ts";
import { availableWatchSources } from "../_shared/watch.ts";
import { loadPrompt } from "../_shared/promptLoad.ts";
import { narratedResponse, type Narrator } from "../_shared/progress.ts";

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
  const action = body.action === "revise" ? "revise" : body.action === "breakdown" ? "breakdown" : body.action === "plan_board" ? "plan_board" : body.action === "new" ? "new" : "build";

  // Editors and owners only.
  const { data: allowed } = await userClient.rpc("can_access_brand", { p_brand_id: body.brandId, p_min_role: "editor" });
  if (!allowed) return json({ success: false, error: "You cannot edit this workspace's plan" }, 403);
  const { data: brand } = await admin.from("brands").select("id, user_id, name, journey_stage, business_kind, goal, goal_horizon").eq("id", body.brandId).maybeSingle();
  if (!brand) return json({ success: false, error: "Brand not found" }, 404);

  if (action === "breakdown") {
    if (!body.taskId) return json({ success: false, error: "taskId is required" }, 400);
    return narratedResponse(req, corsHeaders, (n) => breakdownTask(admin, brand, String(body.taskId), n));
  }
  if (action === "plan_board") {
    if (!body.taskId) return json({ success: false, error: "taskId is required" }, 400);
    return narratedResponse(req, corsHeaders, (n) => planBoard(admin, brand, String(body.taskId), body.note ? String(body.note).slice(0, 600) : "", n));
  }

  const note = body.note ? String(body.note) : undefined;
  const goal = action === "new" ? String(body.goal ?? "").trim() : "";
  if (action === "new" && goal.length < 4) return json({ success: false, error: "Say what this plan should achieve." }, 400);
  // Streamed: the browser sees each step; the result is the last line.
  return narratedResponse(req, corsHeaders, async (n) => {
    const r = await buildOrRevisePlan(admin, brand, action, note, action === "revise" && note ? `You asked: ${note.slice(0, 200)}` : action === "new" ? `New plan: ${goal.slice(0, 200)}` : undefined, playbookFrom(body.playbook), action === "new" ? { goal, horizon: body.goalHorizon ? String(body.goalHorizon) : null } : null, n);
    return r.success ? r : { success: false, error: r.error };
  });
});

type Deliverable = { id: string; title: string; detail: string; kind: "decision" | "document" | "list" | "action"; done: boolean; done_at: string | null; document_id: string | null };

/** Two to five deliverables that, done, make this task complete. Written onto the task; the task moves to doing. */
// deno-lint-ignore no-explicit-any
async function breakdownTask(admin: any, brand: { id: string; name: string; business_kind?: string | null; goal?: string | null }, taskId: string, n: Narrator) {
  n.plan([
    { key: "task", label: "Reading the task and its target" },
    { key: "context", label: "Gathering what Kinika knows about the business" },
    { key: "model", label: "Working out what completes this task" },
    { key: "save", label: "Writing the deliverables onto the task" },
  ]);
  n.start("task");
  // deno-lint-ignore no-explicit-any
  const { data: task }: { data: any } = await admin.from("plan_tasks").select("id, title, detail, owner, status, deliverables, plan_targets!inner(title, why)").eq("id", taskId).eq("brand_id", brand.id).maybeSingle();
  if (!task) return { success: false, error: "Task not found" };
  const existing = Array.isArray(task.deliverables) ? task.deliverables as Deliverable[] : [];
  if (existing.length) { n.done("task", "already broken down"); return { success: true, deliverables: existing, reused: true }; }
  n.done("task");
  n.start("context");
  const pack = await buildContextPack(admin, brand.id);
  n.done("context");
  const target = (task as any).plan_targets as { title: string; why: string | null };
  const system = await loadPrompt(admin, "task_breakdown");
  const user = [
    `BRAND CONTEXT (pack ${pack.hash}):\n${pack.text.slice(0, 9000)}`,
    brand.goal ? `THE FOUNDER'S GOAL: ${brand.goal}` : "",
    `TARGET: ${target?.title ?? ""}${target?.why ? ` (why: ${target.why})` : ""}`,
    `TASK: ${task.title}${task.detail ? `\n${task.detail}` : ""}`,
    await loadPrompt(admin, "respond_json_only"),
  ].filter(Boolean).join("\n\n");
  n.start("model");
  const gw = await fetch(`${SUPABASE_URL}/functions/v1/ai-gateway`, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    body: JSON.stringify({ userId: (brand as any).user_id, taskType: "task_breakdown", systemPrompt: system, messages: [{ role: "user", content: user }], maxTokens: 1200, temperature: 0.2, metadata: { brand_id: brand.id, task_id: taskId } }),
  });
  const result = await gw.json().catch(() => null);
  if (!gw.ok || !result?.success) { n.fail("model", result?.error ?? `no answer (${gw.status})`); return { success: false, error: result?.error ?? `Kinika could not break this down yet (${gw.status}).` }; }
  n.done("model");
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
  if (deliverables.length < 2) { n.fail("save", "the answer did not name clear deliverables"); return { success: false, error: "Kinika could not turn this task into clear deliverables. Try again." }; }
  n.start("save");
  const { error } = await admin.from("plan_tasks").update({ deliverables, status: task.status === "todo" ? "doing" : task.status, updated_at: new Date().toISOString() }).eq("id", taskId);
  if (error) { n.fail("save", error.message); return { success: false, error: error.message }; }
  n.done("save", `${deliverables.length} deliverables`);
  return { success: true, deliverables };
}

/**
 * Set up, from a sentence: the board Kinika proposes for one agent task.
 * The model sees the brand record, the target, the task and the role the
 * plan named; code keeps it to agents, recipes and connections that exist.
 */
// deno-lint-ignore no-explicit-any
async function planBoard(admin: any, brand: { id: string; user_id: string; name: string; goal?: string | null; journey_stage?: string | null }, taskId: string, note: string, n: Narrator) {
  n.plan([
    { key: "task", label: "Reading the task and the role the plan named" },
    { key: "context", label: "Gathering what Kinika knows, the team and your connections" },
    { key: "model", label: "Designing the board: who, what, where, when" },
    { key: "check", label: "Checking it against what exists" },
  ]);
  n.start("task");
  // deno-lint-ignore no-explicit-any
  const { data: task }: { data: any } = await admin.from("plan_tasks").select("id, title, detail, owner, status, agent_slug, agent_brief, plan_targets!inner(title, why)").eq("id", taskId).eq("brand_id", brand.id).maybeSingle();
  if (!task) return { success: false, error: "Task not found" };
  n.done("task", task.agent_slug ? `for the ${task.agent_slug.replace(/_/g, " ")}` : undefined);
  n.start("context");
  const [pack, { data: agentRows }, { data: connRows }, { data: boardRows }] = await Promise.all([
    buildContextPack(admin, brand.id),
    admin.from("agents").select("slug, name, tagline, unit_label").eq("is_active", true).eq("status", "published").order("sort_order"),
    admin.from("tool_connections").select("id, provider, display_name, status").eq("brand_id", brand.id).eq("status", "active"),
    admin.from("automations").select("id, name, trigger_type, task_input, agents(name)").eq("brand_id", brand.id).eq("status", "active").order("created_at").limit(20),
  ]);
  const boards = boardToolsFrom(boardRows);
  const ctx: PlannerContext = {
    request: `${task.title}${task.agent_brief ? `\n${task.agent_brief}` : ""}${note ? `\n${note}` : ""}`,
    agents: (agentRows ?? []) as PlannerContext["agents"],
    connections: ((connRows ?? []) as { id: string; provider: string; display_name: string }[]).map((c) => ({ id: c.id, provider: c.provider, display_name: c.display_name })),
    stage: brand.journey_stage ?? null,
    sources: availableWatchSources((connRows ?? []) as { id: string; provider: string; display_name: string; status: string }[]).map((a) => ({ key: a.source.key, connection_id: a.connection_id, line: `- ${a.source.key}: ${a.source.words.toLowerCase()} (${a.source.name}: ${a.display_name})` })),
    boards: boards.map((b) => ({ id: b.id, name: b.name, line: boardLines([b]) })),
  };
  if (!ctx.agents.length) { n.fail("context", "no agents are published"); return { success: false, error: "Kinika has no agents to staff this with yet." }; }
  n.done("context", `${ctx.agents.length} roles, ${ctx.connections.length} connection${ctx.connections.length === 1 ? "" : "s"}`);
  const [template, jsonOnly] = await Promise.all([loadPrompt(admin, "plan_board"), loadPrompt(admin, "respond_json_only")]);
  const target = (task as any).plan_targets as { title: string; why: string | null };
  const role = ctx.agents.find((a) => a.slug === task.agent_slug) ?? null;
  const user = [
    `BRAND CONTEXT (pack ${pack.hash}):\n${pack.text.slice(0, 6000)}`,
    brand.goal ? `THE FOUNDER'S GOAL: ${brand.goal}` : "",
    `TARGET: ${target?.title ?? ""}${target?.why ? ` (why: ${target.why})` : ""}`,
    `TASK: ${task.title}${task.detail ? `\n${task.detail}` : ""}`,
    task.agent_brief ? `BRIEF FROM THE PLAN: ${task.agent_brief}` : "",
    role ? `ROLE THE PLAN NAMED: ${role.slug} (${role.name})` : "",
    note ? `THE FOUNDER ADDED: ${note}` : "",
    jsonOnly,
  ].filter(Boolean).join("\n\n");
  n.start("model");
  const gw = await fetch(`${SUPABASE_URL}/functions/v1/ai-gateway`, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    body: JSON.stringify({ userId: brand.user_id, taskType: "plan_automation", systemPrompt: plannerSystemPrompt(ctx, template), messages: [{ role: "user", content: user }], maxTokens: 3000, temperature: 0.2, metadata: { brand_id: brand.id, task_id: taskId, plan_board: true } }),
  });
  const result = await gw.json().catch(() => null);
  if (!gw.ok || !result?.success) { n.fail("model", result?.error ?? `no answer (${gw.status})`); return { success: false, error: result?.error ?? `Kinika could not design this yet (${gw.status}).` }; }
  n.done("model");
  n.start("check");
  const parsed = parseStructuredOutput(String(result.text ?? ""));
  if (!parsed.ok) { n.fail("check", "the answer was not in the expected shape"); return { success: false, error: "Kinika answered in an unexpected shape. Try again." }; }
  const raw = parsed.value as Record<string, unknown>;
  const draft = coercePlanDraft(raw, ctx);
  if (!draft) { n.fail("check", "no usable role in the answer"); return { success: false, error: "None of Kinika's roles fit this task as written. Tell Kinika more, or describe it yourself." }; }
  const question = coerceBoardQuestion(raw.question);
  const needs = boardNeeds(draft, raw.needs, ctx.connections.map((c) => ({ provider: c.provider })));
  const lead = ctx.agents.find((a) => a.slug === draft.agents[0]) ?? role;
  n.done("check", `${draft.agents.length} role${draft.agents.length === 1 ? "" : "s"}${question ? ", one question" : ""}${needs.length ? `, ${needs.length} connection${needs.length === 1 ? "" : "s"} named` : ""}`);
  return { success: true, draft, question, needs, role: lead ? { slug: lead.slug, name: lead.name } : null };
}
