import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useVisibleInterval } from "@/hooks/use-visible-interval";
import { listHires, listPendingApprovals, listRuns, type AgentHire, type Approval, type AutomationRun } from "@/services/agentService";
import { getEntitlements, effectiveLimit, type Entitlements } from "@/services/subscriptionService";

/**
 * Home's "Kinika's team" block: what waits for you first, then who is on
 * the team and what they are doing. On the trial it is one line with the
 * door to seats. Reads the same rows the team page reads; polls only while
 * something is running and the tab is visible.
 */
export function HomeTeam({ brandId }: { brandId: string | null | undefined }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [ent, setEnt] = useState<Entitlements | null>(null);
  const [hires, setHires] = useState<AgentHire[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [taskByRun, setTaskByRun] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  const load = async () => {
    if (!brandId || !user) return;
    const [e, h, a, r] = await Promise.all([
      getEntitlements(user.id).catch(() => null),
      listHires(brandId),
      listPendingApprovals(brandId),
      listRuns(brandId, 8),
    ]);
    setEnt(e); setHires(h); setApprovals(a); setRuns(r);
    const runIds = [...new Set([...a.map((x) => x.run_id), ...r.map((x) => x.id)])];
    if (runIds.length) {
      const { data } = await (supabase as any).from("plan_tasks").select("id, run_id").in("run_id", runIds);
      const map: Record<string, string> = {};
      for (const t of data ?? []) map[t.run_id] = t.id;
      setTaskByRun(map);
    }
    setLoaded(true);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setLoaded(false); load(); }, [brandId, user?.id]);
  const inFlight = runs.some((r) => r.status === "queued" || r.status === "running");
  useVisibleInterval(load, 15000, inFlight);

  if (!brandId || !loaded) return null;
  const seats = ent ? effectiveLimit(ent, "agents") : 0;
  const active = hires.filter((h) => h.status === "active");
  const openWork = (runId: string) => navigate(taskByRun[runId] ? `/work/${taskByRun[runId]}` : `/team?run=${runId}`);

  if (seats === 0 && active.length === 0) {
    return (
      <div className="rounded-xl border border-card-border bg-card/40 px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
        <p className="font-ui text-[13px] text-muted-foreground"><strong className="font-semibold text-foreground">Trial:</strong> Kinika plans and advises; you do the tasks. Seats let Kinika hire agents for the marked ones.</p>
        <button onClick={() => navigate("/billing")} className="font-ui text-[12px] text-accent-foreground underline whitespace-nowrap">Add seats</button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-card-border bg-card/40 p-5 md:p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="font-ui text-[10px] uppercase tracking-[0.16em] text-muted-foreground inline-flex items-center gap-1.5"><Users size={11} /> Kinika's team · {active.length}{seats > 0 ? ` of ${seats} seat${seats === 1 ? "" : "s"}` : ""}</span>
        <button onClick={() => navigate("/team")} className="font-ui text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">Open <ArrowUpRight size={11} /></button>
      </div>

      {approvals.length > 0 && (
        <ul className="flex flex-col gap-2">
          {approvals.slice(0, 3).map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-[hsl(var(--brand-needs-you))]/30 bg-[hsl(var(--brand-needs-you-soft))]/50 px-3 py-2.5">
              <div className="min-w-0">
                <p className="font-ui text-[13px] text-foreground truncate">{a.title}</p>
                <p className="font-ui text-[11px] text-muted-foreground">{a.run?.agent?.name ?? "Agent"} · waiting for your approval</p>
              </div>
              <button onClick={() => openWork(a.run_id)} className="shrink-0 h-8 px-3 rounded-md bg-primary text-primary-foreground font-ui text-[12px] font-medium">Review</button>
            </li>
          ))}
        </ul>
      )}

      {active.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {active.map((h) => {
            const run = runs.find((r) => r.agent_id === h.agent_id && (r.status === "queued" || r.status === "running"));
            const last = runs.find((r) => r.agent_id === h.agent_id && r.status === "completed");
            return (
              <li key={h.id} className="flex items-center justify-between gap-3 font-ui text-[13px]">
                <span><strong className="font-semibold">{h.agent.name}</strong>{h.hired_by === "kinika" ? " · hired by Kinika" : ""}</span>
                {run ? <button onClick={() => openWork(run.id)} className="text-[12px] text-accent-foreground underline">working · {run.name}</button>
                  : last ? <span className="text-[12px] text-muted-foreground">idle · last: {last.name}</span>
                  : <span className="text-[12px] text-muted-foreground">idle</span>}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="font-ui text-[13px] text-muted-foreground">No agents on the team yet. Kinika hires from your plan.</p>
      )}
      {approvals.length === 0 && active.length > 0 && <span className="font-ui text-[12px] text-muted-foreground">Nothing waiting for your approval.</span>}
    </div>
  );
}

export default HomeTeam;
