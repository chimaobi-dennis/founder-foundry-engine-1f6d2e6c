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
  toAyrsharePlatforms,
  type ConnectionRow,
  type NormalizedRecord,
  type ProposedChange,
  type PublishResult,
  type Secret,
  composePostText,
  type PublishItem,
} from "./connectors.ts";
import { PROVIDERS } from "./connectors.ts";
import {
  DEFAULT_ALLOWED_PATHS,
  MAX_SNAPSHOT_FILES,
  github,
  isProtectedPath,
  matchesAny,
  parseRepo,
  slugifyBranch,
  validateEdit,
  GitHubError,
  type FileContent,
  type ProposedFileChange,
  type RepoFile,
} from "./github.ts";

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

export interface PublishOutcome {
  published: { change_set_id: string; platforms: string[]; urls: Record<string, string>; text: string }[];
  failed: { platforms: string[]; error: string; text: string }[];
}

/** Publish each item through a social connection; one change set per post. */
export async function publishItems(admin: SupabaseClient, ctx: ApplyContext, loaded: LoadedConnection, items: PublishItem[], scheduleDate?: string): Promise<PublishOutcome> {
  const { row, secret } = loaded;
  const out: PublishOutcome = { published: [], failed: [] };
  for (const item of items) {
    const platforms = toAyrsharePlatforms(item.platforms?.length ? item.platforms : item.platform ? [item.platform] : []);
    const text = composePostText(item);
    if (!text) continue;
    if (!platforms.length) {
      out.failed.push({ platforms: [], error: `No supported platform on "${item.title ?? text.slice(0, 40)}"`, text });
      continue;
    }
    try {
      const res = (await runConnector(row, secret, { action: "publish_post", text, platforms, scheduleDate })) as PublishResult;
      const { data: cs } = await admin.from("change_sets").insert({
        brand_id: ctx.brandId,
        user_id: ctx.userId,
        connection_id: row.id,
        run_id: ctx.runId ?? null,
        step_id: ctx.stepId ?? null,
        provider: row.provider,
        action: "publish_post",
        target_type: "social_post",
        target_id: res.id || `${Date.now()}`,
        target_label: item.title || text.slice(0, 60),
        before: {},
        after: { text, platforms: platforms.join(", "), ...(scheduleDate ? { scheduled_for: scheduleDate } : {}), ...Object.fromEntries(Object.entries(res.urls).map(([k, v]) => [`url_${k}`, v])) },
      }).select("id").single();
      out.published.push({ change_set_id: cs?.id, platforms, urls: res.urls, text });
    } catch (e) {
      out.failed.push({ platforms, error: (e as Error).message, text });
    }
  }
  return out;
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
    } else if (cs.action === "publish_post") {
      await runConnector(loaded.row, loaded.secret, { action: "delete_post", id: cs.target_id });
    } else if (cs.action === "open_pr") {
      const c = repoOf(loaded);
      const token = loaded.secret.token ?? "";
      await github.closePR(token, c, Number(cs.target_id));
      try {
        await github.deleteBranch(token, c, String((cs.after as any)?.branch ?? ""));
      } catch {
        /* branch may already be gone */
      }
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

// ── Code connections (GitHub) ────────────────────────────────────────────────

function repoOf(loaded: LoadedConnection) {
  const c = parseRepo(loaded.row.config.repo ?? "");
  if (!c) throw new GitHubError("Repository must be owner/name", 400);
  return c;
}

function allowedPathsOf(loaded: LoadedConnection): string[] {
  const p = loaded.row.scope?.paths?.filter(Boolean) ?? [];
  return p.length ? p : DEFAULT_ALLOWED_PATHS;
}

async function baseBranchOf(loaded: LoadedConnection, token: string): Promise<string> {
  const configured = (loaded.row.config.base_branch ?? "").trim();
  if (configured) return configured;
  const info = await github.repoInfo(token, repoOf(loaded));
  return info.default_branch;
}

/** The file list the Developer plans from: allowed paths only, bounded. */
export async function repoSnapshot(loaded: LoadedConnection): Promise<{ branch: string; files: RepoFile[]; total: number; truncated: boolean }> {
  const token = loaded.secret.token ?? "";
  const c = repoOf(loaded);
  const branch = await baseBranchOf(loaded, token);
  const all = await github.tree(token, c, branch);
  const allowed = allowedPathsOf(loaded);
  const visible = all.filter((f) => !isProtectedPath(f.path) && matchesAny(f.path, allowed));
  return { branch, files: visible.slice(0, MAX_SNAPSHOT_FILES), total: visible.length, truncated: visible.length > MAX_SNAPSHOT_FILES };
}

export async function readRepoFiles(loaded: LoadedConnection, branch: string, paths: string[]): Promise<{ files: FileContent[]; skipped: { path: string; reason: string }[] }> {
  const token = loaded.secret.token ?? "";
  const c = repoOf(loaded);
  const allowed = allowedPathsOf(loaded);
  const files: FileContent[] = [];
  const skipped: { path: string; reason: string }[] = [];
  for (const raw of paths.slice(0, 8)) {
    const path = String(raw ?? "").replace(/^\.?\//, "");
    if (!path || isProtectedPath(path) || !matchesAny(path, allowed)) {
      skipped.push({ path, reason: "not readable under this connection's paths" });
      continue;
    }
    try {
      const f = await github.getFile(token, c, path, branch);
      files.push(f.content.length > 60_000 ? { ...f, content: f.content.slice(0, 60_000) + "\n/* … truncated … */" } : f);
    } catch (e) {
      skipped.push({ path, reason: (e as Error).message });
    }
  }
  return { files, skipped };
}

export interface OpenPrInput {
  changes: ProposedFileChange[];
  commit_message: string;
  pr_title: string;
  pr_body: string;
  /** shas of files read earlier, so updates target the right blob */
  known: Record<string, string>;
  branch: string;
}

export interface OpenPrResult {
  change_set_id: string;
  pr_number: number;
  pr_url: string;
  branch: string;
  files: { path: string; action: string }[];
  rejected: { path: string; reason: string }[];
}

/**
 * Branch from the base, commit each accepted file, open the PR. The change
 * set's revert closes the PR and deletes the branch.
 */
export async function openPullRequest(admin: SupabaseClient, ctx: ApplyContext, loaded: LoadedConnection, input: OpenPrInput): Promise<OpenPrResult> {
  const token = loaded.secret.token ?? "";
  const c = repoOf(loaded);
  const base = input.branch || (await baseBranchOf(loaded, token));
  const { accepted, rejected } = validateEdit(input.changes, allowedPathsOf(loaded));
  if (!accepted.length) throw new GitHubError(`No acceptable file changes${rejected.length ? ` (${rejected.map((r) => `${r.path}: ${r.reason}`).join("; ")})` : ""}`, 400);

  const headSha = await github.branchSha(token, c, base);
  const branch = slugifyBranch(input.pr_title || input.commit_message || "change");
  await github.createBranch(token, c, branch, headSha);

  const message = (input.commit_message || input.pr_title || "Update site").slice(0, 72);
  for (const ch of accepted) {
    let sha = input.known[ch.path];
    if (!sha && ch.action !== "create") {
      try {
        sha = (await github.getFile(token, c, ch.path, base)).sha;
      } catch {
        sha = undefined as unknown as string;
      }
    }
    if (ch.action === "delete") {
      if (!sha) continue;
      await github.deleteFile(token, c, branch, ch.path, message, sha);
    } else {
      await github.putFile(token, c, branch, ch.path, ch.content ?? "", message, sha || undefined);
    }
  }

  const footer = "\n\n---\nOpened by the Kinika Developer agent. Review the preview, then merge. Closing this PR reverts the change.";
  const pr = await github.createPR(token, c, branch, base, (input.pr_title || message).slice(0, 70), (input.pr_body || "") + footer);

  const { data: cs } = await admin.from("change_sets").insert({
    brand_id: ctx.brandId,
    user_id: ctx.userId,
    connection_id: loaded.row.id,
    run_id: ctx.runId ?? null,
    step_id: ctx.stepId ?? null,
    provider: "github",
    action: "open_pr",
    target_type: "pull_request",
    target_id: String(pr.number),
    target_label: input.pr_title || message,
    before: { base },
    after: { pr_url: pr.html_url, branch, files: accepted.map((a) => `${a.action}:${a.path}`).join(", ") },
  }).select("id").single();

  return { change_set_id: cs?.id, pr_number: pr.number, pr_url: pr.html_url, branch, files: accepted.map((a) => ({ path: a.path, action: a.action })), rejected };
}

export async function pullRequestStatus(loaded: LoadedConnection, number: number) {
  return github.prStatus(loaded.secret.token ?? "", repoOf(loaded), number);
}
