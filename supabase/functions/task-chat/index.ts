/**
 * task-chat — Kinika working one plan task with the founder, in the workspace.
 *
 * POST (user JWT): { brandId, taskId, text, saveUser?: boolean, note?: string }
 *   note: a line shown in the transcript instead of the founder's words (an instruction sent on their behalf)
 * The founder's message is saved at once and the reply is produced in the
 * background (EdgeRuntime.waitUntil), so a page reload never loses a turn.
 * While it runs, mentor_conversations.pending_since is set; the browser
 * polls messages until it clears. The reply closes deliverables, writes a
 * document and leaves follow-ups on the conversation.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { buildContextPack } from "../_shared/contextPack.ts";
import { parseTaskReply, taskPromptBlock, type TaskChatContext } from "../_shared/taskChat.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const GATEWAY_URL = `${SUPABASE_URL}/functions/v1/ai-gateway`;

// deno-lint-ignore no-explicit-any
type Admin = any;
type Deliverable = { id: string; title: string; detail: string; kind: "decision" | "document" | "list" | "action"; done: boolean; done_at: string | null; document_id: string | null; result?: string | null; needs?: { role: string; label: string; why: string; brief: string; raised_at: string; resolved?: string | null } | null; run_id?: string | null; agent_slug?: string | null; agent_name?: string | null };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "POST only" }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ success: false, error: "Unauthorized" }, 401);
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const userId = (await userClient.auth.getUser()).data.user?.id;
  if (!userId) return json({ success: false, error: "Unauthorized" }, 401);
  const admin: Admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  let body: { brandId?: string; taskId?: string; text?: string; saveUser?: boolean; note?: string };
  try { body = await req.json(); } catch { return json({ success: false, error: "Invalid JSON body" }, 400); }
  const text = String(body.text ?? "").trim();
  if (!body.brandId || !body.taskId || !text) return json({ success: false, error: "brandId, taskId and text are required" }, 400);

  const { data: allowed } = await userClient.rpc("can_access_brand", { p_brand_id: body.brandId, p_min_role: "editor" });
  if (!allowed) return json({ success: false, error: "You cannot edit this workspace" }, 403);

  // The task and its conversation.
  const { data: task } = await admin.from("plan_tasks").select("id, brand_id, title, detail, deliverables, plan_targets!inner(title)").eq("id", body.taskId).eq("brand_id", body.brandId).maybeSingle();
  if (!task) return json({ success: false, error: "Task not found" }, 404);
  let { data: conv } = await admin.from("mentor_conversations").select("id, pending_since").eq("plan_task_id", task.id).maybeSingle();
  if (!conv) {
    const ins = await admin.from("mentor_conversations").insert({ brand_id: task.brand_id, plan_task_id: task.id, message_count: 0 }).select("id, pending_since").single();
    if (ins.error) return json({ success: false, error: ins.error.message }, 500);
    conv = ins.data;
  }
  if (conv.pending_since && Date.now() - new Date(conv.pending_since).getTime() < 3 * 60_000) {
    return json({ success: false, error: "Kinika is still answering the last message." }, 409);
  }

  if (body.saveUser !== false) {
    await admin.from("mentor_messages").insert({ conversation_id: conv.id, role: "user", content: text });
  } else if (body.note) {
    await admin.from("mentor_messages").insert({ conversation_id: conv.id, role: "note", content: String(body.note).slice(0, 300) });
  }
  await admin.from("mentor_conversations").update({ pending_since: new Date().toISOString(), last_error: null, last_message_at: new Date().toISOString() }).eq("id", conv.id);

  const work = reply(admin, userId, task, conv.id, text).catch(async (e) => {
    await admin.from("mentor_conversations").update({ pending_since: null, last_error: (e as Error).message }).eq("id", conv.id);
  });
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime) EdgeRuntime.waitUntil(work); else await work;
  return json({ success: true, conversationId: conv.id, pending: true }, 202);
});

// deno-lint-ignore no-explicit-any
async function reply(admin: Admin, userId: string, task: any, conversationId: string, userText: string) {
  const deliverables: Deliverable[] = Array.isArray(task.deliverables) ? task.deliverables : [];
  const [{ data: brand }, pack, { data: history }, { data: promptRow }, { data: plan }] = await Promise.all([
    admin.from("brands").select("id, user_id, name, journey_stage, business_kind, goal").eq("id", task.brand_id).maybeSingle(),
    buildContextPack(admin, task.brand_id),
    admin.from("mentor_messages").select("role, content").eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(40),
    admin.from("ai_system_prompts").select("system_prompt").eq("task_type", "task_chat").eq("is_active", true).maybeSingle(),
    admin.from("brand_plans").select("title, plan_targets(title, status, position)").eq("brand_id", task.brand_id).maybeSingle(),
  ]);
  const ctx: TaskChatContext = {
    task: { id: task.id, title: task.title, detail: task.detail, target_title: task.plan_targets?.title ?? "" },
    deliverables: deliverables.map((d) => ({ id: d.id, title: d.title, detail: d.detail, kind: d.kind, done: d.done, withAgent: d.run_id && !d.done ? (d.agent_name ?? "an agent") : null })),
  };
  const targets = (plan?.plan_targets ?? []).sort((a: { position: number }, b: { position: number }) => a.position - b.position).map((t: { title: string; status: string }) => `- ${t.title} (${t.status})`).join("\n");
  const systemPrompt = [
    promptRow?.system_prompt || `You are Kinika, the business manager of ${brand?.name ?? "this business"}: direct, warm, concrete, never a pronoun for yourself. You know the business from its record and you never invent numbers it does not give you.`,
    `=== BRAND CONTEXT (pack ${pack.hash}) ===\n${pack.text.slice(0, 12_000)}`,
    brand?.goal ? `THE FOUNDER'S GOAL: ${brand.goal}` : "",
    targets ? `THE PLAN${plan?.title ? ` (${plan.title})` : ""}:\n${targets}` : "",
    taskPromptBlock(ctx),
  ].filter(Boolean).join("\n\n");

  // The history already holds the founder's message when it was saved; a hidden instruction is appended here.
  const msgs = (history ?? []).filter((m: { role: string }) => m.role === "user" || m.role === "assistant").map((m: { role: string; content: string }) => ({ role: m.role, content: m.content }));
  if (!(msgs.length && msgs[msgs.length - 1].role === "user" && msgs[msgs.length - 1].content === userText)) msgs.push({ role: "user", content: userText });

  const gw = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    body: JSON.stringify({ userId: brand?.user_id ?? userId, taskType: "task_chat", systemPrompt, messages: msgs, maxTokens: 2500, temperature: 0.4, metadata: { brand_id: task.brand_id, task_id: task.id, conversation_id: conversationId } }),
  });
  const result = await gw.json().catch(() => null);
  if (!gw.ok || !result?.success || !result.text) throw new Error(result?.error ?? `Kinika could not answer (${gw.status})`);

  const parsed = parseTaskReply(String(result.text), ctx.deliverables);
  const now = new Date().toISOString();

  // A document Kinika wrote: saved once; a later version never overwrites the founder's edits.
  let documentId: string | null = null;
  if (parsed.document) {
    const { data: existing } = await admin.from("documents").select("id, body_edited_at").eq("plan_task_id", task.id).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (existing && !existing.body_edited_at) {
      await admin.from("documents").update({ name: parsed.document.title.slice(0, 120), body_md: parsed.document.body, updated_at: now }).eq("id", existing.id);
      documentId = existing.id;
    } else if (!existing) {
      const { data: created } = await admin.from("documents").insert({ brand_id: task.brand_id, user_id: userId, name: parsed.document.title.slice(0, 120), document_type: "kinika_output", purpose: task.title, plan_task_id: task.id, body_md: parsed.document.body }).select("id").single();
      documentId = created?.id ?? null;
    }
  }

  // Deliverables closed in this reply, the document linked to the first document-kind one still open,
  // and a need Kinika raised pinned to its deliverable until the founder resolves it.
  const needTarget = parsed.needs ? (parsed.needs.deliverableId ?? deliverables.find((d) => !d.done)?.id ?? null) : null;
  if (parsed.done.length || documentId || needTarget) {
    const byId = new Map(parsed.done.map((d) => [d.id, d.result]));
    let linked = false;
    const next = deliverables.map((d) => {
      let out = d;
      if (byId.has(d.id)) out = { ...out, done: true, done_at: out.done_at ?? now, result: byId.get(d.id) ?? out.result ?? null };
      if (documentId && !linked && d.kind === "document" && !d.document_id) { out = { ...out, document_id: documentId }; linked = true; }
      if (needTarget === d.id && parsed.needs && !d.done && !(d.needs && !d.needs.resolved)) out = { ...out, needs: { role: parsed.needs.role, label: parsed.needs.label, why: parsed.needs.why, brief: parsed.needs.brief, raised_at: now, resolved: null } };
      return out;
    });
    await admin.from("plan_tasks").update({ deliverables: next, updated_at: now }).eq("id", task.id);
  }

  await admin.from("mentor_messages").insert({ conversation_id: conversationId, role: "assistant", content: parsed.text || "…" });
  await admin.from("mentor_conversations").update({
    pending_since: null, last_error: null, last_message_at: now,
    last_followups: { suggestions: parsed.suggestions, options: parsed.options, document: !!parsed.document, closed: parsed.done.map((d) => d.id), needs: needTarget },
  }).eq("id", conversationId);
}
