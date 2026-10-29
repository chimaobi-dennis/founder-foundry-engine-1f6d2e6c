/**
 * Set up, from a sentence. When the founder presses Set up on a plan task,
 * Kinika proposes the board for it: a plan draft (the same shape Describe it
 * produces), the role, one clarifying question only where the design forks,
 * and what must be connected. This module is the pure part shared by the
 * founder-plan function (which asks the model) and the browser dialog (which
 * applies a chosen answer locally and lists the needs). No prompt text here.
 */
import { PROVIDERS, type ConnectorProvider } from "./connectors.ts";
import { EVENT_TYPES, RECIPES, SCHEDULE_INTERVALS, normalizeUnits, type EventType, type PlanDraft, type ScheduleInterval } from "./runner.ts";
import { watchSourceFor } from "./watch.ts";

/** What a chip changes on the draft when the founder picks it. */
export interface DraftPatch {
  schedule?: PlanDraft["schedule"];
  event?: EventType;
  units?: number;
  platforms?: string[];
  approval?: PlanDraft["approval"];
  on_failure?: PlanDraft["on_failure"];
}

export interface BoardQuestion {
  text: string;
  options: { label: string; patch: DraftPatch }[];
}

export interface BoardNeed {
  provider: ConnectorProvider;
  name: string;
  why: string;
  /** The board cannot run without it (a recipe's connection). */
  required: boolean;
  connected: boolean;
}

const PATCH_KEYS: (keyof DraftPatch)[] = ["schedule", "event", "units", "platforms", "approval", "on_failure"];

function coercePatch(raw: unknown): DraftPatch | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const p: DraftPatch = {};
  const sched = typeof r.schedule === "string" ? r.schedule.trim() : "";
  if (sched === "once" || sched === "webhook" || sched === "watch" || SCHEDULE_INTERVALS.some((i) => i.value === sched)) p.schedule = sched as PlanDraft["schedule"];
  if (sched === "event") {
    const ev = typeof r.event === "string" ? r.event.trim() : "";
    if (EVENT_TYPES.some((e) => e.value === ev)) { p.schedule = "event"; p.event = ev as EventType; }
  }
  if (r.units != null && isFinite(Number(r.units))) p.units = normalizeUnits(r.units);
  if (Array.isArray(r.platforms)) p.platforms = r.platforms.map((x) => String(x).toLowerCase().trim()).filter(Boolean).slice(0, 8);
  if (r.approval === "review_first" || r.approval === "autonomous") p.approval = r.approval;
  if (r.on_failure === "skip" || r.on_failure === "ask" || r.on_failure === "stop") p.on_failure = r.on_failure;
  return PATCH_KEYS.some((k) => p[k] !== undefined) ? p : null;
}

/**
 * The one question, if the model asked one. Dropped when it has fewer than
 * two usable options: a question with one answer is not a fork.
 */
export function coerceBoardQuestion(raw: unknown): BoardQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const text = typeof r.text === "string" ? r.text.trim().slice(0, 200) : "";
  if (!text) return null;
  const options = (Array.isArray(r.options) ? r.options : [])
    .map((o) => {
      const x = (o ?? {}) as Record<string, unknown>;
      const label = typeof x.label === "string" ? x.label.trim().slice(0, 60) : "";
      const patch = coercePatch(x.patch ?? x);
      return label && patch ? { label, patch } : null;
    })
    .filter((o): o is { label: string; patch: DraftPatch } => !!o)
    .slice(0, 4);
  return options.length >= 2 ? { text, options } : null;
}

/** A chosen chip, applied. Publishing and code changes stay reviewed whatever the chip says. */
export function applyDraftPatch(draft: PlanDraft, patch: DraftPatch): PlanDraft {
  const next: PlanDraft = { ...draft, warnings: [...draft.warnings] };
  if (patch.schedule) {
    // A chip cannot invent a source to watch: "watch" only sticks when the draft already has one.
    if (patch.schedule === "watch" && !draft.watch) { next.warnings.push("Nothing is connected to watch yet; kept the schedule."); }
    else {
      next.schedule = patch.schedule;
      next.event = patch.schedule === "event" ? patch.event ?? draft.event : undefined;
      if (patch.schedule !== "event") next.conditions = [];
      if (patch.schedule !== "watch") next.watch = undefined;
    }
  }
  if (patch.units != null) next.units = normalizeUnits(patch.units);
  if (patch.on_failure) next.on_failure = patch.on_failure;
  if (patch.platforms) next.platforms = patch.platforms;
  if (patch.approval) {
    const irreversible = draft.recipe ? !!RECIPES[draft.recipe].irreversible : false;
    next.approval = patch.approval === "autonomous" && !irreversible && draft.action_class !== "publish" && draft.action_class !== "code_change" ? "autonomous" : "review_first";
  }
  return next;
}

/**
 * What must be connected for this board: the recipe's provider (required)
 * plus providers the model named as helpful, each marked connected or not.
 */
export function boardNeeds(draft: PlanDraft, rawNeeds: unknown, connections: { provider: string; status?: string }[]): BoardNeed[] {
  const connected = new Set(connections.filter((c) => !c.status || c.status === "active").map((c) => c.provider));
  const out: BoardNeed[] = [];
  const seen = new Set<string>();
  const push = (provider: string, why: string, required: boolean, fallbackName?: string) => {
    const spec = (PROVIDERS as Record<string, { name: string }>)[provider];
    const name = spec?.name ?? fallbackName;
    if (!name || seen.has(provider)) return;
    seen.add(provider);
    out.push({ provider: provider as ConnectorProvider, name, why, required, connected: connected.has(provider) });
  };
  if (draft.recipe) push(RECIPES[draft.recipe].provider, `${RECIPES[draft.recipe].name} runs on it`, true);
  const ws = draft.schedule === "watch" && draft.watch ? watchSourceFor(draft.watch.source) : null;
  if (ws) push(ws.provider, `the board waits for new ${ws.nouns} there`, true, ws.name);
  for (const n of Array.isArray(rawNeeds) ? rawNeeds.slice(0, 4) : []) {
    const x = (typeof n === "string" ? { provider: n } : n ?? {}) as Record<string, unknown>;
    const provider = String(x.provider ?? "").toLowerCase().trim();
    const why = typeof x.why === "string" ? x.why.trim().slice(0, 120) : "";
    push(provider, why || "Kinika would read or write it for this task", false);
  }
  return out;
}

/** The schedule as a founder reads it. */
export function scheduleWords(draft: Pick<PlanDraft, "schedule" | "event">): string {
  if (draft.schedule === "once") return "Once, now";
  if (draft.schedule === "webhook") return "When a webhook fires";
  if (draft.schedule === "event") return EVENT_TYPES.find((e) => e.value === draft.event)?.label ?? "On an event";
  if (draft.schedule === "watch") return watchSourceFor((draft as { watch?: { source?: string } }).watch?.source)?.words ?? "When something new arrives";
  const map: Record<ScheduleInterval, string> = { daily: "Every day", weekly: "Every week", biweekly: "Every two weeks", monthly: "Every month" };
  return map[draft.schedule] ?? draft.schedule;
}
