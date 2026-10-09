/**
 * The founder's plan — pure helpers shared by the founder-plan function,
 * the UI and tests. The model proposes; this makes it safe and consistent.
 */

export type FounderType = "idea" | "running" | "creator" | "other";

export interface PlanTaskDraft {
  title: string;
  detail: string;
  owner: "founder" | "agent";
  agent_slug: string | null;
  agent_brief: string | null;
}

export interface PlanTargetDraft {
  title: string;
  why: string;
  tasks: PlanTaskDraft[];
}

export interface PlanDraft {
  title: string;
  summary: string;
  founder_type: FounderType;
  targets: PlanTargetDraft[];
}

export interface PlanAgentOption {
  slug: string;
  name: string;
  tagline?: string | null;
  hired: boolean;
}

export const MAX_TARGETS = 5;
export const MAX_TASKS_PER_TARGET = 6;

const clip = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);

export function founderTypeFrom(v: unknown): FounderType {
  const s = String(v ?? "").toLowerCase();
  return s === "idea" || s === "running" || s === "creator" ? s : "other";
}

/** Make the model's draft safe: bounded, known agents only, founder-owned by default. */
export function coercePlan(raw: unknown, agents: PlanAgentOption[]): PlanDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const known = new Set(agents.map((a) => a.slug));
  const targetsRaw = Array.isArray(r.targets) ? r.targets : [];
  const targets: PlanTargetDraft[] = [];
  for (const t of targetsRaw.slice(0, MAX_TARGETS)) {
    const o = (t ?? {}) as Record<string, unknown>;
    const title = clip(o.title, 120);
    if (!title) continue;
    const tasks: PlanTaskDraft[] = [];
    for (const k of (Array.isArray(o.tasks) ? o.tasks : []).slice(0, MAX_TASKS_PER_TARGET)) {
      const x = (k ?? {}) as Record<string, unknown>;
      const tt = clip(x.title, 160);
      if (!tt) continue;
      const slug = clip(x.agent_slug, 80).toLowerCase();
      const agent = known.has(slug) && String(x.owner).toLowerCase() === "agent";
      tasks.push({
        title: tt,
        detail: clip(x.detail, 400),
        owner: agent ? "agent" : "founder",
        agent_slug: agent ? slug : null,
        agent_brief: agent ? clip(x.agent_brief, 600) || tt : null,
      });
    }
    if (!tasks.length) continue;
    targets.push({ title, why: clip(o.why, 300), tasks });
  }
  if (!targets.length) return null;
  return { title: clip(r.title, 120) || "Your plan", summary: clip(r.summary, 600), founder_type: founderTypeFrom(r.founder_type), targets };
}

/** The instruction the plan builder works from. Admins can override it in ai_system_prompts (task_type plan_build). */
export function planSystemPrompt(): string {
  return [
    "You are Kinika, a founder's business-development mentor. From the brand context you are given, write a short, concrete action plan for the next stage of this business.",
    "The plan has 2 to 5 TARGETS in order (the next milestones that matter, e.g. 'Validate the idea with 10 conversations', 'Ship an MVP', 'Get the first 100 customers', 'Raise a pre-seed'). Each target has 2 to 6 TASKS: specific, checkable things, each one sentence.",
    "Decide who does each task. owner 'agent' only when one of the AGENTS listed can do it on their own from a brief (writing copy, a campaign brief, research, SEO on connected records, a code change); then set agent_slug to that agent's slug exactly and agent_brief to the brief you would hand them. Everything else is owner 'founder'.",
    "Match the founder's situation: an idea needs validation before building; a running business needs quick wins on its current channel; a creator needs a content system before monetisation. Use what the context says; do not invent facts, numbers or dates.",
    "When an existing plan is given, keep what is done, keep the founder's edits, and change only what the new information warrants.",
    'Return ONLY a JSON object: { "title": "...", "summary": "two sentences on the situation and the thrust of the plan", "founder_type": "idea|running|creator|other", "targets": [ { "title": "...", "why": "one sentence", "tasks": [ { "title": "...", "detail": "one sentence of how", "owner": "founder|agent", "agent_slug": "slug or null", "agent_brief": "brief or null" } ] } ] }',
  ].join("\n\n");
}

// ── Weekly check-in ──────────────────────────────────────────────────────────

export interface CheckinTask {
  title: string;
  status: string;
  owner: string;
  done_at: string | null;
  updated_at: string;
}
export interface CheckinTarget {
  title: string;
  status: string;
  position: number;
  tasks: CheckinTask[];
}

const WEEK_MS = 7 * 24 * 3600_000;
const list = (xs: string[]) => xs.map((x) => `"${x}"`).join(", ");

