/**
 * ai-gateway — the single server-side path for LLM inference.
 *
 * Why: provider keys used to be read from ai_providers in the browser and
 * sent straight to Google/Anthropic. Now the browser sends a task, the
 * gateway resolves the model, holds the key, calls the provider, records
 * usage + cost in ai_usage_log, and returns text (JSON or SSE).
 *
 * Request (POST, user JWT in Authorization):
 * {
 *   taskType: string,                    // 'mentor_chat', 'template_generation', …
 *   modelTier?: 'fast'|'standard'|'reasoning'|'coding',  // agents ask by tier, not model
 *   messages: {role, content}[],
 *   systemPrompt?: string,
 *   maxTokens?: number,
 *   temperature?: number,
 *   overrideModelId?: string,
 *   imageBase64?: string, imageMimeType?: string,
 *   stream?: boolean,                    // SSE response when true
 *   generationId?: string,               // attach usage/cost to a generation row
 *   cacheContext?: boolean,              // default true
 *   metadata?: object                    // copied onto the usage log row
 * }
 *
 * JSON response: { success, text, modelUsed, providerUsed, usage, costUsd, creditsEquivalent, usageLogId }
 * SSE events:    {type:'chunk', text} … {type:'done', …same fields as JSON…} | {type:'error', error}
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { callProvider, ProviderError, type ChatMessage, type ProviderConfig } from "../_shared/providers.ts";
import { capMaxTokens, isRetryable, orderForRequest, RETRY_DELAY_MS, stripReasoning, type Route, type RouteCandidate } from "../_shared/routing.ts";

/** Longest a single provider attempt may take, and the whole request's budget; both sit under the edge wall clock. */
const ATTEMPT_TIMEOUT_MS = 90_000;
const TOTAL_BUDGET_MS = 140_000;
import {
  costFromUsage,
  creditsFromCost,
  DEFAULT_CREDIT_ECONOMICS,
  type CreditEconomics,
  type ModelRate,
  type TokenUsage,
} from "../_shared/pricing.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const TIERS = new Set(["fast", "standard", "reasoning", "coding"]);

