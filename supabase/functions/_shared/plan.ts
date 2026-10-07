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

export function agentsBlock(agents: PlanAgentOption[]): string {
  if (!agents.length) return "AGENTS: none available yet.";
  return "AGENTS (slug: name, what they do, hired or not):\n" + agents.map((a) => `- ${a.slug}: ${a.name}. ${a.tagline ?? ""} ${a.hired ? "(on the team)" : "(available to hire)"}`.trim()).join("\n");
}
