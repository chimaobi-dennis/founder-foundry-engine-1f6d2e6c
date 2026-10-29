/**
 * watch-source — what a workspace can watch, and the last real item.
 *
 * POST (user JWT):
 *   { action: "sources", brandId }                         → the sources its connections allow
 *   { action: "peek", brandId, source, connectionId, options? } → the newest item (for "start from") and how many arrived in the last 7 days
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { loadConnection } from "../_shared/connectorOps.ts";
import { availableWatchSources, readWatchSource, watchSourceFor } from "../_shared/watch.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "POST only" }, 405);
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ success: false, error: "Unauthorized" }, 401);
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const userId = (await userClient.auth.getUser()).data.user?.id;
  if (!userId) return json({ success: false, error: "Unauthorized" }, 401);
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  let body: { action?: string; brandId?: string; source?: string; connectionId?: string; options?: Record<string, string> };
  try { body = await req.json(); } catch { return json({ success: false, error: "Invalid JSON body" }, 400); }
  if (!body.brandId) return json({ success: false, error: "brandId is required" }, 400);
  const { data: allowed } = await userClient.rpc("can_access_brand", { p_brand_id: body.brandId, p_min_role: "editor" });
  if (!allowed) return json({ success: false, error: "Forbidden" }, 403);
  const { data: conns } = await admin.from("tool_connections").select("id, provider, display_name, status").eq("brand_id", body.brandId).eq("status", "active");
  const available = availableWatchSources((conns ?? []) as { id: string; provider: string; display_name: string; status: string }[]);

  if (body.action === "sources") return json({ success: true, sources: available.map((a) => ({ key: a.source.key, name: a.source.name, words: a.source.words, noun: a.source.noun, nouns: a.source.nouns, options: a.source.options, connection_id: a.connection_id, display_name: a.display_name })) });

  const spec = watchSourceFor(body.source);
  const pick = available.find((a) => a.source.key === body.source && (!body.connectionId || a.connection_id === body.connectionId));
  if (!spec || !pick) return json({ success: false, error: "Nothing is connected for that source." }, 400);
  try {
    const { row, secret } = await loadConnection(admin, pick.connection_id);
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
    const recent = await readWatchSource(admin, spec.key, { id: row.id, config: row.config }, secret, body.options ?? {}, { since: weekAgo, limit: 10 });
    const latest = recent.length ? recent[recent.length - 1] : (await readWatchSource(admin, spec.key, { id: row.id, config: row.config }, secret, body.options ?? {}, { since: null, limit: 1 }))[0] ?? null;
    return json({ success: true, latest, recentCount: recent.length, connection_id: pick.connection_id });
  } catch (e) {
    return json({ success: false, error: (e as Error).message }, 502);
  }
});
