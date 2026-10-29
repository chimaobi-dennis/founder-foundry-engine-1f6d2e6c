import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Check, Link2, Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ProgressSteps } from "@/components/ui/progress-steps";
import { QuoteChip } from "@/components/billing/QuoteChip";
import { BoardPicture, boardSentence, draftBoardCards } from "@/components/work/BoardSurface";
import { useCreditBalance } from "@/hooks/use-credit-balance";
import { usePricingModal } from "@/contexts/PricingModalContext";
import { ensureStaffed, listAgents, type Agent } from "@/services/agentService";
import { listConnections, type ToolConnection } from "@/services/connectionService";
import { executeDraft, quoteDraft, type PlanDraft } from "@/services/plannerService";
import { delegateUrl, linkTaskToRun, planBoard, type PlanTask } from "@/services/planService";
import type { ProgressStep } from "@/services/narrated";
import type { Quote } from "@/services/pricingService";
import { applyDraftPatch, boardNeeds, type BoardNeed, type BoardQuestion } from "@shared/boardDraft";

/**
 * Set up, from a sentence. Pressing Set up on an agent task opens this:
 * Kinika proposes the board (the sentence and the named circles), names the
 * role, asks one question with chips only where the design forks, lists what
 * must be connected, and shows the cost. "Run once" creates exactly what is
 * on screen through the same path Describe it uses, links the task to the
 * run, and opens the work. Describe it stays one link away as the manual way.
 */
