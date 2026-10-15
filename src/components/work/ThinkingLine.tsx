import { useEffect, useState } from "react";

/**
 * What Kinika is doing before the first token arrives. The phases are paced
 * by elapsed time, since one model call gives no real progress; the words
 * stay honest about that (they describe the work, not fake steps).
 */
const PHASES: Array<{ at: number; text: string }> = [
  { at: 0, text: "Reading your message" },
  { at: 2, text: "Thinking it through" },
  { at: 5, text: "Checking it against your business" },
  { at: 9, text: "Putting things together" },
  { at: 14, text: "Tying up loose ends" },
  { at: 22, text: "Nearly there" },
  { at: 40, text: "Taking longer than usual; still working" },
];

export function ThinkingLine({ startedAt, text }: { startedAt: number; text?: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed((Date.now() - startedAt) / 1000), 400);
    return () => clearInterval(t);
  }, [startedAt]);
  const phase = text ? { at: 0, text } : ([...PHASES].reverse().find((p) => elapsed >= p.at) ?? PHASES[0]);
  return (
    <span className="inline-flex items-center gap-2 font-ui text-[13px] text-muted-foreground" role="status" aria-live="polite">
      <span className="inline-flex gap-1" aria-hidden>
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" />
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:120ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:240ms]" />
      </span>
      <span key={phase.text} className="ed-fade-in">{phase.text}…</span>
    </span>
  );
}
