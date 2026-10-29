import { useState } from "react";
import { Sparkles, Loader2, Wand2, AlertTriangle, Repeat, Webhook, Users, Zap } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { QuoteChip } from "@/components/billing/QuoteChip";
import { draftPlan, executeDraft, describeDraftSteps, type PlanDraft } from "@/services/plannerService";
import type { Quote } from "@/services/pricingService";
import type { Agent } from "@/services/agentService";
import type { ToolConnection } from "@/services/connectionService";
import { ACTION_CLASS_LABEL, EVENT_TYPES, RECIPES, SCHEDULE_INTERVALS, type ActionClass } from "@shared/runner";
import { watchSourceFor } from "@shared/watch";

/**
 * "Describe it": plain language in, a reviewed plan out. Nothing is created
 * until the founder confirms the draft they can read.
 */
export function DescribeIt({ brandId, userId, agents, connections, stage, balance, balanceLoading, onTopUp, onCreated, initialText }: {
  brandId: string;
  userId: string;
  agents: Agent[];
  connections: ToolConnection[];
  stage: string | null | undefined;
  balance: number;
  balanceLoading: boolean;
  onTopUp: () => void;
  onCreated: (runId?: string) => void;
  /** Prefilled from a plan task; the founder still reads and confirms */
  initialText?: string;
}) {
  const [text, setText] = useState(initialText ?? "");
  const [busy, setBusy] = useState<"draft" | "run" | null>(null);
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bySlug = new Map(agents.map((a) => [a.slug, a]));
  const insufficient = !balanceLoading && !!quote && quote.max > balance;

  const plan = async () => {
    setBusy("draft");
    setError(null);
    setDraft(null);
    const r = await draftPlan(text, agents, connections, stage, userId);
    setBusy(null);
    if (!r.success || !r.draft) { setError(r.error ?? "Could not plan that."); return; }
    setDraft(r.draft);
    setQuote(r.quote ?? null);
  };

  const run = async () => {
    if (!draft) return;
    setBusy("run");
    const r = await executeDraft(draft, brandId, userId, agents, connections);
    setBusy(null);
    if (!r.success) { toast.error(r.error ?? "Could not start"); return; }
    toast(draft.schedule === "once" ? "On it" : draft.schedule === "webhook" ? "Webhook ready; copy its URL from the schedule list" : draft.schedule === "event" ? "Trigger created" : draft.schedule === "watch" ? "Watching; the board runs when something new arrives" : "Scheduled");
    setDraft(null);
    setText("");
    onCreated(r.run?.id);
  };

  const eventText = draft?.schedule === "event" && draft.event
    ? `${EVENT_TYPES.find((e) => e.value === draft.event)?.label ?? "On an event"}${draft.conditions.length ? ` (${draft.conditions.map((c) => `${c.field} ${c.op === "eq" ? "is" : c.op === "neq" ? "is not" : "contains"} ${c.value}`).join(", ")})` : ""}`
    : "";
  const scheduleLabel = draft ? (draft.schedule === "once" ? "Once, now" : draft.schedule === "webhook" ? "When a webhook fires" : draft.schedule === "event" ? eventText : draft.schedule === "watch" ? (watchSourceFor(draft.watch?.source)?.words ?? "When something new arrives") : SCHEDULE_INTERVALS.find((i) => i.value === draft.schedule)?.label ?? draft.schedule) : "";
  const steps = draft ? describeDraftSteps(draft, agents) : [];
  const classStyle: Record<ActionClass, string> = {
    read: "bg-muted text-muted-foreground",
    generate: "bg-muted text-muted-foreground",
    review: "bg-primary/10 text-primary",
    data_write: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    code_change: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    publish: "bg-destructive/10 text-destructive",
  };

  return (
    <section className="rounded-xl border border-primary/25 bg-primary/[0.03] p-5">
      <div className="flex items-center gap-2 mb-2">
        <Wand2 size={14} className="text-primary" />
        <h2 className="font-ui text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Describe it</h2>
      </div>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder="e.g. Every Monday, research what student associations are posting and write me three LinkedIn posts I can approve"
        className="bg-background"
      />
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <button onClick={plan} disabled={!text.trim() || busy === "draft"} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/40 text-[12px] font-ui text-foreground hover:bg-primary/10 disabled:opacity-50">
          {busy === "draft" ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Plan it
        </button>
        <span className="font-ui text-[11px] text-muted-foreground">You'll see the plan and its cost before anything runs.</span>
      </div>
      {error && <p className="font-ui text-[12px] text-destructive mt-2">{error}</p>}

      {draft && (
        <div className="mt-4 rounded-lg border border-border bg-card/60 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="font-display text-[16px] text-foreground">{draft.name}</p>
              <p className="font-ui text-[13px] text-muted-foreground mt-0.5">{draft.explanation}</p>
            </div>
            {quote && <QuoteChip estimate={quote.estimate} max={quote.max} mode={quote.mode} balance={balance} balanceLoading={balanceLoading} retailUsd={quote.retailUsd} breakdown={quote.breakdown} onTopUp={onTopUp} />}
          </div>
          <ul className="font-ui text-[13px] text-foreground space-y-1">
            <li className="flex items-center gap-2">
              {draft.kind === "hive" ? <Users size={12} className="text-muted-foreground" /> : <Sparkles size={12} className="text-muted-foreground" />}
              {draft.kind === "recipe" && draft.recipe ? `${RECIPES[draft.recipe].name} · ${connections.find((c) => c.id === draft.connection_id)?.display_name ?? ""}` : draft.agents.map((s) => bySlug.get(s)?.name ?? s).join(" → ")}
            </li>
            <li className="text-muted-foreground">{draft.units} {draft.units === 1 ? "item" : "items"}{draft.platforms.length ? ` · ${draft.platforms.join(", ")}` : ""}</li>
            <li className="flex items-center gap-2 text-muted-foreground">{draft.schedule === "webhook" ? <Webhook size={12} /> : draft.schedule === "event" ? <Zap size={12} /> : <Repeat size={12} />} {scheduleLabel} · {draft.approval === "autonomous" ? "no review" : "you review first"}</li>
            {draft.warnings.map((w, i) => <li key={i} className="flex items-start gap-2 text-amber-600 dark:text-amber-400"><AlertTriangle size={12} className="mt-0.5" /> {w}</li>)}
          </ul>
          {steps.length > 0 && (
            <ol className="font-ui text-[12px] space-y-1 border-t border-border/60 pt-3">
              {steps.map((st, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="w-4 text-muted-foreground">{i + 1}.</span>
                  <span className="text-foreground flex-1 min-w-0 truncate">{st.name}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${classStyle[st.action_class]}`}>{ACTION_CLASS_LABEL[st.action_class]}</span>
                </li>
              ))}
            </ol>
          )}
          <div className="flex items-center gap-2">
            <button onClick={run} disabled={busy === "run" || insufficient} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-[12px] font-ui font-medium disabled:opacity-50">
              {busy === "run" ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} {insufficient ? "Top up to run" : draft.schedule === "once" ? "Confirm and run" : draft.schedule === "event" ? "Confirm trigger" : "Confirm and schedule"}
            </button>
            <button onClick={() => setDraft(null)} className="px-3 py-2 rounded-lg text-[12px] font-ui text-muted-foreground">Change the description</button>
          </div>
        </div>
      )}
    </section>
  );
}

export default DescribeIt;
