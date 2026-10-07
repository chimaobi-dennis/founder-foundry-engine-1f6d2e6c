/**
 * run-step — the automation runner.
 *
 * The database is the state machine: automation_runs + automation_run_steps.
 * Each invocation advances one run as far as it can (several steps), stopping
 * at an approval gate, a budget cap, an error, or completion. Nothing here
 * holds state between calls, so a run survives restarts and can wait days
 * for an approval.
 *
 * Billing per run: reserve the quoted max at start (reserve_generation_credits),
 * capture per paid step (capture_reserved_credits), release the remainder at
 * the end (finalize_generation_billing). Hitting a cap pauses; it never fails.
 *
 * POST body:
 *   { runId }        advance one run (owner JWT or service role)
 *   { tick: true }   service role only: enqueue due schedules, advance queued runs
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { buildContextPack } from "../_shared/contextPack.ts";
import { allowedFields, diffLines, ConnectorError, runConnector, type NormalizedRecord, type ProposedChange } from "../_shared/connectors.ts";
import { applyChanges, createRecord, loadConnection, openPullRequest, publishItems, readRepoFiles, repoSnapshot, trimRecords } from "../_shared/connectorOps.ts";
import { validateEdit, DEFAULT_ALLOWED_PATHS } from "../_shared/github.ts";
import {
  buildTaskPrompt,
  checkBudget,
  DEFAULT_BUDGET,
  normalizeUnits,
  parseStructuredOutput,
  summarizeOutput,
  type AgentDefinition,
  type RunBudget,
} from "../_shared/runner.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const GATEWAY_URL = `${SUPABASE_URL}/functions/v1/ai-gateway`;

/** Keep one invocation under the edge runtime's wall clock. */
const MAX_STEPS_PER_INVOCATION = 6;

type Admin = SupabaseClient;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "POST only" }, 405);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const isService = !!token && token === SERVICE_ROLE_KEY;
  let userId: string | null = null;
  if (!isService && token) {
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });
    userId = (await userClient.auth.getUser()).data.user?.id ?? null;
  }
  if (!isService && !userId) return json({ success: false, error: "Unauthorized" }, 401);

  let body: { runId?: string; tick?: boolean };
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "Invalid JSON body" }, 400);
  }

  try {
    if (body.tick) {
      if (!isService) return json({ success: false, error: "tick requires the service role" }, 403);
      const result = await tick(admin);
      return json({ success: true, ...result });
    }

    if (!body.runId) return json({ success: false, error: "runId is required" }, 400);
    const { data: run } = await admin.from("automation_runs").select("id, user_id").eq("id", body.runId).maybeSingle();
    if (!run) return json({ success: false, error: "Run not found" }, 404);
    if (!isService && run.user_id !== userId) return json({ success: false, error: "Forbidden" }, 403);

    const result = await advanceRun(admin, body.runId);
    return json({ success: true, ...result });
  } catch (e) {
    console.error("[run-step]", e);
    return json({ success: false, error: (e as Error).message }, 500);
  }
});

// ── tick ─────────────────────────────────────────────────────────────────────

async function tick(admin: Admin) {
  const { data: enqueued } = await admin.rpc("enqueue_due_automations", { p_limit: 20 });
  const { data: queued } = await admin
    .from("automation_runs")
    .select("id")
    .in("status", ["queued", "running"])
    .lt("updated_at", new Date(Date.now() - 60_000).toISOString())
    .order("created_at")
    .limit(10);
  const ids = new Set<string>([...(enqueued ?? []), ...(queued ?? []).map((r: any) => r.id)]);
  const advanced: Record<string, string> = {};
  for (const id of ids) {
    try {
      const r = await advanceRun(admin, id);
      advanced[id] = r.status;
    } catch (e) {
      advanced[id] = `error: ${(e as Error).message}`;
    }
  }
  const digests = await weeklyDigest(admin);
  return { enqueued: enqueued?.length ?? 0, advanced, digests };
}

/**
 * Once a week per founder with work waiting: one notification that sums it
 * up, so someone who doesn't open the app still hears "3 things need you".
 */
