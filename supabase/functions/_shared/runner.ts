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

export type RecipeKey = "seo_refresh" | "blog_draft" | "notion_draft" | "social_publish" | "code_change" | "table_refresh";

export interface RecipeSpec {
  key: RecipeKey;
  name: string;
  description: string;
  provider: "shopify" | "wordpress" | "notion" | "ayrshare" | "github" | "postgres";
  agentSlug: string;
  unitLabel: string;
  /** Irreversible outward action: always reviewed, never autonomous. */
  irreversible?: boolean;
}

export const RECIPES: Record<RecipeKey, RecipeSpec> = {
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
  notion_draft: {
    key: "notion_draft",
    name: "Write a page in Notion",
    description: "The Copywriter writes from your brief and brand context; the result lands as a new page in your Notion database. Reverting archives the page.",
    provider: "notion",
    agentSlug: "copywriter",
    unitLabel: "page",
  },
  social_publish: {
    key: "social_publish",
    name: "Write and publish to social",
    description: "The Copywriter writes one post per platform; you approve each before anything is published. Posts go out through your linked social accounts.",
    provider: "ayrshare",
    agentSlug: "copywriter",
    unitLabel: "post",
    irreversible: true,
  },
  table_refresh: {
    key: "table_refresh",
    name: "Improve rows in a table",
    description: "Reads rows from your database table, proposes better values for the columns you allow (names, descriptions, meta text) in your voice, applies them after you approve the diff. Every row change is revertible.",
    provider: "postgres",
    agentSlug: "seo_specialist",
    unitLabel: "row",
  },
  code_change: {
    key: "code_change",
    name: "Change my site's code",
    description: "The Developer reads the relevant files, makes the change on a branch and opens a pull request with a preview. You merge it. Never touches your main branch, secrets, CI or dependencies.",
    provider: "github",
    agentSlug: "developer",
    unitLabel: "change",
  },
};

export interface RecipeInput extends TaskInput {
  connection_id: string;
  /** For seo_refresh: how many records to fetch and consider */
  record_limit?: number;
  /** For social_publish: ISO datetime to schedule instead of posting now */
  schedule_at?: string;
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

  if (recipe === "seo_refresh" || recipe === "table_refresh") {
    steps.push({ step_index: i++, type: "connector", name: `Read up to ${limit} ${recipe === "table_refresh" ? "rows" : "products"}`, input: { connection_id: input.connection_id, action: "list_records", limit } });
    steps.push({ step_index: i++, type: "agent_task", name: `${agent.name}: propose changes`, input: { agent_id: agent.id, units: limit, brief: input.brief, use_previous: "records", connection_id: input.connection_id } });
    if (policy.approval === "review_first") {
      steps.push({ step_index: i++, type: "approval", name: "Review the changes", input: { kind: "review_changes", connection_id: input.connection_id } });
    }
    steps.push({ step_index: i++, type: "connector", name: "Apply approved changes", input: { connection_id: input.connection_id, action: "apply_changes", from_step_type: "agent_task" } });
    return steps;
  }

  if (recipe === "blog_draft" || recipe === "notion_draft") {
    const where = recipe === "notion_draft" ? "Notion" : "WordPress";
    steps.push({ step_index: i++, type: "agent_task", name: `${agent.name}: write the ${recipe === "notion_draft" ? "page" : "post"}`, input: { agent_id: agent.id, units: 1, brief: input.brief, platforms: ["blog"], output_hint: "blog_post" } });
    if (policy.approval === "review_first") {
      steps.push({ step_index: i++, type: "approval", name: "Review the draft", input: { kind: "review_output", connection_id: input.connection_id } });
    }
    steps.push({ step_index: i++, type: "connector", name: `Create the ${recipe === "notion_draft" ? "page" : "draft"} in ${where}`, input: { connection_id: input.connection_id, action: "create_draft", from_step_type: "agent_task" } });
    return steps;
  }

