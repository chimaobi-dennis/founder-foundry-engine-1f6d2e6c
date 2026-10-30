/**
 * Standing tasks as tools. Every active board on Kinika's team is a tool:
 * Kinika can start one from a conversation (a RUN_BOARD tag in its reply),
 * and a board can hand its result to another board (a "tool" step planned
 * after the founder's approval). Pure module, shared by the runner, the
 * task-chat function, the planners and the browser. No prompt text here:
 * the sentences that tell the model how to call a board are the prompt
 * `kinika_boards`; this file only fills its {{boards}} placeholder.
 */

export interface BoardTool {
  id: string;
  name: string;
  agent_name: string | null;
  trigger_type: string;
  /** What the board was set up to do, in the founder's words. */
  brief: string;
  /** Runs of this board waiting for credits, when known. */
  waiting?: number;
}

/** Shape the rows automations come back in (with agents(name) joined). */
export function boardToolsFrom(rows: unknown): BoardTool[] {
  if (!Array.isArray(rows)) return [];
  const out: BoardTool[] = [];
  for (const r of rows as Record<string, unknown>[]) {
    if (!r || typeof r.id !== "string" || typeof r.name !== "string") continue;
    const agent = (r.agents ?? r.agent ?? null) as { name?: string } | { name?: string }[] | null;
    const agentName = Array.isArray(agent) ? agent[0]?.name ?? null : agent?.name ?? null;
    const input = (r.task_input ?? {}) as { brief?: unknown };
    out.push({ id: r.id, name: r.name.slice(0, 80), agent_name: agentName ? String(agentName) : null, trigger_type: String(r.trigger_type ?? "manual"), brief: typeof input.brief === "string" ? input.brief.slice(0, 240) : "" });
  }
  return out;
}

/** The data lines the prompts list boards with. A label, not an instruction. */
export function boardLines(tools: BoardTool[]): string {
  if (!tools.length) return "(none yet)";
  return tools.map((t) => `- ${t.id}: "${t.name}"${t.agent_name ? ` (${t.agent_name})` : ""}${t.brief ? ` — ${t.brief.replace(/\s+/g, " ").slice(0, 160)}` : ""}${t.waiting ? ` [${t.waiting} run${t.waiting === 1 ? "" : "s"} waiting for credits]` : ""}`).join("\n");
}

/** Fill the prompt `kinika_boards` ({{boards}}). Empty when there is nothing to call. */
export function boardsBlock(tools: BoardTool[], template: string): string {
  if (!tools.length || !template) return "";
  return template.split("{{boards}}").join(boardLines(tools));
}

export const MAX_BOARD_CALLS = 2;

export interface BoardCall {
  id: string;
  brief: string;
  /** The deliverable the run is pinned to, when Kinika said which (D2 → id). */
  deliverableId: string | null;
}

const RUN_BOARD_RE = /<RUN_BOARD\s+([^>]*)>([\s\S]*?)<\/RUN_BOARD>/gi;

/**
 * Pull <RUN_BOARD id="…" d="D2">brief</RUN_BOARD> blocks out of a reply.
 * Unknown boards are dropped here by the caller; a malformed block is
 * removed from the text either way so machinery never reaches the founder.
 */
export function parseBoardCalls(text: string, deliverables?: { id: string }[]): { text: string; calls: BoardCall[] } {
  const calls: BoardCall[] = [];
  const attr = (attrs: string, key: string): string => {
    const m = new RegExp(`\\b${key}\\s*=\\s*["']([^"']*)["']`, "i").exec(attrs);
    return m ? m[1].trim() : "";
  };
  const clean = text
    .replace(/```[a-z]*\s*(<RUN_BOARD[\s\S]*?<\/RUN_BOARD>)\s*```/gi, "$1")
    .replace(RUN_BOARD_RE, (_m, attrs: string, body: string) => {
      const id = attr(attrs, "id");
      const brief = String(body ?? "").trim().slice(0, 4000);
      if (id && brief && calls.length < MAX_BOARD_CALLS && !calls.some((c) => c.id === id)) {
        const d = attr(attrs, "d");
        const dm = /^D(\d+)$/i.exec(d);
        const deliverableId = dm && deliverables ? deliverables[Number(dm[1]) - 1]?.id ?? null : d && deliverables?.some((x) => x.id === d) ? d : null;
        calls.push({ id, brief, deliverableId });
      }
      return "";
    })
    .replace(/<\/?RUN_BOARD[^>]*>/gi, "");
  return { text: clean.replace(/\n{3,}/g, "\n\n").trim(), calls };
}

/** Where a board's result goes next: another board on the team. */
export interface HandOff {
  automation_id: string;
  name: string;
}

/**
 * The "then" a planner proposed, kept only when it names a listed board
 * that is not the board being planned.
 */
export function coerceHandOff(raw: unknown, boards: { id: string; name: string }[] | undefined, selfId?: string | null): HandOff | null {
  if (!raw || typeof raw !== "object" || !boards?.length) return null;
  const r = raw as Record<string, unknown>;
  const id = String(r.board_id ?? r.automation_id ?? r.id ?? "").trim();
  if (!id || id === selfId) return null;
  const b = boards.find((x) => x.id === id);
  return b ? { automation_id: b.id, name: b.name } : null;
}

/** Boards may hand to boards, but never more than this many deep: A → B → C stops there. */
export const MAX_TOOL_DEPTH = 2;

export function toolDepth(input: unknown): number {
  const d = Number((input as { tool_depth?: unknown } | null)?.tool_depth);
  return Number.isFinite(d) && d > 0 ? Math.floor(d) : 0;
}

/**
 * The brief a called board works on: its own standing brief, then what the
 * caller handed over. Data labels only.
 */
export function toolBrief(boardBrief: string, from: string, handed: string): string {
  const own = String(boardBrief ?? "").trim();
  const what = String(handed ?? "").trim().slice(0, 6000);
  return [own, what ? `HANDED OVER BY ${from.toUpperCase()}:\n${what}` : ""].filter(Boolean).join("\n\n");
}

/** Flatten an agent's structured output into plain text (for the next brief, for copy). */
export function outputText(output: Record<string, unknown> | null | undefined): string {
  if (!output) return "";
  const o = output as Record<string, any>; // deno-lint-ignore-line no-explicit-any
  const parts: string[] = [];
  if (typeof o.brief === "string") parts.push(o.brief);
  if (Array.isArray(o.headlines)) parts.push(`Headlines:\n- ${o.headlines.join("\n- ")}`);
  const items = Array.isArray(o.items) ? o.items.filter((i: unknown) => i && typeof i === "object") : [];
  for (const it of items) {
    const head = [it.platform, it.title].filter(Boolean).join(" · ");
    const tags = Array.isArray(it.hashtags) && it.hashtags.length ? "\n" + it.hashtags.map((h: string) => (String(h).startsWith("#") ? h : "#" + h)).join(" ") : "";
    parts.push(`${head ? head + "\n" : ""}${it.body ?? ""}${tags}${it.cta ? "\n" + it.cta : ""}`);
  }
  if (Array.isArray(o.findings)) for (const f of o.findings) parts.push(`${f?.heading ?? ""}\n${f?.body ?? ""}`.trim());
  if (Array.isArray(o.recommendations)) parts.push(`Recommendations:\n- ${o.recommendations.join("\n- ")}`);
  if (typeof o.notes === "string" && o.notes) parts.push(`Notes: ${o.notes}`);
  if (!parts.length && typeof o.summary === "string") parts.push(o.summary);
  return parts.join("\n\n");
}