async function weeklyDigest(admin: Admin): Promise<number> {
  const { data: pending } = await admin.from("approvals").select("user_id, brand_id").eq("status", "pending");
  if (!pending?.length) return 0;
  const byUser = new Map<string, { brand_id: string; count: number }>();
  for (const p of pending) {
    const cur = byUser.get(p.user_id) ?? { brand_id: p.brand_id, count: 0 };
    cur.count++;
    byUser.set(p.user_id, cur);
  }
  const since = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
  let sent = 0;
  for (const [userId, info] of byUser) {
    const { data: recent } = await admin.from("notifications").select("id").eq("user_id", userId).eq("type", "agent_digest").gte("created_at", since).limit(1);
    if (recent?.length) continue;
    const { error } = await admin.from("notifications").insert({
      user_id: userId,
      brand_id: info.brand_id,
      type: "agent_digest",
      title: `${info.count} item${info.count === 1 ? "" : "s"} waiting for your review`,
      body: "Your agents finished work that needs a yes from you. Approve all of it in a minute on the Team page.",
      action_url: "/team",
      related_type: "digest",
    });
    if (!error) sent++;
  }
  return sent;
}

// ── advance one run ──────────────────────────────────────────────────────────

async function advanceRun(admin: Admin, runId: string): Promise<{ status: string; stepsRun: number; reason?: string }> {
  const { data: run, error } = await admin
    .from("automation_runs")
    .select("*, agents(*)")
    .eq("id", runId)
    .single();
  if (error || !run) throw new Error(error?.message ?? "Run not found");

  if (["completed", "failed", "cancelled"].includes(run.status)) {
    return { status: run.status, stepsRun: 0 };
  }

  const agent = run.agents as AgentDefinition | null;
  const budget: RunBudget = { ...DEFAULT_BUDGET, ...(run.budget ?? {}) };
  let stepsRun = 0;

  // ── reserve on first touch ──
  if (run.status === "queued") {
    const toReserve = Math.max(1, Number(run.credits_reserved) || Number(run.credits_quoted) || 1);
    const { data: res, error: rErr } = await admin.rpc("reserve_generation_credits", {
      p_user_id: run.user_id,
      p_credits: toReserve,
      p_generation_id: null,
      p_platform: "agent",
      p_metadata: { run_id: run.id, agent: agent?.slug ?? null, name: run.name },
    });
    if (rErr) throw new Error(`reserve failed: ${rErr.message}`);
    if (!res?.success) {
      const reason = res?.error === "INSUFFICIENT_BALANCE"
        ? `Not enough credits: this run needs up to ${toReserve}, you have ${res.available ?? 0} available.`
        : `Could not reserve credits (${res?.error ?? "unknown"}).`;
      await pauseRun(admin, run, reason);
      return { status: "paused", stepsRun, reason };
    }
    await admin.from("automation_runs").update({
      status: "running",
      generation_id: res.generation_id,
      credits_reserved: toReserve,
      started_at: run.started_at ?? new Date().toISOString(),
    }).eq("id", run.id);
    run.status = "running";
    run.generation_id = res.generation_id;
    run.credits_reserved = toReserve;
  }

  if (run.status === "paused") {
    // A paused run is resumed by the frontend flipping it back to running.
    return { status: "paused", stepsRun, reason: run.paused_reason ?? undefined };
  }

  // ── load steps ──
  const { data: steps } = await admin
    .from("automation_run_steps")
    .select("*")
    .eq("run_id", run.id)
    .order("step_index");
  const all = steps ?? [];

  // ── waiting on an approval? ──
  if (run.status === "waiting_approval") {
    const waiting = all.find((s: any) => s.status === "waiting");
    if (!waiting) {
      await admin.from("automation_runs").update({ status: "running" }).eq("id", run.id);
    } else {
      const { data: approval } = await admin
        .from("approvals")
        .select("status, note")
        .eq("step_id", waiting.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!approval || approval.status === "pending") {
        return { status: "waiting_approval", stepsRun };
      }
      if (approval.status === "rejected") {
        await admin.from("automation_run_steps").update({ status: "skipped", output: { decision: "rejected", note: approval.note }, finished_at: new Date().toISOString() }).eq("id", waiting.id);
        await finishRun(admin, run, "cancelled", { summary: `Cancelled by the founder${approval.note ? `: ${approval.note}` : "."}` });
        return { status: "cancelled", stepsRun };
      }
      await admin.from("automation_run_steps").update({ status: "done", output: { decision: "approved", note: approval.note }, finished_at: new Date().toISOString() }).eq("id", waiting.id);
      waiting.status = "done";
      await admin.from("automation_runs").update({ status: "running" }).eq("id", run.id);
      run.status = "running";
    }
  }

  // ── execute pending steps ──
  let creditsCaptured = Number(run.credits_captured) || 0;
  let lastOutput: Record<string, unknown> | null = (run.output as any) ?? null;

  for (const step of all) {
    if (step.status !== "pending") continue;
    if (stepsRun >= MAX_STEPS_PER_INVOCATION) break;

    if (step.type === "approval") {
      const prev = [...all].reverse().find((s: any) => s.step_index < step.step_index && s.status === "done" && s.type === "agent_task");
      let diff: Record<string, unknown> | null = null;
      if (step.input?.kind === "review_changes" && step.input?.connection_id) {
        // Show the founder exactly what will change, field by field, against
        // what was read, so the approval is a diff table, not a blob.
        const read = [...all].reverse().find((s: any) => s.step_index < step.step_index && s.status === "done" && s.type === "connector" && Array.isArray(s.output?.records));
        const { data: connRow } = await admin.from("tool_connections").select("provider, scope, display_name").eq("id", step.input.connection_id).maybeSingle();
        if (read && connRow) {
          const allowed = allowedFields(connRow.provider, connRow.scope);
          const d = diffLines(read.output.records as NormalizedRecord[], ((prev?.output as any)?.changes ?? []) as ProposedChange[], connRow.provider, allowed);
          diff = { lines: d.lines, rejected: d.rejected, applied_count: d.applied.length, connection_name: connRow.display_name, provider: connRow.provider };
        }
      }
      let code: Record<string, unknown> | null = null;
      if (step.input?.kind === "review_code" && step.input?.connection_id) {
        const { data: connRow } = await admin.from("tool_connections").select("scope, display_name").eq("id", step.input.connection_id).maybeSingle();
        const allowed = (connRow?.scope?.paths?.length ? connRow.scope.paths : DEFAULT_ALLOWED_PATHS) as string[];
        const v = validateEdit(((prev?.output as any)?.changes ?? []) as any[], allowed);
        code = {
          connection_name: connRow?.display_name ?? null,
          commit_message: (prev?.output as any)?.commit_message ?? null,
          pr_title: (prev?.output as any)?.pr_title ?? null,
          pr_body: (prev?.output as any)?.pr_body ?? null,
          files: v.accepted.map((a) => ({ path: a.path, action: a.action, bytes: a.content ? new TextEncoder().encode(a.content).length : 0, preview: (a.content ?? "").slice(0, 600) })),
          rejected: v.rejected,
        };
      }
      await admin.from("automation_run_steps").update({ status: "waiting", started_at: new Date().toISOString() }).eq("id", step.id);
      const { data: ap } = await admin.from("approvals").insert({
        run_id: run.id,
        step_id: step.id,
        brand_id: run.brand_id,
        user_id: run.user_id,
        kind: step.input?.kind ?? "review_output",
        title: `${agent?.name ?? "Agent"} finished "${run.name}"`,
        payload: { output: code ? null : (prev?.output ?? lastOutput ?? null), step_name: prev?.name ?? null, diff, code },
      }).select("id").single();
      await admin.from("automation_runs").update({ status: "waiting_approval", current_step: step.step_index }).eq("id", run.id);
      await notify(admin, run, "agent_needs_you", `${agent?.name ?? "An agent"} needs your review`, `"${run.name}" is ready to review.`, ap?.id ?? null);
      return { status: "waiting_approval", stepsRun };
    }

    if (step.type === "agent_task") {
      if (!agent) {
        await failRun(admin, run, step, "This run has no agent attached.");
        return { status: "failed", stepsRun };
      }

      // Quote the step so the budget guard has a number.
      const rule = await pricingRule(admin, agent.action_type);
      const units = normalizeUnits(step.input?.units);
      const fixedCredits = rule ? Math.max(1, Math.ceil(Number(rule.base_cost) * units)) : 1;
      const expected = rule?.pricing_mode === "metered" ? Math.ceil(fixedCredits * Math.max(1, Number(rule.range_factor) || 1)) : fixedCredits;

      const verdict = checkBudget(budget, agent, { creditsCaptured, stepsDone: all.filter((s: any) => s.status === "done").length }, expected);
      if (!verdict.ok) {
        await pauseRun(admin, run, verdict.reason);
        return { status: "paused", stepsRun, reason: verdict.reason };
      }

      await admin.from("automation_run_steps").update({ status: "running", started_at: new Date().toISOString() }).eq("id", step.id);
      await admin.from("automation_runs").update({ current_step: step.step_index }).eq("id", run.id);

      const pack = await buildContextPack(admin, run.brand_id);
      const systemPrompt = `${agent.system_prompt}\n\n=== BRAND CONTEXT (pack ${pack.hash}) ===\n${pack.text}`;
      let extra = "";
      if (step.input?.use_previous === "records") {
        const read = [...all].reverse().find((s: any) => s.step_index < step.step_index && s.status === "done" && s.type === "connector" && Array.isArray(s.output?.records));
        const { data: connRow } = step.input?.connection_id ? await admin.from("tool_connections").select("provider, scope").eq("id", step.input.connection_id).maybeSingle() : { data: null };
        const allowed = connRow ? allowedFields(connRow.provider, connRow.scope) : [];
        const records = (read?.output?.records ?? []) as NormalizedRecord[];
        extra = [
          `ALLOWED FIELDS (only these may appear in "fields"): ${allowed.join(", ") || "(none)"}`,
          `RECORDS (${records.length}):`,
          JSON.stringify(records.map((r) => ({ id: r.id, label: r.label, ...r.fields })), null, 0).slice(0, 60_000),
        ].join("\n");
      } else if (step.input?.use_previous === "snapshot") {
        const snap = [...all].reverse().find((s: any) => s.step_index < step.step_index && s.status === "done" && s.type === "connector" && Array.isArray(s.output?.files));
        const files = ((snap?.output?.files ?? []) as { path: string; size: number }[]).map((f) => `${f.path} (${f.size}b)`);
        extra = [
          `MODE: PLAN. Choose at most 8 files to read and outline the change. Respond with the PLAN JSON shape.`,
          `REPOSITORY FILES you may read and change (${files.length}${snap?.output?.truncated ? ", truncated" : ""}):`,
          files.join("\n").slice(0, 40_000),
        ].join("\n");
      } else if (step.input?.use_previous === "files") {
        const read = [...all].reverse().find((s: any) => s.step_index < step.step_index && s.status === "done" && s.type === "connector" && Array.isArray(s.output?.files) && s.output?.files?.[0]?.content != null);
        const plan = [...all].reverse().find((s: any) => s.step_index < step.step_index && s.status === "done" && s.type === "agent_task" && s.input?.prompt_mode === "plan");
        const files = (read?.output?.files ?? []) as { path: string; content: string }[];
        const { data: connRow } = step.input?.connection_id ? await admin.from("tool_connections").select("scope").eq("id", step.input.connection_id).maybeSingle() : { data: null };
        const allowed = (connRow?.scope?.paths?.length ? connRow.scope.paths : DEFAULT_ALLOWED_PATHS) as string[];
        extra = [
          `MODE: EDIT. Respond with the EDIT JSON shape. Return FULL new contents for each changed file.`,
          `WRITABLE PATHS: ${allowed.join(", ")}. Anything else is rejected.`,
          plan?.output?.approach ? `YOUR PLAN: ${plan.output.approach}` : "",
          `FILES (${files.length}):`,
          ...files.map((f) => `=== ${f.path} ===\n${f.content}`),
        ].filter(Boolean).join("\n\n").slice(0, 180_000);
      } else if (step.input?.output_hint === "blog_post") {
        extra = `OUTPUT SHAPE FOR THIS TASK: exactly one item with "platform": "blog", "title" (the post title), "excerpt" (one or two sentences for the meta description, under 155 characters) and "body" (the full post, 500-900 words, with short paragraphs and subheadings as plain text).`;
      }
      const userPrompt = buildTaskPrompt(agent, step.input ?? {}, extra);

      const gw = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
        body: JSON.stringify({
          userId: run.user_id,
          taskType: `agent_${agent.slug}`,
          modelTier: agent.model_tier,
          systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
          maxTokens: Math.min(32000, Math.max(1000, Number(step.input?.max_tokens) || 4000)),
          temperature: step.input?.prompt_mode ? 0.2 : 0.7,
          generationId: run.generation_id,
          cacheContext: true,
          metadata: { run_id: run.id, step_id: step.id, agent: agent.slug, context_hash: pack.hash },
        }),
      });
      const result = await gw.json().catch(() => null);

      if (!gw.ok || !result?.success) {
        const msg = result?.error ?? `AI gateway returned ${gw.status}`;
        await failRun(admin, run, step, msg, result?.usageLogId ?? null);
        return { status: "failed", stepsRun };
      }

      const parsed = parseStructuredOutput(result.text ?? "");
      if (!parsed.ok) {
        await failRun(admin, run, step, `${agent.name} did not return structured output (${parsed.error}).`, result.usageLogId ?? null, result.text);
        return { status: "failed", stepsRun };
      }

      // Charge: fixed rules bill the rule, metered rules bill real usage.
      // Helper steps marked charge:false (e.g. the Developer's plan) bill only
      // their real usage so the quoted action is not charged twice.
      let toCapture = fixedCredits;
      if (rule?.pricing_mode === "metered" || step.input?.charge === false) {
        toCapture = Math.max(step.input?.charge === false ? 0 : 1, Math.ceil(Number(result.creditsEquivalent) || 0));
      }
      const remaining = Number(run.credits_reserved) - creditsCaptured;
      toCapture = Math.min(toCapture, Math.max(0, remaining));
      let captured = 0;
      let captureError: string | null = null;
      if (toCapture > 0 && run.generation_id) {
        const { data: cap, error: capErr } = await admin.rpc("capture_reserved_credits", {
          p_generation_id: run.generation_id,
          p_capture_amount: toCapture,
          p_ai_provider: result.providerUsed ?? null,
          p_ai_model: result.modelUsed ?? null,
        });
        if (capErr) captureError = capErr.message;
        else if (!cap?.success) captureError = cap?.error ?? "capture rejected";
        captured = cap?.success ? Number(cap.credits_captured) || 0 : 0;
        // The work is done and the provider was paid; a billing failure must
        // be visible, not silent.
        if (captureError) console.error("[run-step] capture failed", { runId: run.id, stepId: step.id, toCapture, captureError });
      }
      creditsCaptured += captured;
      lastOutput = parsed.value;

      await admin.from("automation_run_steps").update({
        status: "done",
        output: parsed.value,
        error: captureError ? `Billing: ${captureError}` : null,
        credits_captured: captured,
        cost_usd: Number(result.costUsd) || 0,
        usage_log_id: result.usageLogId ?? null,
        finished_at: new Date().toISOString(),
      }).eq("id", step.id);
      await admin.from("automation_runs").update({ credits_captured: creditsCaptured, output: parsed.value }).eq("id", run.id);
      step.status = "done";
      step.output = parsed.value;
      stepsRun++;
      continue;
    }

    if (step.type === "connector") {
      await admin.from("automation_run_steps").update({ status: "running", started_at: new Date().toISOString() }).eq("id", step.id);
      await admin.from("automation_runs").update({ current_step: step.step_index }).eq("id", run.id);
      try {
        const out = await runConnectorStep(admin, run, step, all);
        await admin.from("automation_run_steps").update({ status: "done", output: out, finished_at: new Date().toISOString() }).eq("id", step.id);
        step.status = "done";
        step.output = out;
        if (out && typeof out === "object" && !Array.isArray((out as any).records)) lastOutput = { ...(lastOutput ?? {}), connector: out };
        stepsRun++;
        continue;
      } catch (e) {
        const msg = e instanceof ConnectorError ? e.message : `Connector step failed: ${(e as Error).message}`;
        await failRun(admin, run, step, msg);
        return { status: "failed", stepsRun };
      }
    }

    // native steps arrive with Phase 3
    await admin.from("automation_run_steps").update({ status: "skipped", output: { reason: "step type not available yet" }, finished_at: new Date().toISOString() }).eq("id", step.id);
    step.status = "skipped";
  }

  const stillPending = all.some((s: any) => s.status === "pending");
  if (stillPending) {
    // Hit the per-invocation cap; the tick (or the next click) continues it.
    return { status: "running", stepsRun };
  }

  const summary = summarizeOutput(agent?.name ?? "Agent", lastOutput, `${run.name} finished.`);
  const finalOutput = { ...(lastOutput ?? {}), summary };
  await finishRun(admin, run, "completed", finalOutput);
  await notify(admin, run, "agent_run_completed", `${agent?.name ?? "Agent"} finished "${run.name}"`, summary, null);
  return { status: "completed", stepsRun };
}

