import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, History, Link2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { WorkspaceSkeleton } from "@/components/ui/page-skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useVisibleInterval } from "@/hooks/use-visible-interval";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StepLine, OutputView } from "@/components/team/RunViews";
import { cancelRun, ensureStaffed } from "@/services/agentService";
import { ApprovalActions, roundOf } from "@/components/work/ApprovalActions";
import { RunRecovery } from "@/components/work/RunRecovery";
import { CreditWait } from "@/components/work/CreditWait";
import { ensureDocument, firstApprovalSeen, getWorkspace, markFirstApprovalSeen, runBodyMarkdown, saveDocumentBody, wantsCanvas, type Workspace } from "@/services/workspaceService";
import ContentStudioEditor from "@/pages/ContentStudioEditor";
import { FounderWorkspace } from "@/components/work/FounderWorkspace";

/**
 * /work/:taskId — a plan task as a place of work. One shell: who is working
 * (top-left), the surface's tools (top-centre), History and Approve
 * (top-right); the plan task, what Kinika is using and Tell Kinika in the
 * left rail. Surface for S4: the document. Approval happens here, nowhere else.
 */
export default function Work() {
  const { taskId = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [ws, setWs] = useState<Workspace | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [body, setBody] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [firstNote, setFirstNote] = useState(false);
  const [tab, setTab] = useState<number | null>(null);
  const bodyRef = useRef(body);
  bodyRef.current = body;

  const load = useCallback(async () => {
    const w = await getWorkspace(taskId);
    setWs(w);
    setLoaded(true);
    if (w && user && !w.brief) {
      const doc = w.document ?? (await ensureDocument(w, user.id));
      if (doc && !dirty) { setBody(doc.body_md ?? ""); setWs({ ...w, document: doc }); }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, user?.id]);

  useEffect(() => { setLoaded(false); setDirty(false); load(); }, [load]);

  // Follow a run that is still working; the tick does the work, this only looks.
  const inFlight = !!ws?.run && ["queued", "running"].includes(ws.run.status);
  useVisibleInterval(load, 8000, inFlight);

  // Save edits a moment after typing stops.
  useEffect(() => {
    if (!dirty || !ws?.document) return;
    const id = ws.document.id;
    const t = setTimeout(async () => {
      setSaving(true);
      const ok = await saveDocumentBody(id, bodyRef.current);
      setSaving(false);
      if (ok) setDirty(false); else toast.error("Could not save your edit");
    }, 900);
    return () => clearTimeout(t);
  }, [body, dirty, ws?.document]);

  const status = useMemo(() => {
    if (!ws) return "";
    const r = ws.run;
    if (!r) return "nothing made yet";
    if (ws.approval) return "waiting for your approval";
    if (r.status === "queued") return "starting";
    if (r.status === "running") { const cur = r.steps?.find((s) => s.status === "running") ?? r.steps?.[r.current_step]; return cur ? `working: ${cur.name.toLowerCase()}` : "working"; }
    if (r.status === "completed") return "done";
    if (r.status === "failed") return `stopped: ${r.error ?? "something went wrong"}`;
    if (r.status === "cancelled") return "sent back";
    if (r.status === "paused") return "paused, needs you";
    if (r.status === "waiting_credits") return "waiting for credits";
    return r.status;
  }, [ws]);

  const decided = async (d: "approved" | "revise" | "rejected") => {
    if (!user) return;
    if (dirty && ws?.document) await saveDocumentBody(ws.document.id, bodyRef.current);
    if (d === "approved" && !firstApprovalSeen(user.id)) { markFirstApprovalSeen(user.id); setFirstNote(true); }
    await load();
  };

  const takeOver = async () => {
    if (!ws?.run || !inFlight) return;
    if (!confirm("Stop the agent here and continue yourself? Credits already used stay used.")) return;
    setBusy("takeover");
    const ok = await cancelRun(ws.run.id);
    setBusy(null);
    if (!ok) toast.error("Could not stop the run");
    await load();
  };

  if (!loaded) return <WorkspaceSkeleton />;
  if (!ws) return <div className="p-8 font-ui text-[13px] text-muted-foreground">This task is not on a plan you can open.</div>;
  // A founder's own task is worked with Kinika: the conversation is the surface until a document exists.
  if (ws.task.owner !== "agent" && user) return <FounderWorkspace ws={ws} userId={user.id} reload={load} />;

  const { task, agent, run, approval, document, brief } = ws;
  const canvas = !!brief;
  const offerCanvas = !brief && !!run && run.status !== "queued" && run.status !== "running" && wantsCanvas(ws);
  // Tabs are outputs: a run whose several steps each produced something opens one tab per output.
  const outputSteps = (run?.steps ?? []).filter((st) => st.type === "agent_task" && st.output && Object.keys(st.output).length > 0 && !/self-review/i.test(st.name));
  const tabbed = outputSteps.length > 1;
  const activeStep = tabbed ? (outputSteps[tab ?? outputSteps.length - 1] ?? outputSteps[outputSteps.length - 1]) : null;
  const agentName = agent?.name ?? run?.agent?.name ?? "Agent";
  const credits = Number(run?.credits_captured ?? 0);
  const dnaLines = ws.using;

  return (
    <div className="h-full flex flex-col bg-background">
      {/* ── Shell header ── */}
      <header className="flex items-center justify-between gap-3 flex-wrap px-4 py-2.5 border-b border-border bg-card">
        <div className="flex items-center gap-2.5 min-w-0">
          <button onClick={() => navigate("/plan")} className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-border bg-card text-foreground" aria-label="Back to the plan"><ArrowLeft size={15} /></button>
          <div className="flex items-center gap-2.5 pl-1.5 pr-2.5 py-1.5 rounded-lg border border-border bg-accent/60 min-w-0">
            <span aria-hidden className="w-7 h-7 rounded-md bg-primary text-primary-foreground inline-flex items-center justify-center font-ui text-[12px] font-semibold shrink-0">{agentName.slice(0, 1)}</span>
            <span className="flex flex-col leading-tight min-w-0">
              <span className="font-ui text-[13px] font-semibold truncate">{task.owner === "agent" ? `${agentName} · on Kinika's team` : "You"}</span>
              <span className="font-ui text-[11px] text-accent-foreground truncate">{status}{run ? ` · ${credits} credits used` : ""}</span>
            </span>
            {inFlight && <button disabled={!!busy} onClick={takeOver} className="ml-1 h-7 px-2.5 rounded-md border border-border bg-card font-ui text-[12px] disabled:opacity-50">Take over</button>}
          </div>
        </div>
        <nav aria-label="Document tools" className="hidden md:flex items-center gap-1 p-1 rounded-lg border border-border bg-card">
          <span className="h-7 px-2.5 inline-flex items-center rounded-md font-ui text-[12px] text-muted-foreground">{canvas ? "Canvas" : "Document"}</span>
          {!canvas && <span className="h-7 px-2.5 inline-flex items-center rounded-md font-ui text-[12px] text-muted-foreground">{saving ? "Saving…" : dirty ? "Unsaved" : document?.body_edited_at ? "Your version" : "Kinika's version"}</span>}
        </nav>
        <div className="flex items-center gap-2">
          <button onClick={() => setHistoryOpen((v) => !v)} className={cn("h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-border font-ui text-[12px]", historyOpen ? "bg-accent text-accent-foreground" : "bg-card")}><History size={13} /> History</button>
          <button onClick={async () => { try { await navigator.clipboard.writeText(window.location.href); toast("Link copied"); } catch { toast.error("Could not copy"); } }} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-border bg-card font-ui text-[12px]"><Link2 size={13} /> Share</button>
          {approval && user && <ApprovalActions approvalId={approval.id} userId={user.id} agentName={agentName} round={roundOf(run?.steps)} onDecided={decided} compact kind={approval.kind} />}
        </div>
      </header>

      {tabbed && (
        <nav aria-label="Outputs" className="flex items-end gap-1 px-4 border-b border-border bg-card">
          {outputSteps.map((st, i) => {
            const cur = (tab ?? outputSteps.length - 1) === i;
            const who = st.name.includes(":") ? st.name.split(":")[0] : agentName;
            return (
              <button key={st.id} onClick={() => setTab(i)} aria-current={cur ? "page" : undefined} className={cn("inline-flex items-center gap-2 h-9 px-3.5 rounded-t-lg font-ui text-[13px] border -mb-px", cur ? "bg-background border-border border-b-background text-foreground font-medium" : "border-transparent text-muted-foreground")}>
                <span aria-hidden className={cn("w-2 h-2 rounded-full", st.status === "done" ? "bg-[hsl(var(--brand-good))]" : st.status === "waiting" ? "bg-[hsl(var(--brand-needs-you))]" : "bg-muted-foreground/40")} />
                {st.name.includes(":") ? st.name.split(":").slice(1).join(":").trim() : st.name}
                <span className="font-ui text-[11px] text-muted-foreground">{who}</span>
              </button>
            );
          })}
          <span className="ml-auto pb-2 font-ui text-[11px] text-muted-foreground">Tabs are this task's outputs. Kinika opened them.</span>
        </nav>
      )}

      <div className="flex-1 min-h-0 flex">
        {/* ── Left rail ── */}
        <aside className="hidden lg:flex w-[260px] shrink-0 flex-col gap-5 p-4 border-r border-border bg-muted/40 overflow-y-auto">
          <div className="flex flex-col gap-1">
            <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-muted-foreground">From your plan</span>
            <span className="font-ui text-[13px] font-medium leading-snug">{task.title}</span>
            <span className="font-ui text-[11px] text-muted-foreground">Target {task.target_position + 1} · {task.target_title} · <button onClick={() => navigate("/plan")} className="underline">open the plan</button></span>
          </div>
          {dnaLines.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-muted-foreground">What Kinika is using</span>
              <span className="font-ui text-[12px] leading-relaxed text-muted-foreground">{dnaLines.join(" · ")}</span>
            </div>
          )}
          {run?.automation_id && (
            <button onClick={() => navigate(`/board/${run.automation_id}`)} className="self-start font-ui text-[12px] text-accent-foreground underline">This is a standing task · open its board</button>
          )}
          {run && (
            <div className="flex flex-col gap-1.5">
              <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-muted-foreground">How {agentName} worked</span>
              <ul className="space-y-1">{(run.steps ?? []).map((s) => <StepLine key={s.id} step={s} />)}</ul>
            </div>
          )}
          {approval && (
            <div className="flex flex-col gap-1.5">
              <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-muted-foreground">This approval</span>
              <span className="font-ui text-[12px] leading-relaxed text-muted-foreground">Approving keeps {document?.body_edited_at ? "your version" : "the result"} and marks the task done. Sending it back for changes asks {agentName} for another round with your note. Stop ends the run; the {credits} credits already used stay used.</span>
            </div>
          )}
          <div className="mt-auto flex flex-col gap-1.5">
            <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Tell Kinika</span>
            <button onClick={() => navigate(`/mentor?task=${task.id}`)} className="h-9 px-3 rounded-lg border border-border bg-card font-ui text-[13px] text-left text-muted-foreground">Shorter. Lead with Tuesdays…</button>
          </div>
        </aside>

        {/* ── Surface ── */}
        {canvas && brief ? (
          <main className="flex-1 min-w-0 min-h-0 overflow-hidden">
            <ContentStudioEditor briefId={brief.id} onClose={() => navigate("/plan")} />
          </main>
        ) : (
        <main className="flex-1 min-w-0 overflow-y-auto p-4 md:p-8">
          {offerCanvas && (
            <div className="max-w-[720px] mx-auto mb-4 rounded-xl border border-primary/40 bg-accent/50 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
              <p className="font-ui text-[13px] text-foreground">This is a design. Open it on the canvas to see it as posts and visuals you can edit.</p>
              <button onClick={() => navigate(`/content-studio/new?fromRun=${run!.id}&task=${task.id}`)} className="h-9 px-3.5 rounded-lg bg-primary text-primary-foreground font-ui text-[12px] font-medium">Open on the canvas</button>
            </div>
          )}
          {firstNote && (
            <div role="status" className="max-w-[720px] mx-auto mb-5 rounded-xl border border-[hsl(var(--brand-good))]/40 bg-[hsl(var(--brand-good-soft))]/50 p-4 flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-[17px] text-foreground">That is how Kinika's team works.</p>
                <p className="font-ui text-[13px] text-muted-foreground mt-1 leading-relaxed">Kinika hires a role for a task; it reads your business, does the work and stops for your yes. Nothing goes out or gets changed without it. Kinika keeps what was learned, so the next task starts from here.</p>
              </div>
              <button onClick={() => setFirstNote(false)} className="text-muted-foreground" aria-label="Dismiss"><X size={14} /></button>
            </div>
          )}

          {!run && (
            <div className="max-w-[720px] mx-auto rounded-xl border border-border bg-card p-6 flex flex-col gap-3">
              <p className="font-display text-[20px]">Nothing has been made for this task yet.</p>
              <p className="font-ui text-[13px] text-muted-foreground leading-relaxed">{task.detail || "When an agent works on it, the result appears here and you approve it here."}</p>
              {task.owner === "agent" && <button onClick={async () => { if (!user || !task.agent_slug) return; const r = await ensureStaffed(task.brand_id, user.id, task.agent_slug); if (r.ok === true) navigate(`/board/new?task=${task.id}`); else toast.error(r.reason === "trial" ? `Kinika would run this with the ${r.agent?.name ?? "right agent"}; your trial has no seats yet.` : r.reason === "seats_busy" ? `Your seats are busy with ${r.busy.map((h) => h.agent.name).join(" and ")}. Pause one on Kinika's team, or add a seat.` : r.error ?? "Kinika could not staff this.", { action: { label: "Seats", onClick: () => navigate("/billing") } }); }} className="self-start h-10 px-4 rounded-lg bg-primary text-primary-foreground font-ui text-[13px] font-medium">Set up</button>}
            </div>
          )}

          {run && <div className="max-w-[720px] mx-auto mb-4 flex flex-col gap-3"><CreditWait run={run} onChanged={load} /><RunRecovery run={run} onChanged={load} /></div>}
          {run && approval?.kind === "decision" && approval.payload.decision && (
            <div className="max-w-[720px] mx-auto mb-4 rounded-xl border border-[hsl(var(--brand-needs-you))]/50 bg-[hsl(var(--brand-needs-you-soft))]/50 p-4 flex flex-col gap-1.5">
              <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--brand-needs-you))]">Kinika asks: {approval.payload.decision.question}</span>
              {approval.payload.decision.choice && <p className="font-ui text-[14px] text-foreground">Kinika read it as <strong>{approval.payload.decision.choice}</strong>{approval.payload.decision.why ? `: ${approval.payload.decision.why}` : "."}</p>}
              {approval.payload.decision.item && <p className="font-ui text-[13px] text-muted-foreground whitespace-pre-wrap">{String((approval.payload.decision.item as { title?: string }).title ?? "")}{(approval.payload.decision.item as { from?: string }).from ? ` · from ${(approval.payload.decision.item as { from?: string }).from}` : ""}{"\n"}{String((approval.payload.decision.item as { text?: string }).text ?? "").slice(0, 600)}</p>}
              <p className="font-ui text-[12px] text-muted-foreground">Run it, and {agentName} does the work for your approval. Skip this one, and nothing happens for it.</p>
            </div>
          )}
          {run && (
            <article className="max-w-[720px] mx-auto rounded-xl border border-border bg-card">
              <div className="px-6 pt-6 pb-3 border-b border-border flex flex-col gap-1">
                <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-accent-foreground">{approval ? (approval.kind === "decision" ? "Waiting for your decision" : "Waiting for your approval") : run.status === "completed" ? "Approved" : run.status === "paused" ? "Paused" : "Draft"} · {agentName}</span>
                <h1 className="font-display text-[24px] leading-tight">{run.name}</h1>
              </div>
              {tabbed && activeStep ? (
                <div className="px-6 py-5"><OutputView output={activeStep.output} /></div>
              ) : document ? (
                <Textarea value={body} onChange={(e) => { setBody(e.target.value); setDirty(true); }} rows={Math.max(12, body.split("\n").length + 2)}
                  className="w-full border-0 rounded-none rounded-b-xl bg-transparent px-6 py-5 font-ui text-[14px] leading-relaxed resize-none focus-visible:ring-0" aria-label="The document" />
              ) : runBodyMarkdown(run, approval) ? (
                <div className="px-6 py-5"><OutputView output={(approval?.payload?.output ?? run.output) as Record<string, unknown> | null} /></div>
              ) : (
                <p className="px-6 py-8 font-ui text-[13px] text-muted-foreground">{inFlight ? `${agentName} is working. This page follows along.` : "No result to show."}</p>
              )}
            </article>
          )}
          {document && <p className="max-w-[720px] mx-auto mt-2 font-ui text-[11px] text-muted-foreground">Edit any line. Your version is kept when {agentName} continues and is what approval keeps.</p>}
        </main>
        )}

        {/* ── History ── */}
        {historyOpen && (
          <aside className="w-[260px] shrink-0 flex flex-col gap-3 p-4 border-l border-border bg-card overflow-y-auto">
            <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-muted-foreground">History</span>
            {document?.body_edited_at && <p className="font-ui text-[12px] text-muted-foreground">You edited this {new Date(document.body_edited_at).toLocaleString()}.</p>}
            {run ? <ul className="space-y-1">{(run.steps ?? []).map((s) => <StepLine key={s.id} step={s} />)}</ul> : <p className="font-ui text-[12px] text-muted-foreground">No run yet.</p>}
            {run && <p className="font-ui text-[11px] text-muted-foreground">Started {run.started_at ? new Date(run.started_at).toLocaleString() : "—"}{run.finished_at ? ` · finished ${new Date(run.finished_at).toLocaleString()}` : ""}.</p>}
          </aside>
        )}
      </div>
    </div>
  );
}
