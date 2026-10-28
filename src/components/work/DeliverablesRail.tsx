import { Check, Circle, FileText, ListChecks, Loader2, Scale, Zap } from "lucide-react";
import { ProgressSteps } from "@/components/ui/progress-steps";
import type { ProgressStep } from "@shared/progress";
import { cn } from "@/lib/utils";
import type { Deliverable } from "@/services/planService";

const ICON: Record<Deliverable["kind"], typeof Check> = { decision: Scale, document: FileText, list: ListChecks, action: Zap };

/** The deliverables that complete a founder task, ticked as the work with Kinika progresses. */
export function DeliverablesRail({ deliverables, breaking, breakSteps = [], busyId, onToggle, onOpen }: {
  deliverables: Deliverable[];
  breaking: boolean;
  /** The real steps of the breakdown while it runs. */
  breakSteps?: ProgressStep[];
  busyId: string | null;
  onToggle: (d: Deliverable) => void;
  /** Open the deliverable itself: its list, decision, or document. */
  onOpen: (d: Deliverable) => void;
}) {
  const done = deliverables.filter((d) => d.done).length;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Deliverables</span>
        {deliverables.length > 0 && <span className="font-ui text-[11px] text-muted-foreground">{done} of {deliverables.length}</span>}
      </div>
      {breaking && (
        <div className="flex flex-col gap-1.5">
          <p className="font-ui text-[12px] text-muted-foreground inline-flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Kinika is breaking this task into deliverables</p>
          <ProgressSteps steps={breakSteps} compact placeholder="Reaching Kinika" />
        </div>
      )}
      {!breaking && deliverables.length === 0 && <p className="font-ui text-[12px] text-muted-foreground">Kinika names what completes this task once the workspace opens.</p>}
      <ul className="flex flex-col gap-1.5">
        {deliverables.map((d) => {
          const Icon = ICON[d.kind] ?? Zap;
          return (
            <li key={d.id} className={cn("rounded-lg border px-2.5 py-2 flex items-start gap-2", d.done ? "border-[hsl(var(--brand-good))]/40 bg-[hsl(var(--brand-good-soft))]/40" : "border-border bg-card")}>
              <button disabled={busyId === d.id} onClick={() => onToggle(d)} className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary disabled:opacity-50" aria-label={d.done ? "Mark not done" : "Mark done"}>
                {busyId === d.id ? <Loader2 size={15} className="animate-spin" /> : d.done ? <Check size={15} className="text-[hsl(var(--brand-good))]" /> : <Circle size={15} />}
              </button>
              <button onClick={() => onOpen(d)} className="min-w-0 flex-1 text-left group">
                <p className={cn("font-ui text-[12px] font-medium leading-snug group-hover:underline", d.done && "text-muted-foreground")}>{d.title}</p>
                {d.detail && <p className="font-ui text-[11px] text-muted-foreground mt-0.5 leading-snug">{d.detail}</p>}
                <p className="font-ui text-[10px] text-muted-foreground mt-1 inline-flex items-center gap-1"><Icon size={10} /> {d.kind}{d.done && <span className="text-[hsl(var(--brand-good))]">· {d.result || d.document_id ? "see the outcome" : "no outcome written"}</span>}{!d.done && d.needs && !d.needs.resolved && <span className="text-[hsl(var(--brand-needs-you))]">· needs a {d.needs.label.toLowerCase()}</span>}{!d.done && d.run_id && <span className="text-accent-foreground">· with {d.agent_name ?? "an agent"}</span>}</p>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