// ── connector steps ──────────────────────────────────────────────────────────

/**
 * list_records → read through the connection (output.records)
 * apply_changes → take the previous agent step's `changes`, diff them against
 *                 the records read earlier, write the allowed ones, one change
 *                 set each
 * create_draft  → take the previous agent step's first item and create it
 */
async function runConnectorStep(admin: Admin, run: any, step: any, all: any[]): Promise<Record<string, unknown>> {
  const connectionId = step.input?.connection_id;
  if (!connectionId) throw new ConnectorError("This step has no connection.", 400);
  const loaded = await loadConnection(admin, connectionId);
  if (loaded.row.brand_id !== run.brand_id || loaded.row.user_id !== run.user_id) throw new ConnectorError("Connection does not belong to this run's brand.", 403);
  const ctx = { brandId: run.brand_id, userId: run.user_id, runId: run.id, stepId: step.id };
  const prevAgent = [...all].reverse().find((s: any) => s.step_index < step.step_index && s.status === "done" && s.type === "agent_task");

  switch (step.input?.action) {
    case "list_records": {
      const records = await runConnector(loaded.row, loaded.secret, { action: "list_records", limit: Number(step.input.limit) || 25 });
      return { records: trimRecords(records), count: records.length, connection: loaded.row.display_name };
    }
    case "apply_changes": {
      const read = [...all].reverse().find((s: any) => s.step_index < step.step_index && s.status === "done" && s.type === "connector" && Array.isArray(s.output?.records));
      const records = (read?.output?.records ?? []) as NormalizedRecord[];
      const changes = ((prevAgent?.output as any)?.changes ?? []) as ProposedChange[];
      if (!changes.length) return { applied: [], rejected: [], failed: [], note: "The agent proposed no changes." };
      const result = await applyChanges(admin, ctx, loaded, records, changes);
      return { ...result, summary: `${result.applied.length} record${result.applied.length === 1 ? "" : "s"} updated in ${loaded.row.display_name}${result.failed.length ? `, ${result.failed.length} failed` : ""}.` };
    }
    case "create_draft": {
      const item = ((prevAgent?.output as any)?.items ?? [])[0];
      if (!item) throw new ConnectorError("The agent did not produce a post to publish.", 400);
      const fields: Record<string, string> = {
        title: String(item.title ?? run.name),
        content: String(item.body ?? ""),
        excerpt: String(item.excerpt ?? ""),
      };
      const { change_set_id, record } = await createRecord(admin, ctx, loaded, fields, fields.title);
      return { created: { id: record.id, label: record.label, url: record.url }, change_set_id, summary: `Draft "${record.label}" created in ${loaded.row.display_name}.` };
    }
    case "repo_snapshot": {
      const snap = await repoSnapshot(loaded);
      return { ...snap, summary: `${snap.total} file${snap.total === 1 ? "" : "s"} visible under the allowed paths.` };
    }
    case "read_files": {
      const snap = [...all].reverse().find((s: any) => s.step_index < step.step_index && s.status === "done" && s.type === "connector" && s.output?.branch);
      const paths = (((prevAgent?.output as any)?.files_to_read ?? []) as unknown[]).map(String);
      if (!paths.length) throw new ConnectorError("The plan named no files to read.", 400);
      const r = await readRepoFiles(loaded, String(snap?.output?.branch ?? ""), paths);
      return { ...r, branch: snap?.output?.branch ?? null, summary: `Read ${r.files.length} file${r.files.length === 1 ? "" : "s"}.` };
    }
    case "open_pr": {
      const out = (prevAgent?.output ?? {}) as any;
      const read = [...all].reverse().find((s: any) => s.step_index < step.step_index && s.status === "done" && s.type === "connector" && Array.isArray(s.output?.files) && s.output?.files?.[0]?.sha);
      const known: Record<string, string> = {};
      for (const f of (read?.output?.files ?? []) as { path: string; sha: string }[]) known[f.path] = f.sha;
      const r = await openPullRequest(admin, ctx, loaded, {
        changes: out.changes ?? [],
        commit_message: String(out.commit_message ?? ""),
        pr_title: String(out.pr_title ?? run.name),
        pr_body: String(out.pr_body ?? ""),
        known,
        branch: String(read?.output?.branch ?? ""),
      });
      return { ...r, summary: `Pull request #${r.pr_number} opened with ${r.files.length} file${r.files.length === 1 ? "" : "s"}: ${r.pr_url}` };
    }
    case "publish_items": {
      const items = (((prevAgent?.output as any)?.items ?? []) as any[]).filter((it) => it && typeof it === "object");
      if (!items.length) throw new ConnectorError("The agent did not produce any posts to publish.", 400);
      const scheduleAt = step.input?.schedule_at ? String(step.input.schedule_at) : undefined;
      const out = await publishItems(admin, ctx, loaded, items, scheduleAt);
      const n = out.published.length;
      return { ...out, summary: `${n} post${n === 1 ? "" : "s"} ${scheduleAt ? "scheduled" : "published"} via ${loaded.row.display_name}${out.failed.length ? `, ${out.failed.length} failed` : ""}.` };
    }
    default:
      throw new ConnectorError(`Unknown connector action ${step.input?.action}`, 400);
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

async function pricingRule(admin: Admin, key: string) {
  const { data } = await admin.from("ai_generation_pricing").select("base_cost, pricing_mode, range_factor").eq("pricing_key", key).eq("is_active", true).maybeSingle();
  return data as { base_cost: number; pricing_mode: string; range_factor: number } | null;
}

async function pauseRun(admin: Admin, run: any, reason: string) {
  await admin.from("automation_runs").update({ status: "paused", paused_reason: reason }).eq("id", run.id);
  await notify(admin, run, "agent_run_paused", `"${run.name}" is paused`, reason, null);
}

async function failRun(admin: Admin, run: any, step: any, message: string, usageLogId: string | null = null, rawText?: string) {
  await admin.from("automation_run_steps").update({
    status: "failed",
    error: message,
    usage_log_id: usageLogId,
    output: rawText ? { raw: rawText.slice(0, 4000) } : null,
    finished_at: new Date().toISOString(),
  }).eq("id", step.id);
  await finishRun(admin, run, "failed", null, message);
  await notify(admin, run, "agent_run_failed", `"${run.name}" stopped`, message, null);
}

async function finishRun(admin: Admin, run: any, status: "completed" | "failed" | "cancelled", output: Record<string, unknown> | null, error?: string) {
  await admin.from("automation_runs").update({
    status,
    output: output ?? run.output ?? null,
    error: error ?? null,
    finished_at: new Date().toISOString(),
  }).eq("id", run.id);
  if (run.generation_id) {
    // Releases whatever was reserved but not captured. Captured credits stay
    // captured even on failure: provider cost was already incurred.
    // generations.status only accepts the billing vocabulary.
    const captured = Number(run.credits_captured) || 0;
    const genStatus = status === "completed" ? "completed" : status === "cancelled" ? "released" : captured > 0 ? "failed_post_cost" : "failed_pre_cost";
    await admin.rpc("finalize_generation_billing", {
      p_generation_id: run.generation_id,
      p_status: genStatus,
      p_provider_cost_usd: null,
      p_metadata: { run_id: run.id, final: status },
    });
  }
}

async function notify(admin: Admin, run: any, type: string, title: string, body: string, approvalId: string | null) {
  const { error } = await admin.from("notifications").insert({
    user_id: run.user_id,
    brand_id: run.brand_id,
    type,
    title,
    body: body.slice(0, 500),
    action_url: approvalId ? `/team?approval=${approvalId}` : `/team?run=${run.id}`,
    related_id: run.id,
    related_type: "automation_run",
  });
  // A notification is a courtesy; never let it break a run, but say so.
  if (error) console.error("[run-step] notification failed", { runId: run.id, type, error: error.message });
}
