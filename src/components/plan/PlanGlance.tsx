import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Bot, Check, Circle, ListChecks, UserRound, Wand2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { buildPlan, getPlan, nextTasks, planProgress, type FounderPlan } from "@/services/planService";

/**
 * A compact view of the plan for Home and Mentor: the current target, the
 * next few tasks, and a way to build one if none exists.
 */
export function PlanGlance({ brandId, variant = "card", refreshKey }: { brandId: string | null | undefined; variant?: "card" | "aside"; refreshKey?: unknown }) {
  const navigate = useNavigate();
  const [plan, setPlan] = useState<FounderPlan | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [building, setBuilding] = useState(false);

  useEffect(() => {
    if (!brandId) return;
    let active = true;
    getPlan(brandId).then((p) => { if (active) { setPlan(p); setLoaded(true); } });
    return () => { active = false; };
  }, [brandId, refreshKey]);

  if (!brandId || !loaded) return null;
  const aside = variant === "aside";
  const wrap = aside ? "px-4 py-4 border-t border-border/60" : "rounded-xl border border-card-border bg-card/40 p-5 md:p-6";

  if (!plan) {
    return (
      <div className={wrap}>
        <div className="flex items-center justify-between mb-2">
          <span className="font-ui text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Your plan</span>
        </div>
        <p className="font-ui text-[12px] text-muted-foreground">Kinika can turn what you have told it into the next targets and a checklist for each.</p>
        <button
          disabled={building}
          onClick={async () => { setBuilding(true); const r = await buildPlan(brandId); setBuilding(false); if (!r.success) { toast.error(r.error ?? "Could not write the plan"); return; } toast(`Plan ready: ${r.targets} targets`); navigate("/plan"); }}
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[12px] font-ui font-medium disabled:opacity-50"
        >{building ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />} Write my plan</button>
      </div>
    );
  }

  const current = plan.targets.find((t) => t.status === "current") ?? plan.targets[0];
  const next = nextTasks(plan, 3);
  const progress = planProgress(plan);
  return (
    <div className={wrap}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-ui text-[10px] uppercase tracking-[0.16em] text-muted-foreground inline-flex items-center gap-1.5"><ListChecks size={11} /> Your plan · {progress.done}/{progress.total}</span>
        <button onClick={() => navigate("/plan")} className="font-ui text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">Open <ArrowUpRight size={11} /></button>
      </div>
      {current && <p className={aside ? "font-display text-[14px] text-foreground" : "font-display text-[18px] text-foreground"}>{current.title}</p>}
      {next.length === 0 ? (
        <p className="font-ui text-[12px] text-muted-foreground mt-2">Everything on the plan is done. Revise it on the plan page.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {next.map(({ task }) => (
            <li key={task.id} className="flex items-start gap-2 font-ui text-[12px] text-foreground">
              {task.status === "done" ? <Check size={13} className="mt-0.5 text-primary" /> : <Circle size={13} className="mt-0.5 text-muted-foreground" />}
              <span className="min-w-0 flex-1 truncate">{task.title}</span>
              <span className="shrink-0 text-muted-foreground inline-flex items-center gap-1">{task.owner === "agent" ? <Bot size={11} /> : <UserRound size={11} />}{task.status === "doing" ? "in progress" : ""}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default PlanGlance;