  if (recipe === "code_change") {
    steps.push({ step_index: i++, type: "connector", name: "Read the repository file list", input: { connection_id: input.connection_id, action: "repo_snapshot" } });
    steps.push({ step_index: i++, type: "agent_task", name: `${agent.name}: plan the change`, input: { agent_id: agent.id, units: 1, brief: input.brief, use_previous: "snapshot", prompt_mode: "plan", max_tokens: 2000, connection_id: input.connection_id, charge: false } });
    steps.push({ step_index: i++, type: "connector", name: "Read the chosen files", input: { connection_id: input.connection_id, action: "read_files", from_step_type: "agent_task" } });
    steps.push({ step_index: i++, type: "agent_task", name: `${agent.name}: make the change`, input: { agent_id: agent.id, units: 1, brief: input.brief, use_previous: "files", prompt_mode: "edit", max_tokens: 16000, connection_id: input.connection_id } });
    if (policy.approval === "review_first") {
      steps.push({ step_index: i++, type: "approval", name: "Review the change", input: { kind: "review_code", connection_id: input.connection_id } });
    }
    steps.push({ step_index: i++, type: "connector", name: "Open the pull request", input: { connection_id: input.connection_id, action: "open_pr", from_step_type: "agent_task" } });
    return steps;
  }

  if (recipe === "social_publish") {
    const platforms = (input.platforms ?? []).filter(Boolean);
    const units = Math.max(1, platforms.length);
    steps.push({ step_index: i++, type: "agent_task", name: `${agent.name}: write ${units} post${units === 1 ? "" : "s"}`, input: { agent_id: agent.id, units, brief: input.brief, platforms } });
    // Publishing is irreversible: the review step is not optional.
    steps.push({ step_index: i++, type: "approval", name: "Approve before publishing", input: { kind: "review_publish", connection_id: input.connection_id } });
    steps.push({ step_index: i++, type: "connector", name: input.schedule_at ? "Schedule the posts" : "Publish the posts", input: { connection_id: input.connection_id, action: "publish_items", from_step_type: "agent_task", schedule_at: input.schedule_at ?? null } });
    return steps;
  }

  return steps;
}

/** Units a recipe is quoted on (the agent step is what costs credits). */
export function recipeUnits(recipe: RecipeKey, input: RecipeInput): number {
  if (recipe === "seo_refresh" || recipe === "table_refresh") return Math.max(1, Math.min(250, Math.floor(Number(input.record_limit) || 25)));
  if (recipe === "social_publish") return Math.max(1, (input.platforms ?? []).filter(Boolean).length);
  return 1;
}

// ── Hives (multi-agent handoffs) ─────────────────────────────────────────────

export interface HiveStage {
  agent: AgentDefinition;
  units?: number;
  platforms?: string[];
  /** Stage-specific instruction; the founder's brief is always included too */
  instruction?: string;
}

export const MAX_HIVE_STAGES = 4;

/**
 * A hive is a linear handoff: each agent gets the founder's brief plus the
 * previous agent's structured output. One review at the end under
 * review_first. Budget is the sum of the stages' ceilings (capped per run).
 */
export function planHiveRun(stages: HiveStage[], input: TaskInput, policy: RunPolicy = DEFAULT_POLICY): PlannedStep[] {
  const steps: PlannedStep[] = [];
  const list = stages.slice(0, MAX_HIVE_STAGES);
  list.forEach((st, i) => {
    const units = normalizeUnits(st.units ?? input.units);
    steps.push({
      step_index: i,
      type: "agent_task",
      name: `${st.agent.name}: ${units} ${st.agent.unit_label}${units === 1 ? "" : "s"}`,
      input: {
        agent_id: st.agent.id,
        units,
        brief: [input.brief, st.instruction].filter(Boolean).join("\n\n"),
        platforms: st.platforms ?? input.platforms ?? [],
        ...(i > 0 ? { use_previous: "output" } : {}),
      },
    });
  });
  if (policy.approval === "review_first") {
    steps.push({ step_index: list.length, type: "approval", name: "Review the team's result", input: { kind: "review_output" } });
  }
  return steps;
}

export function hiveBudget(stages: HiveStage[]): RunBudget {
  const sum = stages.slice(0, MAX_HIVE_STAGES).reduce((a, s) => a + s.agent.per_run_credit_ceiling, 0);
  return { credits_per_run: Math.min(600, Math.max(DEFAULT_BUDGET.credits_per_run, sum)), max_steps: MAX_HIVE_STAGES + 2 };
}

// ── Natural-language authoring ───────────────────────────────────────────────

