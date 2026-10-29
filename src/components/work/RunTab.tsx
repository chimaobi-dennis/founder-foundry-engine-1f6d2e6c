import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Markdown } from "@/components/ui/markdown";
import { ListSkeleton } from "@/components/ui/page-skeleton";
import { OutputView } from "@/components/team/RunViews";
import { ProgressSteps } from "@/components/ui/progress-steps";
import type { ProgressStep } from "@shared/progress";
import type { RunStep } from "@/services/agentService";
import { useVisibleInterval } from "@/hooks/use-visible-interval";
import { useAuth } from "@/contexts/AuthContext";
import { cancelRun, getRun, outputToText, type Approval, type AutomationRun } from "@/services/agentService";
import { ApprovalActions, roundOf } from "@/components/work/ApprovalActions";
import { RunRecovery } from "@/components/work/RunRecovery";
import { supabase } from "@/integrations/supabase/client";
import type { Deliverable } from "@/services/planService";

/** A run step in the shared progress shape: the runner's own plan is the to-do list. */
function stepToProgress(s: RunStep): ProgressStep {
  const status = s.status === "done" ? "done" : s.status === "running" ? "doing" : s.status === "failed" ? "failed" : s.status === "skipped" ? "skipped" : s.status === "waiting" ? "doing" : "todo";
  const bits = [s.status === "waiting" ? "waiting for you" : "", s.credits_captured > 0 ? `${Number(s.credits_captured)} credits` : "", s.error ?? ""].filter(Boolean);
  return { key: s.id, label: s.name, status, at: s.started_at ?? undefined, note: bits.join(" · ") || undefined };
}

/** "Step 2 of 4 · writing the captions." */
function runSummary(steps: RunStep[], agentName: string): string {
  const cur = steps.find((s) => s.status === "running" || s.status === "waiting");
  if (!cur) return `${agentName} is starting.`;
  const i = steps.findIndex((s) => s.id === cur.id) + 1;
  return `Step ${i} of ${steps.length}: ${cur.name}.`;
}

/**
 * One deliverable an agent is doing, as a tab in the founder's workspace:
 * how the agent worked, what it made, and the approval, right here. When the
 * founder approves, the deliverable is done and its outcome is the result.
 */
