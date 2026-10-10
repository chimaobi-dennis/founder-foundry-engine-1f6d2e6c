/**
 * understanding — "your business, as Kinika understands it".
 *
 * POST (user JWT), editors and owners:
 *   { action: "draft", brandId, text, kind?, websiteUrl?, chatUrl?, pasted?, documents?: string[] }
 *     → { success, readback }   nothing is written
 *   { action: "approve", brandId, readback, goal?, goalHorizon?, sources?: { site, chat, documents, pasted } }
 *     → { success }             writes brand_dna, the stage, the kind, the goal,
 *                               and marks the brand understood
 * The model call goes through ai-gateway as task type `understanding`.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { parseStructuredOutput } from "../_shared/runner.ts";
import { coerceReadback, kindFrom, readbackToDna, sectionLabels, understandingSystemPrompt, type Readback } from "../_shared/understanding.ts";
import { remember } from "../_shared/memory.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const GATEWAY_URL = `${SUPABASE_URL}/functions/v1/ai-gateway`;
const READ_LIMIT = 9000;

/** Read a public page as text, once. Best effort: a failure means the page is left out. */
async function readPage(url: string): Promise<string> {
  try {
    const full = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12_000);
    const res = await fetch(`https://r.jina.ai/${full}`, { headers: { Accept: "text/plain" }, signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return "";
    return (await res.text()).slice(0, READ_LIMIT);
  } catch {
    return "";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "POST only" }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ success: false, error: "Unauthorized" }, 401);
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const userId = (await userClient.auth.getUser()).data.user?.id;
  if (!userId) return json({ success: false, error: "Unauthorized" }, 401);
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  let body: any;
  try { body = await req.json(); } catch { return json({ success: false, error: "Invalid JSON body" }, 400); }
  if (!body?.brandId) return json({ success: false, error: "brandId is required" }, 400);

  const { data: allowed } = await userClient.rpc("can_access_brand", { p_brand_id: body.brandId, p_min_role: "editor" });
  if (!allowed) return json({ success: false, error: "You cannot edit this workspace" }, 403);
  const { data: brand } = await admin.from("brands").select("id, user_id, name, journey_stage").eq("id", body.brandId).maybeSingle();
  if (!brand) return json({ success: false, error: "Brand not found" }, 404);

  const { data: stageRows } = await admin.from("journey_stages").select("stage_key, name, description").order("sort_order");
  const stageKeys: string[] = (stageRows ?? []).map((s: any) => s.stage_key);

  // ── draft ──
  if (body.action !== "approve") {
    const text = String(body.text ?? "").trim();
    if (text.length < 20) return json({ success: false, error: "Tell Kinika a little more first (a few sentences)." }, 400);
    const [site, chat] = await Promise.all([
      body.websiteUrl ? readPage(String(body.websiteUrl)) : Promise.resolve(""),
      body.chatUrl ? readPage(String(body.chatUrl)) : Promise.resolve(""),
    ]);
    const docs = (Array.isArray(body.documents) ? body.documents : []).map((d: unknown) => String(d ?? "").slice(0, 6000)).filter(Boolean).slice(0, 5);
    const parts = [
      `THE FOUNDER SAID (situation: ${kindFrom(body.kind)}):\n${text.slice(0, 4000)}`,
      body.pasted ? `MORE FROM THE FOUNDER:\n${String(body.pasted).slice(0, 6000)}` : "",
      site ? `WEBSITE (${body.websiteUrl}):\n${site}` : "",
      chat ? `A CONVERSATION THE FOUNDER ALREADY HAD ABOUT THIS BUSINESS:\n${chat}` : "",
      ...docs.map((d: string, i: number) => `DOCUMENT ${i + 1}:\n${d}`),
      `JOURNEY STAGES: ${(stageRows ?? []).map((s: any) => `${s.stage_key} (${s.name}: ${String(s.description ?? "").slice(0, 80)})`).join("; ")}`,
      "Respond with the JSON object only.",
    ].filter(Boolean).join("\n\n");

    const { data: promptRow } = await admin.from("ai_system_prompts").select("system_prompt").eq("task_type", "understanding").eq("is_active", true).maybeSingle();
    const systemPrompt = promptRow?.system_prompt || understandingSystemPrompt(stageKeys);
    const gw = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
      body: JSON.stringify({ userId: brand.user_id, taskType: "understanding", systemPrompt, messages: [{ role: "user", content: parts }], maxTokens: 3000, temperature: 0.2, metadata: { brand_id: brand.id, sources: { site: !!site, chat: !!chat, documents: docs.length } } }),
    });
    const result = await gw.json().catch(() => null);
    if (!gw.ok || !result?.success) return json({ success: false, error: result?.error ?? `Kinika could not read this yet (${gw.status}).` }, 502);
    const parsed = parseStructuredOutput(result.text ?? "");
    const readback = parsed.ok ? coerceReadback(parsed.value, stageKeys) : null;
    if (!readback) return json({ success: false, error: "Kinika needs a little more to go on. Add a sentence or two, or a website." }, 502);
    return json({ success: true, readback, sourcesRead: { site: !!site, chat: !!chat, documents: docs.length } });
  }

  // ── approve ──
  const rb = coerceReadback(body.readback, stageKeys);
  if (!rb) return json({ success: false, error: "The read-back is incomplete." }, 400);
  // The founder may have edited labels; keep ours but their values.
  const labels = sectionLabels(rb.kind);
  for (const s of rb.sections) s.label = labels[s.key];
  const { dna, meta } = readbackToDna(rb);

  const { data: existingDna } = await admin.from("brand_dna").select("id, field_meta").eq("brand_id", brand.id).maybeSingle();
  const mergedMeta = { ...(existingDna?.field_meta ?? {}), ...meta };
  if (existingDna) {
    const { error } = await admin.from("brand_dna").update({ ...dna, field_meta: mergedMeta, updated_at: new Date().toISOString() }).eq("id", existingDna.id);
    if (error) return json({ success: false, error: error.message }, 500);
  } else {
    const { error } = await admin.from("brand_dna").insert({ brand_id: brand.id, ...dna, field_meta: mergedMeta });
    if (error) return json({ success: false, error: error.message }, 500);
  }

  // brands.context_source is constrained; pick from what was read.
  const src = body.sources ?? {};
  const contextSource = src.site && (src.documents || src.chat || src.pasted) ? "mixed" : src.site ? "website_url" : src.documents ? "document_upload" : "text_paste";
  const goal = body.goal ? String(body.goal).slice(0, 300) : null;
  const goalHorizon = body.goalHorizon ? String(body.goalHorizon).slice(0, 40) : null;
  const nameIsPlaceholder = !brand.name || /untitled/i.test(brand.name);
  const { error: bErr } = await admin.from("brands").update({
    ...(nameIsPlaceholder && rb.name ? { name: rb.name } : {}),
    business_kind: rb.kind,
    journey_stage: rb.stage_key,
    journey_stage_updated_at: new Date().toISOString(),
    understanding_approved_at: new Date().toISOString(),
    onboarding_completed: true,
    context_source: contextSource,
    ...(goal ? { goal, goal_horizon: goalHorizon } : {}),
    updated_at: new Date().toISOString(),
  }).eq("id", brand.id);
  if (bErr) return json({ success: false, error: bErr.message }, 500);

  await remember(admin, { brandId: brand.id, userId: brand.user_id }, {
    kind: "feedback", key: `understanding:${brand.id}:${Date.now()}`,
    title: `Approved: ${rb.name}, ${rb.descriptor || rb.kind}`,
    summary: rb.sections.map((s) => `${s.label}: ${s.value}`).join(" ").slice(0, 600),
    data: { kind: rb.kind, stage: rb.stage_key, not_known: rb.not_known },
  });
  return json({ success: true, kind: rb.kind, stage: rb.stage_key });
});