export interface PlanDraft {
  kind: "task" | "hive" | "recipe";
  name: string;
  brief: string;
  /** task: one slug; hive: ordered slugs */
  agents: string[];
  recipe?: RecipeKey;
  connection_id?: string;
  units: number;
  platforms: string[];
  schedule: "once" | ScheduleInterval | "webhook";
  approval: "review_first" | "autonomous";
  /** One or two sentences the founder reads before confirming */
  explanation: string;
  /** Anything the planner could not honour */
  warnings: string[];
}

export interface PlannerContext {
  agents: { slug: string; name: string; tagline?: string | null; unit_label: string }[];
  connections: { id: string; provider: string; display_name: string }[];
  stage?: string | null;
}

export function plannerSystemPrompt(ctx: PlannerContext): string {
  const agents = ctx.agents.map((a) => `- ${a.slug}: ${a.name} (${a.unit_label}s). ${a.tagline ?? ""}`).join("\n");
  const recipes = Object.values(RECIPES).map((r) => `- ${r.key}: ${r.name} (needs a ${r.provider} connection; agent ${r.agentSlug})`).join("\n");
  const conns = ctx.connections.length ? ctx.connections.map((c) => `- ${c.id}: ${c.display_name} (${c.provider})`).join("\n") : "(none)";
  return `You turn a founder's request into one plan for their AI team. Choose only from the agents, recipes and connections listed. Never invent ids. If something cannot be done with what exists, say so in "warnings" and plan the closest thing that can.

AGENTS
${agents}

RECIPES (use when the request needs an external tool)
${recipes}

CONNECTIONS
${conns}

RULES
- "task": one agent. "hive": 2-4 agents in order, each building on the previous (e.g. researcher then copywriter). "recipe": one of the recipes above with a matching connection.
- units: how many ${"things"} to produce (1-20). platforms: lowercase names (instagram, linkedin, x, facebook, tiktok, email, blog) when relevant, else [].
- schedule: "once", or "daily" | "weekly" | "biweekly" | "monthly" when the founder wants it repeated, or "webhook" when they want it triggered by another system.
- approval: "review_first" unless the founder clearly says they do not want to review; publishing and code changes are always reviewed anyway.
- name: short, specific. explanation: one or two plain sentences of what will happen.

Return ONLY a JSON object:
{ "kind": "task|hive|recipe", "name": "...", "brief": "the task in the founder's words, cleaned up", "agents": ["slug", ...], "recipe": "recipe key or omit", "connection_id": "id or omit", "units": 3, "platforms": [], "schedule": "once", "approval": "review_first", "explanation": "...", "warnings": [] }`;
}

const INTERVALS: ScheduleInterval[] = ["daily", "weekly", "biweekly", "monthly"];

/**
 * Make a model's draft safe: only known agents/recipes/connections, bounded
 * numbers, forced review for irreversible recipes. Returns null when nothing
 * usable survives.
 */
