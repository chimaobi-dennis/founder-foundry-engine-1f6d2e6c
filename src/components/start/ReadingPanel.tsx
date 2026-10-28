import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { ProgressSteps } from "@/components/ui/progress-steps";
import type { ProgressStep } from "@shared/progress";

/**
 * What Kinika is doing while the read-back is written: the function's own
 * steps, streamed as they happen (what you wrote, the website, the
 * conversation, the documents, the model, the check). A source that could
 * not be read says so on its line instead of disappearing. Past 45 seconds
 * the panel says it is slow, and past 90 offers to try again.
 */
export function ReadingPanel({ steps, startedAt, hasSources, onRetry, onStop }: {
  steps: ProgressStep[];
  startedAt: number;
  hasSources: boolean;
  onRetry: () => void;
  onStop: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 500);
    return () => clearInterval(t);
  }, [startedAt]);
  const slow = elapsed >= 45;
  const verySlow = elapsed >= 90;
  const leftOut = steps.filter((s) => s.status === "skipped");

  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-4 p-5 rounded-2xl border-2 border-primary bg-card">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="font-display text-[18px] inline-flex items-center gap-2.5"><Loader2 size={18} className="animate-spin text-primary" /> Kinika is reading</span>
        <span className="font-ui text-[12px] text-muted-foreground tabular-nums">{elapsed}s · usually {hasSources ? "20 to 60" : "10 to 30"} seconds</span>
      </div>
      <ProgressSteps steps={steps} placeholder="Reaching Kinika" />
      <p className="font-ui text-[13px] leading-relaxed text-muted-foreground max-w-[60ch]">
        {verySlow
          ? "This is taking much longer than usual. Kinika is still trying, but a busy model can hold it up."
          : slow
            ? "Taking a little longer than usual. A busy model does that; Kinika is still at it."
            : leftOut.length
              ? "A source that could not be read is left out of this read-back; everything else is in. You can fix the address and read again later from the plan."
              : "Each line of the read-back will say where it came from and how sure Kinika is. You will be able to fix any of it."}
      </p>
      {verySlow && (
        <div className="flex items-center gap-3 flex-wrap">
          <button type="button" onClick={onRetry} className="inline-flex items-center h-10 px-4 rounded-lg bg-primary text-primary-foreground font-ui text-[13px] font-medium">Start the read again</button>
          <button type="button" onClick={onStop} className="inline-flex items-center h-10 px-4 rounded-lg border border-border bg-card font-ui text-[13px]">Stop and go back</button>
        </div>
      )}
    </div>
  );
}
