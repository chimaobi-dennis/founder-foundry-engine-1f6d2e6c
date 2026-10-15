import { useEffect, useState } from "react";
import { Check, FileText, ListChecks, Scale, Zap } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/ui/markdown";
import type { Deliverable } from "@/services/planService";

const ICON: Record<Deliverable["kind"], typeof Check> = { decision: Scale, document: FileText, list: ListChecks, action: Zap };
const WHAT: Record<Deliverable["kind"], string> = { decision: "The decision", document: "The document", list: "The list", action: "What was done" };

/**
 * One deliverable, opened from the rail: what it is, whether it is done, and
 * the outcome Kinika wrote down (or the founder writes). Documents open on
 * the document surface instead.
 */
export function DeliverableSheet({ deliverable, onClose, onAskKinika, onSaveResult, onToggle }: {
  deliverable: Deliverable | null;
  onClose: () => void;
  onAskKinika: (d: Deliverable) => void;
  onSaveResult: (d: Deliverable, result: string) => Promise<void>;
  onToggle: (d: Deliverable) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  useEffect(() => { setEditing(false); setDraft(deliverable?.result ?? ""); }, [deliverable?.id, deliverable?.result]);
  if (!deliverable) return null;
  const d = deliverable;
  const Icon = ICON[d.kind] ?? Zap;
  return (
    <Sheet open={!!deliverable} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-[520px] overflow-y-auto">
        <SheetHeader className="text-left">
          <p className="font-ui text-[10px] uppercase tracking-[0.18em] text-muted-foreground inline-flex items-center gap-1.5"><Icon size={11} /> {d.kind} · {d.done ? "done" : "open"}</p>
          <SheetTitle className="font-display text-[20px] leading-tight">{d.title}</SheetTitle>
          {d.detail && <SheetDescription className="font-ui text-[13px]">{d.detail}</SheetDescription>}
        </SheetHeader>

        <div className="mt-6 flex flex-col gap-4">
          <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{WHAT[d.kind]}</span>
          {editing ? (
            <>
              <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={10} className="text-[14px]" placeholder={d.kind === "list" ? "- one item per line" : "Write it in your words"} />
              <div className="flex items-center gap-2">
                <button onClick={async () => { await onSaveResult(d, draft.trim()); setEditing(false); }} className="h-9 px-3.5 rounded-lg bg-primary text-primary-foreground font-ui text-[13px] font-medium">Save</button>
                <button onClick={() => { setEditing(false); setDraft(d.result ?? ""); }} className="h-9 px-3 rounded-lg border border-border bg-card font-ui text-[13px]">Cancel</button>
              </div>
            </>
          ) : d.result ? (
            <>
              <div className="rounded-xl border border-border bg-card px-4 py-3 text-[14px]"><Markdown>{d.result}</Markdown></div>
              <div className="flex items-center gap-3 flex-wrap">
                <button onClick={() => setEditing(true)} className="font-ui text-[12px] underline">Edit</button>
                <button onClick={() => onAskKinika(d)} className="font-ui text-[12px] underline">Ask Kinika to rewrite it</button>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-4 flex flex-col gap-3">
              <p className="font-ui text-[13px] text-muted-foreground leading-relaxed">
                {d.done ? "This was ticked without the outcome being written down." : "Nothing is written down for this yet. It fills in when Kinika closes it in the conversation."}
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => onAskKinika(d)} className="h-9 px-3.5 rounded-lg bg-primary text-primary-foreground font-ui text-[13px] font-medium">Ask Kinika to write it down</button>
                <button onClick={() => setEditing(true)} className="h-9 px-3 rounded-lg border border-border bg-card font-ui text-[13px]">Write it myself</button>
              </div>
            </div>
          )}
          <div className="pt-2 border-t border-border">
            <button onClick={() => onToggle(d)} className="font-ui text-[12px] text-muted-foreground underline">{d.done ? "Mark not done" : "Mark done"}</button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
