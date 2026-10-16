/**
 * Build or revise a founder's plan — the core shared by the founder-plan
 * function (the founder asks) and the runner's housekeeping tick (a milestone
 * or stage change asks). Context in, model through ai-gateway as task type
 * plan_build, rows out; done tasks and the founder's edits survive a revision.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildContextPack } from "./contextPack.ts";
import { parseStructuredOutput } from "./runner.ts";
import { agentsBlock, coercePlan, playbookBlock, playbookForKind, type PlanAgentOption, type PlanDraft, type PlaybookChoice } from "./plan.ts";
import { remember } from "./memory.ts";
import { loadPrompts } from "./promptLoad.ts";

export interface PlanBrand {
  id: string;
  user_id: string;
  name: string;
  journey_stage: string | null;
  business_kind?: string | null;
  goal?: string | null;
  goal_horizon?: string | null;
}

export type PlanBuildResult =
  | { success: true; planId: string; version: number; targets: number; tasks: number; modelUsed?: string }
  | { success: false; error: string; status: number };

const WEEK_MS = 7 * 24 * 3600_000;

export async function buildOrRevisePlan(
  admin: SupabaseClient,
  brand: PlanBrand,
  action: "build" | "revise",
  note?: string,
  /** Why this revision happened, shown on the plan ("Revised after: …"). */
  reason?: string,
  /** A playbook the founder chose for a fresh build; "auto" lets the model pick. */
  playbook: PlaybookChoice = "auto",
): Promise<PlanBuildResult> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

  const P = await loadPrompts(admin, ["plan_build", "plan_goal_rule", "plan_agents_rule", "plan_playbook_auto", "plan_playbook_chosen", "respond_json_only"]);
  const systemPrompt = `${P.plan_build}\n\n=== BRAND CONTEXT (pack ${pack.hash}) ===\n${pack.text}`;

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
    `Journey stage: ${brand.journey_stage ?? "unknown"}.${brand.business_kind ? ` Kind of business: ${brand.business_kind}.` : ""}`,
    brand.goal ? P.plan_goal_rule.split("{{horizon}}").join(brand.goal_horizon ? ` (${brand.goal_horizon})` : "").split("{{goal}}").join(String(brand.goal)) : "",
    action === "build" ? playbookBlock(playbook === "auto" ? playbookForKind(brand.business_kind) : playbook, { auto: P.plan_playbook_auto, chosen: P.plan_playbook_chosen }) : "",
    agentsBlock(agents, P.plan_agents_rule),
    milestoneText,
    existingText,
    note ? `NOTE FROM THE FOUNDER OR A TRIGGER: ${String(note).slice(0, 1500)}` : "",
    P.respond_json_only,
  ].filter(Boolean).join("\n\n");

  // ── Model ──
  const gw = await fetch(`${SUPABASE_URL}/functions/v1/ai-gateway`, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    body: JSON.stringify({ userId: brand.user_id, taskType: "plan_build", systemPrompt, messages: [{ role: "user", content: userPrompt }], maxTokens: 6000, temperature: 0.3, cacheContext: true, metadata: { plan: action, brand_id: brand.id } }),
  });
  const result = await gw.json().catch(() => null);
  if (!gw.ok || !result?.success) return { success: false, error: result?.error ?? `The plan builder did not answer (${gw.status}).`, status: 502 };
  const parsed = parseStructuredOutput(result.text ?? "");
  if (!parsed.ok) return { success: false, error: "The plan came back in an unexpected shape. Try again.", status: 502 };
  const draft = coercePlan(parsed.value, agents);
  if (!draft) return { success: false, error: "The plan builder produced nothing usable. Add more about the business in Kinika and try again.", status: 502 };

  // ── Write ──
  const plan = await writePlan(admin, brand.id, brand.user_id, draft, existing, action, reason);
  await remember(admin, { brandId: brand.id, userId: brand.user_id }, {
    kind: "run_summary", key: `plan:${plan.id}:v${plan.version}`,
    title: action === "build" ? `Plan built: ${draft.title}` : `Plan revised: ${draft.title}`,
    summary: `${reason ? `${reason} ` : ""}${draft.summary} Targets: ${draft.targets.map((t) => t.title).join("; ")}.`,
    data: { version: plan.version, founder_type: draft.founder_type, reason: reason ?? null },
  });
  return { success: true, planId: plan.id, version: plan.version, targets: draft.targets.length, tasks: draft.targets.reduce((n, t) => n + t.tasks.length, 0), modelUsed: result.modelUsed };
}

/** Replace the plan's targets and tasks, carrying over statuses of tasks that still exist (by title). */
async function writePlan(admin: SupabaseClient, brandId: string, ownerId: string, draft: PlanDraft, existing: any, action: "build" | "revise", reason?: string) {
  const keep = new Map<string, { status: string; run_id: string | null; done_at: string | null }>();
  if (existing && action === "revise") {
    for (const t of existing.plan_targets ?? []) for (const k of t.plan_tasks ?? []) keep.set(k.title.trim().toLowerCase(), { status: k.status, run_id: k.run_id, done_at: k.done_at });
  }
  let planId: string = existing?.id;
  const version = existing ? Number(existing.version) + 1 : 1;
  const now = new Date();
  // A revision clears the queued note; a fresh build also restarts the weekly check-in.
  const patch = {
    title: draft.title, summary: draft.summary, founder_type: draft.founder_type, version, built_at: now.toISOString(),
    revise_note: null, revise_requested_at: null, last_revision_reason: reason ?? null,
    ...(action === "build" ? { next_checkin_at: new Date(now.getTime() + WEEK_MS).toISOString() } : {}),
  };
  if (existing) {
    await admin.from("brand_plans").update(patch).eq("id", existing.id);
    await admin.from("plan_targets").delete().eq("plan_id", existing.id);
  } else {
    const { data, error } = await admin.from("brand_plans").insert({ brand_id: brandId, user_id: ownerId, ...patch }).select("id").single();
    if (error || !data) throw new Error(`could not create the plan: ${error?.message ?? "no row"}`);
    planId = data.id;
  }
  for (const [ti, t] of draft.targets.entries()) {
    const { data: target, error: tErr } = await admin.from("plan_targets").insert({ plan_id: planId, brand_id: brandId, title: t.title, why: t.why, position: ti }).select("id").single();
    if (tErr || !target) throw new Error(`could not write target "${t.title}": ${tErr?.message ?? "no row"}`);
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
