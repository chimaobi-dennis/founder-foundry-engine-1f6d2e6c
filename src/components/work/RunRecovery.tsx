import { useState } from "react";
import { Loader2, RotateCcw, SkipForward, X } from "lucide-react";
import { toast } from "sonner";
import { cancelRun, retryStep, skipFailedStep, type AutomationRun } from "@/services/agentService";
import { plainFailure } from "@shared/branching";

/**
 * A run that stopped on a failed step, in plain words, with the three ways
 * on: Try again (the step runs again), Skip this step (the rest continues),
 * Stop. Shown wherever a run is shown. Credits already used stay used.
 */
export function RunRecovery({ run, onChanged }: { run: Pick<AutomationRun, "id" | "status" | "paused_reason" | "error" | "steps">; onChanged: () => Promise<void> | void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const failedStep = (run.steps ?? []).filter((s) => s.status === "failed").sort((a, b) => b.step_index - a.step_index)[0] ?? null;
  if (!(run.status === "paused" || run.status === "failed") || !failedStep) return null;
  const f = plainFailure(failedStep.error ?? run.paused_reason ?? run.error);
  const act = async (what: string, fn: () => Promise<{ success: boolean; error?: string } | boolean>) => {
    setBusy(what);
    const r = await fn();
    setBusy(null);
    const ok = typeof r === "boolean" ? r : r.success;
    if (!ok) toast.error(typeof r === "boolean" ? "Could not do that" : r.error ?? "Could not do that");
    await onChanged();
  };
  return (
    <div role="status" className="rounded-xl border border-[hsl(var(--brand-needs-you))]/50 bg-[hsl(var(--brand-needs-you-soft))]/50 p-4 flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--brand-needs-you))]">Paused on: {failedStep.name}</span>
        <p className="font-ui text-[14px] text-foreground">{f.what}</p>
        <p className="font-ui text-[13px] text-muted-foreground">{f.next}</p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <button disabled={!!busy} onClick={() => act("retry", () => retryStep(run.id))} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-primary text-primary-foreground font-ui text-[13px] font-medium disabled:opacity-50">{busy === "retry" ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />} Try again</button>
        <button disabled={!!busy} onClick={() => act("skip", () => skipFailedStep(run.id))} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-border bg-card font-ui text-[13px] disabled:opacity-50">{busy === "skip" ? <Loader2 size={13} className="animate-spin" /> : <SkipForward size={13} />} Skip this step</button>
        <button disabled={!!busy} onClick={() => { if (confirm("Stop the run here? Credits already used stay used.")) act("stop", () => cancelRun(run.id)); }} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-border bg-card font-ui text-[13px] text-muted-foreground disabled:opacity-50"><X size={13} /> Stop</button>
      </div>
    </div>
  );
}

export default RunRecovery;
