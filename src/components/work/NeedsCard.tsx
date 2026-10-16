import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, UserPlus, Users, FileText, X } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { createRun, hireAgent, listAgents, listHires, quoteAgentTask, type Agent } from "@/services/agentService";
import { effectiveLimit, getEntitlements } from "@/services/subscriptionService";
import { requirePrompt } from "@/services/aiService";
import type { Deliverable } from "@/services/planService";
import type { Workspace } from "@/services/workspaceService";

/** Which role on Kinika's roster does a need map to. Legal has no role yet. */
const ROLE_SLUG: Record<string, string | null> = { research: "researcher", copy: "copywriter", design: "designer", seo: "seo_specialist", dev: "developer", legal: "legal_drafter", community: null, other: null };

/**
 * Kinika found work it should not do itself. Three doors, the same wherever a
 * hire is confirmed: let Kinika hire the role, bring your own person and paste
 * their text, or have Kinika write the brief for them. Each resolves the need.
 */
export function NeedsCard({ ws, deliverables, deliverable, onResolve, onHired, onSend, onAsk }: {
  ws: Workspace;
  deliverables: Deliverable[];
  deliverable: Deliverable;
  onResolve: (d: Deliverable, how: NonNullable<NonNullable<Deliverable["needs"]>["resolved"]>) => Promise<void>;
  /** A run was created for this deliverable; the workspace records it and opens its tab. */
  onHired: (d: Deliverable, run: { id: string; agentSlug: string; agentName: string }) => Promise<void>;
  /** Send a message in the founder's voice. */
  onSend: (text: string) => void;
  /** Send an instruction on the founder's behalf, with the note shown instead. */
  onAsk: (text: string, note: string) => void;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const need = deliverable.needs!;
  const [agent, setAgent] = useState<Agent | null | undefined>(undefined);
  const [seats, setSeats] = useState<{ total: number; used: number; hiredSlugs: Set<string> } | null>(null);
  const [quote, setQuote] = useState<number | null>(null);
  const [own, setOwn] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const slug = ROLE_SLUG[need.role] ?? null;
      const [agents, hires, ent] = await Promise.all([listAgents(), listHires(ws.task.brand_id), user ? getEntitlements(user.id) : Promise.resolve(null)]);
      if (!active) return;
      const found = slug ? agents.find((a) => a.slug === slug) ?? null : null;
      setAgent(found);
      const total = ent ? effectiveLimit(ent, "agents") : 0;
      const activeHires = hires.filter((h) => h.status === "active");
      setSeats({ total, used: activeHires.length, hiredSlugs: new Set(activeHires.map((h) => h.agent.slug)) });
      if (found) { try { const q = await quoteAgentTask(found, { brief: need.brief || deliverable.detail, units: 1 }); if (active) setQuote(Math.round(q.estimate)); } catch { /* no rate */ } }
    })();
    return () => { active = false; };
  }, [need.role, ws.task.brand_id, user]);

  /** Kinika hires the role (a seat) if needed, then starts the run for this deliverable with the decisions so far. */
  const hired = async () => {
    if (!agent || !user || !seats) return;
    setBusy("hire");
    if (!seats.hiredSlugs.has(agent.slug)) {
      const h = await hireAgent(ws.task.brand_id, user.id, agent.id, "kinika");
      if (!h.success) { setBusy(null); toast.error(h.error ?? `Could not hire ${agent.name}`); return; }
    }
    const decided = deliverables.filter((d) => d.done && d.result).map((d) => `- ${d.title}: ${d.result}`).join("\n");
    const brief = [need.brief || deliverable.detail, `Task: ${ws.task.title}.`, decided ? `Decisions already made:\n${decided}` : ""].filter(Boolean).join("\n\n");
    const r = await createRun({ brandId: ws.task.brand_id, userId: user.id, agent, name: deliverable.title, input: { brief, units: 1, plan_task_id: ws.task.id, deliverable_id: deliverable.id } });
    setBusy(null);
    if (!r.success || !r.run) { toast.error(r.error ?? `Could not start ${agent.name}`); return; }
    await onHired(deliverable, { id: r.run.id, agentSlug: agent.slug, agentName: agent.name });
    toast(`Kinika hired ${agent.name} for "${deliverable.title}"`);
  };
  const alreadyHired = !!(agent && seats?.hiredSlugs.has(agent.slug));
  const free = seats ? (seats.total < 0 ? Infinity : seats.total - seats.used) : 0;

  return (
    <div role="region" aria-label="This needs someone" className="rounded-xl border border-[hsl(var(--brand-needs-you))]/40 bg-[hsl(var(--brand-needs-you-soft))]/60 p-4 flex flex-col gap-3 max-w-[85%]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--brand-needs-you))] inline-flex items-center gap-1.5"><Users size={11} /> This needs a {need.label}</span>
          <p className="font-ui text-[13px] text-foreground leading-relaxed">For <strong className="font-semibold">{deliverable.title}</strong>. {need.why}</p>
        </div>
        <button onClick={() => onResolve(deliverable, "dismissed")} className="text-muted-foreground" aria-label="Dismiss"><X size={14} /></button>
      </div>
      {need.brief && <p className="font-ui text-[12px] text-muted-foreground leading-relaxed">What they would deliver: {need.brief}</p>}

      <div className="flex flex-col gap-2">
        {/* Door 1: Kinika hires */}
        {agent === undefined || !seats ? (
          <span className="font-ui text-[12px] text-muted-foreground inline-flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Checking Kinika's roster and your seats</span>
        ) : agent === null ? (
          <p className="font-ui text-[12px] text-muted-foreground">Kinika's roster has no {need.label} yet, so Kinika cannot hire one for this. The other two doors work today.</p>
        ) : seats.total === 0 ? (
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={() => navigate("/billing")} className="h-9 px-3.5 rounded-lg bg-primary text-primary-foreground font-ui text-[13px] font-medium inline-flex items-center gap-1.5"><UserPlus size={13} /> Add a seat so Kinika can hire {agent.name}</button>
            <span className="font-ui text-[12px] text-muted-foreground">Your trial has no agent seats.</span>
          </div>
        ) : free > 0 || alreadyHired ? (
          <div className="flex items-center gap-3 flex-wrap">
            <button disabled={!!busy} onClick={hired} className="h-9 px-3.5 rounded-lg bg-primary text-primary-foreground font-ui text-[13px] font-medium inline-flex items-center gap-1.5 disabled:opacity-50">{busy === "hire" ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />} {alreadyHired ? `Hand this to ${agent.name}` : `Let Kinika hire ${agent.name} for this`}</button>
            <span className="font-ui text-[12px] text-muted-foreground">{quote != null ? `About ${quote} credits` : ""}{alreadyHired ? "" : " · uses a seat"} · you approve the result here</span>
          </div>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={() => navigate("/billing")} className="h-9 px-3.5 rounded-lg border border-border bg-card font-ui text-[13px] inline-flex items-center gap-1.5"><UserPlus size={13} /> Add a seat</button>
            <span className="font-ui text-[12px] text-muted-foreground">All {seats.total} seats are taken.</span>
          </div>
        )}

        {/* Door 2: your own person */}
        {own ? (
          <div className="flex flex-col gap-2">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder={`Paste what your ${need.label.toLowerCase()} sent, or their notes`} className="text-[13px] bg-card" />
            <div className="flex items-center gap-2">
              <button disabled={!text.trim()} onClick={async () => { onSend(`From my own ${need.label.toLowerCase()}, for "${deliverable.title}":\n\n${text.trim()}`); await onResolve(deliverable, "own"); }} className="h-9 px-3.5 rounded-lg bg-primary text-primary-foreground font-ui text-[13px] font-medium disabled:opacity-50">Give this to Kinika</button>
              <button onClick={() => setOwn(false)} className="h-9 px-3 rounded-lg border border-border bg-card font-ui text-[13px]">Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setOwn(true)} className="self-start h-9 px-3.5 rounded-lg border border-border bg-card font-ui text-[13px] inline-flex items-center gap-1.5"><FileText size={13} /> I have my own {need.label.toLowerCase()}; paste their text</button>
        )}

        {/* Door 3: the brief */}
        <button onClick={async () => { try { onAsk(await requirePrompt("task_chat_brief_request", { label: need.label, title: deliverable.title }), `You asked Kinika to write the brief for a ${need.label.toLowerCase()}.`); await onResolve(deliverable, "brief"); } catch (e) { toast.error((e as Error).message); } }} className="self-start h-9 px-3.5 rounded-lg border border-border bg-card font-ui text-[13px] inline-flex items-center gap-1.5"><FileText size={13} /> Kinika, write the brief for them</button>
      </div>
    </div>
  );
}
