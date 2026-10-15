import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, SendHorizonal } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/ui/markdown";
import { Skeleton } from "@/components/ui/skeleton";
import { ThinkingLine } from "@/components/work/ThinkingLine";
import { getBrandDNA } from "@/services/brandService";
import { getMentorAIResponse, getMessages, getOrCreateTaskConversation, saveMessage, visibleWhileStreaming, type MentorMessage, type ReplyOption, type TaskChatContext } from "@/services/mentorService";
import type { Deliverable } from "@/services/planService";
import type { Workspace } from "@/services/workspaceService";

/**
 * Kinika working one plan task with the founder. Every reply may mark
 * deliverables done or write a document; the workspace owns both and is told
 * through the callbacks. The first turn is Kinika's: it opens the task.
 */
export function TaskChat({ ws, userId, brand, deliverables, onDeliverablesDone, onDocument, compact = false, ask }: {
  ws: Workspace;
  userId: string;
  brand: { id: string; name: string; journey_stage?: string | null; context_source?: string | null } & Record<string, unknown>;
  deliverables: Deliverable[];
  onDeliverablesDone: (done: { id: string; result: string | null }[]) => Promise<void>;
  onDocument: (doc: { title: string; body: string }) => Promise<void>;
  compact?: boolean;
  /** An instruction the workspace sends on the founder's behalf (new nonce each time); shown as a note, not as the founder's words. */
  ask?: { text: string; note: string; nonce: number } | null;
}) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MentorMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [notes, setNotes] = useState<{ id: string; afterIndex: number; text: string }[]>([]);
  // For the latest reply only: the choices Kinika offered and three things the founder might say next.
  const [followups, setFollowups] = useState<{ options: ReplyOption[]; suggestions: string[] }>({ options: [], suggestions: [] });
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const openedRef = useRef(false);

  const ctx = useCallback((): TaskChatContext => ({
    task: { id: ws.task.id, title: ws.task.title, detail: ws.task.detail, target_title: ws.task.target_title },
    deliverables: deliverables.map((d) => ({ id: d.id, title: d.title, detail: d.detail, kind: d.kind, done: d.done })),
  }), [ws.task, deliverables]);

  /** One turn: history + the founder's message (or Kinika's opening) → reply, tags handled, both saved. */
  const turn = useCallback(async (userText: string, saveUser: boolean) => {
    if (!conversationId) return;
    setBusy(true);
    setFollowups({ options: [], suggestions: [] });
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    // The founder's message is on screen before Kinika's bubble appears; the save catches up.
    if (saveUser) {
      const tempId = `temp-${Date.now()}`;
      setMessages((m) => [...m, { id: tempId, conversation_id: conversationId, role: "user", content: userText, created_at: new Date().toISOString() } as MentorMessage]);
      saveMessage(conversationId, "user", userText).then((saved) => { if (saved) setMessages((m) => m.map((x) => x.id === tempId ? saved : x)); });
    }
    setStartedAt(Date.now());
    setStreaming("");
    const dna = await getBrandDNA(brand.id).catch(() => null);
    const r = await getMentorAIResponse(userId, brand, dna, history, userText, (t) => setStreaming((s) => (s ?? "") + t), undefined, ctx());
    setStreaming(null);
    if (!r) { setBusy(false); toast.error("Kinika did not answer. Try again."); return; }
    const saved = await saveMessage(conversationId, "assistant", r.text);
    if (saved) setMessages((m) => [...m, saved]);
    setFollowups({ options: r.options ?? [], suggestions: r.suggestions ?? [] });
    if (r.taskDocument) await onDocument(r.taskDocument);
    if (r.deliverablesDone?.length) await onDeliverablesDone(r.deliverablesDone);
    setBusy(false);
  }, [conversationId, messages, brand, userId, ctx, onDocument, onDeliverablesDone]);

  useEffect(() => {
    let active = true;
    (async () => {
      const c = await getOrCreateTaskConversation(ws.task.brand_id, ws.task.id);
      if (!active || !c) return;
      setConversationId(c.id);
      const ms = await getMessages(c.id);
      if (!active) return;
      setMessages(ms);
      setReady(true);
    })();
    return () => { active = false; };
  }, [ws.task.id, ws.task.brand_id]);

  // Kinika opens the task once the deliverables exist and nothing has been said yet.
  useEffect(() => {
    if (!ready || !conversationId || openedRef.current || messages.length > 0 || deliverables.length === 0) return;
    openedRef.current = true;
    turn("Open this task: in three short lines say how we will work through the deliverables, then ask the first question for the first open deliverable.", false);
  }, [ready, conversationId, messages.length, deliverables.length, turn]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [messages, streaming]);

  const askedRef = useRef<number>(0);
  useEffect(() => {
    if (!ask || ask.nonce === askedRef.current || !ready || busy) return;
    askedRef.current = ask.nonce;
    setNotes((n) => [...n, { id: String(ask.nonce), afterIndex: messages.length, text: ask.note }]);
    turn(ask.text, false);
  }, [ask, ready, busy, turn, messages.length]);

  const send = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    await turn(text, true);
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className={cn("flex-1 min-h-0 overflow-y-auto", compact ? "px-4 py-4" : "px-4 md:px-8 py-6")}>
        <div className={cn("mx-auto flex flex-col gap-4", compact ? "" : "max-w-[760px]")}>
          {!ready && (
            <div className="flex flex-col gap-4" aria-busy="true" aria-label="Opening the conversation">
              <Skeleton className="h-16 w-3/4 rounded-2xl" />
              <Skeleton className="h-10 w-1/2 rounded-2xl self-end" />
              <Skeleton className="h-20 w-4/5 rounded-2xl" />
            </div>
          )}
          {messages.map((m, i) => (
            <div key={m.id} className="contents">
            {notes.filter((n) => n.afterIndex === i).map((n) => <p key={n.id} className="text-center font-ui text-[11px] text-muted-foreground">{n.text}</p>)}
            <div className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[85%] rounded-2xl px-4 py-3 font-ui text-[14px] leading-relaxed", m.role === "user" ? "bg-primary text-primary-foreground rounded-br-md whitespace-pre-wrap" : "bg-card border border-border rounded-bl-md")}>
                {m.role !== "user" && <span className="block font-ui text-[10px] uppercase tracking-[0.18em] text-accent-foreground mb-1">Kinika</span>}
                {m.role === "user" ? m.content : <Markdown>{m.content}</Markdown>}
              </div>
            </div>
            </div>
          ))}
          {notes.filter((n) => n.afterIndex >= messages.length).map((n) => <p key={n.id} className="text-center font-ui text-[11px] text-muted-foreground">{n.text}</p>)}
          {!busy && followups.options.length > 0 && (
            <div className="flex flex-wrap gap-2 pl-1" role="group" aria-label="Kinika's options">
              {followups.options.map((o) => (
                <button key={o.label} type="button" onClick={() => turn(o.value, true)} className="h-9 px-3.5 rounded-full border border-[hsl(var(--brand-blue-line))] bg-accent text-accent-foreground font-ui text-[13px] font-medium hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors">{o.label}</button>
              ))}
            </div>
          )}
          {streaming !== null && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl rounded-bl-md px-4 py-3 bg-card border border-border font-ui text-[14px] leading-relaxed">
                <span className="block font-ui text-[10px] uppercase tracking-[0.18em] text-accent-foreground mb-1">Kinika</span>
                {(() => {
                  if (!streaming) return <ThinkingLine startedAt={startedAt} />;
                  const v = visibleWhileStreaming(streaming);
                  return (
                    <>
                      {v.text ? <Markdown>{v.text}</Markdown> : <ThinkingLine startedAt={startedAt} />}
                      {v.writingDocument && <p className="mt-2 font-ui text-[12px] text-muted-foreground inline-flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Writing the document…</p>}
                    </>
                  );
                })()}
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(); }} className={cn("border-t border-border bg-card", compact ? "p-3" : "px-4 md:px-8 py-4")}>
        {!busy && followups.suggestions.length > 0 && (
          <div className={cn("mx-auto flex gap-2 overflow-x-auto pb-2 -mt-1", compact ? "" : "max-w-[760px]")} aria-label="Replies you might give">
            {followups.suggestions.map((t) => (
              <button key={t} type="button" onClick={() => turn(t, true)} className="shrink-0 h-8 px-3 rounded-full border border-border bg-background font-ui text-[12px] text-muted-foreground hover:text-foreground hover:border-primary transition-colors">{t}</button>
            ))}
          </div>
        )}
        <div className={cn("mx-auto flex items-end gap-2", compact ? "" : "max-w-[760px]")}>
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={compact ? 2 : 2} placeholder="Tell Kinika" aria-label="Tell Kinika"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            className="flex-1 resize-none text-[14px]" disabled={!ready || busy} />
          <button type="submit" disabled={!ready || busy || !draft.trim()} className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50" aria-label="Send">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <SendHorizonal size={16} />}
          </button>
        </div>
      </form>
    </div>
  );
}
