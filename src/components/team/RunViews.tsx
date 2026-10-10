import { Check, Clock, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { outputItems, type RunStep } from "@/services/agentService";

/** One step of a run: status icon, name, what it cost. Shared by the team page and the workspace. */
export function StepLine({ step }: { step: RunStep }) {
  const icon = step.status === "done" ? <Check size={12} className="text-[hsl(var(--brand-good))]" />
    : step.status === "running" ? <Loader2 size={12} className="animate-spin text-primary" />
    : step.status === "waiting" ? <Clock size={12} className="text-[hsl(var(--brand-needs-you))]" />
    : step.status === "failed" ? <X size={12} className="text-destructive" />
    : <span className="w-3 h-3 rounded-full border border-border inline-block" />;
  return (
    <li className="flex items-center gap-2 font-ui text-[12px]">
      {icon}
      <span className="text-foreground">{step.name}</span>
      {step.credits_captured > 0 && <span className="text-muted-foreground">· {Number(step.credits_captured)} credits</span>}
      {step.cost_usd > 0 && <span className="text-muted-foreground/70">· ${Number(step.cost_usd).toFixed(4)}</span>}
      {step.error && <span className="text-destructive truncate">· {step.error}</span>}
    </li>
  );
}

/** An agent's structured output, rendered read-only. */
export function OutputView({ output, compact = false }: { output: Record<string, unknown> | null; compact?: boolean }) {
  if (!output) return null;
  const o = output as any;
  const items = outputItems(output);
  const shown = compact ? items.slice(0, 2) : items;

  return (
    <div className={cn("space-y-3", compact && "mt-3")}>
      {typeof o.brief === "string" && <p className="font-ui text-[13px] text-foreground leading-relaxed">{o.brief}</p>}
      {o.visual_direction && typeof o.visual_direction === "object" && !compact && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 font-ui text-[12px]">
          {Object.entries(o.visual_direction).map(([k, v]) => (
            <div key={k}><dt className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</dt><dd className="text-foreground">{String(v)}</dd></div>
          ))}
        </dl>
      )}
      {Array.isArray(o.headlines) && (
        <ul className="font-ui text-[13px] text-foreground list-disc pl-5 space-y-0.5">
          {o.headlines.slice(0, compact ? 3 : 10).map((h: string, i: number) => <li key={i}>{h}</li>)}
        </ul>
      )}
      {shown.map((it, i) => (
        <div key={i} className="rounded-lg border border-border/60 bg-background/40 p-3">
          <div className="flex items-center gap-2 mb-1">
            {it.platform && <span className="font-ui text-[10px] uppercase tracking-wider text-muted-foreground">{it.platform}</span>}
            {it.title && <span className="font-ui text-[12px] text-foreground">{it.title}</span>}
          </div>
          <p className="font-ui text-[13px] text-foreground whitespace-pre-wrap">{it.body}</p>
          {it.hashtags?.length ? <p className="font-ui text-[11px] text-muted-foreground mt-1">{it.hashtags.map((h) => (h.startsWith("#") ? h : "#" + h)).join(" ")}</p> : null}
          {it.cta && <p className="font-ui text-[12px] text-primary mt-1">{it.cta}</p>}
        </div>
      ))}
      {compact && items.length > shown.length && <p className="font-ui text-[11px] text-muted-foreground">+ {items.length - shown.length} more</p>}
      {Array.isArray(o.findings) && !compact && (
        <div className="space-y-2">
          {o.findings.map((f: any, i: number) => (
            <div key={i} className="rounded-lg border border-border/60 bg-background/40 p-3">
              <p className="font-ui text-[13px] text-foreground font-medium">{f.heading} <span className="text-[10px] uppercase text-muted-foreground ml-1">{f.confidence} · {String(f.source ?? "").replace(/_/g, " ")}</span></p>
              <p className="font-ui text-[13px] text-foreground mt-1 whitespace-pre-wrap">{f.body}</p>
            </div>
          ))}
        </div>
      )}
      {Array.isArray(o.recommendations) && !compact && (
        <div><p className="font-ui text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1">Recommendations</p>
          <ul className="font-ui text-[13px] text-foreground list-disc pl-5 space-y-0.5">{o.recommendations.map((r: string, i: number) => <li key={i}>{r}</li>)}</ul></div>
      )}
      {Array.isArray(o.open_questions) && !compact && (
        <div><p className="font-ui text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1">To validate</p>
          <ul className="font-ui text-[13px] text-foreground list-disc pl-5 space-y-0.5">{o.open_questions.map((r: string, i: number) => <li key={i}>{r}</li>)}</ul></div>
      )}
      {typeof o.notes === "string" && o.notes && !compact && <p className="font-ui text-[12px] text-muted-foreground italic">{o.notes}</p>}
    </div>
  );
}