/**
 * The weekly check-in as a notification: what moved, what is next in the
 * current target, what has sat "in progress" for over a week. Computed, not
 * generated, so it costs the founder nothing.
 */
export function checkinSummary(plan: { title: string; targets: CheckinTarget[] }, now = new Date()): { title: string; body: string; complete: boolean } {
  const weekAgo = now.getTime() - WEEK_MS;
  const targets = [...plan.targets].sort((a, b) => a.position - b.position);
  const tasks = targets.flatMap((t) => t.tasks).filter((k) => k.status !== "skipped");
  const doneWeek = tasks.filter((k) => k.status === "done" && k.done_at && Date.parse(k.done_at) >= weekAgo);
  const open = tasks.filter((k) => k.status === "todo" || k.status === "doing");
  const stale = tasks.filter((k) => k.status === "doing" && Date.parse(k.updated_at) < weekAgo);
  if (!open.length) {
    return { complete: true, title: "Your plan is complete", body: `Every task on "${clip(plan.title, 80)}" is done. Ask Kinika to write what comes next.` };
  }
  const current = targets.find((t) => t.status !== "done" && t.tasks.some((k) => k.status === "todo" || k.status === "doing")) ?? targets[0];
  const next = current.tasks.filter((k) => k.status === "todo" || k.status === "doing").slice(0, 3).map((k) => clip(k.title, 80));
  const agentable = open.filter((k) => k.owner === "agent").length;
  const parts = [
    doneWeek.length ? `Done this week: ${list(doneWeek.slice(0, 3).map((k) => clip(k.title, 60)))}${doneWeek.length > 3 ? ` and ${doneWeek.length - 3} more` : ""}.` : "Nothing moved this week.",
    `Up next in "${clip(current.title, 80)}": ${list(next)}.`,
    stale.length ? `${stale.length} task${stale.length === 1 ? " has" : "s have"} been in progress for over a week: ${list(stale.slice(0, 2).map((k) => clip(k.title, 60)))}.` : "",
    agentable ? `${agentable} of the open tasks can go to an agent.` : "",
  ].filter(Boolean);
  return {
    complete: false,
    title: `Your week on the plan: ${doneWeek.length} done, ${open.length} to go`,
    body: parts.join(" "),
  };
}

export function agentsBlock(agents: PlanAgentOption[]): string {
  if (!agents.length) return "AGENTS: none available yet.";
  return "AGENTS (slug: name, what they do, hired or not):\n" + agents.map((a) => `- ${a.slug}: ${a.name}. ${a.tagline ?? ""} ${a.hired ? "(on the team)" : "(available to hire)"}`.trim()).join("\n");
}

// ── Playbooks ────────────────────────────────────────────────────────────────

/** Stage-shaped starting points. The builder adapts one to the context; the founder can pick. */
export const PLAYBOOKS: Record<Exclude<FounderType, "other">, { label: string; who: string; targets: string[] }> = {
  idea: {
    label: "Validate an idea",
    who: "a founder with an idea and no customers yet",
    targets: [
      "Validate the problem with 10 conversations",
      "Define the smallest offer and its price",
      "Get 5 paying or committed customers",
      "Set up the brand basics: name, promise, one channel",
    ],
  },
  running: {
    label: "Grow a running business",
    who: "a business with customers and revenue",
    targets: [
      "Find the step where most prospects drop and fix it",
      "Double down on the channel that already works",
      "Ship one improvement customers asked for",
      "Build a weekly content and outreach rhythm",
    ],
  },
  creator: {
    label: "Build a creator business",
    who: "a creator building an audience",
    targets: [
      "Pick one platform and a posting cadence you can keep",
      "Define the one topic and the audience it serves",
      "Publish a four-week content series",
      "Add the first offer: product, service or sponsorship",
    ],
  },
};

export type PlaybookChoice = Exclude<FounderType, "other"> | "auto";

export function playbookFrom(v: unknown): PlaybookChoice {
  const s = String(v ?? "").toLowerCase();
  return s === "idea" || s === "running" || s === "creator" ? s : "auto";
}

/** The playbook paragraph for the builder prompt: one chosen, or all for the model to pick from. */
export function playbookBlock(choice: PlaybookChoice): string {
  if (choice === "auto") {
    return "PLAYBOOKS (pick the one that fits the founder's situation and adapt it to the context):\n" +
      (Object.keys(PLAYBOOKS) as Array<keyof typeof PLAYBOOKS>).map((k) => `- ${k} (${PLAYBOOKS[k].who}): ${PLAYBOOKS[k].targets.join("; ")}`).join("\n");
  }
  const p = PLAYBOOKS[choice];
  return `PLAYBOOK — ${p.label} (${p.who}). The founder chose this; shape the targets after it, adapted to the context:\n${p.targets.map((t) => `- ${t}`).join("\n")}\nSet founder_type to "${choice}".`;
}

