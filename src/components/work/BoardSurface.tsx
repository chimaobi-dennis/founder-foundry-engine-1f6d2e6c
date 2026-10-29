import { useMemo } from "react";
import { BookOpen, Bot, Check, Clock, GitBranch, Loader2, Send, UserRound, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { planSingleAgentRun, SCHEDULE_INTERVALS, EVENT_TYPES, type Agent, type Automation, type AutomationRun, type RunStep } from "@/services/agentService";
import { planHiveRun, planRecipeRun, RECIPES, type PlanDraft, type PlannedStep, type HiveStage } from "@shared/runner";
import { scheduleWords } from "@shared/boardDraft";
import { watchSourceFor } from "@shared/watch";

/**
 * The board: a standing task you can read as one sentence, drawn as named
 * circles left to right. Circles come from the runner's own plan for this
 * task, so what you see is what runs. The approval circle is part of the
 * plan whenever a later step sends, publishes or changes something; it is
 * drawn in and cannot be removed. The picture is read-only: changes come
 * from Set up or from telling Kinika, and the sentence redraws.
 */

export interface BoardCard {
  key: string;
  stepIndex: number | null;
  kind: "when" | "read" | "work" | "review" | "act" | "report" | "branch";
  label: string;
  title: string;
  /** Who does it, or which connection and permission. */
  who: string;
  detail: string;
  status: "idle" | "running" | "waiting" | "done" | "failed" | "pending";
}

export function triggerLabel(a: Automation): string {
  if (a.trigger_type === "webhook") return "When a webhook fires";
  if (a.trigger_type === "event") {
    const ev = EVENT_TYPES.find((e) => e.value === a.event_type)?.label ?? "On an event";
    const cond = a.conditions?.length ? ` (${a.conditions.map((c) => `${c.field} ${c.op === "eq" ? "is" : c.op === "neq" ? "is not" : "contains"} ${c.value}`).join(", ")})` : "";
    return `${ev}${cond}`;
  }
  if (a.trigger_type === "schedule") return SCHEDULE_INTERVALS.find((i) => i.value === a.schedule_interval)?.label ?? "On a schedule";
  if (a.trigger_type === "watch") return watchSourceFor(a.watch?.source)?.words ?? "When something new arrives";
  return "When you run it";
}

function stepStatus(s: RunStep | undefined): BoardCard["status"] {
  if (!s) return "idle";
  if (s.status === "done") return "done";
  if (s.status === "running") return "running";
  if (s.status === "waiting") return "waiting";
  if (s.status === "failed") return "failed";
  return "pending";
}

/** A connector step's provider, from its name or input, in plain words. */
function connectorWho(input: Record<string, unknown> | undefined, name: string, afterReview: boolean): string {
  const provider = String((input as { provider?: string } | undefined)?.provider ?? "").trim();
  const base = provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : name.split(":")[0].trim() || "a connection";
  return afterReview ? `${base} · after your yes` : `${base} · read`;
}

/** Cards for an automation, with the latest run's state. */
export function boardCards(a: Automation, latest: AutomationRun | null): BoardCard[] {
  const planned = latest?.steps?.length
    ? latest.steps.map((s) => ({ step_index: s.step_index, type: s.type, name: s.name, input: s.input }))
    : a.agent ? planSingleAgentRun(a.agent as never, a.task_input, a.policy) : [];
  const when: BoardCard = {
    key: "when", stepIndex: null, kind: "when", label: "When", title: triggerLabel(a), who: a.trigger_type === "schedule" ? "Kinika's clock" : a.trigger_type === "webhook" ? "another system" : a.trigger_type === "event" ? "something in Kinika" : a.trigger_type === "watch" ? `${watchSourceFor(a.watch?.source)?.name ?? "a connection"} · read` : "you",
    detail: a.status === "paused" ? "paused" : a.trigger_type === "watch" ? (a.last_watch_error ? `could not read: ${a.last_watch_error.slice(0, 60)}` : a.last_watched_at ? `checked ${new Date(a.last_watched_at).toLocaleTimeString()} · every ${a.watch?.interval_minutes ?? 5} min` : "watching from now") : a.next_run_at && a.trigger_type === "schedule" ? `next ${new Date(a.next_run_at).toLocaleString()}` : latest ? `last ${new Date(latest.created_at).toLocaleString()}` : "has not run yet",
    status: a.status === "paused" ? "idle" : latest && (latest.status === "queued" || latest.status === "running") ? "running" : "idle",
  };
  return cardsFromPlan(when, planned, latest, a.agent?.name ?? "an agent");
}

/**
 * Cards for a draft the founder has not confirmed yet (the Set up dialog):
 * the same picture the board will show once it exists, so what they read is
 * what runs.
 */
export function draftBoardCards(draft: PlanDraft, agents: Agent[]): BoardCard[] {
  const bySlug = new Map(agents.map((a) => [a.slug, a]));
  const policy = { approval: draft.approval, branches: draft.branches ?? null, on_failure: draft.on_failure ?? "ask" };
  const input = { brief: draft.brief, units: draft.units, platforms: draft.platforms };
  let planned: PlannedStep[] = [];
  if (draft.kind === "recipe" && draft.recipe) {
    const agent = bySlug.get(RECIPES[draft.recipe].agentSlug);
    if (agent) planned = planRecipeRun(draft.recipe, agent as never, { ...input, connection_id: draft.connection_id ?? "", record_limit: draft.units }, policy);
  } else if (draft.kind === "hive") {
    const stages = draft.agents.map((s) => ({ agent: bySlug.get(s)!, units: draft.units, platforms: draft.platforms })).filter((s) => s.agent) as unknown as HiveStage[];
    planned = planHiveRun(stages, input, policy);
  } else {
    const agent = bySlug.get(draft.agents[0]);
    if (agent) planned = planSingleAgentRun(agent as never, input, policy);
  }
  const once = draft.schedule === "once";
  const watching = draft.schedule === "watch" ? watchSourceFor(draft.watch?.source) : null;
  const when: BoardCard = {
    key: "when", stepIndex: null, kind: "when", label: "When", title: once ? "When you run it" : scheduleWords(draft),
    who: once ? "you" : draft.schedule === "webhook" ? "another system" : draft.schedule === "event" ? "something in Kinika" : watching ? `${watching.name} · read` : "Kinika's clock",
    detail: once ? "right after you confirm" : watching ? `every ${watching.intervalMinutes} min, only what is new` : "first run right after you confirm", status: "idle",
  };
  return cardsFromPlan(when, planned, null, bySlug.get(draft.agents[0])?.name ?? "an agent");
}

function cardsFromPlan(when: BoardCard, planned: Pick<PlannedStep, "step_index" | "type" | "name" | "input">[], latest: AutomationRun | null, agentName: string): BoardCard[] {
  const cards: BoardCard[] = [when];
  let reviewed = false;
  for (const p of planned) {
    const s = latest?.steps?.find((x) => x.step_index === p.step_index);
    const input = (p.input ?? {}) as Record<string, unknown>;
    const isBranch = p.type === "branch";
    const isDecision = p.type === "approval" && input.kind === "decision";
    const isReview = p.type === "approval";
    const isConnector = p.type === "connector";
    const isRead = isConnector && !reviewed && /read|fetch|snapshot|watch|list|get/i.test(p.name);
    const kind: BoardCard["kind"] = isBranch ? "branch" : isReview ? "review" : isConnector ? (isRead ? "read" : "act") : "work";
    const options = isBranch && Array.isArray(input.options) ? (input.options as { label: string; action: string }[]) : [];
    const title = isBranch ? String(input.question ?? "Which way?") : isDecision ? "You decide" : isReview ? "You approve" : p.name.includes(":") ? p.name.split(":").slice(1).join(":").trim() : p.name;
    cards.push({
      key: `s${p.step_index}`, stepIndex: p.step_index, kind, label: isBranch ? "Decide" : isDecision ? "Ask you" : isReview ? "Approve" : kind === "read" ? "Read" : kind === "act" ? "Act" : "Work",
      title: title || p.name,
      who: isBranch ? "Kinika" : isReview ? "you" : isConnector ? connectorWho(input, p.name, reviewed) : (p.name.includes(":") ? p.name.split(":")[0].trim() : agentName),
      detail: s ? (s.status === "done" ? (isBranch ? `decided: ${String((s.output as { choice?: string } | null)?.choice ?? "")}` : `ran · ${Number(s.credits_captured) || 0} credits`) : s.status === "waiting" ? "waiting for you" : s.status === "failed" ? "paused here" : s.status === "skipped" ? (isDecision ? "not needed" : "skipped") : s.status === "running" ? (isBranch ? "deciding" : "working") : "next") : isBranch ? options.map((o) => `${o.label} → ${o.action === "ask" ? "ask you" : o.action === "skip" ? "skip" : "do it"}`).join(" · ") : isDecision ? "only when Kinika is unsure" : isReview ? "cannot be removed" : "not run yet",
      status: stepStatus(s),
    });
    if (isReview) reviewed = true;
  }
  cards.push({ key: "report", stepIndex: null, kind: "report", label: "Remember", title: "Kinika remembers", who: "Kinika", detail: latest?.status === "completed" ? "added to what Kinika knows" : "after each run", status: latest?.status === "completed" ? "done" : "idle" });
  return cards;
}

/** The board as one sentence a founder can read aloud. */
export function boardSentence(_a: unknown, cards: BoardCard[]): string {
  const parts: string[] = [];
  const when = cards.find((c) => c.kind === "when");
  parts.push(when ? when.title.replace(/^When /, "When ").replace(/^On /, "On ") : "When it runs");
  for (const c of cards) {
    if (c.kind === "when" || c.kind === "report") continue;
    if (c.kind === "branch") parts.push(`Kinika decides ${c.title.toLowerCase().replace(/\?$/, "")}`);
    else if (c.kind === "review" && c.title === "You decide") parts.push("asks you when unsure");
    else if (c.kind === "review") parts.push("you approve");
    else if (c.kind === "read") parts.push(`Kinika reads ${c.who.split(" · ")[0]}`);
    else if (c.kind === "act") parts.push(`${c.title.toLowerCase()} on ${c.who.split(" · ")[0]}`);
    else {
      const t = c.title.toLowerCase();
      // A step named only by its count ("1 brief", "3 captions") needs a verb to read as a sentence.
      parts.push(`${c.who === "you" ? "you" : `the ${c.who}`} ${/^\d/.test(t) ? `make${c.who === "you" ? "" : "s"} ${t}` : t}`);
    }
  }
  parts.push("and Kinika remembers");
  const text = parts.join(", ") + ".";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const ICON: Record<BoardCard["kind"], typeof Clock> = { when: Clock, read: BookOpen, work: Bot, review: UserRound, act: Send, report: Zap, branch: GitBranch };

export function BoardSurface({ automation, latest, selected, onSelect }: { automation: Automation; latest: AutomationRun | null; selected?: string | null; onSelect?: (key: string) => void }) {
  const cards = useMemo(() => boardCards(automation, latest), [automation, latest]);
  return <BoardPicture cards={cards} selected={selected} onSelect={onSelect} />;
}

/** The named circles, left to right, for any list of cards (a board or a draft). */
export function BoardPicture({ cards, selected, onSelect, compact = false }: { cards: BoardCard[]; selected?: string | null; onSelect?: (key: string) => void; compact?: boolean }) {
  return (
    <div className="flex items-start gap-0 flex-wrap" role="list" aria-label="The board">
      {cards.map((c, i) => {
        const Icon = ICON[c.kind];
        const sel = selected === c.key;
        return (
          <div key={c.key} className="flex items-start" role="listitem">
            <button type="button" onClick={() => onSelect?.(c.key)} aria-pressed={sel} className={cn("flex flex-col items-center gap-2 text-center group", compact ? "w-[120px]" : "w-[150px]")}>
              <span className={cn(
                "relative rounded-full inline-flex items-center justify-center border-2 transition-colors",
                compact ? "w-[56px] h-[56px]" : "w-[72px] h-[72px]",
                c.kind === "review" ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border",
                c.status === "done" && c.kind !== "review" && "border-[hsl(var(--brand-good))]",
                c.status === "waiting" && "border-[hsl(var(--brand-needs-you))] ring-4 ring-[hsl(var(--brand-needs-you-soft))]",
                c.status === "failed" && "border-destructive",
                c.status === "running" && "border-primary",
                sel && "ring-4 ring-[hsl(var(--brand-blue-line))]",
              )}>
                <Icon size={compact ? 20 : 26} />
                <span className={cn("absolute -bottom-1 -right-1 w-6 h-6 rounded-full inline-flex items-center justify-center border-2 border-background text-[11px]",
                  c.status === "done" ? "bg-[hsl(var(--brand-good))] text-white" : c.status === "running" ? "bg-primary text-primary-foreground" : c.status === "waiting" ? "bg-[hsl(var(--brand-needs-you))] text-white" : c.status === "failed" ? "bg-destructive text-white" : "bg-muted text-muted-foreground")}>
                  {c.status === "done" ? <Check size={12} /> : c.status === "running" ? <Loader2 size={12} className="animate-spin" /> : c.status === "waiting" ? <Clock size={12} /> : c.status === "failed" ? <X size={12} /> : <span>{i + 1}</span>}
                </span>
              </span>
              <span className="flex flex-col gap-0.5 px-1">
                <span className="font-ui text-[13px] font-semibold leading-snug">{c.title}</span>
                <span className={cn("font-ui text-[11px]", c.kind === "review" ? "text-accent-foreground font-medium" : "text-muted-foreground")}>{c.who}</span>
                <span className={cn("font-ui text-[11px]", c.status === "done" ? "text-[hsl(var(--brand-good))]" : c.status === "failed" ? "text-destructive" : c.status === "waiting" ? "text-[hsl(var(--brand-needs-you))]" : "text-muted-foreground")}>{c.detail}</span>
              </span>
            </button>
            {i < cards.length - 1 && <span aria-hidden className={cn("w-6 h-0.5 bg-border relative shrink-0", compact ? "mt-[26px]" : "mt-[34px]")}><span className="absolute -right-px -top-[5px] border-[6px] border-transparent border-l-[8px] border-l-border" /></span>}
          </div>
        );
      })}
    </div>
  );
}

export default BoardSurface;
