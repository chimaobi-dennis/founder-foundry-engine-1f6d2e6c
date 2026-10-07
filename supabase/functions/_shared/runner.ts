/**
 * Pure runner logic shared by the run-step edge function and the frontend
 * (planning a run before it is created, rendering outputs). No I/O here.
 */

export type StepType = "agent_task" | "approval" | "native" | "connector";
export type RunStatus = "queued" | "running" | "waiting_approval" | "paused" | "completed" | "failed" | "cancelled";
export type StepStatus = "pending" | "running" | "waiting" | "done" | "failed" | "skipped";

export interface AgentDefinition {
  id: string;
  slug: string;
  name: string;
  role: string;
  system_prompt: string;
  model_tier: "fast" | "standard" | "reasoning";
  action_type: string;
  unit_label: string;
  per_run_credit_ceiling: number;
  cost_indicator: number;
  output_spec: Record<string, unknown>;
}

export interface TaskInput {
  /** What the founder asked for, in their words */
  brief: string;
  /** How many units (captions, posts, briefs). Default 1. */
  units?: number;
  /** Platforms to target, when the agent cares */
  platforms?: string[];
  /** Anything else the UI collected */
  [key: string]: unknown;
}

export interface RunPolicy {
  approval: "review_first" | "autonomous";
}

export interface RunBudget {
  credits_per_run: number;
  max_steps: number;
}

export interface PlannedStep {
  step_index: number;
  type: StepType;
  name: string;
  input: Record<string, unknown>;
}

export const DEFAULT_POLICY: RunPolicy = { approval: "review_first" };
export const DEFAULT_BUDGET: RunBudget = { credits_per_run: 200, max_steps: 8 };

/** Units are bounded so a typo cannot create a 1,000-caption run. */
export function normalizeUnits(units: unknown, max = 20): number {
  const n = Math.floor(Number(units));
  if (!isFinite(n) || n < 1) return 1;
  return Math.min(max, n);
}

/**
 * The plan for a single-agent task: produce, then (review_first) wait for the
 * founder. Hives (multi-agent handoffs) extend this in Phase 3.
 */
export function planSingleAgentRun(agent: AgentDefinition, input: TaskInput, policy: RunPolicy = DEFAULT_POLICY): PlannedStep[] {
  const units = normalizeUnits(input.units);
  const steps: PlannedStep[] = [
    {
      step_index: 0,
      type: "agent_task",
      name: `${agent.name}: ${units} ${agent.unit_label}${units === 1 ? "" : "s"}`,
      input: { agent_id: agent.id, units, brief: input.brief, platforms: input.platforms ?? [] },
    },
  ];
  if (policy.approval === "review_first") {
    steps.push({
      step_index: 1,
      type: "approval",
      name: "Review the result",
      input: { kind: "review_output" },
    });
  }
  return steps;
}

export interface BudgetState {
  creditsCaptured: number;
  stepsDone: number;
}

export type BudgetVerdict = { ok: true } | { ok: false; reason: string };

/** Checked before every paid step. Hitting a cap pauses the run; it never fails it. */
export function checkBudget(budget: RunBudget, agent: Pick<AgentDefinition, "per_run_credit_ceiling">, state: BudgetState, nextStepCredits: number): BudgetVerdict {
  const ceiling = Math.min(budget.credits_per_run, agent.per_run_credit_ceiling);
  if (state.stepsDone >= budget.max_steps) {
    return { ok: false, reason: `Step cap reached (${budget.max_steps}).` };
  }
  if (state.creditsCaptured + nextStepCredits > ceiling) {
    return { ok: false, reason: `This step would exceed the run's credit cap (${ceiling}).` };
  }
  return { ok: true };
}

/**
 * Models are asked for JSON only, but they sometimes wrap it in prose or a
 * code fence. Pull the first balanced object out and parse it.
 */
export function parseStructuredOutput(text: string): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  if (!text || !text.trim()) return { ok: false, error: "Empty response" };
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1], text];
  for (const c of candidates) {
    if (!c) continue;
    const start = c.indexOf("{");
    if (start < 0) continue;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < c.length; i++) {
      const ch = c[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          try {
            const v = JSON.parse(c.slice(start, i + 1));
            if (v && typeof v === "object" && !Array.isArray(v)) return { ok: true, value: v };
          } catch {
            /* try the next candidate */
          }
          break;
        }
      }
    }
  }
  return { ok: false, error: "Response was not a JSON object" };
}

/** One line for the brand memory and the run list. */
export function summarizeOutput(agentName: string, output: Record<string, unknown> | null | undefined, fallback: string): string {
  const s = output && typeof output.summary === "string" ? output.summary.trim() : "";
  if (s) return s;
  const items = output && Array.isArray((output as any).items) ? (output as any).items.length : 0;
  if (items) return `${agentName} produced ${items} item${items === 1 ? "" : "s"}.`;
  return fallback;
}

/** Build the user-turn prompt for an agent task step. */
export function buildTaskPrompt(agent: AgentDefinition, input: Record<string, unknown>, extra = ""): string {
  const units = normalizeUnits(input.units, 250);
  const platforms = Array.isArray(input.platforms) && input.platforms.length ? (input.platforms as string[]).join(", ") : "founder's choice";
  const lines = [
    `TASK FROM THE FOUNDER:`,
    String(input.brief ?? "").trim() || "(no brief given; use the brand context)",
    ``,
    `REQUEST: produce ${units} ${agent.unit_label}${units === 1 ? "" : "s"}.`,
    `PLATFORMS: ${platforms}.`,
  ];
  if (extra) lines.push(``, extra);
  lines.push(`Respond with the JSON object only.`);
  return lines.join("\n");
}

