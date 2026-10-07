/**
 * connector-action — connection operations started from the UI.
 *
 * The secret never leaves the server: the browser sends a connection id and
 * an action, this function loads the credentials and talks to the provider.
 *
 * POST body (owner JWT):
 *   { connectionId, action: "test" }                      → verify credentials, record last_tested_at
 *   { connectionId, action: "list_records", limit? }      → preview what an agent would read
 *   { changeSetId,  action: "revert" }                     → put the before values back
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { ConnectorError, runConnector } from "../_shared/connectors.ts";
import { loadConnection, pullRequestStatus, revertChangeSet, trimRecords } from "../_shared/connectorOps.ts";

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

  let body: { connectionId?: string; changeSetId?: string; action?: string; limit?: number; prNumber?: number };
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "Invalid JSON body" }, 400);
  }

  try {
    if (body.action === "revert") {
      if (!body.changeSetId) return json({ success: false, error: "changeSetId is required" }, 400);
      const r = await revertChangeSet(admin, body.changeSetId, userId);
      return json(r, r.success ? 200 : 400);
    }

    if (!body.connectionId) return json({ success: false, error: "connectionId is required" }, 400);
    const loaded = await loadConnection(admin, body.connectionId);
    if (loaded.row.user_id !== userId) return json({ success: false, error: "Forbidden" }, 403);

    if (body.action === "test") {
      try {
        const info = await runConnector(loaded.row, loaded.secret, { action: "test" });
        // Remember what the test learned (account label, linked platforms) so
        // the card can show it without another round trip.
        const config = { ...loaded.row.config, account: info?.account ?? loaded.row.config.account, ...(info?.linked_platforms ? { linked_platforms: info.linked_platforms } : {}) };
        await admin.from("tool_connections").update({ status: "active", last_tested_at: new Date().toISOString(), last_error: null, config }).eq("id", loaded.row.id);
        return json({ success: true, info });
      } catch (e) {
        const msg = (e as Error).message;
        await admin.from("tool_connections").update({ status: "error", last_tested_at: new Date().toISOString(), last_error: msg }).eq("id", loaded.row.id);
        return json({ success: false, error: msg }, e instanceof ConnectorError ? e.status : 502);
      }
    }

    if (body.action === "list_records") {
      const records = await runConnector(loaded.row, loaded.secret, { action: "list_records", limit: body.limit ?? 10 });
      return json({ success: true, records: trimRecords(records, 300) });
    }

    if (body.action === "pr_status") {
      if (!body.prNumber) return json({ success: false, error: "prNumber is required" }, 400);
      const status = await pullRequestStatus(loaded, Number(body.prNumber));
      return json({ success: true, status });
    }

    return json({ success: false, error: `Unknown action ${body.action}` }, 400);
  } catch (e) {
    const status = e instanceof ConnectorError ? e.status : 500;
    return json({ success: false, error: (e as Error).message }, status);
  }
});
