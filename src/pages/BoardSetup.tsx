import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Check, Link2, Loader2, Maximize2, Play, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { WorkspaceSkeleton } from "@/components/ui/page-skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ProgressSteps } from "@/components/ui/progress-steps";
import { QuoteChip } from "@/components/billing/QuoteChip";
import { BoardCanvas, fitCamera, type Camera } from "@/components/work/BoardCanvas";
import { BoardPicture, boardSentence, draftBoardCards, type BoardCard } from "@/components/work/BoardSurface";
import { useCreditBalance } from "@/hooks/use-credit-balance";
import { usePricingModal } from "@/contexts/PricingModalContext";
import { ensureStaffed, listAgents, type Agent } from "@/services/agentService";
import { listConnections, type ToolConnection } from "@/services/connectionService";
import { executeDraft, quoteDraft, type PlanDraft } from "@/services/plannerService";
import { delegateUrl, getTask, linkTaskToRun, planBoard, type PlanTask } from "@/services/planService";
import type { ProgressStep } from "@/services/narrated";
import type { Quote } from "@/services/pricingService";
import { applyDraftPatch, boardNeeds, type BoardNeed, type BoardQuestion } from "@shared/boardDraft";
import { ago, peekWatchSource, watchSourceFor, type WatchItem } from "@/services/watchService";
import { ON_FAILURE_WORDS } from "@shared/branching";

/**
 * /board/new?task=:id — Set up, in the board. Pressing Set up on an agent
 * task lands here: the board's own surface with Kinika's cursor on it and a
 * conversation beside it. Kinika designs the board in front of the founder:
 * the cursor moves, the circles appear, the sentence writes itself. The
 * founder changes it by telling Kinika; the board redraws. Run once (top
 * right, where Approve sits on other surfaces) creates exactly what is on
 * the sheet, links the task and opens the work or the standing board.
 * Nothing on the sheet is dragged: the layout is Kinika's.
 */

type Bubble =
  | { id: number; role: "you"; text: string }
  | { id: number; role: "kinika"; text?: string; steps?: ProgressStep[]; question?: BoardQuestion; needs?: BoardNeed[]; quote?: boolean; warnings?: string[]; start?: { item: WatchItem | null; count: number; noun: string; nouns: string; error?: string } };

const CARD_PITCH = 174; // card 150 + connector 24, as BoardPicture lays them out
const SHEET_PAD = 40;
const circleCentre = (i: number) => ({ x: SHEET_PAD + i * CARD_PITCH + 75, y: SHEET_PAD + 36 });

