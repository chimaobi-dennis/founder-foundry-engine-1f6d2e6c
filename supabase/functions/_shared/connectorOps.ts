/**
 * Connector operations that need the database: loading a connection with its
 * secret, applying a change and recording the change set, reverting one.
 * Used by run-step (inside a run) and connector-action (from the UI).
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  allowedFields,
  ConnectorError,
  diffLines,
  runConnector,
  type ConnectionRow,
  type NormalizedRecord,
  type ProposedChange,
  type Secret,
} from "./connectors.ts";
import { PROVIDERS } from "./connectors.ts";

export interface LoadedConnection {
  row: ConnectionRow & { brand_id: string; user_id: string; status: string; display_name: string };
  secret: Secret;
}

export async function loadConnection(admin: SupabaseClient, connectionId: string): Promise<LoadedConnection> {
  const [{ data: row }, { data: sec }] = await Promise.all([
    admin.from("tool_connections").select("*").eq("id", connectionId).maybeSingle(),
    admin.from("tool_connection_secrets").select("secret").eq("connection_id", connectionId).maybeSingle(),
  ]);
  if (!row) throw new ConnectorError("Connection not found", 404);
  if (!sec?.secret) throw new ConnectorError("This connection has no credentials saved. Edit it and add them.", 400);
  if (row.status === "paused") throw new ConnectorError("This connection is paused.", 400);
  return {
    row: { ...row, config: row.config ?? {}, scope: row.scope ?? {}, capabilities: row.capabilities ?? ["read"] },
    secret: sec.secret as Secret,
  };
}

/** Records are stored on steps; keep long bodies out of the row. */
export function trimRecords(records: NormalizedRecord[], max = 1200): NormalizedRecord[] {
  return records.map((r) => ({
    ...r,
    fields: Object.fromEntries(Object.entries(r.fields).map(([k, v]) => [k, typeof v === "string" && v.length > max ? v.slice(0, max) + "…" : v])),
  }));
}

export interface ApplyContext {
  brandId: string;
  userId: string;
  runId?: string | null;
  stepId?: string | null;
}

export interface ApplyResult {
  applied: { change_set_id: string; target_id: string; target_label: string; fields: Record<string, string> }[];
  rejected: { target_id: string; field: string; reason: string }[];
  failed: { target_id: string; error: string }[];
}

/**
 * Apply proposed changes against fetched records. Each successful write is
 * one change_set with the exact before/after of the fields it touched.
 */
export async function applyChanges(admin: SupabaseClient, ctx: ApplyContext, loaded: LoadedConnection, records: NormalizedRecord[], changes: ProposedChange[]): Promise<ApplyResult> {
  const { row, secret } = loaded;
  const allowed = allowedFields(row.provider, row.scope);
  const { applied: plan, rejected } = diffLines(records, changes, row.provider, allowed);
  const byId = new Map(records.map((r) => [String(r.id), r]));
  const result: ApplyResult = { applied: [], rejected, failed: [] };

  for (const ch of plan) {
    const rec = byId.get(String(ch.target_id))!;
    const fields = ch.fields as Record<string, string>;
    const before = Object.fromEntries(Object.keys(fields).map((k) => [k, rec.fields[k] ?? ""]));
    try {
      await runConnector(row, secret, { action: "update_record", id: rec.id, fields });
      const { data: cs } = await admin.from("change_sets").insert({
        brand_id: ctx.brandId,
        user_id: ctx.userId,
        connection_id: row.id,
        run_id: ctx.runId ?? null,
        step_id: ctx.stepId ?? null,
        provider: row.provider,
        action: "update_record",
        target_type: PROVIDERS[row.provider].targetType,
        target_id: rec.id,
        target_label: rec.label,
        before,
        after: fields,
      }).select("id").single();
      result.applied.push({ change_set_id: cs?.id, target_id: rec.id, target_label: rec.label, fields });
    } catch (e) {
      result.failed.push({ target_id: rec.id, error: (e as Error).message });
    }
  }
  return result;
}

/** Create a record (e.g. a WordPress draft) and record it so revert can trash it. */
export async function createRecord(admin: SupabaseClient, ctx: ApplyContext, loaded: LoadedConnection, fields: Record<string, string>, label: string): Promise<{ change_set_id: string; record: NormalizedRecord }> {
  const { row, secret } = loaded;
  const record = (await runConnector(row, secret, { action: "create_record", fields })) as NormalizedRecord;
  const { data: cs } = await admin.from("change_sets").insert({
    brand_id: ctx.brandId,
    user_id: ctx.userId,
    connection_id: row.id,
    run_id: ctx.runId ?? null,
    step_id: ctx.stepId ?? null,
    provider: row.provider,
    action: "create_record",
    target_type: PROVIDERS[row.provider].targetType,
    target_id: record.id,
    target_label: label || record.label,
    before: {},
    after: fields,
  }).select("id").single();
  return { change_set_id: cs?.id, record };
}

/** Put the before values back (or trash a created record). Idempotent. */
export async function revertChangeSet(admin: SupabaseClient, changeSetId: string, userId: string): Promise<{ success: boolean; error?: string }> {
  const { data: cs } = await admin.from("change_sets").select("*").eq("id", changeSetId).maybeSingle();
  if (!cs) return { success: false, error: "Change not found" };
  if (cs.user_id !== userId) return { success: false, error: "Not yours to revert" };
  if (cs.reverted_at) return { success: true };
  if (!cs.connection_id) return { success: false, error: "The connection this change used no longer exists" };
  try {
    const loaded = await loadConnection(admin, cs.connection_id);
    if (cs.action === "create_record") {
      await runConnector(loaded.row, loaded.secret, { action: "delete_record", id: cs.target_id });
    } else {
      await runConnector(loaded.row, loaded.secret, { action: "update_record", id: cs.target_id, fields: cs.before as Record<string, string> });
    }
    await admin.from("change_sets").update({ reverted_at: new Date().toISOString(), reverted_by: userId, revert_error: null }).eq("id", cs.id);
    return { success: true };
  } catch (e) {
    const msg = (e as Error).message;
    await admin.from("change_sets").update({ revert_error: msg }).eq("id", cs.id);
    return { success: false, error: msg };
  }
}
