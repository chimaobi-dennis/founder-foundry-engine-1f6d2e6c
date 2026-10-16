import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, SendHorizonal } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/ui/markdown";
import { Skeleton } from "@/components/ui/skeleton";
import { ThinkingLine } from "@/components/work/ThinkingLine";
import { useVisibleInterval } from "@/hooks/use-visible-interval";
import { getMessages, type MentorMessage, type ReplyOption } from "@/services/mentorService";
import type { Deliverable } from "@/services/planService";
import { getTaskConversationState, sendTaskMessage, saveDeliverables, type Workspace } from "@/services/workspaceService";
import { NeedsCard } from "@/components/work/NeedsCard";

/**
 * Kinika working one plan task with the founder. Each turn is sent to the
 * task-chat function, which answers in the background, so a reload never
 * loses a message: while the conversation is pending this component polls
 * for the reply. Deliverables and documents are applied server-side; the
 * workspace reloads when a reply lands.
 */
export function TaskChat({ ws, deliverables, onReplied, compact = false, ask }: {
  ws: Workspace;
  deliverables: Deliverable[];
  /** A reply landed; the workspace should reload its task, deliverables and document. */
  onReplied: () => Promise<void>;
  compact?: boolean;
  /** An instruction the workspace sends on the founder's behalf (new nonce each time); shown as a note, not as the founder's words. */
  ask?: { text: string; note: string; nonce: number } | null;
}) {
  const [messages, setMessages] = useState<MentorMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [ready, setReady] = useState(false);
  const [followups, setFollowups] = useState<{ options: ReplyOption[]; suggestions: string[] }>({ options: [], suggestions: [] });
  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const openedRef = useRef(false);
  const askedRef = useRef(0);
  const lastCountRef = useRef(0);

  /** What is on the server now: messages, whether Kinika is still answering, and the follow-ups of the last reply. */
  const sync = useCallback(async (initial = false) => {
    const state = await getTaskConversationState(ws.task.id);
    const ms = state ? await getMessages(state.id) : [];
    setMessages(ms);
    const stillPending = !!state?.pending_since && Date.now() - new Date(state.pending_since).getTime() < 3 * 60_000;
    if (stillPending && !pending) setStartedAt(state!.pending_since ? new Date(state!.pending_since).getTime() : Date.now());
    setPending(stillPending);
    if (!stillPending) {
      const f = state?.last_followups;
      setFollowups({ suggestions: f?.suggestions ?? [], options: f?.options ?? [] });
      if (state?.last_error && !initial) toast.error(`Kinika did not answer: ${state.last_error}`);
      if (ms.length !== lastCountRef.current && !initial) await onReplied();
    }
    lastCountRef.current = ms.length;
    if (initial) setReady(true);
  }, [ws.task.id, pending, onReplied]);

  useEffect(() => { setReady(false); sync(true); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws.task.id]);
  useVisibleInterval(() => { sync(); }, 2500, pending);

  /** One turn: the founder's message (or a hidden instruction) goes to the server; the reply is polled. */
  const turn = useCallback(async (text: string, saveUser: boolean, note?: string) => {
    if (pending) return;
    setFollowups({ options: [], suggestions: [] });
    if (saveUser) setMessages((m) => [...m, { id: `temp-${Date.now()}`, conversation_id: "", role: "user", content: text, created_at: new Date().toISOString() } as MentorMessage]);
    else if (note) setMessages((m) => [...m, { id: `temp-${Date.now()}`, conversation_id: "", role: "note", content: note, created_at: new Date().toISOString() } as MentorMessage]);
    setPending(true);
    setStartedAt(Date.now());
    const r = await sendTaskMessage(ws.task.brand_id, ws.task.id, text, saveUser, note);
    if (r.success === false) { setPending(false); toast.error(r.error); setMessages((m) => m.filter((x) => !x.id.startsWith("temp-"))); return; }
  }, [pending, ws.task.brand_id, ws.task.id]);

  // Kinika opens the task once the deliverables exist and nothing has been said yet.
  useEffect(() => {
    if (!ready || pending || openedRef.current || messages.length > 0 || deliverables.length === 0) return;
    openedRef.current = true;
    turn("Open this task: in three short lines say how we will work through the deliverables, then ask the first question for the first open deliverable.", false);
  }, [ready, pending, messages.length, deliverables.length, turn]);

  useEffect(() => {
    if (!ask || ask.nonce === askedRef.current || !ready || pending) return;
    askedRef.current = ask.nonce;
    turn(ask.text, false, ask.note);
  }, [ask, ready, pending, turn]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [messages, pending, followups]);

  const send = async () => {
    const text = draft.trim();
    if (!text || pending) return;
    setDraft("");
    await turn(text, true);
  };
  /** A suggestion is a starting point, not an answer: it goes into the box for the founder to finish. */
  const startFromSuggestion = (t: string) => {
    setDraft(`Based on "${t}": `);
    inputRef.current?.focus();
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
          {messages.map((m) => m.role === "note" ? (
            <p key={m.id} className="text-center font-ui text-[11px] text-muted-foreground">{m.content}</p>
          ) : (
            <div key={m.id} className="contents">
              <div className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[85%] rounded-2xl px-4 py-3 font-ui text-[14px] leading-relaxed", m.role === "user" ? "bg-primary text-primary-foreground rounded-br-md whitespace-pre-wrap" : "bg-card border border-border rounded-bl-md")}>
                  {m.role !== "user" && <span className="block font-ui text-[10px] uppercase tracking-[0.18em] text-accent-foreground mb-1">Kinika</span>}
                  {m.role === "user" ? m.content : <Markdown>{m.content}</Markdown>}
                </div>
              </div>
            </div>
          ))}
          {pending && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl rounded-bl-md px-4 py-3 bg-card border border-border font-ui text-[14px] leading-relaxed">
                <span className="block font-ui text-[10px] uppercase tracking-[0.18em] text-accent-foreground mb-1">Kinika</span>
                <ThinkingLine startedAt={startedAt} />
              </div>
            </div>
          )}
          {!pending && (() => {
            const needing = deliverables.find((d) => !d.done && d.needs && !d.needs.resolved);
            return needing ? (
              <NeedsCard ws={ws} deliverable={needing}
                onResolve={async (d, how) => { const next = deliverables.map((x) => x.id === d.id && x.needs ? { ...x, needs: { ...x.needs, resolved: how } } : x); if (!(await saveDeliverables(ws.task.id, next))) toast.error("Could not save"); await onReplied(); }}
                onSend={(text) => turn(text, true)}
                onAsk={(text, note) => turn(text, false, note)} />
            ) : null;
          })()}
          {!pending && followups.options.length > 0 && (
            <div className="flex flex-wrap gap-2 pl-1" role="group" aria-label="Kinika's options">
              {followups.options.map((o) => (
                <button key={o.label} type="button" onClick={() => turn(o.value, true)} className="h-9 px-3.5 rounded-full border border-[hsl(var(--brand-blue-line))] bg-accent text-accent-foreground font-ui text-[13px] font-medium hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors">{o.label}</button>
              ))}
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(); }} className={cn("border-t border-border bg-card", compact ? "p-3" : "px-4 md:px-8 py-4")}>
        {!pending && followups.suggestions.length > 0 && (
          <div className={cn("mx-auto flex gap-2 overflow-x-auto pb-2 -mt-1", compact ? "" : "max-w-[760px]")} aria-label="Starting points for your reply">
            {followups.suggestions.map((t) => (
              <button key={t} type="button" onClick={() => startFromSuggestion(t)} className="shrink-0 h-8 px-3 rounded-full border border-border bg-background font-ui text-[12px] text-muted-foreground hover:text-foreground hover:border-primary transition-colors">{t}</button>
            ))}
          </div>
        )}
        <div className={cn("mx-auto flex items-end gap-2", compact ? "" : "max-w-[760px]")}>
          <Textarea ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} placeholder="Tell Kinika" aria-label="Tell Kinika"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            className="flex-1 resize-none text-[14px]" disabled={!ready} />
          <button type="submit" disabled={!ready || pending || !draft.trim()} className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50" aria-label="Send">
            {pending ? <Loader2 size={16} className="animate-spin" /> : <SendHorizonal size={16} />}
          </button>
        </div>
      </form>
    </div>
  );
}