export default function BoardSetup() {
  const [params] = useSearchParams();
  const taskId = params.get("task") ?? "";
  const navigate = useNavigate();
  const { user } = useAuth();
  const { balance, loading: balanceLoading, refresh: refetchBalance } = useCreditBalance();
  const { openPricingModal } = usePricingModal();

  const [task, setTask] = useState<(PlanTask & { brand_id: string }) | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [connections, setConnections] = useState<ToolConnection[]>([]);
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const [needs, setNeeds] = useState<BoardNeed[]>([]);
  const [question, setQuestion] = useState<BoardQuestion | null>(null);
  const [answered, setAnswered] = useState<number | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [role, setRole] = useState<{ slug: string; name: string } | null>(null);
  const [busy, setBusy] = useState<"plan" | "run" | null>(null);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [input, setInput] = useState("");
  const [startFrom, setStartFrom] = useState<WatchItem | null>(null);
  const [startFromNow, setStartFromNow] = useState(false);
  const [camera, setCamera] = useState<Camera>({ x: 48, y: 48, scale: 1 });
  const [shown, setShown] = useState(0);
  const [cursor, setCursor] = useState<{ x: number; y: number; label: string; busy?: boolean }>({ x: 160, y: 120, label: "", busy: false });
  const sheetRef = useRef<HTMLDivElement>(null);
  const chatEnd = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
  const reveal = useRef<number | null>(null);

  type NewBubble = { role: "you"; text: string } | Omit<Extract<Bubble, { role: "kinika" }>, "id">;
  const say = useCallback((b: NewBubble) => { const id = nextId.current++; setBubbles((bs) => [...bs, { ...b, id } as Bubble]); return id; }, []);
  const patchBubble = useCallback((id: number, patch: Partial<Extract<Bubble, { role: "kinika" }>>) => setBubbles((bs) => bs.map((b) => (b.id === id && b.role === "kinika" ? { ...b, ...patch } : b))), []);

  const cards: BoardCard[] = useMemo(() => (draft ? draftBoardCards(draft, agents) : []), [draft, agents]);
  const sentence = useMemo(() => (draft && shown >= cards.length ? boardSentence(null, cards) : ""), [draft, cards, shown]);
  const bySlug = useMemo(() => new Map(agents.map((a) => [a.slug, a])), [agents]);

  /** Fit the sheet to the circles Kinika has drawn. */
  const fit = useCallback((n: number) => {
    const el = sheetRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    setCamera(fitCamera({ width: r.width, height: r.height }, { width: SHEET_PAD * 2 + Math.max(1, n) * CARD_PITCH, height: 300 }));
  }, []);

  /** Kinika places the circles one by one, cursor first, then the circle. */
  const draw = useCallback((all: BoardCard[]) => {
    if (reveal.current) window.clearInterval(reveal.current);
    setShown(0);
    fit(all.length);
    let i = 0;
    const step = () => {
      // Done placing: the cursor settles at the start of the sentence it is about to write.
      if (i >= all.length) { if (reveal.current) window.clearInterval(reveal.current); reveal.current = null; setCursor({ x: SHEET_PAD + 6, y: SHEET_PAD + 196, label: "", busy: false }); return; }
      const c = circleCentre(i);
      setCursor({ x: c.x + 12, y: c.y + 10, label: all[i].title, busy: false });
      const k = i;
      window.setTimeout(() => setShown((s) => Math.max(s, k + 1)), 380);
      i += 1;
    };
    step();
    reveal.current = window.setInterval(step, 620);
  }, [fit]);

  const plan = useCallback(async (t: PlanTask & { brand_id: string }, note?: string, ag?: Agent[], co?: ToolConnection[]) => {
    setBusy("plan");
    const id = say({ role: "kinika", steps: [] });
    setCursor((c) => ({ ...c, label: "reading the task", busy: true }));
    const r = await planBoard(t.brand_id, t.id, note, (steps) => {
      patchBubble(id, { steps });
      const doing = steps.find((s) => s.status === "doing");
      if (doing) setCursor((c) => ({ ...c, label: doing.label.toLowerCase(), busy: true }));
    });
    setBusy(null);
    if (!r.success || !r.draft) {
      patchBubble(id, { text: r.error ?? "Kinika could not design this yet." });
      setCursor((c) => ({ ...c, label: "", busy: false }));
      return;
    }
    const agentsNow = ag ?? agents, connNow = co ?? connections;
    setDraft(r.draft); setQuestion(r.question ?? null); setAnswered(null); setRole(r.role ?? null);
    const nd = r.needs ?? boardNeeds(r.draft, [], connNow);
    setNeeds(nd);
    patchBubble(id, { text: r.draft.explanation || `Here is the board for "${t.title}".`, warnings: r.draft.warnings });
    draw(draftBoardCards(r.draft, agentsNow));
    if (r.question) say({ role: "kinika", question: r.question });
    if (nd.length) say({ role: "kinika", needs: nd });
    setStartFrom(null); setStartFromNow(false);
    const src = r.draft.schedule === "watch" && r.draft.watch ? watchSourceFor(r.draft.watch.source) : null;
    if (src && r.draft.watch) {
      const pk = await peekWatchSource(t.brand_id, r.draft.watch.source, r.draft.watch.connection_id, r.draft.watch.options);
      if (pk.success) { setStartFrom(pk.latest ?? null); say({ role: "kinika", start: { item: pk.latest ?? null, count: pk.recentCount, noun: src.noun, nouns: src.nouns } }); }
      else say({ role: "kinika", start: { item: null, count: 0, noun: src.noun, nouns: src.nouns, error: pk.error } });
    }
    let q: Quote | null = null;
    try { q = await quoteDraft(r.draft, agentsNow, connNow); } catch { q = null; }
    setQuote(q);
    say({ role: "kinika", quote: true });
  }, [say, patchBubble, draw, agents, connections]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!taskId) { setLoaded(true); return; }
      const [t, ag] = await Promise.all([getTask(taskId), listAgents()]);
      if (!active) return;
      setTask(t); setAgents(ag); setLoaded(true);
      if (!t) return;
      const co = await listConnections(t.brand_id);
      if (!active) return;
      setConnections(co);
      say({ role: "kinika", text: `Setting up "${t.title}". Kinika designs the board here; tell Kinika anything to change and it redraws.` });
      plan(t, undefined, ag, co);
    })();
    return () => { active = false; if (reveal.current) window.clearInterval(reveal.current); };
  }, [taskId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [bubbles, shown]);

  const choose = async (i: number) => {
    if (!draft || !question) return;
    const next = applyDraftPatch(draft, question.options[i].patch);
    setDraft(next); setAnswered(i);
    setNeeds(boardNeeds(next, needs.filter((n) => !n.required).map((n) => ({ provider: n.provider, why: n.why })), connections));
    draw(draftBoardCards(next, agents));
    try { setQuote(await quoteDraft(next, agents, connections)); } catch { /* keep the last quote */ }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || !task || busy) return;
    setInput("");
    say({ role: "you", text });
    await plan(task, text);
  };

  const missingRequired = needs.filter((n) => n.required && !n.connected);
  const insufficient = !balanceLoading && !!quote && quote.max > balance;
  const standing = !!draft && draft.schedule !== "once";
  const canRun = !!draft && !busy && shown >= cards.length && !insufficient && missingRequired.length === 0;

  const run = async () => {
    if (!draft || !task || !user) return;
    setBusy("run");
    for (const slug of draft.agents) {
      const st = await ensureStaffed(task.brand_id, user.id, slug, { agents });
      if (st.ok === false) {
        setBusy(null);
        say({ role: "kinika", text: st.reason === "trial" ? `Kinika would run this with the ${st.agent?.name ?? "right agent"}; your trial has no seats yet. Add a seat, or do this task with Kinika.` : st.reason === "seats_busy" ? `Every seat is busy with ${st.busy.map((h) => h.agent.name).join(" and ")}. Pause one on Kinika's team, or add a seat.` : st.error ?? "Kinika could not staff this." });
        return;
      }
      if (st.hired) toast(`${st.agent.name} is on Kinika's team for this`);
    }
    const r = await executeDraft(draft, task.brand_id, user.id, agents, connections, startFromNow ? null : startFrom);
    setBusy(null);
    if (!r.success) { say({ role: "kinika", text: r.error ?? "Could not start." }); return; }
    if (r.run?.id) await linkTaskToRun(task.id, r.run.id);
    refetchBalance();
    navigate(r.automation?.id ? `/board/${r.automation.id}` : `/work/${task.id}`);
  };

  if (!loaded) return <WorkspaceSkeleton />;
  if (!task) return <div className="p-8 font-ui text-[13px] text-muted-foreground">This task is not in a workspace you can open.</div>;

  const leadName = role?.name ?? (task.agent_slug ? bySlug.get(task.agent_slug)?.name : null) ?? "Kinika";
  const status = busy === "plan" ? "designing the board" : busy === "run" ? "starting" : draft ? (shown < cards.length ? "drawing" : "ready to run") : "";

  return (
    <div className="h-full flex flex-col bg-background">
      <header className="flex items-center justify-between gap-3 flex-wrap px-4 py-2.5 border-b border-border bg-card">
        <div className="flex items-center gap-2.5 min-w-0">
          <button onClick={() => navigate("/plan")} className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-border bg-card" aria-label="Back to the plan"><ArrowLeft size={15} /></button>
          <div className="flex items-center gap-2.5 pl-1.5 pr-2.5 py-1.5 rounded-lg border border-border bg-accent/60 min-w-0">
            <span aria-hidden className="w-7 h-7 rounded-md bg-primary text-primary-foreground inline-flex items-center justify-center font-ui text-[12px] font-semibold shrink-0">K</span>
            <span className="flex flex-col leading-tight min-w-0">
              <span className="font-ui text-[13px] font-semibold truncate">Kinika · setting up: {task.title}</span>
              <span className="font-ui text-[11px] text-accent-foreground truncate">with the {leadName}{draft && draft.agents.length > 1 ? ` and the ${draft.agents.slice(1).map((s) => bySlug.get(s)?.name ?? s).join(", ")}` : ""}{status ? ` · ${status}` : ""}</span>
            </span>
          </div>
        </div>
        <nav aria-label="Board tools" className="hidden md:flex items-center gap-1 p-1 rounded-lg border border-border bg-card">
          <span className="h-7 px-2.5 inline-flex items-center rounded-md font-ui text-[12px] text-muted-foreground">Board</span>
          <button onClick={() => fit(cards.length || 1)} className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md font-ui text-[12px] text-foreground hover:bg-accent" title="Fit the board to the window"><Maximize2 size={12} /> Fit</button>
        </nav>
        <div className="flex items-center gap-2">
          {quote && <QuoteChip estimate={quote.estimate} max={quote.max} mode={quote.mode} balance={balance} balanceLoading={balanceLoading} retailUsd={quote.retailUsd} breakdown={quote.breakdown} onTopUp={() => openPricingModal({ currentBalance: balance })} />}
          <button disabled={!canRun} onClick={run} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-primary-foreground font-ui text-[13px] font-medium disabled:opacity-50">
            {busy === "run" ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            {insufficient ? "Top up to run" : missingRequired.length ? `Connect ${missingRequired[0].name} first` : draft?.schedule === "watch" ? (startFrom && !startFromNow ? "Start from the last one" : "Start watching") : standing ? "Set up and run once" : "Run once"}
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 flex">
        {/* ── The sheet ── */}
        <div ref={sheetRef} className="flex-1 min-w-0 relative">
          <BoardCanvas camera={camera} onCamera={setCamera} cursor={cursor}>
            <div style={{ padding: SHEET_PAD, minWidth: SHEET_PAD * 2 + Math.max(1, cards.length) * CARD_PITCH }}>
              {cards.length > 0 ? <BoardPicture cards={cards.slice(0, shown)} /> : <div className="w-[150px] h-[72px]" />}
              {sentence && <p className="mt-6 font-display text-[20px] leading-snug text-foreground max-w-[70ch] animate-in fade-in duration-500">{sentence}</p>}
            </div>
          </BoardCanvas>
          <p className="absolute left-4 bottom-3 font-ui text-[11px] text-muted-foreground pointer-events-none">Drag to pan · ⌘ and scroll to zoom · Kinika places the circles; tell Kinika to change them</p>
        </div>

        {/* ── Tell Kinika ── */}
        <aside className="hidden md:flex w-[400px] shrink-0 flex-col border-l border-border bg-background min-h-0">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
            <span className="font-ui text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Tell Kinika</span>
            <button onClick={() => navigate(delegateUrl(task))} className="font-ui text-[11px] text-muted-foreground underline">Describe it yourself instead</button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 flex flex-col gap-3">
            {bubbles.map((b) => b.role === "you" ? (
              <div key={b.id} className="self-end max-w-[85%] rounded-2xl rounded-br-md px-4 py-3 bg-primary text-primary-foreground font-ui text-[14px] leading-relaxed whitespace-pre-wrap">{b.text}</div>
            ) : (
              <div key={b.id} className="self-start max-w-[92%] rounded-2xl rounded-bl-md px-4 py-3 bg-card border border-border font-ui text-[14px] leading-relaxed flex flex-col gap-2">
                <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-accent-foreground">Kinika</span>
                {b.steps && !b.text && <ProgressSteps steps={b.steps} compact placeholder="Reaching Kinika" />}
                {b.text && <p>{b.text}</p>}
                {b.warnings?.map((w, i) => <p key={i} className="font-ui text-[12px] text-[hsl(var(--brand-needs-you))] flex items-start gap-1.5"><AlertTriangle size={12} className="mt-0.5 shrink-0" /> {w}</p>)}
                {b.question && (
                  <div className="flex flex-col gap-2">
                    <p className="font-medium">{b.question.text}</p>
                    <div className="flex items-center gap-2 flex-wrap" role="radiogroup" aria-label={b.question.text}>
                      {b.question.options.map((o, i) => (
                        <button key={i} role="radio" aria-checked={answered === i} disabled={!!busy} onClick={() => choose(i)} className={cn("h-8 px-3 rounded-full border font-ui text-[13px] inline-flex items-center gap-1.5", answered === i ? "bg-accent border-[hsl(var(--brand-blue-line))] text-accent-foreground font-medium" : "bg-card border-border hover:border-primary/50")}>
                          {answered === i && <Check size={12} />}{o.label}
                        </button>
                      ))}
                    </div>
                    {answered === null && <p className="font-ui text-[12px] text-muted-foreground">Unanswered, Kinika goes with the first.</p>}
                  </div>
                )}
                {b.needs && (
                  <div className="flex flex-col gap-1.5">
                    <p className="font-medium">What must be connected</p>
                    {b.needs.map((n) => (
                      <div key={n.provider} className="flex items-center justify-between gap-3 flex-wrap font-ui text-[13px]">
                        <span className="flex items-center gap-2 min-w-0"><Link2 size={13} className={n.connected ? "text-[hsl(var(--brand-good))]" : "text-muted-foreground"} /><span className="font-medium">{n.name}</span><span className="text-muted-foreground truncate">{n.why}</span></span>
                        {n.connected ? <span className="text-[12px] text-[hsl(var(--brand-good))]">connected</span> : <button onClick={() => navigate("/team#connections")} className="text-[12px] underline text-accent-foreground">{n.required ? "Connect it to run this" : "Connect"}</button>}
                      </div>
                    ))}
                  </div>
                )}
                {b.start && (
                  <div className="flex flex-col gap-2">
                    {b.start.error ? (
                      <p className="font-ui text-[13px] text-destructive flex items-start gap-1.5"><AlertTriangle size={12} className="mt-0.5 shrink-0" /> Kinika could not read the connection: {b.start.error}</p>
                    ) : b.start.item ? (
                      <>
                        <p className="font-medium">Start from the last real {b.start.noun}?</p>
                        <p className="font-ui text-[13px] text-foreground"><span className="font-medium">{b.start.item.title}</span> <span className="text-muted-foreground">· from {b.start.item.from} · {ago(b.start.item.at)}</span></p>
                        <p className="font-ui text-[12px] text-muted-foreground">{b.start.count} {b.start.count === 1 ? b.start.noun : b.start.nouns} arrived in the last week. The first run works on this one; after it, only what is new runs.</p>
                        <div className="flex items-center gap-2 flex-wrap" role="radiogroup" aria-label="Start from">
                          <button role="radio" aria-checked={!startFromNow} onClick={() => setStartFromNow(false)} className={cn("h-8 px-3 rounded-full border font-ui text-[13px] inline-flex items-center gap-1.5", !startFromNow ? "bg-accent border-[hsl(var(--brand-blue-line))] text-accent-foreground font-medium" : "bg-card border-border hover:border-primary/50")}>{!startFromNow && <Check size={12} />}Start from this one</button>
                          <button role="radio" aria-checked={startFromNow} onClick={() => setStartFromNow(true)} className={cn("h-8 px-3 rounded-full border font-ui text-[13px] inline-flex items-center gap-1.5", startFromNow ? "bg-accent border-[hsl(var(--brand-blue-line))] text-accent-foreground font-medium" : "bg-card border-border hover:border-primary/50")}>{startFromNow && <Check size={12} />}Only what arrives from now</button>
                        </div>
                      </>
                    ) : (
                      <p className="font-ui text-[13px]">Nothing has arrived there yet. The board runs on the first {b.start.noun} that does.</p>
                    )}
                  </div>
                )}
                {b.quote && (
                  <p className="font-ui text-[13px] text-muted-foreground">{quote ? `About ${quote.estimate} credits, up to ${quote.max}; ${Math.max(0, balance - quote.max)} after.` : "No price yet."} {draft?.approval === "autonomous" ? "No review step." : "You approve before anything goes out."} If a step fails, Kinika will {ON_FAILURE_WORDS[draft?.on_failure ?? "ask"]}. {draft?.schedule === "watch" ? "Start watching" : standing ? "Set up and run once" : "Run once"} is top right when you are ready.</p>
                )}
              </div>
            ))}
            <div ref={chatEnd} />
          </div>
          <div className="p-3 border-t border-border flex items-end gap-2">
            <Textarea value={input} onChange={(e) => setInput(e.target.value)} rows={2} placeholder="Tell Kinika what to change, e.g. 'make it five posts, LinkedIn only, every week'" className="font-ui text-[13px] resize-none" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
            <button disabled={!input.trim() || !!busy} onClick={send} className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50" aria-label="Tell Kinika"><Send size={15} /></button>
          </div>
        </aside>
      </div>
    </div>
  );
}
