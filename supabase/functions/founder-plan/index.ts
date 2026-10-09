/**
 * founder-plan — Mentor builds or revises the founder's plan.
 *
 * POST (user JWT): { action: "build" | "revise", brandId, note?: string, playbook?: "auto"|"idea"|"running"|"creator" }
 *   build:  a fresh plan from the brand context (replaces any existing plan)
 *   revise: the existing plan plus a note from the founder; done tasks and
 *           the founder's own edits are kept.
 * The work is in _shared/planBuild.ts, which the runner also uses to revise
 * plans after milestones and stage changes.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { buildOrRevisePlan } from "../_shared/planBuild.ts";
import { playbookFrom } from "../_shared/plan.ts";

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

  let body: { action?: string; brandId?: string; note?: string; playbook?: string };
  try { body = await req.json(); } catch { return json({ success: false, error: "Invalid JSON body" }, 400); }
  if (!body.brandId) return json({ success: false, error: "brandId is required" }, 400);
  const action = body.action === "revise" ? "revise" : "build";

  // Editors and owners only.
  const { data: allowed } = await userClient.rpc("can_access_brand", { p_brand_id: body.brandId, p_min_role: "editor" });
  if (!allowed) return json({ success: false, error: "You cannot edit this workspace's plan" }, 403);
  const { data: brand } = await admin.from("brands").select("id, user_id, name, journey_stage").eq("id", body.brandId).maybeSingle();
  if (!brand) return json({ success: false, error: "Brand not found" }, 404);

  const note = body.note ? String(body.note) : undefined;
  try {
    const r = await buildOrRevisePlan(admin, brand, action, note, action === "revise" && note ? `You asked: ${note.slice(0, 200)}` : undefined, playbookFrom(body.playbook));
    if (!r.success) return json({ success: false, error: r.error }, r.status);
    return json(r);
  } catch (e) {
    return json({ success: false, error: (e as Error).message }, 500);
  }
});
