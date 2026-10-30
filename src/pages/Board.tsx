import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { WorkspaceSkeleton } from "@/components/ui/page-skeleton";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useVisibleInterval } from "@/hooks/use-visible-interval";
import { OutputView, StepLine } from "@/components/team/RunViews";
import { BoardSurface, boardCards, boardSentence, triggerLabel } from "@/components/work/BoardSurface";
import { getAutomation, listAutomationRuns, runAutomationNow, setAutomationStatus, type Automation, type AutomationRun } from "@/services/agentService";
import { tasksForRuns } from "@/services/planService";

/**
 * /board/:automationId — a standing task as a place of work. The sentence
 * across the top, the picture of named circles under it, Run once and the
 * activation switch, and a Logs tab of every run. Click a circle to see
 * what that step did last time and what it cost. Approvals for a run are
 * decided in that run's workspace.
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
  const [tab, setTab] = useState<"board" | "logs">("board");
  const [selected, setSelected] = useState<string | null>(null);
  const [openRun, setOpenRun] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [auto, rs] = await Promise.all([getAutomation(automationId), listAutomationRuns(automationId, 30)]);
    setA(auto); setRuns(rs); setLoaded(true);
    if (rs.length) setTaskByRun(await tasksForRuns(rs.map((r) => r.id)));
  }, [automationId]);
  useEffect(() => { setLoaded(false); load(); }, [load]);
  const latest = runs[0] ?? null;
  const inFlight = !!latest && (latest.status === "queued" || latest.status === "running");
  useVisibleInterval(load, 8000, inFlight);

  const cards = useMemo(() => (a ? boardCards(a, latest) : []), [a, latest]);
  const sentence = useMemo(() => (a ? boardSentence(a, cards) : ""), [a, cards]);

  if (!loaded) return <WorkspaceSkeleton />;
  if (!a) return <div className="p-8 font-ui text-[13px] text-muted-foreground">This board is not in a workspace you can open.</div>;

  const paused = a.status === "paused";
  const agentName = a.agent?.name ?? "Agent";
  const waitingCredits = runs.filter((r) => r.status === "waiting_credits").length;
  const status = paused ? "paused" : inFlight ? "working" : latest?.status === "waiting_approval" ? "waiting for your approval" : waitingCredits ? `${waitingCredits} run${waitingCredits === 1 ? "" : "s"} waiting for credits` : latest ? `last run ${new Date(latest.created_at).toLocaleDateString()}` : "has not run yet";
  const waiting = latest?.status === "waiting_approval" ? latest : null;
  const act = async (what: string, fn: () => Promise<unknown>) => { setBusy(what); await fn(); setBusy(null); await load(); };
  const openWork = (runId: string) => navigate(taskByRun[runId] ? `/work/${taskByRun[runId]}` : `/team?run=${runId}`);
  const selectedCard = cards.find((c) => c.key === selected) ?? null;
  const selectedStep = selectedCard?.stepIndex != null ? latest?.steps?.find((s) => s.step_index === selectedCard.stepIndex) ?? null : null;

  return (
    <div className="h-full flex flex-col bg-background">
      <header className="flex items-center justify-between gap-3 flex-wrap px-4 py-2.5 border-b border-border bg-card">
        <div className="flex items-center gap-2.5 min-w-0">
          <button onClick={() => navigate("/team")} className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-border bg-card" aria-label="Back to Kinika's team"><ArrowLeft size={15} /></button>
          <div className="flex items-center gap-2.5 pl-1.5 pr-2.5 py-1.5 rounded-lg border border-border bg-accent/60 min-w-0">
            <span aria-hidden className="w-7 h-7 rounded-md bg-primary text-primary-foreground inline-flex items-center justify-center font-ui text-[12px] font-semibold shrink-0">{agentName.slice(0, 1)}</span>
            <span className="flex flex-col leading-tight min-w-0">
              <span className="font-ui text-[13px] font-semibold truncate">{agentName} · on Kinika's team</span>
              <span className="font-ui text-[11px] text-accent-foreground truncate">{status}{latest ? ` · ${Number(latest.credits_captured ?? 0)} credits last run` : ""}</span>
            </span>
          </div>
        </div>
        <nav aria-label="Board views" className="hidden md:flex items-center gap-1 p-1 rounded-lg border border-border bg-card">
          <button onClick={() => setTab("board")} className={cn("h-7 px-2.5 inline-flex items-center rounded-md font-ui text-[12px]", tab === "board" ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground")}>Board</button>
          <button onClick={() => setTab("logs")} className={cn("h-7 px-2.5 inline-flex items-center rounded-md font-ui text-[12px]", tab === "logs" ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground")}>Logs · {runs.length}</button>
        </nav>
        <div className="flex items-center gap-3">
          <span className="font-ui text-[12px] text-muted-foreground hidden sm:inline">{triggerLabel(a)}</span>
          <label className="inline-flex items-center gap-2 font-ui text-[12px] cursor-pointer">
            <Switch checked={!paused} disabled={!!busy} onCheckedChange={(on) => act("toggle", () => setAutomationStatus(a.id, on ? "active" : "paused"))} aria-label={paused ? "Activate this board" : "Pause this board"} />
            <span className={paused ? "text-muted-foreground" : "text-foreground font-medium"}>{paused ? "Paused" : "Active"}</span>
          </label>
          {waiting && <button onClick={() => openWork(waiting.id)} className="h-8 px-3.5 inline-flex items-center rounded-lg bg-primary text-primary-foreground font-ui text-[12px] font-medium">Review the result</button>}
        </div>
      </header>

      <div className="flex-1 min-h-0 flex">
        <aside className="hidden lg:flex w-[260px] shrink-0 flex-col gap-5 p-4 border-r border-border bg-muted/40 overflow-y-auto">
          <div className="flex flex-col gap-1">
            <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Standing task</span>
            <span className="font-ui text-[13px] font-medium leading-snug">{a.name}</span>
            <span className="font-ui text-[11px] text-muted-foreground">{triggerLabel(a)} · {a.task_input.units ?? 1} {a.agent?.unit_label ?? "item"}{(a.task_input.units ?? 1) === 1 ? "" : "s"} a run</span>
          </div>
          {a.trigger_type === "watch" && (
            <div className="flex flex-col gap-1">
              <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Watching</span>
              <span className="font-ui text-[12px] leading-relaxed text-muted-foreground">{a.watch?.started_from ? <>Started from <span className="text-foreground">{a.watch.started_from.title}</span> ({new Date(a.watch.started_from.at).toLocaleString()}); only what arrived after it runs.</> : "Only what arrives from now on runs."} {a.last_watched_at ? `Last checked ${new Date(a.last_watched_at).toLocaleTimeString()}.` : ""}</span>
              {a.last_watch_error && <span className="font-ui text-[12px] text-destructive">Could not read: {a.last_watch_error}</span>}
            </div>
          )}
          <div className="flex flex-col gap-1">
            <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-muted-foreground">The brief</span>
            <span className="font-ui text-[12px] leading-relaxed text-muted-foreground whitespace-pre-wrap">{String(a.task_input.brief ?? "").slice(0, 400)}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Rules</span>
            <span className="font-ui text-[12px] leading-relaxed text-muted-foreground">{a.policy.approval === "review_first" ? "You approve every result before anything is used." : "Runs without a review step; only drafts, nothing is sent."} Up to {a.budget.credits_per_run} credits a run.</span>
          </div>
          <div className="mt-auto flex flex-col gap-1.5">
            <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Tell Kinika</span>
            <button onClick={() => navigate(`/mentor?describe=${encodeURIComponent(`Change the standing task "${a.name}": `)}`)} className="h-9 px-3 rounded-lg border border-border bg-card font-ui text-[13px] text-left text-muted-foreground">Also watch Facebook…</button>
          </div>
        </aside>

        {tab === "board" ? (
          <main className="flex-1 min-w-0 overflow-y-auto p-5 md:p-8">
            <p className="font-display text-[20px] md:text-[22px] leading-snug max-w-[70ch] text-foreground">{sentence}</p>
            <p className="font-ui text-[12px] text-muted-foreground mt-1.5 mb-7">This is the whole task. Click a step to see what it did last time. Changes come from Set up or from telling Kinika; the picture redraws.</p>
            <div className="rounded-2xl border border-border bg-[radial-gradient(hsl(var(--border))_1px,transparent_1px)] [background-size:20px_20px] p-6 md:p-8 overflow-x-auto">
              <BoardSurface automation={a} latest={latest} selected={selected} onSelect={(k) => setSelected(selected === k ? null : k)} />
            </div>
            <div className="mt-4 flex items-center gap-3 flex-wrap">
              <button disabled={!!busy || paused || !user} onClick={() => act("run", async () => { const r = await runAutomationNow(a, user!.id); if (!r.success) toast.error(r.error ?? "Could not start"); else { toast("Running once; follow it on the board"); setTab("board"); } })} className="h-10 px-4 inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground font-ui text-[13px] font-medium disabled:opacity-50">{busy === "run" ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Run once</button>
              <span className="font-ui text-[12px] text-muted-foreground">{paused ? "Switch the board on to run it." : "Runs the whole task now, once, on the current input; nothing is sent without your approval. Quoted up to " + a.budget.credits_per_run + " credits."}</span>
            </div>

            {selectedCard && (
              <section className="mt-6 max-w-[760px] rounded-xl border border-border bg-card p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className="font-ui text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{selectedCard.label} · {selectedCard.title} · {selectedCard.who}</span>
                  {selectedStep && <span className="font-ui text-[12px] text-muted-foreground">{selectedStep.status}{selectedStep.credits_captured ? ` · ${Number(selectedStep.credits_captured)} credits` : ""}{selectedStep.finished_at ? ` · ${new Date(selectedStep.finished_at).toLocaleString()}` : ""}</span>}
                </div>
                {selectedCard.kind === "when" && <p className="font-ui text-[13px] text-muted-foreground">{triggerLabel(a)}. {a.trigger_type === "schedule" ? "Kinika starts the task on this schedule while the board is on." : a.trigger_type === "webhook" ? "Another system starts the task by calling this board's webhook." : a.trigger_type === "event" ? "Something that happens in Kinika starts the task." : "You start the task with Run once."}</p>}
                {selectedCard.kind === "review" && <p className="font-ui text-[13px] text-muted-foreground">Every run stops here and waits for you. Approve keeps the result and lets the next step act; Send back for changes asks for another round; Stop ends the run. This step cannot be removed.</p>}
                {selectedCard.kind === "report" && <p className="font-ui text-[13px] text-muted-foreground">After each run, what was made and what you decided go into what Kinika knows about the business, so the next run starts from there.</p>}
                {selectedStep?.error && <p className="font-ui text-[13px] text-destructive">{selectedStep.error}</p>}
                {selectedStep?.output && Object.keys(selectedStep.output).length > 0 && <OutputView output={selectedStep.output} />}
                {(selectedCard.kind === "work" || selectedCard.kind === "act" || selectedCard.kind === "read") && !selectedStep && <p className="font-ui text-[13px] text-muted-foreground">This step has not run yet. Run once to see what it does.</p>}
              </section>
            )}

            {!selectedCard && latest?.output && (
              <section className="mt-6 max-w-[760px] rounded-xl border border-border bg-card p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-ui text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Latest result · {new Date(latest.created_at).toLocaleDateString()}</span>
                  <button onClick={() => openWork(latest.id)} className="font-ui text-[12px] text-accent-foreground underline">Open the work</button>
                </div>
                <OutputView output={latest.output} />
              </section>
            )}
          </main>
        ) : (
          <main className="flex-1 min-w-0 overflow-y-auto p-5 md:p-8">
            <p className="font-display text-[20px] leading-snug">Logs</p>
            <p className="font-ui text-[12px] text-muted-foreground mt-1 mb-5">Every run of this board, newest first: when, how it ended, what it cost, and each step.</p>
            {runs.length === 0 && <p className="font-ui text-[13px] text-muted-foreground">No runs yet. Run once to see the first.</p>}
            <ul className="flex flex-col gap-2 max-w-[760px]">
              {runs.map((r) => {
                const open = openRun === r.id;
                const tone = r.status === "completed" ? "text-[hsl(var(--brand-good))]" : r.status === "failed" ? "text-destructive" : r.status === "waiting_approval" ? "text-[hsl(var(--brand-needs-you))]" : "text-muted-foreground";
                return (
                  <li key={r.id} className="rounded-xl border border-border bg-card">
                    <button onClick={() => setOpenRun(open ? null : r.id)} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left">
                      <span className="font-ui text-[13px]">{new Date(r.created_at).toLocaleString()}</span>
                      <span className="flex items-center gap-3 font-ui text-[12px]">
                        <span className={tone}>{r.status.replace("_", " ")}</span>
                        <span className="text-muted-foreground">{Number(r.credits_captured ?? 0)} credits</span>
                        <span className="text-muted-foreground">{(r.steps ?? []).length} steps</span>
                      </span>
                    </button>
                    {open && (
                      <div className="px-4 pb-4 border-t border-border pt-3 flex flex-col gap-2">
                        <ul className="space-y-1">{(r.steps ?? []).map((s) => <StepLine key={s.id} step={s} />)}</ul>
                        {r.error && <p className="font-ui text-[12px] text-destructive">{r.error}</p>}
                        <button onClick={() => openWork(r.id)} className="self-start font-ui text-[12px] text-accent-foreground underline">Open the work</button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </main>
        )}
      </div>
    </div>
  );
}
