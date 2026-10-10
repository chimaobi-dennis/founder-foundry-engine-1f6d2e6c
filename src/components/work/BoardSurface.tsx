import { useMemo } from "react";
import { Check, Clock, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { planSingleAgentRun, SCHEDULE_INTERVALS, EVENT_TYPES, type Automation, type AutomationRun, type RunStep } from "@/services/agentService";

/**
 * The board: a standing task drawn as step cards left to right, with the
 * state of the latest run on each. Cards come from the runner's own plan for
 * this agent, so what you see is what runs. The review step is part of the
 * plan whenever a later step sends, publishes or changes something; it is
 * not a card you can remove.
 */

export interface BoardCard {
  key: string;
  kind: "when" | "step" | "review" | "report";
  label: string;
  title: string;
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

/** Cards for an automation, with the latest run's state. */
export function boardCards(a: Automation, latest: AutomationRun | null): BoardCard[] {
  const planned = latest?.steps?.length
    ? latest.steps.map((s) => ({ step_index: s.step_index, type: s.type, name: s.name, input: s.input }))
    : a.agent ? planSingleAgentRun(a.agent as never, a.task_input, a.policy) : [];
  const cards: BoardCard[] = [{
    key: "when", kind: "when", label: "When", title: triggerLabel(a),
    detail: a.status === "paused" ? "paused" : a.next_run_at && a.trigger_type === "schedule" ? `next ${new Date(a.next_run_at).toLocaleString()}` : latest ? `last ${new Date(latest.created_at).toLocaleString()}` : "has not run yet",
    status: a.status === "paused" ? "idle" : latest && (latest.status === "queued" || latest.status === "running") ? "running" : "idle",
  }];
  for (const p of planned) {
    const s = latest?.steps?.find((x) => x.step_index === p.step_index);
    const isReview = p.type === "approval";
    cards.push({
      key: `s${p.step_index}`, kind: isReview ? "review" : "step", label: isReview ? "You approve" : p.type === "connector" ? "Act" : "Work",
      title: isReview ? "Review the result" : p.name,
      detail: s ? (s.status === "done" ? `ran · ${Number(s.credits_captured) || 0} credits` : s.status === "waiting" ? "waiting for you" : s.status === "failed" ? (s.error ?? "failed") : s.status === "running" ? "working" : "next") : isReview ? "cannot be removed: this board acts on your behalf" : "not run yet",
      status: stepStatus(s),
    });
  }
  cards.push({ key: "report", kind: "report", label: "Report", title: "Kinika remembers", detail: latest?.status === "completed" ? "added to what Kinika knows" : "after each run", status: latest?.status === "completed" ? "done" : "idle" });
  return cards;
}

export function BoardSurface({ automation, latest }: { automation: Automation; latest: AutomationRun | null }) {
  const cards = useMemo(() => boardCards(automation, latest), [automation, latest]);
  return (
    <div className="flex items-stretch gap-0 flex-wrap">
      {cards.map((c, i) => (
        <div key={c.key} className="flex items-center">
          <div className={cn("w-[190px] p-3.5 rounded-xl border bg-card flex flex-col gap-1.5 relative", c.kind === "review" ? "border-2 border-primary" : c.status === "waiting" ? "border-[hsl(var(--brand-needs-you))]" : "border-border")}>
            {c.status === "waiting" && <span className="absolute -top-2.5 right-3 font-ui text-[10px] px-2 py-0.5 rounded-full bg-[hsl(var(--brand-needs-you-soft))] text-[hsl(var(--brand-needs-you))] font-semibold">waiting for you</span>}
            <span className={cn("font-ui text-[10px] uppercase tracking-[0.16em]", c.kind === "review" ? "text-accent-foreground" : "text-muted-foreground")}>{i + 1} · {c.label}</span>
            <span className="font-ui text-[13px] font-medium leading-snug">{c.title}</span>
            <span className={cn("font-ui text-[11px] inline-flex items-center gap-1", c.status === "done" ? "text-[hsl(var(--brand-good))]" : c.status === "failed" ? "text-destructive" : "text-muted-foreground")}>
              {c.status === "done" ? <Check size={11} /> : c.status === "running" ? <Loader2 size={11} className="animate-spin" /> : c.status === "waiting" ? <Clock size={11} /> : c.status === "failed" ? <X size={11} /> : null}
              {c.detail}
            </span>
          </div>
          {i < cards.length - 1 && <span aria-hidden className="w-7 h-px bg-muted-foreground/50 relative shrink-0"><span className="absolute -right-px -top-1 border-4 border-transparent border-l-[6px] border-l-muted-foreground/50" /></span>}
        </div>
      ))}
    </div>
  );
}

export default BoardSurface;
