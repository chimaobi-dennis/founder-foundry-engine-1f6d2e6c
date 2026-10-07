import { useEffect, useState } from "react";
import { Brain, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { deleteTeamMemory, listTeamMemories, MEMORY_KIND_LABEL, type TeamMemory } from "@/services/memoryService";

/**
 * What the team remembers about this brand: finished work, what came of it,
 * and the founder's own approvals and rejections. Every agent reads this
 * before it works, so the founder can prune it here.
 */
export function TeamMemorySection({ brandId, canEdit, refreshKey }: { brandId: string; canEdit: boolean; refreshKey?: number }) {
  const [items, setItems] = useState<TeamMemory[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    listTeamMemories(brandId).then((m) => { if (active) { setItems(m); setLoaded(true); } });
    return () => { active = false; };
  }, [brandId, refreshKey]);

  if (!loaded || items.length === 0) return null;
  const shown = open ? items : items.slice(0, 4);

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Brain size={14} className="text-muted-foreground" />
        <h2 className="font-ui text-[11px] uppercase tracking-[0.16em] text-muted-foreground">What your team remembers</h2>
        <span className="font-ui text-[11px] text-muted-foreground">· {items.length}</span>
      </div>
      <p className="font-ui text-[12px] text-muted-foreground mb-3 max-w-prose">Every agent reads this before it works, so it builds on what was done and on what you said. Remove anything that is wrong or no longer true.</p>
      <div className="grid gap-2">
        {shown.map((m) => (
          <div key={m.id} className="rounded-lg border border-border/60 bg-card/30 px-4 py-2.5 flex items-start gap-3">
            <span className={cn("shrink-0 mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-ui font-medium", m.kind === "feedback" ? "bg-primary/10 text-primary" : m.kind === "outcome" ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : "bg-muted text-muted-foreground")}>{MEMORY_KIND_LABEL[m.kind]}</span>
            <div className="min-w-0 flex-1">
              <p className="font-ui text-[13px] text-foreground">{m.title}</p>
              <p className="font-ui text-[12px] text-muted-foreground mt-0.5 line-clamp-2">{m.summary}</p>
              <p className="font-ui text-[10px] text-muted-foreground/70 mt-1">{new Date(m.created_at).toLocaleDateString()}</p>
            </div>
            {canEdit && (
              <button
                aria-label="Forget this"
                title="Forget this"
                onClick={async () => { if (await deleteTeamMemory(m.id)) { setItems((cur) => cur.filter((x) => x.id !== m.id)); toast("Forgotten"); } else toast.error("Could not remove that"); }}
                className="shrink-0 text-muted-foreground hover:text-destructive"
              ><Trash2 size={13} /></button>
            )}
          </div>
        ))}
      </div>
      {items.length > 4 && (
        <button onClick={() => setOpen(!open)} className="mt-2 font-ui text-[12px] text-muted-foreground underline">{open ? "Show less" : `Show all ${items.length}`}</button>
      )}
    </section>
  );
}

export default TeamMemorySection;
