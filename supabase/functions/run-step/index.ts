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
  return { enqueued: enqueued?.length ?? 0, advanced };
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
      await admin.from("automation_run_steps").update({ status: "waiting", started_at: new Date().toISOString() }).eq("id", step.id);
      const { data: ap } = await admin.from("approvals").insert({
        run_id: run.id,
        step_id: step.id,
        brand_id: run.brand_id,
        user_id: run.user_id,
        kind: step.input?.kind ?? "review_output",
        title: `${agent?.name ?? "Agent"} finished "${run.name}"`,
        payload: { output: prev?.output ?? lastOutput ?? null, step_name: prev?.name ?? null },
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
      const userPrompt = buildTaskPrompt(agent, step.input ?? {});

      const gw = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
        body: JSON.stringify({
          userId: run.user_id,
          taskType: `agent_${agent.slug}`,
          modelTier: agent.model_tier,
          systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
          maxTokens: 4000,
          temperature: 0.7,
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
      let toCapture = fixedCredits;
      if (rule?.pricing_mode === "metered") {
        toCapture = Math.max(1, Math.ceil(Number(result.creditsEquivalent) || 0));
      }
      const remaining = Number(run.credits_reserved) - creditsCaptured;
      toCapture = Math.min(toCapture, Math.max(0, remaining));
      let captured = 0;
      if (toCapture > 0 && run.generation_id) {
        const { data: cap } = await admin.rpc("capture_reserved_credits", {
          p_generation_id: run.generation_id,
          p_capture_amount: toCapture,
          p_ai_provider: result.providerUsed ?? null,
          p_ai_model: result.modelUsed ?? null,
        });
        captured = cap?.success ? Number(cap.credits_captured) || 0 : 0;
      }
      creditsCaptured += captured;
      lastOutput = parsed.value;

      await admin.from("automation_run_steps").update({
        status: "done",
        output: parsed.value,
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

    // native / connector steps arrive in Phase 2
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
  await admin.from("notifications").insert({
    user_id: run.user_id,
    brand_id: run.brand_id,
    type,
    title,
    body: body.slice(0, 500),
    action_url: approvalId ? `/team?approval=${approvalId}` : `/team?run=${run.id}`,
    related_id: run.id,
    related_type: "automation_run",
  });
}