interface GatewayRequest {
  taskType: string;
  modelTier?: string;
  messages: ChatMessage[];
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  overrideModelId?: string;
  imageBase64?: string;
  imageMimeType?: string;
  stream?: boolean;
  generationId?: string;
  cacheContext?: boolean;
  metadata?: Record<string, unknown>;
}


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "POST only" }, 405);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // ── Auth ──
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  let userId: string | null = null;
  let isServiceCall = false;
  if (token && token === SERVICE_ROLE_KEY) {
    isServiceCall = true;
  } else if (token) {
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });
    const { data } = await userClient.auth.getUser();
    userId = data.user?.id ?? null;
  }
  if (!userId && !isServiceCall) return json({ success: false, error: "Unauthorized" }, 401);

  // ── Parse ──
  let body: GatewayRequest;
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "Invalid JSON body" }, 400);
  }
  if (isServiceCall && typeof (body as any).userId === "string") userId = (body as any).userId;
  if (!body.taskType || !Array.isArray(body.messages) || body.messages.length === 0) {
    return json({ success: false, error: "taskType and messages are required" }, 400);
  }
  const tier = body.modelTier && TIERS.has(body.modelTier) ? body.modelTier : null;
  const maxTokens = clamp(body.maxTokens ?? 2000, 16, 65536);

  // ── Resolve the route: ordered candidates from the active profile ──
  let route: Route;
  try {
    route = await resolveRoute(admin, body.taskType, tier, userId);
  } catch (e) {
    return json({ success: false, error: (e as Error).message }, 500);
  }
  // Remember the task type so admins can route it (fire and forget).
  admin.rpc("register_ai_task_type", { p_task_type: body.taskType, p_tier: tier }).then(() => {}, () => {});

  let candidates = orderForRequest(route.candidates, !!body.imageBase64);
  if (body.overrideModelId) {
    // An explicit model wins, if the admin has it configured; otherwise it is ignored.
    const pinned = route.candidates.find((c) => c.model_id === body.overrideModelId);
    if (pinned) candidates = [pinned, ...candidates.filter((c) => c.model_row_id !== pinned.model_row_id)];
  }
  if (!candidates.length) {
    const where = route.class ? `the ${route.class} class` : tier ? `tier_${tier}` : body.taskType;
    return json({ success: false, error: `No AI model is routed for ${where}. Set it in Admin → AI Models → Routing.` }, 422);
  }

  // Keys are fetched per provider as we go; a provider with no key is skipped.
  const keyCache = new Map<string, string | null>();
  const keyFor = async (c: RouteCandidate) => {
    if (!keyCache.has(c.provider.id)) keyCache.set(c.provider.id, await providerKey(admin, c.provider.id, c.provider.slug));
    return keyCache.get(c.provider.id) ?? null;
  };

  const econ = await creditEconomics(admin);
  const started = Date.now();
  let attemptsTotal = 0;
  // Every failed try, so an admin can see why a fallback was used.
  const attemptErrors: { provider: string; model: string; status: number; error: string }[] = [];

  const finish = async (chosen: RouteCandidate, text: string, usage: TokenUsage, success: boolean, error?: string, routeNote?: Record<string, unknown>) => {
    const rate = await modelRate(admin, chosen.provider.slug, chosen.model_id, chosen);
    const costUsd = costFromUsage(usage, rate);
    const credits = creditsFromCost(costUsd, econ);
    const latency = Date.now() - started;
    const { data: logRow } = await admin
      .from("ai_usage_log")
      .insert({
        user_id: userId,
        generation_id: body.generationId ?? null,
        task_type: body.taskType,
        model_tier: tier,
        provider_slug: chosen.provider.slug,
        model_id: chosen.model_id,
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        cache_read_tokens: usage.cache_read_tokens,
        cache_write_tokens: usage.cache_write_tokens,
        cost_usd: costUsd,
        credits_equivalent: credits,
        latency_ms: latency,
        success,
        error_message: error ?? null,
        metadata: { ...(body.metadata ?? {}), stream: !!body.stream, max_tokens: maxTokens, rate_found: !!rate, route: { profile: route.profile, class: route.class, source: route.source, attempts: attemptsTotal, ...(attemptErrors.length ? { attempt_errors: attemptErrors } : {}), ...(routeNote ?? {}) } },
      })
      .select("id")
      .single();

    if (body.generationId && success) {
      // Keep the generation row's provider cost in step with what we spent.
      await admin.rpc("add_generation_provider_cost", {
        p_generation_id: body.generationId,
        p_cost_usd: costUsd,
        p_provider: chosen.provider.slug,
        p_model: chosen.model_id,
        p_usage: usage,
      }).then(({ error: rpcErr }: any) => {
        if (rpcErr) console.warn("[ai-gateway] add_generation_provider_cost:", rpcErr.message);
      });
    }

    return {
      success,
      text,
      error,
      modelUsed: chosen.model_id,
      providerUsed: chosen.provider.slug,
      usage,
      costUsd,
      creditsEquivalent: credits,
      latencyMs: latency,
      usageLogId: logRow?.id ?? null,
    };
  };

  const baseReq = {
    messages: body.messages,
    systemPrompt: body.systemPrompt,
    temperature: body.temperature,
    imageBase64: body.imageBase64,
    imageMimeType: body.imageMimeType,
    cacheContext: body.cacheContext !== false,
  };

  /**
   * Walk the candidates: one retry on the same model for a provider-side
   * failure, then the next model. Returns the first good answer, or the last
   * error with the candidate it came from.
   */
  const attempt = async (onChunk?: (t: string) => void): Promise<{ ok: true; chosen: RouteCandidate; text: string; usage: TokenUsage; fallbackUsed: boolean } | { ok: false; chosen: RouteCandidate; status: number; message: string }> => {
    let last: { chosen: RouteCandidate; status: number; message: string } | null = null;
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const apiKey = await keyFor(c);
      if (!apiKey) { last = { chosen: c, status: 422, message: `No API key configured for provider ${c.provider.slug}. Add it in Admin → AI Models → Providers.` }; continue; }
      const cfg: ProviderConfig = { slug: c.provider.slug, base_url: baseUrlFor(c.provider), auth_header_name: c.provider.auth_header_name, auth_header_prefix: c.provider.auth_header_prefix, apiKey };
      for (let tryN = 0; tryN < 2; tryN++) {
        attemptsTotal++;
        let emitted = false;
        // A provider that has not answered within the attempt budget is abandoned so the next
        // candidate still fits inside the edge function's wall clock, and the failure is logged.
        const ctrl = new AbortController();
        const budget = Math.max(5_000, Math.min(ATTEMPT_TIMEOUT_MS, TOTAL_BUDGET_MS - (Date.now() - started)));
        const timer = setTimeout(() => ctrl.abort(), budget);
        try {
          const out = await callProvider(cfg, { ...baseReq, modelId: c.model_id, maxTokens: capMaxTokens(maxTokens, c), signal: ctrl.signal, ...(onChunk ? { stream: true, onChunk: (t: string) => { emitted = true; onChunk(t); } } : {}) });
          clearTimeout(timer);
          const text = c.strip_reasoning ? stripReasoning(out.text) : out.text;
          if (!text) { last = { chosen: c, status: 502, message: "Provider returned an empty response" }; attemptErrors.push({ provider: c.provider.slug, model: c.model_id, status: 502, error: "empty response" }); break; }
          return { ok: true, chosen: c, text, usage: out.usage, fallbackUsed: i > 0 };
        } catch (e) {
          clearTimeout(timer);
          const timedOut = ctrl.signal.aborted;
          const status = timedOut ? 504 : e instanceof ProviderError ? e.status : 500;
          const message = timedOut ? `${c.provider.slug}/${c.model_id} did not answer within ${Math.round(budget / 1000)}s` : (e as Error).message;
          last = { chosen: c, status, message };
          attemptErrors.push({ provider: c.provider.slug, model: c.model_id, status, error: message.slice(0, 200) });
          // A stream that already sent text cannot be transparently retried; a timeout moves straight to the next model.
          if (emitted || !isRetryable(status, message)) return { ok: false, ...last };
          if (timedOut) break;
          if (tryN === 0) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        }
      }
    }
    return { ok: false, ...(last ?? { chosen: candidates[0], status: 502, message: "No candidate could serve the request" }) };
  };

  // ── Non-streaming ──
  if (!body.stream) {
    const res = await attempt();
    if (res.ok) return json(await finish(res.chosen, res.text, res.usage, true, undefined, { fallback_used: res.fallbackUsed }));
    const r = await finish(res.chosen, "", zeroUsage(), false, res.message);
    return json(r, res.status >= 400 && res.status < 600 ? res.status : 502);
  }

  // ── Streaming (SSE) ──
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (ev: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
      try {
        const res = await attempt((text) => send({ type: "chunk", text }));
        if (res.ok) {
          const r = await finish(res.chosen, res.text, res.usage, true, undefined, { fallback_used: res.fallbackUsed });
          send({ type: "done", ...r });
        } else {
          const r = await finish(res.chosen, "", zeroUsage(), false, res.message);
          send({ type: "error", ...r });
        }
      } catch (e) {
        send({ type: "error", success: false, error: (e as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { ...corsHeaders, "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" },
  });
});

// ── helpers ──────────────────────────────────────────────────────────────────

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, Math.floor(Number(n) || lo)));
}

