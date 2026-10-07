import { useEffect, useState } from "react";
import { FadeIn } from "@/components/FadeIn";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { adminListAgents, adminReviewAgent, STATUS_LABEL, type AgentStatus, type CreatorAgent } from "@/services/creatorAgentService";

const STATUS_TABS: (AgentStatus | "all")[] = ["pending_review", "published", "draft", "unpublished", "all"];

const pill: Record<string, React.CSSProperties> = {
  pending_review: { background: "#2A2A0A", color: "#D4A017" },
  published: { background: "#1A2A1A", color: "#4ADE80" },
  draft: { background: "#1A2A3A", color: "#8A96A3" },
  unpublished: { background: "#2A1A1A", color: "#F87171" },
};

/** Admin → Product → Community agents: review what creators submit. */
export default function AdminAgents() {
  const [agents, setAgents] = useState<CreatorAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<AgentStatus | "all">("pending_review");
  const [detail, setDetail] = useState<CreatorAgent | null>(null);
  const [notes, setNotes] = useState("");
  const [share, setShare] = useState(30);
  const [busy, setBusy] = useState(false);
  const cardBg = { background: "#0D1520", border: "0.5px solid #1A2A3A" };

  const load = async () => { setLoading(true); setAgents(await adminListAgents(filter === "all" ? undefined : filter)); setLoading(false); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [filter]);

  const open = (a: CreatorAgent) => { setDetail(a); setNotes(a.admin_notes ?? ""); setShare(a.revenue_share_pct); };
  const act = async (decision: "publish" | "request_changes" | "unpublish") => {
    if (!detail) return;
    if (decision === "request_changes" && !notes.trim()) { toast({ title: "Say what should change", variant: "destructive" }); return; }
    setBusy(true);
    const r = await adminReviewAgent(detail.id, decision, notes, share);
    setBusy(false);
    if (!r.success) { toast({ title: "Failed", description: r.error, variant: "destructive" }); return; }
    toast({ title: decision === "publish" ? "Published" : decision === "unpublish" ? "Unpublished" : "Changes requested" });
    setDetail(null);
    load();
  };

  return (
    <FadeIn>
      <div className="p-6 md:p-8 space-y-6">
        <div>
          <h1 className="font-display text-2xl" style={{ color: "#F5F0E6" }}>Community agents</h1>
          <p className="font-ui text-[13px] mt-1" style={{ color: "#8A96A3" }}>Agents written by creators. Read the instructions before publishing: they run against founders' brand context with the shared metered pricing for their tier.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {STATUS_TABS.map((t) => (
            <button key={t} onClick={() => setFilter(t)} className="px-3 py-1.5 rounded-full text-[12px] font-ui" style={{ background: filter === t ? "#D4A017" : "transparent", color: filter === t ? "#0D1B2A" : "#8A96A3", border: filter === t ? "none" : "0.5px solid #1A2A3A" }}>
              {t === "all" ? "All" : STATUS_LABEL[t]}
            </button>
          ))}
        </div>
        <div className="rounded-xl overflow-hidden" style={cardBg}>
          {loading ? <div className="p-6 space-y-2"><Skeleton className="h-5 w-1/2" /><Skeleton className="h-5 w-1/3" /></div> : agents.length === 0 ? (
            <p className="p-6 font-ui text-[13px]" style={{ color: "#8A96A3" }}>Nothing here.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Agent</TableHead><TableHead>Creator</TableHead><TableHead>Tier</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Uses</TableHead><TableHead className="text-right">Share</TableHead></TableRow></TableHeader>
              <TableBody>
                {agents.map((a) => (
                  <TableRow key={a.id} className="cursor-pointer" onClick={() => open(a)}>
                    <TableCell><p className="font-ui text-sm" style={{ color: "#F5F0E6" }}>{a.name}</p><p className="text-[11px]" style={{ color: "#8A96A3" }}>{a.role}</p></TableCell>
                    <TableCell className="font-ui text-[12px]" style={{ color: "#8A96A3" }}>{a.creator?.display_name ?? "—"}</TableCell>
                    <TableCell className="font-ui text-[12px] capitalize" style={{ color: "#8A96A3" }}>{a.model_tier}</TableCell>
                    <TableCell><span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-ui" style={pill[a.status]}>{STATUS_LABEL[a.status]}</span></TableCell>
                    <TableCell className="text-right font-ui text-[12px]" style={{ color: "#F5F0E6" }}>{a.uses_count}</TableCell>
                    <TableCell className="text-right font-ui text-[12px]" style={{ color: "#F5F0E6" }}>{a.revenue_share_pct}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <Sheet open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null); }}>
        <SheetContent className="overflow-y-auto sm:max-w-xl">
          {detail && (
            <>
              <SheetHeader><SheetTitle className="font-display">{detail.name} <span className="font-ui text-[12px] text-muted-foreground">· {detail.role}</span></SheetTitle></SheetHeader>
              <div className="space-y-4 mt-4 font-ui text-[13px]">
                <p className="text-muted-foreground">{detail.creator?.display_name ?? "Unknown creator"} · {detail.model_tier} tier · {detail.unit_label} · ceiling {detail.per_run_credit_ceiling} credits · stages {detail.suited_stages?.join(", ") || "any"}</p>
                {detail.tagline && <p className="italic">{detail.tagline}</p>}
                <p>{detail.description}</p>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Instructions</p>
                  <pre className="whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-[12px] font-mono max-h-80 overflow-auto">{detail.system_prompt}</pre>
                </div>
                <div className="grid grid-cols-[1fr_120px] gap-3 items-end">
                  <div><p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Notes to the creator</p><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What should change, or why it was unpublished." /></div>
                  <div><p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Creator share %</p><Input type="number" min={0} max={90} value={share} onChange={(e) => setShare(Number(e.target.value))} /></div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {detail.status !== "published" && <button disabled={busy} onClick={() => act("publish")} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-[12px] font-medium disabled:opacity-50">Publish</button>}
                  {detail.status === "published" && <button disabled={busy} onClick={() => act("unpublish")} className="px-3 py-2 rounded-lg border border-border text-[12px] disabled:opacity-50">Unpublish</button>}
                  <button disabled={busy} onClick={() => act("request_changes")} className="px-3 py-2 rounded-lg border border-border text-[12px] disabled:opacity-50">Request changes</button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </FadeIn>
  );
}
