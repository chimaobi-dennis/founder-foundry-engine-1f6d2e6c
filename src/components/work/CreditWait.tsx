import { useState } from "react";
import { Loader2, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { cancelRun, resumeRun, type AutomationRun } from "@/services/agentService";
import { usePricingModal } from "@/contexts/PricingModalContext";
import { useCreditBalance } from "@/hooks/use-credit-balance";

/**
 * A run waiting for credits, in plain words, with the three ways on: Add
 * credits (the run continues on its own once they land), Try now, Stop.
 * Shown wherever a run is shown. Nothing is spent while it waits.
 */
export function CreditWait({ run, onChanged }: { run: Pick<AutomationRun, "id" | "status" | "paused_reason" | "credits_needed">; onChanged: () => Promise<void> | void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const { openPricingModal } = usePricingModal();
  const { balance } = useCreditBalance();
  if (run.status !== "waiting_credits") return null;
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
        <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--brand-needs-you))]">Waiting for credits</span>
        <p className="font-ui text-[14px] text-foreground">{run.paused_reason ?? `This run needs about ${run.credits_needed ?? 1} credits.`}</p>
        <p className="font-ui text-[13px] text-muted-foreground">It is in line: the oldest waiting run continues first, within a minute of credits landing.</p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <button disabled={!!busy} onClick={() => openPricingModal({ currentBalance: balance })} className="h-9 px-3.5 rounded-lg bg-primary text-primary-foreground font-ui text-[13px] font-medium disabled:opacity-50">Add credits</button>
        <button disabled={!!busy} onClick={() => act("retry", () => resumeRun(run.id))} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-border bg-card font-ui text-[13px] disabled:opacity-50">{busy === "retry" ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />} Try now</button>
        <button disabled={!!busy} onClick={() => { if (confirm("Stop this run? Nothing has been spent while it waited.")) act("stop", () => cancelRun(run.id)); }} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-border bg-card font-ui text-[13px] text-muted-foreground disabled:opacity-50"><X size={13} /> Stop</button>
      </div>
    </div>
  );
}