function zeroUsage(): TokenUsage {
  return { input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0 };
}

function baseUrlFor(p: RouteCandidate["provider"]): string {
  if (p.base_url) return p.base_url;
  if (p.slug === "lovable-gemini") return "https://ai.gateway.lovable.dev/v1";
  if (p.slug === "openai") return "https://api.openai.com/v1";
  return "";
}

/** The ordered candidates for this call, from the active routing profile. */
async function resolveRoute(admin: SupabaseClient, taskType: string, tier: string | null, userId: string | null): Promise<Route> {
  const { data, error } = await admin.rpc("resolve_ai_route", { p_task_type: taskType, p_tier: tier, p_user_id: userId });
  if (error) throw new Error(`Could not resolve a model: ${error.message}`);
  const r = (data ?? {}) as Partial<Route>;
  return { profile: r.profile ?? null, class: r.class ?? null, source: r.source ?? "none", candidates: Array.isArray(r.candidates) ? r.candidates : [] };
}

/** Secret from ai_provider_secrets, else an env var for that provider. */
async function providerKey(admin: SupabaseClient, providerId: string, slug: string): Promise<string | null> {
  const { data } = await admin.from("ai_provider_secrets").select("api_key").eq("provider_id", providerId).maybeSingle();
  if (data?.api_key) return data.api_key;
  const envBySlug: Record<string, string> = {
    anthropic: "ANTHROPIC_API_KEY",
    "google-ai-studio": "GOOGLE_AI_API_KEY",
    openai: "OPENAI_API_KEY",
    "lovable-gemini": "LOVABLE_API_KEY",
  };
  const envName = envBySlug[slug];
  return envName ? Deno.env.get(envName) ?? null : null;
}

async function modelRate(admin: SupabaseClient, slug: string, modelId: string, resolved: Pick<RouteCandidate, "cost_per_1k_input" | "cost_per_1k_output">): Promise<ModelRate | null> {
  const { data } = await admin
    .from("model_rates")
    .select("input_per_1m, output_per_1m, cache_read_per_1m, cache_write_per_1m")
    .eq("provider_slug", slug)
    .eq("model_id", modelId)
    .eq("is_active", true)
    .maybeSingle();
  if (data) return data as ModelRate;
  // Fall back to the per-1k numbers on ai_models, if the admin filled them in.
  if (resolved.cost_per_1k_input != null || resolved.cost_per_1k_output != null) {
    return {
      input_per_1m: (resolved.cost_per_1k_input ?? 0) * 1000,
      output_per_1m: (resolved.cost_per_1k_output ?? 0) * 1000,
      cache_read_per_1m: null,
      cache_write_per_1m: null,
    };
  }
  return null;
}

async function creditEconomics(admin: SupabaseClient): Promise<CreditEconomics> {
  const { data } = await admin.from("platform_settings").select("setting_value").eq("setting_key", "credit_economics").maybeSingle();
  const v = (data?.setting_value ?? {}) as Partial<CreditEconomics>;
  return {
    retail_usd_per_credit: Number(v.retail_usd_per_credit) || DEFAULT_CREDIT_ECONOMICS.retail_usd_per_credit,
    cogs_multiplier: Number(v.cogs_multiplier) || DEFAULT_CREDIT_ECONOMICS.cogs_multiplier,
  };
}
