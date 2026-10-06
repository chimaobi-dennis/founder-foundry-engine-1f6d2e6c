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
 *   modelTier?: 'fast'|'standard'|'reasoning',  // agents ask by tier, not model
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

const TIERS = new Set(["fast", "standard", "reasoning"]);

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

interface ResolvedModel {
  modelId: string;
  modelName: string;
  provider: { id: string; slug: string; base_url: string; auth_header_name: string; auth_header_prefix: string; is_enabled: boolean };
  costPer1kInput: number | null;
  costPer1kOutput: number | null;
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

  // ── Resolve model + key ──
  let resolved: ResolvedModel | null;
  try {
    resolved = await resolveModel(admin, body.taskType, tier, userId);
  } catch (e) {
    return json({ success: false, error: (e as Error).message }, 500);
  }
  if (!resolved) {
    const where = tier ? `tier_${tier}` : body.taskType;
    return json({ success: false, error: `No AI model configured for ${where}. Set it in Admin → AI Models → Task Defaults.` }, 422);
  }
  if (!resolved.provider.is_enabled) {
    return json({ success: false, error: `Provider ${resolved.provider.slug} is disabled.` }, 422);
  }
  const modelId = body.overrideModelId || resolved.modelId;
  const apiKey = await providerKey(admin, resolved.provider.id, resolved.provider.slug);
  if (!apiKey) {
    return json({ success: false, error: `No API key configured for provider ${resolved.provider.slug}. Add it in Admin → AI Models → Providers.` }, 422);
  }

  const cfg: ProviderConfig = {
    slug: resolved.provider.slug,
    base_url: baseUrlFor(resolved.provider),
    auth_header_name: resolved.provider.auth_header_name,
    auth_header_prefix: resolved.provider.auth_header_prefix,
    apiKey,
  };

  // Rates + economics are read once per call; both are small tables.
  const [rate, econ] = await Promise.all([
    modelRate(admin, cfg.slug, modelId, resolved),
    creditEconomics(admin),
  ]);

  const started = Date.now();
  const finish = async (text: string, usage: TokenUsage, success: boolean, error?: string) => {
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
        provider_slug: cfg.slug,
        model_id: modelId,
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        cache_read_tokens: usage.cache_read_tokens,
        cache_write_tokens: usage.cache_write_tokens,
        cost_usd: costUsd,
        credits_equivalent: credits,
        latency_ms: latency,
        success,
        error_message: error ?? null,
        metadata: { ...(body.metadata ?? {}), stream: !!body.stream, max_tokens: maxTokens, rate_found: !!rate },
      })
      .select("id")
      .single();

    if (body.generationId && success) {
      // Keep the generation row's provider cost in step with what we spent.
      await admin.rpc("add_generation_provider_cost", {
        p_generation_id: body.generationId,
        p_cost_usd: costUsd,
        p_provider: cfg.slug,
        p_model: modelId,
        p_usage: usage,
      }).then(({ error: rpcErr }: any) => {
        if (rpcErr) console.warn("[ai-gateway] add_generation_provider_cost:", rpcErr.message);
      });
    }

    return {
      success,
      text,
      error,
      modelUsed: modelId,
      providerUsed: cfg.slug,
      usage,
      costUsd,
      creditsEquivalent: credits,
      latencyMs: latency,
      usageLogId: logRow?.id ?? null,
    };
  };

  const providerReq = {
    modelId,
    messages: body.messages,
    systemPrompt: body.systemPrompt,
    maxTokens,
    temperature: body.temperature,
    imageBase64: body.imageBase64,
    imageMimeType: body.imageMimeType,
    cacheContext: body.cacheContext !== false,
  };

  // ── Non-streaming ──
  if (!body.stream) {
    try {
      const out = await callProvider(cfg, providerReq);
      if (!out.text) {
        const r = await finish("", out.usage, false, "Provider returned an empty response");
        return json(r, 502);
      }
      return json(await finish(out.text, out.usage, true));
    } catch (e) {
      const status = e instanceof ProviderError ? e.status : 500;
      const r = await finish("", zeroUsage(), false, (e as Error).message);
      return json(r, status >= 400 && status < 600 ? status : 502);
    }
  }

  // ── Streaming (SSE) ──
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (ev: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
      try {
        const out = await callProvider(cfg, {
          ...providerReq,
          stream: true,
          onChunk: (text) => send({ type: "chunk", text }),
        });
        const r = await finish(out.text, out.usage, !!out.text, out.text ? undefined : "Provider returned an empty response");
        send({ type: r.success ? "done" : "error", ...r });
      } catch (e) {
        const r = await finish("", zeroUsage(), false, (e as Error).message);
        send({ type: "error", ...r });
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

function baseUrlFor(p: ResolvedModel["provider"]): string {
  if (p.base_url) return p.base_url;
  if (p.slug === "lovable-gemini") return "https://ai.gateway.lovable.dev/v1";
  if (p.slug === "openai") return "https://api.openai.com/v1";
  return "";
}

/**
 * Mirrors resolveModelForTask on the client:
 * user preference → task default → (tier_<x> when a tier is given) → system_ai.
 */
async function resolveModel(
  admin: SupabaseClient,
  taskType: string,
  tier: string | null,
  userId: string | null,
): Promise<ResolvedModel | null> {
  const select = "model_id, ai_models ( id, name, model_id, cost_per_1k_input, cost_per_1k_output, is_enabled, ai_providers ( id, slug, base_url, auth_header_name, auth_header_prefix, is_enabled ) )";
  const shape = (row: any): ResolvedModel | null => {
    const m = row?.ai_models;
    if (!m || !m.ai_providers || m.is_enabled === false) return null;
    return {
      modelId: m.model_id,
      modelName: m.name,
      provider: m.ai_providers,
      costPer1kInput: m.cost_per_1k_input,
      costPer1kOutput: m.cost_per_1k_output,
    };
  };

  // Tier requests resolve through the tier defaults first.
  if (tier) {
    const { data } = await admin.from("ai_task_defaults").select(select).eq("task_type", `tier_${tier}`).maybeSingle();
    const r = shape(data);
    if (r) return r;
  }

  if (userId) {
    const { data } = await admin
      .from("user_model_preferences")
      .select(select)
      .eq("user_id", userId)
      .eq("task_type", taskType)
      .maybeSingle();
    const r = shape(data);
    if (r) return r;
  }

  const { data: def } = await admin.from("ai_task_defaults").select(select).eq("task_type", taskType).maybeSingle();
  const r = shape(def);
  if (r) return r;

  if (taskType !== "system_ai") {
    const { data: sys } = await admin.from("ai_task_defaults").select(select).eq("task_type", "system_ai").maybeSingle();
    return shape(sys);
  }
  return null;
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

async function modelRate(admin: SupabaseClient, slug: string, modelId: string, resolved: ResolvedModel): Promise<ModelRate | null> {
  const { data } = await admin
    .from("model_rates")
    .select("input_per_1m, output_per_1m, cache_read_per_1m, cache_write_per_1m")
    .eq("provider_slug", slug)
    .eq("model_id", modelId)
    .eq("is_active", true)
    .maybeSingle();
  if (data) return data as ModelRate;
  // Fall back to the per-1k numbers on ai_models, if the admin filled them in.
  if (resolved.costPer1kInput != null || resolved.costPer1kOutput != null) {
    return {
      input_per_1m: (resolved.costPer1kInput ?? 0) * 1000,
      output_per_1m: (resolved.costPer1kOutput ?? 0) * 1000,
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
