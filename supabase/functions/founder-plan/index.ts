/**
 * founder-plan — Mentor builds or revises the founder's plan.
 *
 * POST (user JWT): { action: "build" | "revise", brandId, note?: string }
 *   build:  a fresh plan from the brand context (replaces any existing plan)
 *   revise: the existing plan plus a note from the founder or a trigger;
 *           done tasks and the founder's own edits are kept.
 * The model call goes through ai-gateway as task type plan_build (admins
 * route it); the plan is written as rows the UI edits directly.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { buildContextPack } from "../_shared/contextPack.ts";
import { parseStructuredOutput } from "../_shared/runner.ts";
import { agentsBlock, coercePlan, planSystemPrompt, type PlanAgentOption, type PlanDraft } from "../_shared/plan.ts";
import { remember } from "../_shared/memory.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const GATEWAY_URL = `${SUPABASE_URL}/functions/v1/ai-gateway`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "POST only" }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ success: false, error: "Unauthorized" }, 401);
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const userId = (await userClient.auth.getUser()).data.user?.id;
  if (!userId) return json({ success: false, error: "Unauthorized" }, 401);
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  let body: { action?: string; brandId?: string; note?: string };
  try { body = await req.json(); } catch { return json({ success: false, error: "Invalid JSON body" }, 400); }
  if (!body.brandId) return json({ success: false, error: "brandId is required" }, 400);
  const action = body.action === "revise" ? "revise" : "build";

  // Editors and owners only.
  const { data: allowed } = await userClient.rpc("can_access_brand", { p_brand_id: body.brandId, p_min_role: "editor" });
  if (!allowed) return json({ success: false, error: "You cannot edit this workspace's plan" }, 403);
  const { data: brand } = await admin.from("brands").select("id, user_id, name, journey_stage").eq("id", body.brandId).maybeSingle();
  if (!brand) return json({ success: false, error: "Brand not found" }, 404);

  // ── Context ──
  const [pack, { data: agentRows }, { data: hires }, { data: milestones }, { data: existing }] = await Promise.all([
    buildContextPack(admin, brand.id),
    admin.from("agents").select("slug, name, tagline").eq("is_active", true).eq("status", "published").order("sort_order"),
    admin.from("agent_hires").select("agent_id, agents(slug)").eq("brand_id", brand.id).eq("status", "active"),
    admin.from("milestones").select("name, category, stage_key, created_at").eq("brand_id", brand.id).order("created_at", { ascending: false }).limit(10),
    admin.from("brand_plans").select("*, plan_targets(*, plan_tasks(*))").eq("brand_id", brand.id).maybeSingle(),
  ]);
  const hiredSlugs = new Set((hires ?? []).map((h: any) => h.agents?.slug).filter(Boolean));
  const agents: PlanAgentOption[] = (agentRows ?? []).map((a: any) => ({ slug: a.slug, name: a.name, tagline: a.tagline, hired: hiredSlugs.has(a.slug) }));

  const { data: promptRow } = await admin.from("ai_system_prompts").select("system_prompt").eq("task_type", "plan_build").eq("is_active", true).maybeSingle();
  const systemPrompt = `${promptRow?.system_prompt || planSystemPrompt()}\n\n=== BRAND CONTEXT (pack ${pack.hash}) ===\n${pack.text}`;

  const existingText = existing && action === "revise"
    ? "EXISTING PLAN (keep done tasks and the founder's edits; change only what the new information warrants):\n" + JSON.stringify({
        title: existing.title,
        targets: (existing.plan_targets ?? []).sort((a: any, b: any) => a.position - b.position).map((t: any) => ({
          title: t.title, status: t.status,
          tasks: (t.plan_tasks ?? []).sort((a: any, b: any) => a.position - b.position).map((k: any) => ({ title: k.title, status: k.status, owner: k.owner, agent_slug: k.agent_slug })),
        })),
      }).slice(0, 12_000)
    : "";
  const milestoneText = (milestones ?? []).length ? "RECENT MILESTONES:\n" + (milestones ?? []).map((m: any) => `- ${m.name} (${m.stage_key ?? m.category})`).join("\n") : "";
  const userPrompt = [
    `Journey stage: ${brand.journey_stage ?? "unknown"}.`,
    agentsBlock(agents),
    milestoneText,
    existingText,
    body.note ? `NOTE FROM THE FOUNDER OR A TRIGGER: ${String(body.note).slice(0, 1500)}` : "",
    "Respond with the JSON object only.",
  ].filter(Boolean).join("\n\n");

  // ── Model ──
  const gw = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    body: JSON.stringify({ userId: brand.user_id, taskType: "plan_build", systemPrompt, messages: [{ role: "user", content: userPrompt }], maxTokens: 6000, temperature: 0.3, cacheContext: true, metadata: { plan: action, brand_id: brand.id } }),
  });
  const result = await gw.json().catch(() => null);
  if (!gw.ok || !result?.success) return json({ success: false, error: result?.error ?? `The plan builder did not answer (${gw.status}).` }, 502);
  const parsed = parseStructuredOutput(result.text ?? "");
  if (!parsed.ok) return json({ success: false, error: "The plan came back in an unexpected shape. Try again." }, 502);
  const draft = coercePlan(parsed.value, agents);
  if (!draft) return json({ success: false, error: "The plan builder produced nothing usable. Add more about the business in Kinika and try again." }, 502);

  // ── Write ──
  const plan = await writePlan(admin, brand.id, brand.user_id, draft, existing, action);
  await remember(admin, { brandId: brand.id, userId: brand.user_id }, {
    kind: "run_summary", key: `plan:${plan.id}:v${plan.version}`,
    title: action === "build" ? `Plan built: ${draft.title}` : `Plan revised: ${draft.title}`,
    summary: `${draft.summary} Targets: ${draft.targets.map((t) => t.title).join("; ")}.`,
    data: { version: plan.version, founder_type: draft.founder_type },
  });
  return json({ success: true, planId: plan.id, version: plan.version, targets: draft.targets.length, tasks: draft.targets.reduce((n, t) => n + t.tasks.length, 0), modelUsed: result.modelUsed });
});

/** Replace the plan's targets and tasks, carrying over statuses of tasks that still exist (by title). */
async function writePlan(admin: any, brandId: string, ownerId: string, draft: PlanDraft, existing: any, action: "build" | "revise") {
  const keep = new Map<string, { status: string; run_id: string | null; done_at: string | null }>();
  if (existing && action === "revise") {
    for (const t of existing.plan_targets ?? []) for (const k of t.plan_tasks ?? []) keep.set(k.title.trim().toLowerCase(), { status: k.status, run_id: k.run_id, done_at: k.done_at });
  }
  let planId: string = existing?.id;
  const version = existing ? Number(existing.version) + 1 : 1;
  if (existing) {
    await admin.from("brand_plans").update({ title: draft.title, summary: draft.summary, founder_type: draft.founder_type, version, built_at: new Date().toISOString() }).eq("id", existing.id);
    await admin.from("plan_targets").delete().eq("plan_id", existing.id);
  } else {
    const { data } = await admin.from("brand_plans").insert({ brand_id: brandId, user_id: ownerId, title: draft.title, summary: draft.summary, founder_type: draft.founder_type, version }).select("id").single();
    planId = data.id;
  }
  for (const [ti, t] of draft.targets.entries()) {
    const { data: target } = await admin.from("plan_targets").insert({ plan_id: planId, brand_id: brandId, title: t.title, why: t.why, position: ti }).select("id").single();
    await admin.from("plan_tasks").insert(t.tasks.map((k, ki) => {
      const prev = keep.get(k.title.trim().toLowerCase());
      return { plan_id: planId, target_id: target.id, brand_id: brandId, title: k.title, detail: k.detail, position: ki, owner: k.owner, agent_slug: k.agent_slug, agent_brief: k.agent_brief, status: prev?.status ?? "todo", run_id: prev?.run_id ?? null, done_at: prev?.done_at ?? null };
    }));
  }
  // Targets whose tasks are all done are done; the first undone is current.
  await admin.rpc("plan_mark_done_targets", { p_plan_id: planId }).then(() => {}, () => {});
  await admin.rpc("plan_recompute_current", { p_plan_id: planId });
  return { id: planId, version };
}
