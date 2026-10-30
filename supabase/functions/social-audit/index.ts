/**
 * social-audit — Kinika reads the founder's own social accounts.
 *
 * POST (user JWT) { brandId, taskId, connectionIds? }
 *   Reads every chosen social connection of the workspace (all social ones
 *   when none are named), keeps the snapshot on the connection
 *   (config.snapshot, config.snapshot_at), and hands the facts to the task
 *   conversation as a hidden turn (prompt task_chat_social_read) so Kinika
 *   writes them into the deliverable with their source. The reply arrives
 *   the way every task-chat reply does: the browser polls the conversation.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { getOAuthAccessToken } from "../_shared/oauth.ts";
import { loadPrompt } from "../_shared/promptLoad.ts";
import { isSocialProviderKey, readSocialConnection, snapshotBlock, type SocialSnapshot } from "../_shared/socialRead.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "POST only" }, 405);
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return json({ success: false, error: "Unauthorized" }, 401);
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const userId = (await userClient.auth.getUser()).data.user?.id;
  if (!userId) return json({ success: false, error: "Unauthorized" }, 401);
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  let body: { brandId?: string; taskId?: string; connectionIds?: string[] };
  try { body = await req.json(); } catch { return json({ success: false, error: "Invalid JSON body" }, 400); }
  if (!body.brandId || !body.taskId) return json({ success: false, error: "brandId and taskId are required" }, 400);
  const { data: allowed } = await userClient.rpc("can_access_brand", { p_brand_id: body.brandId, p_min_role: "editor" });
  if (!allowed) return json({ success: false, error: "You cannot edit this workspace" }, 403);

  const { data: conns } = await admin.from("tool_connections").select("id, display_name, config, status").eq("brand_id", body.brandId).eq("status", "active");
  const chosen = ((conns ?? []) as { id: string; display_name: string; config: Record<string, unknown> }[])
    .filter((c) => isSocialProviderKey(c.config?.oauth_provider_key))
    .filter((c) => !body.connectionIds?.length || body.connectionIds.includes(c.id));
  if (!chosen.length) return json({ success: false, error: "No social account is connected yet." }, 400);

  const now = new Date().toISOString();
  const snapshots: SocialSnapshot[] = [];
  const errors: { account: string; error: string }[] = [];
  for (const c of chosen) {
    const t = await getOAuthAccessToken(admin, c.id);
    if (!t.ok) { errors.push({ account: c.display_name, error: t.error }); continue; }
    try {
      const read = await readSocialConnection(String(c.config.oauth_provider_key), t.token, now);
      snapshots.push(...read);
      await admin.from("tool_connections").update({ config: { ...c.config, snapshot: read, snapshot_at: now }, last_tested_at: now, last_error: null }).eq("id", c.id);
    } catch (e) {
      const msg = (e as Error).message;
      errors.push({ account: c.display_name, error: msg });
      await admin.from("tool_connections").update({ last_error: msg.slice(0, 300) }).eq("id", c.id);
    }
  }
  if (!snapshots.length) return json({ success: false, error: errors[0]?.error ?? "Nothing could be read.", errors }, 502);

  // Hand the facts to the task conversation: Kinika writes them into the deliverable with their source.
  const block = snapshotBlock(snapshots, errors);
  const text = await loadPrompt(admin, "task_chat_social_read", { accounts: block });
  const names = snapshots.map((s) => `${s.platform === "x" ? "X" : s.platform[0].toUpperCase() + s.platform.slice(1)} ${s.account}`).join(", ");
  const note = `Kinika read ${snapshots.length === 1 ? "your account" : "your accounts"}: ${names}.`;
  const handed = await fetch(`${SUPABASE_URL}/functions/v1/task-chat`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: ANON_KEY, Authorization: auth },
    body: JSON.stringify({ brandId: body.brandId, taskId: body.taskId, text, saveUser: false, note }),
  });
  const r = await handed.json().catch(() => null);
  if (!handed.ok || r?.success === false) return json({ success: false, error: r?.error ?? `Kinika did not take the facts (${handed.status})`, snapshots, errors }, 502);
  return json({ success: true, snapshots, errors });
});