// ── In-chat plan edits ───────────────────────────────────────────────────────

export type PlanEditOp =
  | { op: "done" | "todo" | "skip" | "remove"; task: string }
  | { op: "add"; target: string | null; task: string; detail: string; owner: "founder" | "agent"; agent_slug: string | null }
  | { op: "revise"; note: string };

const PLAN_EDIT_RE = /<PLAN_EDIT>([\s\S]*?)<\/PLAN_EDIT>/g;

/** Pull <PLAN_EDIT>{ "ops": [...] }</PLAN_EDIT> blocks out of a Mentor reply; malformed ones are dropped silently. */
export function parsePlanEdits(text: string): { text: string; ops: PlanEditOp[] } {
  const ops: PlanEditOp[] = [];
  const clean = text.replace(PLAN_EDIT_RE, (_m, body: string) => {
    try {
      const raw = JSON.parse(body.trim());
      const list = Array.isArray(raw) ? raw : Array.isArray(raw?.ops) ? raw.ops : [];
      for (const x of list) {
        const op = String(x?.op ?? "").toLowerCase();
        if ((op === "done" || op === "todo" || op === "skip" || op === "remove") && clip(x.task, 160)) ops.push({ op, task: clip(x.task, 160) });
        else if (op === "add" && clip(x.task, 160)) {
          const agent = String(x.owner ?? "").toLowerCase() === "agent" && clip(x.agent_slug, 80);
          ops.push({ op: "add", target: clip(x.target, 120) || null, task: clip(x.task, 160), detail: clip(x.detail, 400), owner: agent ? "agent" : "founder", agent_slug: agent ? clip(x.agent_slug, 80).toLowerCase() : null });
        } else if (op === "revise" && clip(x.note, 1500)) ops.push({ op: "revise", note: clip(x.note, 1500) });
      }
    } catch { /* not JSON: drop the block */ }
    return "";
  }).replace(/\n{3,}/g, "\n\n").trim();
  return { text: clean, ops: ops.slice(0, 10) };
}

const words = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2));

/** Find the item the model meant: exact title, then containment, then most shared words (at least 60%). */
export function matchByTitle<T extends { title: string }>(needle: string, items: T[]): T | null {
  const n = needle.trim().toLowerCase();
  if (!n) return null;
  const exact = items.find((i) => i.title.trim().toLowerCase() === n);
  if (exact) return exact;
  const contains = items.find((i) => i.title.toLowerCase().includes(n) || n.includes(i.title.toLowerCase()));
  if (contains) return contains;
  const nw = words(n);
  if (!nw.size) return null;
  let best: { item: T; score: number } | null = null;
  for (const item of items) {
    const iw = words(item.title);
    let shared = 0;
    for (const w of nw) if (iw.has(w)) shared++;
    const score = shared / Math.max(nw.size, iw.size);
    if (score > (best?.score ?? 0)) best = { item, score };
  }
  return best && best.score >= 0.6 ? best.item : null;
}

export interface PlanForPrompt {
  title: string;
  targets: Array<{ title: string; status: string; tasks: Array<{ title: string; status: string; owner: string }> }>;
}

/** The plan as Mentor sees it, plus how it may change it. */
export function planPromptBlock(plan: PlanForPrompt): string {
  const lines = plan.targets.map((t, i) => `${i + 1}. ${t.title} [${t.status}]\n` + t.tasks.map((k) => `   - ${k.title} [${k.status}${k.owner === "agent" ? ", agent" : ""}]`).join("\n"));
  return [
    `THE FOUNDER'S PLAN — "${plan.title}":`,
    lines.join("\n"),
    "Refer to it when it is relevant; do not recite it. When the founder tells you something that changes the plan (a task is done, something should be added, dropped or skipped, or the situation has changed), apply it by appending ONE block at the very end of your reply, after your prose:",
    '<PLAN_EDIT>{ "ops": [ { "op": "done", "task": "<task title>" }, { "op": "add", "target": "<target title>", "task": "<new task>", "owner": "founder" }, { "op": "skip", "task": "..." }, { "op": "remove", "task": "..." }, { "op": "revise", "note": "<what changed, for a full revision>" } ] }</PLAN_EDIT>',
    'Use task and target titles exactly as listed. Use "revise" only when several targets need rethinking; otherwise edit tasks directly. Never emit the block when nothing changes. Tell the founder in one short sentence what you changed.',
  ].join("\n");
}
