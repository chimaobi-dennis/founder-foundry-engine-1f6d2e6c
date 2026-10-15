import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, FileText, Link2, Loader2, MessageSquare, PanelRightClose, PanelRightOpen } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { TaskChat } from "@/components/work/TaskChat";
import { DeliverablesRail } from "@/components/work/DeliverablesRail";
import { DeliverableSheet } from "@/components/work/DeliverableSheet";
import { setTaskStatus, type Deliverable } from "@/services/planService";
import { breakdownTask, saveDeliverables, saveDocumentBody, type Workspace } from "@/services/workspaceService";

/**
 * A founder's own plan task, worked with Kinika. Kinika breaks the task into
 * deliverables, the conversation fills the surface, and the moment Kinika
 * writes something the document takes the surface and the conversation
 * slides to the side. The task is done when every deliverable is.
 */
export function FounderWorkspace({ ws, userId, reload }: { ws: Workspace; userId: string; reload: () => Promise<void> }) {
  const navigate = useNavigate();
  const [deliverables, setDeliverables] = useState<Deliverable[]>(ws.task.deliverables ?? []);
  const [breaking, setBreaking] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [document, setDocument] = useState(ws.document);
  const [body, setBody] = useState(ws.document?.body_md ?? "");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [view, setView] = useState<"document" | "chat">("document");
  const [completing, setCompleting] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [ask, setAsk] = useState<{ text: string; note: string; nonce: number } | null>(null);
  const bodyRef = useRef(body); bodyRef.current = body;
  const brokeRef = useRef(false);

  // The server applies replies (deliverables, documents); after a reload the workspace follows it.
  useEffect(() => { setDeliverables(ws.task.deliverables ?? []); }, [ws.task.deliverables]);
  useEffect(() => {
    if (!ws.document) return;
    if (!document) { setDocument(ws.document); setBody(ws.document.body_md ?? ""); setView("document"); setChatOpen(true); return; }
    if (ws.document.id === document.id && !dirty && ws.document.body_md !== document.body_md) { setDocument(ws.document); setBody(ws.document.body_md ?? ""); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws.document]);

  const allDone = deliverables.length > 0 && deliverables.every((d) => d.done);
  const taskDone = ws.task.status === "done";

  // Deliverables first: without them there is nothing to work towards.
  useEffect(() => {
    if (deliverables.length || brokeRef.current || taskDone) return;
    brokeRef.current = true;
    (async () => {
      setBreaking(true);
      const r = await breakdownTask(ws.task.brand_id, ws.task.id);
      setBreaking(false);
      if (r.success === false) { toast.error(r.error); brokeRef.current = false; return; }
      setDeliverables(r.deliverables);
    })();
  }, [deliverables.length, ws.task.brand_id, ws.task.id, taskDone]);

  useEffect(() => {
    if (!dirty || !document) return;
    const id = document.id;
    const t = setTimeout(async () => { setSaving(true); const ok = await saveDocumentBody(id, bodyRef.current); setSaving(false); if (ok) setDirty(false); else toast.error("Could not save your edit"); }, 900);
    return () => clearTimeout(t);
  }, [body, dirty, document]);

  const persist = useCallback(async (next: Deliverable[]) => {
    setDeliverables(next);
    if (!(await saveDeliverables(ws.task.id, next))) toast.error("Could not save the deliverables");
  }, [ws.task.id]);

  const toggle = async (d: Deliverable) => {
    setBusyId(d.id);
    await persist(deliverables.map((x) => x.id === d.id ? { ...x, done: !x.done, done_at: !x.done ? new Date().toISOString() : null } : x));
    setBusyId(null);
  };

  /** Open a deliverable: documents go to the document surface, everything else to the side sheet. */
  const openDeliverable = (d: Deliverable) => {
    if (d.kind === "document" && (d.document_id || document)) { setView("document"); return; }
    setOpenId(d.id);
  };
  const askKinika = (d: Deliverable) => {
    setOpenId(null);
    if (document && view === "document") setChatOpen(true); else setView("chat");
    const n = deliverables.findIndex((x) => x.id === d.id) + 1;
    setAsk({
      text: `Close deliverable D${n} ("${d.title}") now with its outcome in the STATE line, from what we have decided so far, and confirm in one line without mentioning any ids. If we have not decided enough, say what is missing instead and leave it open.`,
      note: `You asked Kinika to write down the outcome of "${d.title}".`,
      nonce: Date.now(),
    });
  };
  const saveResult = async (d: Deliverable, result: string) => {
    await persist(deliverables.map((x) => x.id === d.id ? { ...x, result: result || null } : x));
  };

  const complete = async () => {
    setCompleting(true);
    if (dirty && document) await saveDocumentBody(document.id, bodyRef.current);
    const ok = await setTaskStatus(ws.task, "done");
    setCompleting(false);
    if (!ok) { toast.error("Could not mark the task done"); return; }
    toast("Task done. It is ticked on your plan.");
    await reload();
    navigate("/plan");
  };

  const showDoc = !!document && view === "document";
  const chat = (
    <TaskChat ws={ws} deliverables={deliverables} onReplied={reload} compact={showDoc} ask={ask} />
  );

  return (
    <div className="h-full flex flex-col bg-background">
      <header className="flex items-center justify-between gap-3 flex-wrap px-4 py-2.5 border-b border-border bg-card">
        <div className="flex items-center gap-2.5 min-w-0">
          <button onClick={() => navigate("/plan")} className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-border bg-card text-foreground" aria-label="Back to the plan"><ArrowLeft size={15} /></button>
          <div className="flex items-center gap-2.5 pl-1.5 pr-2.5 py-1.5 rounded-lg border border-border bg-accent/60 min-w-0">
            <span aria-hidden className="w-7 h-7 rounded-md bg-primary text-primary-foreground inline-flex items-center justify-center font-ui text-[12px] font-semibold shrink-0">K</span>
            <span className="flex flex-col leading-tight min-w-0">
              <span className="font-ui text-[13px] font-semibold truncate">You, with Kinika</span>
              <span className="font-ui text-[11px] text-accent-foreground truncate">{taskDone ? "done" : breaking ? "breaking the task down" : allDone ? "every deliverable is done" : `${deliverables.filter((d) => d.done).length} of ${deliverables.length} deliverables`}</span>
            </span>
          </div>
        </div>
        <nav aria-label="Surface" className="hidden md:flex items-center gap-1 p-1 rounded-lg border border-border bg-card">
          {document && (
            <>
              <button onClick={() => setView("document")} className={cn("h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md font-ui text-[12px]", view === "document" ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground")}><FileText size={12} /> Document</button>
              <button onClick={() => setView("chat")} className={cn("h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md font-ui text-[12px]", view === "chat" ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground")}><MessageSquare size={12} /> Conversation</button>
            </>
          )}
          {!document && <span className="h-7 px-2.5 inline-flex items-center rounded-md font-ui text-[12px] text-muted-foreground">Conversation</span>}
          {document && view === "document" && <span className="h-7 px-2.5 inline-flex items-center rounded-md font-ui text-[12px] text-muted-foreground">{saving ? "Saving…" : dirty ? "Unsaved" : document.body_edited_at ? "Your version" : "Kinika's version"}</span>}
        </nav>
        <div className="flex items-center gap-2">
          {showDoc && <button onClick={() => setChatOpen((v) => !v)} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-border bg-card font-ui text-[12px]">{chatOpen ? <PanelRightClose size={13} /> : <PanelRightOpen size={13} />} {chatOpen ? "Hide Kinika" : "Show Kinika"}</button>}
          <button onClick={async () => { try { await navigator.clipboard.writeText(window.location.href); toast("Link copied"); } catch { toast.error("Could not copy"); } }} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-border bg-card font-ui text-[12px]"><Link2 size={13} /> Share</button>
          {!taskDone && (
            <button disabled={completing || !allDone} title={allDone ? "Tick the task on your plan" : "Every deliverable must be done first"} onClick={complete} className="h-8 px-3.5 inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground font-ui text-[12px] font-medium disabled:opacity-50">{completing ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Mark the task done</button>
          )}
        </div>
      </header>

      <div className="flex-1 min-h-0 flex">
        <aside className="hidden lg:flex w-[280px] shrink-0 flex-col gap-5 p-4 border-r border-border bg-muted/40 overflow-y-auto">
          <div className="flex flex-col gap-1">
            <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-muted-foreground">From your plan</span>
            <span className="font-ui text-[13px] font-medium leading-snug">{ws.task.title}</span>
            {ws.task.detail && <span className="font-ui text-[12px] text-muted-foreground leading-snug">{ws.task.detail}</span>}
            <span className="font-ui text-[11px] text-muted-foreground">Target {ws.task.target_position + 1} · {ws.task.target_title} · <button onClick={() => navigate("/plan")} className="underline">open the plan</button></span>
          </div>
          <DeliverablesRail deliverables={deliverables} breaking={breaking} busyId={busyId} onToggle={toggle} onOpen={openDeliverable} />
          {ws.using.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-muted-foreground">What Kinika is using</span>
              <span className="font-ui text-[12px] leading-relaxed text-muted-foreground">{ws.using.join(" · ")}</span>
            </div>
          )}
          <p className="mt-auto font-ui text-[11px] text-muted-foreground leading-relaxed">Kinika ticks a deliverable when you have decided or approved it and writes the outcome down. Click one to see it; you can tick or untick any yourself.</p>
        </aside>
        <DeliverableSheet deliverable={deliverables.find((d) => d.id === openId) ?? null} onClose={() => setOpenId(null)} onAskKinika={askKinika} onSaveResult={saveResult} onToggle={(d) => toggle(d)} />

        {showDoc ? (
          <>
            <main className="flex-1 min-w-0 overflow-y-auto p-4 md:p-8">
              <article className="max-w-[760px] mx-auto rounded-xl border border-border bg-card">
                <div className="px-6 pt-6 pb-3 border-b border-border flex flex-col gap-1">
                  <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-accent-foreground">Written with Kinika</span>
                  <h1 className="font-display text-[24px] leading-tight">{document!.name}</h1>
                </div>
                <Textarea value={body} onChange={(e) => { setBody(e.target.value); setDirty(true); }} rows={Math.max(14, body.split("\n").length + 2)} className="w-full border-0 rounded-none rounded-b-xl bg-transparent px-6 py-5 font-ui text-[14px] leading-relaxed resize-none focus-visible:ring-0" aria-label="The document" />
              </article>
              <p className="max-w-[760px] mx-auto mt-2 font-ui text-[11px] text-muted-foreground">Edit any line. Your version is what is kept.</p>
            </main>
            {chatOpen && <aside className="hidden md:flex w-[400px] shrink-0 flex-col border-l border-border bg-background min-h-0">{chat}</aside>}
          </>
        ) : (
          <main className="flex-1 min-w-0 min-h-0 flex flex-col">{chat}</main>
        )}
      </div>
    </div>
  );
}
