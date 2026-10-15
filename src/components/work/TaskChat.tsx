import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, SendHorizonal } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/ui/markdown";
import { Skeleton } from "@/components/ui/skeleton";
import { getBrandDNA } from "@/services/brandService";
import { getMentorAIResponse, getMessages, getOrCreateTaskConversation, saveMessage, type MentorMessage, type TaskChatContext } from "@/services/mentorService";
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
  /** A message the workspace wants sent on the founder's behalf (new nonce each time). */
  ask?: { text: string; nonce: number } | null;
}) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MentorMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState<string | null>(null);
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
    setStreaming("");
    if (saveUser) {
      const saved = await saveMessage(conversationId, "user", userText);
      if (saved) setMessages((m) => [...m, saved]);
    }
    const dna = await getBrandDNA(brand.id).catch(() => null);
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    const r = await getMentorAIResponse(userId, brand, dna, history, userText, (t) => setStreaming((s) => (s ?? "") + t), undefined, ctx());
    setStreaming(null);
    if (!r) { setBusy(false); toast.error("Kinika did not answer. Try again."); return; }
    const saved = await saveMessage(conversationId, "assistant", r.text);
    if (saved) setMessages((m) => [...m, saved]);
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
    turn(ask.text, true);
  }, [ask, ready, busy, turn]);

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
          {messages.map((m) => (
            <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[85%] rounded-2xl px-4 py-3 font-ui text-[14px] leading-relaxed", m.role === "user" ? "bg-primary text-primary-foreground rounded-br-md whitespace-pre-wrap" : "bg-card border border-border rounded-bl-md")}>
                {m.role !== "user" && <span className="block font-ui text-[10px] uppercase tracking-[0.18em] text-accent-foreground mb-1">Kinika</span>}
                {m.role === "user" ? m.content : <Markdown>{m.content}</Markdown>}
              </div>
            </div>
          ))}
          {streaming !== null && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl rounded-bl-md px-4 py-3 bg-card border border-border font-ui text-[14px] leading-relaxed">
                <span className="block font-ui text-[10px] uppercase tracking-[0.18em] text-accent-foreground mb-1">Kinika</span>
                {streaming ? <Markdown>{streaming}</Markdown> : <span className="inline-flex gap-1" aria-label="Kinika is writing"><span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" /><span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:120ms]" /><span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:240ms]" /></span>}
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(); }} className={cn("border-t border-border bg-card", compact ? "p-3" : "px-4 md:px-8 py-4")}>
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
