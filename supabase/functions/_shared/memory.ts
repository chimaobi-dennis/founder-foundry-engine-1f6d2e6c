/**
 * Team memory — what the agents did, what came of it, and what the founder
 * thought. Pure builders (tested) plus one tolerant writer: a memory problem
 * must never stop a run.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type MemoryKind = "run_summary" | "outcome" | "feedback";

export interface MemoryEntry {
  kind: MemoryKind;
  title: string;
  summary: string;
  data?: Record<string, unknown>;
  /** One memory per event: a retried step writes the same key and is ignored. */
  key: string;
}

const clip = (s: unknown, n: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function runSummaryEntry(runId: string, runName: string, agentName: string, summary: string, extra: Record<string, unknown> = {}): MemoryEntry | null {
  const s = clip(summary, 600);
  if (!s) return null;
  return { kind: "run_summary", key: `run:${runId}:summary`, title: clip(runName, 160) || `${agentName} run`, summary: s, data: { agent: agentName, ...extra } };
}

/** What a write to a connected tool actually did. Dry runs and failures remember nothing. */
export function outcomeEntry(stepId: string, action: string, out: Record<string, any> | null | undefined, connection: string): MemoryEntry | null {
  if (!out || out.dry_run) return null;
  const key = `step:${stepId}:outcome`;
  if (action === "apply_changes") {
    const applied = Array.isArray(out.applied) ? out.applied : [];
    if (!applied.length) return null;
    const names = applied.slice(0, 5).map((a: any) => `${clip(a.target_label ?? a.target_id, 60)} (${Object.keys(a.fields ?? {}).join(", ")})`);
    const failed = Array.isArray(out.failed) ? out.failed.length : 0;
    return { kind: "outcome", key, title: `Updated ${plural(applied.length, "record")} in ${connection}`, summary: `${names.join("; ")}${applied.length > 5 ? `; and ${applied.length - 5} more` : ""}${failed ? `. ${failed} failed.` : "."}`, data: { applied: applied.length, failed, change_sets: applied.map((a: any) => a.change_set_id).filter(Boolean).slice(0, 50) } };
  }
  if (action === "create_draft" && out.created) {
    return { kind: "outcome", key, title: `Created "${clip(out.created.label, 100)}" in ${connection}`, summary: out.created.url ? `Draft at ${clip(out.created.url, 200)}` : "Draft created.", data: { id: out.created.id ?? null, change_set_id: out.change_set_id ?? null } };
  }
  if (action === "open_pr" && out.pr_number) {
    const files = Array.isArray(out.files) ? out.files.map((f: any) => f.path).slice(0, 6) : [];
    return { kind: "outcome", key, title: `Opened pull request #${out.pr_number} in ${connection}`, summary: `${files.length ? `Touches ${files.join(", ")}. ` : ""}${clip(out.pr_url, 200)}`, data: { pr_number: out.pr_number, pr_url: out.pr_url ?? null, change_set_id: out.change_set_id ?? null } };
  }
  if (action === "publish_items") {
    const published = Array.isArray(out.published) ? out.published : [];
    if (!published.length) return null;
    const lines = published.slice(0, 5).map((p: any) => `${(p.platforms ?? []).join("+")}: ${clip(Object.values(p.urls ?? {})[0] ?? "posted", 120)}`);
    return { kind: "outcome", key, title: `Published ${plural(published.length, "post")} via ${connection}`, summary: lines.join("; "), data: { posts: published.map((p: any) => ({ platforms: p.platforms, urls: p.urls, change_set_id: p.change_set_id })).slice(0, 20) } };
  }
  return null;
}

/** The founder's verdict on the work: the most useful thing for the next run to know. */
export function feedbackEntry(approvalId: string, decision: "approved" | "rejected", note: string | null | undefined, runName: string, agentName: string): MemoryEntry | null {
  const n = clip(note, 400);
  if (decision === "approved" && !n) return null; // a bare approval carries no new information
  return {
    kind: "feedback",
    key: `approval:${approvalId}:feedback`,
    title: decision === "rejected" ? `Founder rejected ${agentName}'s work on "${clip(runName, 100)}"` : `Founder approved ${agentName}'s work on "${clip(runName, 100)}" with a note`,
    summary: n || "No reason given.",
    data: { decision },
  };
}

export function revertFeedbackEntry(changeSetId: string, label: string | null, connection: string): MemoryEntry {
  return { kind: "feedback", key: `revert:${changeSetId}`, title: `Founder reverted a change in ${connection}`, summary: clip(label, 200) || "A change made by an agent was reverted.", data: { decision: "reverted", change_set_id: changeSetId } };
}

/** One line per memory for the context pack. Stable for a given set of rows. */
export function memoryLine(row: { kind: string; title: string; summary: string }): string {
  return `- [${row.kind.replace("_", " ")}] ${clip(row.title, 140)}: ${clip(row.summary, 320)}`;
}

export async function remember(admin: SupabaseClient, ctx: { brandId: string; userId: string; runId?: string | null }, m: MemoryEntry | null): Promise<void> {
  if (!m) return;
  try {
    const { error } = await admin.from("brand_memories").upsert({
      brand_id: ctx.brandId,
      user_id: ctx.userId,
      kind: m.kind,
      source: "agent_run",
      title: m.title.slice(0, 200),
      summary: m.summary.slice(0, 800),
      data: m.data ?? {},
      run_id: ctx.runId ?? null,
      dedupe_key: m.key,
    }, { onConflict: "brand_id,dedupe_key", ignoreDuplicates: true });
    // Before the migration the table does not exist; that is not worth a log line per step.
    if (error && !/brand_memories|schema cache|does not exist/i.test(error.message)) console.error("[memory] not remembered", { key: m.key, error: error.message });
  } catch (e) {
    console.error("[memory] not remembered", { key: m.key, error: (e as Error).message });
  }
}
