import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BusinessKind } from "@/services/understandingService";

/**
 * What Kinika is doing while the read-back is written. The function runs as
 * one call, so the steps below are what it reads in order, ticked on a
 * timer that matches how long each usually takes; the last step stays open
 * until the answer arrives. Past 45 seconds the panel says so, and past 90
 * offers the words-only route.
 */
const KIND_WORD: Record<BusinessKind, string> = { starting: "an idea", running: "a running business", creator: "a creator", other: "your business" };

export function ReadingPanel({ reading, kind, onUseWordsOnly, onStop }: {
  reading: { site: boolean; chat: boolean; documents: number; startedAt: number };
  kind: BusinessKind;
  onUseWordsOnly: () => void;
  onStop: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - reading.startedAt) / 1000)), 500);
    return () => clearInterval(t);
  }, [reading.startedAt]);

  const hasSources = reading.site || reading.chat || reading.documents > 0;
  // Each step: label, and the second it usually completes by.
  const steps: Array<{ label: string; doneBy: number }> = [
    { label: "Reading what you wrote", doneBy: 2 },
    ...(reading.site ? [{ label: "Reading your website", doneBy: 10 }] : []),
    ...(reading.chat ? [{ label: "Reading the conversation you shared", doneBy: 14 }] : []),
    ...(reading.documents ? [{ label: `Reading ${reading.documents} document${reading.documents === 1 ? "" : "s"}`, doneBy: 16 }] : []),
    { label: `Writing it back under headings that fit ${KIND_WORD[kind]}`, doneBy: Infinity },
  ];
  const slow = elapsed >= 45;
  const verySlow = elapsed >= 90;

  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-4 p-5 rounded-2xl border-2 border-primary bg-card">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="font-display text-[18px] inline-flex items-center gap-2.5"><Loader2 size={18} className="animate-spin text-primary" /> Kinika is reading</span>
        <span className="font-ui text-[12px] text-muted-foreground tabular-nums">{elapsed}s · usually {hasSources ? "20 to 60" : "10 to 30"} seconds</span>
      </div>
      <ol className="flex flex-col gap-2">
        {steps.map((st, i) => {
          const done = elapsed >= st.doneBy;
          const current = !done && (i === 0 || elapsed >= steps[i - 1].doneBy);
          return (
            <li key={st.label} className={cn("flex items-center gap-3 font-ui text-[14px]", done ? "text-muted-foreground" : current ? "text-foreground" : "text-muted-foreground/60")}>
              <span className={cn("w-5 h-5 rounded-full inline-flex items-center justify-center shrink-0 border", done ? "bg-[hsl(var(--brand-good-soft))] border-transparent text-[hsl(var(--brand-good))]" : current ? "border-primary" : "border-border")}>
                {done ? <Check size={12} /> : current ? <span className="w-2 h-2 rounded-full bg-primary animate-pulse" /> : null}
              </span>
              {st.label}
            </li>
          );
        })}
      </ol>
      <p className="font-ui text-[13px] leading-relaxed text-muted-foreground max-w-[60ch]">
        {verySlow
          ? "This is taking much longer than usual. Kinika is still trying, but a slow or very long website can hold it up."
          : slow
            ? "Taking a little longer than usual. A long website or a busy model does that; Kinika is still reading."
            : "Each line of the read-back will say where it came from and how sure Kinika is. You will be able to fix any of it."}
      </p>
      {verySlow && (
        <div className="flex items-center gap-3 flex-wrap">
          {hasSources && <button type="button" onClick={onUseWordsOnly} className="inline-flex items-center h-10 px-4 rounded-lg bg-primary text-primary-foreground font-ui text-[13px] font-medium">Use only what I wrote</button>}
          <button type="button" onClick={onStop} className="inline-flex items-center h-10 px-4 rounded-lg border border-border bg-card font-ui text-[13px]">Stop and go back</button>
        </div>
      )}
    </div>
  );
}
