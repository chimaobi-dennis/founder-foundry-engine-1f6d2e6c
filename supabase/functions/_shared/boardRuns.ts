/**
 * Starting a board from the server: the one insert every caller shares
 * (the watch tick, a tool step in another run, Kinika in a task
 * conversation). The run is queued; the runner reserves credits on first
 * touch and plans its steps from the board's agent and policy.
 */
import { toolBrief } from "./tools.ts";

// deno-lint-ignore no-explicit-any
type Admin = any;

export interface BoardRow {
  id: string;
  brand_id: string;
  user_id: string;
  agent_id: string | null;
  name: string;
  task_input: Record<string, unknown> | null;
  policy: Record<string, unknown> | null;
  budget: { credits_per_run?: number } | null;
}

export interface QueueBoardRun {
  /** Shown on the run; the board's name when omitted. */
  name?: string;
  /** What the caller hands the board; appended to the board's own brief. */
  handed?: string;
  /** Who handed it, in words ("the Researcher's board", "Kinika"). */
  from?: string;
  /** Extra input fields (event, watch_source, called_by, tool_depth). */
  input?: Record<string, unknown>;
  trigger_type: "watch" | "tool" | "kinika";
  /** Unique per board: a second queue with the same id returns the first run. */
  external_event_id: string;
}

export const BOARD_SELECT = "id, brand_id, user_id, agent_id, name, task_input, policy, budget, trigger_type, status";

/** Queue one run of a board. Returns the run id (an existing one when the event was queued before). */
export async function queueBoardRun(admin: Admin, board: BoardRow, q: QueueBoardRun): Promise<{ id: string; created: boolean }> {
  if (!board.agent_id) throw new Error(`The board "${board.name}" has no agent attached.`);
  const base = (board.task_input ?? {}) as Record<string, unknown>;
  const input: Record<string, unknown> = { ...base, ...(q.input ?? {}) };
  if (q.handed) input.brief = toolBrief(String(base.brief ?? ""), q.from ?? "Kinika", q.handed);
  const credits = Math.max(1, Number(board.budget?.credits_per_run) || 200);
  const { data: run, error } = await admin.from("automation_runs").insert({
    automation_id: board.id, brand_id: board.brand_id, user_id: board.user_id, agent_id: board.agent_id,
    name: (q.name ?? board.name).slice(0, 120), trigger_type: q.trigger_type, status: "queued",
    input, policy: board.policy, budget: board.budget, credits_quoted: credits, credits_reserved: credits,
    external_event_id: q.external_event_id,
  }).select("id").single();
  if (run) {
    await admin.from("automations").update({ last_run_at: new Date().toISOString() }).eq("id", board.id);
    return { id: run.id, created: true };
  }
  if (error && /duplicate|unique/i.test(error.message)) {
    const { data: existing } = await admin.from("automation_runs").select("id").eq("automation_id", board.id).eq("external_event_id", q.external_event_id).maybeSingle();
    if (existing) return { id: existing.id, created: false };
  }
  throw new Error(error?.message ?? "Could not queue the run");
}

/** Wake the runner for one run; the tick picks it up anyway if this fails. */
export function kickRun(supabaseUrl: string, serviceKey: string, runId: string): void {
  fetch(`${supabaseUrl}/functions/v1/run-step`, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({ runId }),
  }).catch(() => {});
}