export function SetUpDialog({ task, brandId, userId, agents: givenAgents, open, onClose, onDone }: {
  task: PlanTask | null;
  brandId: string;
  userId: string;
  agents?: Agent[];
  open: boolean;
  onClose: () => void;
  /** After the run or board exists; the caller reloads the plan. */
  onDone?: () => Promise<void> | void;
}) {
  const navigate = useNavigate();
  const { balance, loading: balanceLoading, refresh: refetchBalance } = useCreditBalance();
  const { openPricingModal } = usePricingModal();
  const [agents, setAgents] = useState<Agent[]>(givenAgents ?? []);
  const [connections, setConnections] = useState<ToolConnection[]>([]);
  const [steps, setSteps] = useState<ProgressStep[]>([]);
  const [busy, setBusy] = useState<"plan" | "run" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const [question, setQuestion] = useState<BoardQuestion | null>(null);
  const [answered, setAnswered] = useState<number | null>(null);
  const [needs, setNeeds] = useState<BoardNeed[]>([]);
  const [role, setRole] = useState<{ slug: string; name: string } | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [note, setNote] = useState("");

  const plan = useCallback(async (taskId: string, withNote?: string) => {
    setBusy("plan"); setError(null); setSteps([]); setDraft(null); setQuestion(null); setAnswered(null); setQuote(null);
    const [ag, co, r] = await Promise.all([
      givenAgents?.length ? Promise.resolve(givenAgents) : listAgents(),
      listConnections(brandId),
      planBoard(brandId, taskId, withNote, setSteps),
    ]);
    setAgents(ag); setConnections(co);
    setBusy(null);
    if (!r.success || !r.draft) { setError(r.error ?? "Kinika could not design this yet."); return; }
    setDraft(r.draft); setQuestion(r.question ?? null); setRole(r.role ?? null);
    setNeeds(r.needs ?? boardNeeds(r.draft, [], co));
    try { setQuote(await quoteDraft(r.draft, ag, co)); } catch { setQuote(null); }
  }, [brandId, givenAgents]);

  useEffect(() => { if (open && task) plan(task.id); }, [open, task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = async (i: number) => {
    if (!draft || !question) return;
    const next = applyDraftPatch(draft, question.options[i].patch);
    setDraft(next); setAnswered(i);
    setNeeds(boardNeeds(next, needs.filter((n) => !n.required).map((n) => ({ provider: n.provider, why: n.why })), connections));
    try { setQuote(await quoteDraft(next, agents, connections)); } catch { /* keep the last quote */ }
  };

  const cards = useMemo(() => (draft ? draftBoardCards(draft, agents) : []), [draft, agents]);
  const sentence = useMemo(() => (draft ? boardSentence(null, cards) : ""), [draft, cards]);
  const missingRequired = needs.filter((n) => n.required && !n.connected);
  const insufficient = !balanceLoading && !!quote && quote.max > balance;
  const standing = !!draft && draft.schedule !== "once";
  const bySlug = useMemo(() => new Map(agents.map((a) => [a.slug, a])), [agents]);

  const run = async () => {
    if (!draft || !task) return;
    setBusy("run"); setError(null);
    // Staffing is Kinika's: every role on the draft joins the team if a seat is free.
    for (const slug of draft.agents) {
      const st = await ensureStaffed(brandId, userId, slug, { agents });
      if (st.ok === false) {
        setBusy(null);
        setError(st.reason === "trial" ? `Kinika would run this with the ${st.agent?.name ?? "right agent"}; your trial has no seats yet. Add a seat, or do this task with Kinika.` : st.reason === "seats_busy" ? `Every seat is busy with ${st.busy.map((h) => h.agent.name).join(" and ")}. Pause one on Kinika's team, or add a seat.` : st.error ?? "Kinika could not staff this.");
        return;
      }
      if (st.hired) toast(`${st.agent.name} is on Kinika's team for this`);
    }
    const r = await executeDraft(draft, brandId, userId, agents, connections);
    setBusy(null);
    if (!r.success) { setError(r.error ?? "Could not start."); return; }
    if (r.run?.id) await linkTaskToRun(task.id, r.run.id);
    refetchBalance();
    await onDone?.();
    onClose();
    if (r.automation?.id) navigate(`/board/${r.automation.id}`);
    else navigate(`/work/${task.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && busy !== "run") onClose(); }}>
      <DialogContent className="max-w-[860px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-[20px]">Set up: {task?.title}</DialogTitle>
          <DialogDescription className="font-ui text-[13px]">
            {role ? <>Kinika runs this with the <strong className="text-foreground">{role.name}</strong>{draft && draft.agents.length > 1 ? ` and the ${draft.agents.slice(1).map((s) => bySlug.get(s)?.name ?? s).join(", ")}` : ""}. Read the board, answer the question if there is one, and run it.</> : "Kinika is designing the board for this task."}
          </DialogDescription>
        </DialogHeader>

        {busy === "plan" && <ProgressSteps steps={steps} placeholder="Reaching Kinika" />}
        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5 font-ui text-[13px] text-destructive flex items-start justify-between gap-3 flex-wrap">
            <span>{error}</span>
            <span className="flex items-center gap-3">
              {task && !draft && <button onClick={() => plan(task.id, note || undefined)} className="underline">Try again</button>}
              {/trial|seat/i.test(error) && <button onClick={() => navigate("/billing")} className="underline">Seats</button>}
            </span>
          </div>
        )}

        {draft && (
          <div className="flex flex-col gap-5">
            <section className="rounded-xl border border-border bg-card p-4 flex flex-col gap-4">
              <p className="font-display text-[18px] leading-snug text-foreground">{sentence}</p>
              <div className="overflow-x-auto pb-1">
                <BoardPicture cards={cards} compact />
              </div>
              {draft.explanation && <p className="font-ui text-[13px] text-muted-foreground">{draft.explanation}</p>}
              {draft.warnings.map((w, i) => <p key={i} className="font-ui text-[12px] text-[hsl(var(--brand-needs-you))] flex items-start gap-1.5"><AlertTriangle size={12} className="mt-0.5 shrink-0" /> {w}</p>)}
            </section>

            {question && (
              <section className="flex flex-col gap-2">
                <p className="font-ui text-[13px] font-medium text-foreground">{question.text}</p>
                <div className="flex items-center gap-2 flex-wrap" role="radiogroup" aria-label={question.text}>
                  {question.options.map((o, i) => (
                    <button key={i} role="radio" aria-checked={answered === i} onClick={() => choose(i)} className={cn("h-9 px-3.5 rounded-full border font-ui text-[13px] inline-flex items-center gap-1.5", answered === i ? "bg-accent border-[hsl(var(--brand-blue-line))] text-accent-foreground font-medium" : "bg-card border-border text-foreground hover:border-primary/50")}>
                      {answered === i && <Check size={12} />}{o.label}
                    </button>
                  ))}
                </div>
                {answered === null && <p className="font-ui text-[12px] text-muted-foreground">Unanswered, Kinika goes with the first.</p>}
              </section>
            )}

            {needs.length > 0 && (
              <section className="flex flex-col gap-2">
                <p className="font-ui text-[11px] uppercase tracking-[0.16em] text-muted-foreground">What must be connected</p>
                <ul className="flex flex-col gap-1.5">
                  {needs.map((n) => (
                    <li key={n.provider} className="font-ui text-[13px] flex items-center justify-between gap-3 flex-wrap rounded-lg border border-border bg-card px-3 py-2">
                      <span className="flex items-center gap-2 min-w-0">
                        <Link2 size={13} className={n.connected ? "text-[hsl(var(--brand-good))]" : "text-muted-foreground"} />
                        <span className="font-medium">{n.name}</span>
                        <span className="text-muted-foreground truncate">{n.why}</span>
                      </span>
                      {n.connected ? <span className="text-[12px] text-[hsl(var(--brand-good))]">connected</span> : <button onClick={() => navigate("/team#connections")} className="text-[12px] underline text-accent-foreground">{n.required ? "Connect it to run this" : "Connect"}</button>}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="flex items-center gap-2">
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Tell Kinika what to change, e.g. 'make it five posts, LinkedIn only'" className="font-ui text-[13px]" onKeyDown={(e) => { if (e.key === "Enter" && note.trim() && task) plan(task.id, note.trim()); }} />
              <button disabled={!note.trim() || busy !== null} onClick={() => task && plan(task.id, note.trim())} className="h-10 px-3.5 rounded-lg border border-border bg-card font-ui text-[13px] whitespace-nowrap disabled:opacity-50">Redesign</button>
            </section>

            <footer className="flex items-center justify-between gap-3 flex-wrap border-t border-border pt-4">
              <div className="flex items-center gap-3 flex-wrap">
                {quote && <QuoteChip estimate={quote.estimate} max={quote.max} mode={quote.mode} balance={balance} balanceLoading={balanceLoading} retailUsd={quote.retailUsd} breakdown={quote.breakdown} onTopUp={() => openPricingModal({ currentBalance: balance })} />}
                <span className="font-ui text-[12px] text-muted-foreground">{draft.approval === "autonomous" ? "No review step" : "You approve before anything goes out"}</span>
              </div>
              <div className="flex items-center gap-3">
                {task && <button onClick={() => navigate(delegateUrl(task))} className="font-ui text-[12px] text-muted-foreground underline">Describe it yourself instead</button>}
                <button disabled={busy !== null || insufficient || missingRequired.length > 0} onClick={run} className="inline-flex items-center gap-1.5 h-11 px-5 rounded-lg bg-primary text-primary-foreground font-ui text-[14px] font-medium disabled:opacity-50">
                  {busy === "run" ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                  {insufficient ? "Top up to run" : missingRequired.length ? `Connect ${missingRequired[0].name} first` : standing ? "Set up and run once" : "Run once"}
                </button>
              </div>
            </footer>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default SetUpDialog;
