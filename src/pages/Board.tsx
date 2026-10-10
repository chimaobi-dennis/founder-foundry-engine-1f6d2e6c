import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Pause, Play, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useVisibleInterval } from "@/hooks/use-visible-interval";
import { OutputView, StepLine } from "@/components/team/RunViews";
import { BoardSurface, triggerLabel } from "@/components/work/BoardSurface";
import { getAutomation, listAutomationRuns, runAutomationNow, setAutomationStatus, type Automation, type AutomationRun } from "@/services/agentService";
import { tasksForRuns } from "@/services/planService";

/**
 * /board/:automationId — a standing task as a place of work. Same shell as
 * the document workspace; the surface is the board of steps with the latest
 * run's state, and the latest result beneath it. Approvals for a run on the
 * board are decided in that run's workspace.
 */
export default function Board() {
  const { automationId = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [a, setA] = useState<Automation | null>(null);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [taskByRun, setTaskByRun] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [auto, rs] = await Promise.all([getAutomation(automationId), listAutomationRuns(automationId)]);
    setA(auto); setRuns(rs); setLoaded(true);
    if (rs.length) setTaskByRun(await tasksForRuns(rs.map((r) => r.id)));
  }, [automationId]);
  useEffect(() => { setLoaded(false); load(); }, [load]);
  const latest = runs[0] ?? null;
  const inFlight = !!latest && (latest.status === "queued" || latest.status === "running");
  useVisibleInterval(load, 8000, inFlight);

  if (!loaded) return <div className="p-8"><Loader2 className="animate-spin text-muted-foreground" size={18} /></div>;
  if (!a) return <div className="p-8 font-ui text-[13px] text-muted-foreground">This board is not in a workspace you can open.</div>;

  const paused = a.status === "paused";
  const agentName = a.agent?.name ?? "Agent";
  const status = paused ? "paused" : inFlight ? "working" : latest?.status === "waiting_approval" ? "waiting for your approval" : latest ? `last run ${new Date(latest.created_at).toLocaleDateString()}` : "has not run yet";
  const waiting = latest?.status === "waiting_approval" ? latest : null;

  const act = async (what: string, fn: () => Promise<unknown>) => { setBusy(what); await fn(); setBusy(null); await load(); };

  return (
    <div className="h-full flex flex-col bg-background">
      <header className="flex items-center justify-between gap-3 flex-wrap px-4 py-2.5 border-b border-border bg-card">
        <div className="flex items-center gap-2.5 min-w-0">
          <button onClick={() => navigate("/team")} className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-border bg-card" aria-label="Back to Kinika's team"><ArrowLeft size={15} /></button>
          <div className="flex items-center gap-2.5 pl-1.5 pr-2.5 py-1.5 rounded-lg border border-border bg-accent/60 min-w-0">
            <span aria-hidden className="w-7 h-7 rounded-md bg-primary text-primary-foreground inline-flex items-center justify-center font-ui text-[12px] font-semibold shrink-0">{agentName.slice(0, 1)}</span>
            <span className="flex flex-col leading-tight min-w-0">
              <span className="font-ui text-[13px] font-semibold truncate">{agentName} · hired by Kinika</span>
              <span className="font-ui text-[11px] text-accent-foreground truncate">{status}{latest ? ` · ${Number(latest.credits_captured ?? 0)} credits last run` : ""}</span>
            </span>
          </div>
        </div>
        <nav aria-label="Board tools" className="hidden md:flex items-center gap-1 p-1 rounded-lg border border-border bg-card">
          <span className="h-7 px-2.5 inline-flex items-center rounded-md font-ui text-[12px] text-muted-foreground">Board</span>
          <button disabled={!!busy || paused || !user} onClick={() => act("run", async () => { const r = await runAutomationNow(a, user!.id); if (!r.success) toast.error(r.error ?? "Could not start"); else toast("Running now"); })} className="h-7 px-2.5 inline-flex items-center gap-1 rounded-md font-ui text-[12px] text-accent-foreground disabled:opacity-50">{busy === "run" ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Run now</button>
        </nav>
        <div className="flex items-center gap-2">
          <span className="font-ui text-[12px] text-muted-foreground">Runs · {runs.length}</span>
          <button disabled={!!busy} onClick={() => act("toggle", () => setAutomationStatus(a.id, paused ? "active" : "paused"))} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-border bg-card font-ui text-[12px] disabled:opacity-50">{paused ? <Play size={13} /> : <Pause size={13} />} {paused ? "Resume" : "Pause"}</button>
          {waiting && <button onClick={() => navigate(taskByRun[waiting.id] ? `/work/${taskByRun[waiting.id]}` : `/team?run=${waiting.id}`)} className="h-8 px-3.5 inline-flex items-center rounded-lg bg-primary text-primary-foreground font-ui text-[12px] font-medium">Review the result</button>}
        </div>
      </header>

      <div className="flex-1 min-h-0 flex">
        <aside className="hidden lg:flex w-[260px] shrink-0 flex-col gap-5 p-4 border-r border-border bg-muted/40 overflow-y-auto">
          <div className="flex flex-col gap-1">
            <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Standing task</span>
            <span className="font-ui text-[13px] font-medium leading-snug">{a.name}</span>
            <span className="font-ui text-[11px] text-muted-foreground">{triggerLabel(a)} · {a.task_input.units ?? 1} {a.agent?.unit_label ?? "item"}{(a.task_input.units ?? 1) === 1 ? "" : "s"} a run</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-muted-foreground">The brief</span>
            <span className="font-ui text-[12px] leading-relaxed text-muted-foreground whitespace-pre-wrap">{String(a.task_input.brief ?? "").slice(0, 400)}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Rules</span>
            <span className="font-ui text-[12px] leading-relaxed text-muted-foreground">{a.policy.approval === "review_first" ? "You review every result before anything is used." : "Runs without a review step; only drafts, nothing is sent."} Up to {a.budget.credits_per_run} credits a run.</span>
          </div>
          {latest && (
            <div className="flex flex-col gap-1.5">
              <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Last run · {new Date(latest.created_at).toLocaleDateString()}</span>
              <ul className="space-y-1">{(latest.steps ?? []).map((s) => <StepLine key={s.id} step={s} />)}</ul>
            </div>
          )}
          <div className="mt-auto flex flex-col gap-1.5">
            <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Tell Kinika</span>
            <button onClick={() => navigate(`/mentor?describe=${encodeURIComponent(`Change the standing task "${a.name}": `)}`)} className="h-9 px-3 rounded-lg border border-border bg-card font-ui text-[13px] text-left text-muted-foreground">Also watch Facebook…</button>
          </div>
        </aside>

        <main className="flex-1 min-w-0 overflow-y-auto p-5 md:p-8 bg-[radial-gradient(hsl(var(--border))_1px,transparent_1px)] [background-size:20px_20px]">
          <BoardSurface automation={a} latest={latest} />
          {latest?.output && (
            <section className="mt-7 max-w-[680px] rounded-xl border border-border bg-card p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-ui text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Latest result · {new Date(latest.created_at).toLocaleDateString()}</span>
                <button onClick={() => navigate(taskByRun[latest.id] ? `/work/${taskByRun[latest.id]}` : `/team?run=${latest.id}`)} className="font-ui text-[12px] text-accent-foreground underline">Open the work</button>
              </div>
              <OutputView output={latest.output} />
            </section>
          )}
          {runs.length > 1 && (
            <section className="mt-6 max-w-[680px] flex flex-col gap-2">
              <span className="font-ui text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Earlier runs</span>
              <ul className="flex flex-col gap-1.5">
                {runs.slice(1).map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 font-ui text-[12px]">
                    <span>{new Date(r.created_at).toLocaleString()} · {r.status.replace("_", " ")} · {Number(r.credits_captured ?? 0)} credits</span>
                    <button onClick={() => navigate(taskByRun[r.id] ? `/work/${taskByRun[r.id]}` : `/team?run=${r.id}`)} className="underline text-muted-foreground">open</button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <p className="mt-6 max-w-[680px] font-ui text-[11px] text-muted-foreground">The review step stays on this board: it acts on your behalf, so you always see results before they are used.</p>
        </main>
      </div>
    </div>
  );
}