// ── Schedules ────────────────────────────────────────────────────────────────

export type ScheduleInterval = "daily" | "weekly" | "biweekly" | "monthly";

export const SCHEDULE_INTERVALS: { value: ScheduleInterval; label: string }[] = [
  { value: "daily", label: "Every day" },
  { value: "weekly", label: "Every week" },
  { value: "biweekly", label: "Every two weeks" },
  { value: "monthly", label: "Every month" },
];

/** When the next run after `from` should happen for an interval. */
export function nextRunAt(interval: ScheduleInterval, from: Date = new Date()): Date {
  const d = new Date(from.getTime());
  switch (interval) {
    case "daily":
      d.setUTCDate(d.getUTCDate() + 1);
      break;
    case "weekly":
      d.setUTCDate(d.getUTCDate() + 7);
      break;
    case "biweekly":
      d.setUTCDate(d.getUTCDate() + 14);
      break;
    case "monthly":
      d.setUTCMonth(d.getUTCMonth() + 1);
      break;
  }
  return d;
}

/**
 * Stage keys drift between the seed and the live journey_stages table; match
 * leniently so a recommendation still appears.
 */
export function agentSuitsStage(suited: string[] | null | undefined, stage: string | null | undefined): boolean {
  if (!suited || suited.length === 0 || !stage) return false;
  const aliases: Record<string, string[]> = {
    spark: ["spark", "idea"],
    shape: ["shape", "idea"],
    validate: ["validate", "validation"],
    brand: ["brand"],
    launch: ["launch"],
    grow: ["grow", "growth"],
  };
  const wanted = new Set(aliases[stage] ?? [stage]);
  return suited.some((s) => wanted.has(s));
}

// ── Recipes (connector + agent plans) ───────────────────────────────────────

export type RecipeKey = "seo_refresh" | "blog_draft";

export const RECIPES: Record<RecipeKey, { key: RecipeKey; name: string; description: string; provider: "shopify" | "wordpress"; agentSlug: string; unitLabel: string }> = {
  seo_refresh: {
    key: "seo_refresh",
    name: "Refresh product SEO",
    description: "Reads your products, proposes better search titles and descriptions in your voice, applies them after you approve the diff. Every change is revertible.",
    provider: "shopify",
    agentSlug: "seo_specialist",
    unitLabel: "product",
  },
  blog_draft: {
    key: "blog_draft",
    name: "Draft a blog post",
    description: "The Copywriter writes a post from your brief and brand context; it lands in WordPress as a draft you can edit or publish.",
    provider: "wordpress",
    agentSlug: "copywriter",
    unitLabel: "post",
  },
};

export interface RecipeInput extends TaskInput {
  connection_id: string;
  /** For seo_refresh: how many records to fetch and consider */
  record_limit?: number;
}

/**
 * Connector recipes read first, think second, ask third, write last.
 * Reversible data writes can skip the approval under an autonomous policy;
 * the write step itself still records a change set for one-tap revert.
 */
export function planRecipeRun(recipe: RecipeKey, agent: AgentDefinition, input: RecipeInput, policy: RunPolicy = DEFAULT_POLICY): PlannedStep[] {
  const limit = Math.max(1, Math.min(250, Math.floor(Number(input.record_limit) || 25)));
  const steps: PlannedStep[] = [];
  let i = 0;

  if (recipe === "seo_refresh") {
    steps.push({ step_index: i++, type: "connector", name: `Read up to ${limit} products`, input: { connection_id: input.connection_id, action: "list_records", limit } });
    steps.push({ step_index: i++, type: "agent_task", name: `${agent.name}: propose changes`, input: { agent_id: agent.id, units: limit, brief: input.brief, use_previous: "records", connection_id: input.connection_id } });
    if (policy.approval === "review_first") {
      steps.push({ step_index: i++, type: "approval", name: "Review the changes", input: { kind: "review_changes", connection_id: input.connection_id } });
    }
    steps.push({ step_index: i++, type: "connector", name: "Apply approved changes", input: { connection_id: input.connection_id, action: "apply_changes", from_step_type: "agent_task" } });
    return steps;
  }

  if (recipe === "blog_draft") {
    steps.push({ step_index: i++, type: "agent_task", name: `${agent.name}: write the post`, input: { agent_id: agent.id, units: 1, brief: input.brief, platforms: ["blog"], output_hint: "blog_post" } });
    if (policy.approval === "review_first") {
      steps.push({ step_index: i++, type: "approval", name: "Review the draft", input: { kind: "review_output", connection_id: input.connection_id } });
    }
    steps.push({ step_index: i++, type: "connector", name: "Create the draft in WordPress", input: { connection_id: input.connection_id, action: "create_draft", from_step_type: "agent_task" } });
    return steps;
  }

  return steps;
}

/** Units a recipe is quoted on (the agent step is what costs credits). */
export function recipeUnits(recipe: RecipeKey, input: RecipeInput): number {
  if (recipe === "seo_refresh") return Math.max(1, Math.min(250, Math.floor(Number(input.record_limit) || 25)));
  return 1;
}
