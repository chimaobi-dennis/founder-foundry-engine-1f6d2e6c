import { useState } from "react";
import { Check, Loader2, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { decideApproval } from "@/services/agentService";

/**
 * The one approval control, used wherever a result waits for the founder:
 * Approve · Send back for changes (a note is required; the agent revises and
 * asks again) · Stop (ends the run). The same three everywhere.
 */
export function ApprovalActions({ approvalId, userId, agentName, round, onDecided, compact = false }: {
  approvalId: string;
  userId: string;
  agentName: string;
  /** Which round this result is; 1 for the first. */
  round?: number;
  onDecided: (decision: "approved" | "revise" | "rejected") => Promise<void>;
  compact?: boolean;
}) {
  const [mode, setMode] = useState<"idle" | "revise">("idle");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const decide = async (d: "approved" | "revise" | "rejected") => {
    if (d === "rejected" && !confirm(`Stop ${agentName} here? The run ends; credits already used stay used.`)) return;
    setBusy(d);
    const r = await decideApproval(approvalId, d, userId, note.trim() || undefined);
    setBusy(null);
    if (!r.success) { toast.error(r.error ?? "Could not record your decision"); return; }
    toast(d === "approved" ? "Approved" : d === "revise" ? `${agentName} is revising` : "Stopped");
    setMode("idle"); setNote("");
    await onDecided(d);
  };
  const btn = compact ? "h-8 px-3 text-[12px]" : "h-9 px-3.5 text-[13px]";

  return (
    <div className="flex flex-col gap-2 items-end">
      <div className="flex items-center gap-2 flex-wrap justify-end">
        {round && round > 1 && <span className="font-ui text-[11px] text-muted-foreground">Round {round}</span>}
        <button disabled={!!busy} onClick={() => setMode(mode === "revise" ? "idle" : "revise")} className={`${btn} inline-flex items-center gap-1.5 rounded-lg border font-ui disabled:opacity-50 ${mode === "revise" ? "border-primary bg-accent text-accent-foreground" : "border-border bg-card"}`}><RotateCcw size={13} /> Send back for changes</button>
        <button disabled={!!busy} onClick={() => decide("rejected")} className={`${btn} inline-flex items-center gap-1.5 rounded-lg border border-border bg-card font-ui text-muted-foreground disabled:opacity-50`} title="End the run">{busy === "rejected" ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />} Stop</button>
        <button disabled={!!busy} onClick={() => decide("approved")} className={`${btn} inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground font-ui font-medium disabled:opacity-50`}>{busy === "approved" ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Approve</button>
      </div>
      {mode === "revise" && (
        <div className="w-full max-w-[520px] flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
          <label className="font-ui text-[12px] font-medium">What should {agentName} change?</label>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} autoFocus placeholder="Shorter. Lead with the weekday offer. Drop the third clause." className="text-[13px]" />
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="font-ui text-[11px] text-muted-foreground">Another round is quoted and reserved like a run; everything you did not mention stays as it is.</span>
            <button disabled={!!busy || !note.trim()} onClick={() => decide("revise")} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground font-ui text-[12px] font-medium disabled:opacity-50">{busy === "revise" ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />} Send back</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Which round a run's current result is: 1, or 1 + the revisions already made. */
export function roundOf(steps: { type: string; input?: Record<string, unknown> | null }[] | undefined): number {
  return 1 + (steps ?? []).filter((s) => s.type === "agent_task" && s.input && (s.input as { revision_round?: number }).revision_round).length;
}