export function RunTab({ deliverable, onApproved }: { deliverable: Deliverable; onApproved: (d: Deliverable, result: string) => Promise<void> }) {
  const { user } = useAuth();
  const [run, setRun] = useState<AutomationRun | null | undefined>(undefined);
  const [approval, setApproval] = useState<Approval | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!deliverable.run_id) return;
    const r = await getRun(deliverable.run_id);
    setRun(r);
    if (r) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: ap } = await (supabase as any).from("approvals").select("*").eq("run_id", r.id).eq("status", "pending").order("created_at", { ascending: false }).limit(1).maybeSingle();
      setApproval(ap ?? null);
    }
  }, [deliverable.run_id]);
  useEffect(() => { setRun(undefined); load(); }, [load]);
  const inFlight = !!run && ["queued", "running"].includes(run.status);
  useVisibleInterval(load, 8000, inFlight);

  const output = (approval?.payload?.output ?? run?.output ?? null) as Record<string, unknown> | null;
  const resultText = (): string => {
    const doc = output && typeof output.document === "string" ? (output.document as string) : "";
    const extra = output && Array.isArray(output.decisions_needed) && (output.decisions_needed as unknown[]).length ? `\n\n**Your decisions:**\n${(output.decisions_needed as string[]).map((x) => `- ${x}`).join("\n")}` : "";
    return (doc ? doc + extra : outputToText(output)).trim();
  };

  const decided = async (d: "approved" | "revise" | "rejected") => {
    if (d === "approved") await onApproved(deliverable, resultText());
    await load();
  };

  if (run === undefined) return <div className="p-4 md:p-8"><ListSkeleton cards={1} rows={3} className="max-w-[760px] mx-auto" /></div>;
  if (!run) return <p className="p-8 font-ui text-[13px] text-muted-foreground">This run is not available.</p>;
  const agentName = deliverable.agent_name ?? run.agent?.name ?? "Agent";
  const status = approval ? "waiting for your approval" : run.status === "queued" ? "starting" : run.status === "running" ? "working" : run.status === "completed" ? "approved" : run.status === "failed" ? "stopped" : run.status === "paused" ? "paused, needs you" : run.status === "cancelled" ? "sent back" : run.status;
  const legalDraft = output && typeof output.document === "string";

  return (
    <div className="p-4 md:p-8">
      <article className="max-w-[760px] mx-auto rounded-xl border border-border bg-card">
        <div className="px-6 pt-6 pb-3 border-b border-border flex items-start justify-between gap-4 flex-wrap">
          <div className="flex flex-col gap-1">
            <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-accent-foreground">{agentName} · on Kinika's team · {status}</span>
            <h1 className="font-display text-[22px] leading-tight">{deliverable.title}</h1>
            <span className="font-ui text-[12px] text-muted-foreground">{Number(run.credits_captured ?? 0)} credits used{inFlight ? " so far" : ""}</span>
          </div>
          <div className="flex items-center gap-2">
            {inFlight && <button disabled={!!busy} onClick={async () => { if (!confirm("Stop the agent here? Credits already used stay used.")) return; setBusy("stop"); await cancelRun(run.id); setBusy(null); await load(); }} className="h-8 px-3 rounded-lg border border-border bg-card font-ui text-[12px] disabled:opacity-50">Take over</button>}
            {approval && user && <ApprovalActions approvalId={approval.id} userId={user.id} agentName={agentName} round={roundOf(run.steps)} onDecided={decided} compact kind={approval.kind} />}
          </div>
        </div>
        {approval && (
          <div className="px-6 py-3 border-b border-border bg-[hsl(var(--brand-needs-you-soft))]/50">
            <span className="font-ui text-[12px] text-foreground">Approving marks the deliverable done and keeps this as its outcome. Sending it back for changes asks {agentName} for another round with your note. Stop ends the run.</span>
          </div>
        )}
        <div className="px-6 py-5">
          <RunRecovery run={run} onChanged={load} />
          {approval?.kind === "decision" && approval.payload.decision && (
            <p className="font-ui text-[13px] text-foreground mb-3">Kinika asks: {approval.payload.decision.question}{approval.payload.decision.choice ? ` It read this as "${approval.payload.decision.choice}".` : ""} Run it, or skip this one.</p>
          )}
          {inFlight && !output && (
            <div className="flex flex-col gap-3">
              <p className="font-ui text-[13px] text-muted-foreground">{runSummary(run.steps ?? [], agentName)} This tab follows along; nothing goes anywhere without your yes.</p>
              <ProgressSteps steps={(run.steps ?? []).map(stepToProgress)} placeholder={`${agentName} is starting`} />
            </div>
          )}
          {output && (legalDraft ? (
            <div className="flex flex-col gap-4">
              <p className="font-ui text-[12px] px-3 py-2 rounded-lg bg-[hsl(var(--brand-needs-you-soft))] text-[hsl(var(--brand-needs-you))]">A draft to review with a licensed lawyer. Not legal advice.</p>
              <div className="text-[14px]"><Markdown>{String(output.document)}</Markdown></div>
              {Array.isArray(output.decisions_needed) && (output.decisions_needed as string[]).length > 0 && (
                <div className="rounded-lg border border-border p-3"><p className="font-ui text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1.5">Your decisions</p><ul className="list-disc pl-5 font-ui text-[13px] space-y-1">{(output.decisions_needed as string[]).map((x) => <li key={x}>{x}</li>)}</ul></div>
              )}
              {Array.isArray(output.review_points) && (output.review_points as string[]).length > 0 && (
                <div className="rounded-lg border border-border p-3"><p className="font-ui text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1.5">For the lawyer to check first</p><ul className="list-disc pl-5 font-ui text-[13px] space-y-1">{(output.review_points as string[]).map((x) => <li key={x}>{x}</li>)}</ul></div>
              )}
            </div>
          ) : <OutputView output={output} />)}
          {!inFlight && !output && <p className="font-ui text-[13px] text-muted-foreground">{run.status === "failed" ? run.error ?? "The run stopped." : "No result to show."}</p>}
        </div>
      </article>
    </div>
  );
}
