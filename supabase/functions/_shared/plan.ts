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