export function coercePlanDraft(raw: unknown, ctx: PlannerContext): PlanDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const known = new Set(ctx.agents.map((a) => a.slug));
  const warnings: string[] = Array.isArray(r.warnings) ? (r.warnings as unknown[]).map(String).slice(0, 5) : [];
  const str = (v: unknown, max = 400) => (typeof v === "string" ? v.trim().slice(0, max) : "");

  let kind: PlanDraft["kind"] = r.kind === "hive" ? "hive" : r.kind === "recipe" ? "recipe" : "task";
  let agents = (Array.isArray(r.agents) ? (r.agents as unknown[]).map(String) : []).filter((s) => known.has(s));
  const dropped = (Array.isArray(r.agents) ? (r.agents as unknown[]).map(String) : []).filter((s) => !known.has(s));
  if (dropped.length) warnings.push(`Unknown agent${dropped.length === 1 ? "" : "s"} ignored: ${dropped.join(", ")}.`);

  let recipe: RecipeKey | undefined;
  let connection_id: string | undefined;
  if (kind === "recipe") {
    const key = str(r.recipe, 40) as RecipeKey;
    const spec = (RECIPES as Record<string, RecipeSpec>)[key];
    if (!spec) {
      warnings.push("The requested recipe does not exist; planned a plain task instead.");
      kind = "task";
    } else {
      recipe = spec.key;
      const conn = ctx.connections.find((c) => c.id === str(r.connection_id, 80)) ?? ctx.connections.find((c) => c.provider === spec.provider);
      if (!conn) {
        warnings.push(`${spec.name} needs a ${spec.provider} connection; connect one first.`);
        kind = "task";
        recipe = undefined;
      } else {
        if (conn.provider !== spec.provider) {
          warnings.push(`${spec.name} needs a ${spec.provider} connection, not ${conn.provider}.`);
          kind = "task";
          recipe = undefined;
        } else {
          connection_id = conn.id;
          agents = known.has(spec.agentSlug) ? [spec.agentSlug] : [];
        }
      }
    }
  }
  if (kind === "hive") {
    agents = agents.slice(0, MAX_HIVE_STAGES);
    if (agents.length < 2) {
      kind = "task";
      if (agents.length === 1) warnings.push("Only one usable agent; running it as a single task.");
    }
  }
  if (kind === "task") agents = agents.slice(0, 1);
  if (!agents.length) return null;

  const schedRaw = str(r.schedule, 20);
  const schedule: PlanDraft["schedule"] = schedRaw === "webhook" ? "webhook" : (INTERVALS as string[]).includes(schedRaw) ? (schedRaw as ScheduleInterval) : "once";
  const irreversible = recipe ? !!RECIPES[recipe].irreversible : false;
  const approval: PlanDraft["approval"] = r.approval === "autonomous" && !irreversible ? "autonomous" : "review_first";
  const platforms = (Array.isArray(r.platforms) ? (r.platforms as unknown[]).map((p) => String(p).toLowerCase().trim()) : []).filter(Boolean).slice(0, 8);

  return {
    kind,
    name: str(r.name, 80) || "New task",
    brief: str(r.brief, 2000),
    agents,
    recipe,
    connection_id,
    units: normalizeUnits(r.units),
    platforms,
    schedule,
    approval,
    explanation: str(r.explanation, 400),
    warnings,
  };
}

// ── Review policy for connector writes ──────────────────────────────────────

/** Connector actions that change something outside Kinika. */
export const CONNECTOR_WRITE_ACTIONS = ["apply_changes", "create_draft", "open_pr", "publish_items"] as const;
export type ConnectorWriteAction = (typeof CONNECTOR_WRITE_ACTIONS)[number];

export function isConnectorWrite(action: unknown): action is ConnectorWriteAction {
  return typeof action === "string" && (CONNECTOR_WRITE_ACTIONS as readonly string[]).includes(action);
}

/** The approval kind the UI renders for a given write. */
export function approvalKindFor(action: ConnectorWriteAction): "review_changes" | "review_code" | "review_publish" | "review_output" {
  switch (action) {
    case "apply_changes": return "review_changes";
    case "open_pr": return "review_code";
    case "publish_items": return "review_publish";
    default: return "review_output";
  }
}

/**
 * Whether a write may run without a founder's approval in this run.
 * Publishing never may; everything else needs both the autonomous policy
 * and a plan that includes autonomous changes.
 */
export function writeMayRunUnreviewed(action: ConnectorWriteAction, policyApproval: string | undefined, planAllowsAutonomous: boolean): boolean {
  if (action === "publish_items") return false;
  return policyApproval === "autonomous" && planAllowsAutonomous;
}

// ── Marketplace ─────────────────────────────────────────────────────────────

export const CUSTOM_AGENT_TIERS = ["fast", "standard", "reasoning"] as const;

/** Pricing key a creator-made agent is quoted on; the DB trigger sets the same. */
export function customActionType(tier: AgentDefinition["model_tier"]): string {
  return `agent_custom_${CUSTOM_AGENT_TIERS.includes(tier) ? tier : "standard"}`;
}

/** The creator's cut of one captured step, in dollars (4 dp). */
export function creatorEarning(credits: number, sharePct: number, retailUsdPerCredit: number): number {
  const c = Math.max(0, Math.floor(Number(credits) || 0));
  const pct = Math.min(90, Math.max(0, Number(sharePct) || 0));
  const retail = Math.max(0, Number(retailUsdPerCredit) || 0);
  return Math.round(c * retail * (pct / 100) * 10_000) / 10_000;
}

/** A URL-safe, unique-enough slug for a creator agent. */
export function creatorAgentSlug(name: string, seed: string): string {
  const base = String(name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "agent";
  return `${base}-${String(seed).replace(/[^a-z0-9]/gi, "").slice(0, 6).toLowerCase() || "x"}`;
}
