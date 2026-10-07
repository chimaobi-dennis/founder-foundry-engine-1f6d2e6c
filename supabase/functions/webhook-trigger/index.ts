/**
 * webhook-trigger — fire an automation from another system.
 *
 *   POST /functions/v1/webhook-trigger?automation=<id>&key=<webhook_secret>
 *   headers: X-Event-Id: <unique id>   (optional; else body.id / body.event_id)
 *   body:    any JSON; stored on the run as input.event
 *
 * Idempotent per (automation, event id): a retried delivery returns the
 * existing run instead of starting another. No user JWT: the secret is the
 * credential, scoped to one automation.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { planSingleAgentRun, DEFAULT_BUDGET, DEFAULT_POLICY, type AgentDefinition } from "../_shared/runner.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "POST only" }, 405);

  const url = new URL(req.url);
  const automationId = url.searchParams.get("automation") ?? "";
  const key = url.searchParams.get("key") ?? req.headers.get("X-Kinika-Key") ?? "";
  if (!automationId || !key) return json({ success: false, error: "automation and key are required" }, 400);

  let body: any = {};
  try {
    const text = await req.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    body = {};
  }
  const eventId = (req.headers.get("X-Event-Id") ?? body?.event_id ?? body?.id ?? "").toString().slice(0, 200) || null;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: automation } = await admin.from("automations").select("*, agents(*)").eq("id", automationId).maybeSingle();
  if (!automation || !automation.webhook_secret || automation.webhook_secret !== key) {
    // Same answer for unknown id and wrong key.
    return json({ success: false, error: "Unknown automation or key" }, 404);
  }
  if (automation.status !== "active") return json({ success: false, error: "Automation is paused" }, 409);
  if (automation.trigger_type !== "webhook") return json({ success: false, error: "This automation is not webhook-triggered" }, 409);

  if (eventId) {
    const { data: existing } = await admin.from("automation_runs").select("id, status").eq("automation_id", automation.id).eq("external_event_id", eventId).maybeSingle();
    if (existing) return json({ success: true, duplicate: true, run_id: existing.id, status: existing.status });
  }

  const agent = automation.agents as AgentDefinition | null;
  if (!agent) return json({ success: false, error: "Automation has no agent" }, 409);

  // The event payload is appended to the brief so the agent can use it.
  const payloadNote = body && Object.keys(body).length ? `\n\nEVENT DATA:\n${JSON.stringify(body).slice(0, 4000)}` : "";
  const input = { ...(automation.task_input ?? {}), brief: `${automation.task_input?.brief ?? ""}${payloadNote}`, event: body };
  const policy = automation.policy ?? DEFAULT_POLICY;
  const budget = automation.budget ?? DEFAULT_BUDGET;
  const steps = planSingleAgentRun(agent, input, policy);

  const { data: run, error } = await admin.from("automation_runs").insert({
    automation_id: automation.id,
    brand_id: automation.brand_id,
    user_id: automation.user_id,
    agent_id: automation.agent_id,
    name: automation.name,
    trigger_type: "webhook",
    status: "queued",
    input,
    policy,
    budget,
    credits_quoted: budget.credits_per_run,
    credits_reserved: budget.credits_per_run,
    external_event_id: eventId,
  }).select("id").single();
  if (error || !run) {
    // A concurrent duplicate hits the unique index; report the first run.
    if (eventId) {
      const { data: existing } = await admin.from("automation_runs").select("id, status").eq("automation_id", automation.id).eq("external_event_id", eventId).maybeSingle();
      if (existing) return json({ success: true, duplicate: true, run_id: existing.id, status: existing.status });
    }
    return json({ success: false, error: error?.message ?? "Could not create run" }, 500);
  }
  await admin.from("automation_run_steps").insert(steps.map((s) => ({ run_id: run.id, step_index: s.step_index, type: s.type, name: s.name, input: s.input })));
  await admin.from("automations").update({ last_run_at: new Date().toISOString() }).eq("id", automation.id);

  // Kick the runner; the tick picks it up anyway if this fails.
  fetch(`${SUPABASE_URL}/functions/v1/run-step`, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    body: JSON.stringify({ runId: run.id }),
  }).catch(() => {});

  return json({ success: true, run_id: run.id, status: "queued" }, 202);
});
