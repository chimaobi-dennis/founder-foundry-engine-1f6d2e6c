import { useEffect, useState } from "react";
import { Check, Minus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProgressStep } from "@shared/progress";

/**
 * The real steps of a piece of work as they happen: ticked when done, a
 * pulse and elapsed seconds on the one in progress, the rest as the to-do
 * list. A note under a step says what was found or why it was left out.
 * Before the first step arrives, `placeholder` is shown as the only step.
 */
export function ProgressSteps({ steps, placeholder = "Reaching Kinika", compact = false, className }: {
  steps: ProgressStep[];
  placeholder?: string;
  compact?: boolean;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  const doing = steps.some((s) => s.status === "doing");
  useEffect(() => {
    if (!doing) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [doing]);
  const list: ProgressStep[] = steps.length ? steps : [{ key: "_", label: placeholder, status: "doing" }];
  const size = compact ? "text-[12px]" : "text-[14px]";
  return (
    <ol className={cn("flex flex-col", compact ? "gap-1" : "gap-2", className)} aria-live="polite">
      {list.map((st) => {
        const secs = st.status === "doing" && st.at ? Math.max(0, Math.floor((now - new Date(st.at).getTime()) / 1000)) : null;
        const tone = st.status === "done" ? "text-muted-foreground" : st.status === "doing" ? "text-foreground" : st.status === "failed" ? "text-destructive" : "text-muted-foreground/60";
        return (
          <li key={st.key} className={cn("flex items-start gap-2.5 font-ui", size, tone)}>
            <span className={cn("rounded-full inline-flex items-center justify-center shrink-0 border mt-[2px]", compact ? "w-4 h-4" : "w-5 h-5",
              st.status === "done" ? "bg-[hsl(var(--brand-good-soft))] border-transparent text-[hsl(var(--brand-good))]"
                : st.status === "doing" ? "border-primary"
                : st.status === "failed" ? "border-destructive text-destructive"
                : st.status === "skipped" ? "border-border text-muted-foreground"
                : "border-border")}>
              {st.status === "done" ? <Check size={compact ? 10 : 12} />
                : st.status === "doing" ? <span className={cn("rounded-full bg-primary animate-pulse", compact ? "w-1.5 h-1.5" : "w-2 h-2")} />
                : st.status === "failed" ? <X size={compact ? 10 : 12} />
                : st.status === "skipped" ? <Minus size={compact ? 10 : 12} /> : null}
            </span>
            <span className="flex flex-col min-w-0">
              <span className="leading-snug">
                {st.label}
                {secs != null && secs >= 3 && <span className="text-muted-foreground tabular-nums"> · {secs}s</span>}
              </span>
              {st.note && <span className={cn("font-ui leading-snug", compact ? "text-[11px]" : "text-[12px]", st.status === "failed" ? "text-destructive" : "text-muted-foreground")}>{st.note}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** One-line form for tight places: the step in progress, or the last one. */
export function ProgressLine({ steps, placeholder = "Reaching Kinika" }: { steps: ProgressStep[]; placeholder?: string }) {
  const cur = steps.find((s) => s.status === "doing") ?? steps.filter((s) => s.status !== "todo").at(-1);
  const done = steps.filter((s) => s.status === "done").length;
  return (
    <span className="inline-flex items-center gap-2 font-ui text-[13px] text-muted-foreground" role="status" aria-live="polite">
      <span className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" aria-hidden />
      <span key={cur?.key ?? "_"} className="ed-fade-in">{cur?.label ?? placeholder}…</span>
      {steps.length > 1 && <span className="tabular-nums">{done} of {steps.length}</span>}
    </span>
  );
}
