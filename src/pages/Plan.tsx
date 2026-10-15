import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Circle, Loader2, Plus, RefreshCw, Sparkles, Trash2, UserRound, Bot, Wand2, ChevronRight, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useBrand } from "@/hooks/use-brand";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { listAgents, listHires, hireAgent, type Agent, type AgentHire } from "@/services/agentService";
import { getEntitlements, effectiveLimit, type Entitlements } from "@/services/subscriptionService";
import { KinikaTeam } from "@/components/plan/KinikaTeam";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { getMyRole } from "@/services/teamMembersService";
import { roleAtLeast } from "@shared/plans";
import { PLAYBOOKS, type PlaybookChoice } from "@shared/plan";
import { addTask, buildPlan, delegateUrl, deleteTask, getPlan, planProgress, revisePlan, setAutoRevise, setTaskStatus, type FounderPlan, type PlanTask, type PlanTarget, type TaskStatus } from "@/services/planService";

/**
 * /plan — the founder's plan. Targets in order, each a checklist. Every task
 * is the founder's or an agent's; agent tasks hand off to the Team page with
 * the brief prefilled, and come back done when the run completes.
 */
export default function Plan() {
  const { user } = useAuth();
  const { activeBrand } = useBrand();
  const navigate = useNavigate();
  const brandId = activeBrand?.id;
  const [plan, setPlan] = useState<FounderPlan | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [hired, setHired] = useState<Set<string>>(new Set());
  const [hires, setHires] = useState<AgentHire[]>([]);
  const [ent, setEnt] = useState<Entitlements | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(true);
  const [note, setNote] = useState("");
  const [revising, setRevising] = useState(false);
  const [startOverOpen, setStartOverOpen] = useState(false);
  const [playbook, setPlaybook] = useState<PlaybookChoice>("auto");

  const reload = async () => {
    if (!brandId) return;
    const [p, a, h, role, e] = await Promise.all([getPlan(brandId), listAgents(), listHires(brandId), getMyRole(brandId), user ? getEntitlements(user.id).catch(() => null) : Promise.resolve(null)]);
    setPlan(p);
    setAgents(a);
    setHires(h);
    setEnt(e);
    setHired(new Set(h.filter((x) => x.status === "active").map((x) => x.agent.slug)));
    setCanEdit(role ? roleAtLeast(role, "editor") : true);
    setLoaded(true);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setLoaded(false); reload(); }, [brandId]);

  const agentBySlug = useMemo(() => new Map(agents.map((a) => [a.slug, a])), [agents]);
  const progress = planProgress(plan);

  const build = async (fresh: boolean) => {
    if (!brandId) return;
    setBusy(fresh ? "build" : "revise");
    const r = fresh ? await buildPlan(brandId, undefined, playbook) : await revisePlan(brandId, note.trim());
    setBusy(null);
    if (!r.success) { toast.error(r.error ?? "Kinika could not write the plan"); return; }
    toast(fresh ? `Plan ready: ${r.targets} targets, ${r.tasks} tasks` : "Plan revised");
    setNote("");
    setRevising(false);
    reload();
  };

  if (!activeBrand) return <div className="p-8 font-ui text-[13px] text-muted-foreground">Pick a business first.</div>;
  if (!loaded) return <PlanSkeleton />;

  if (!plan) {
    return (
      <div className="max-w-3xl mx-auto px-4 md:px-8 py-12">
        <p className="font-ui text-[10px] uppercase tracking-[0.24em] text-muted-foreground mb-3">{activeBrand.name}</p>
        <h1 className="font-display text-3xl text-foreground">Your plan</h1>
        <p className="font-ui text-[14px] text-muted-foreground mt-3 max-w-prose leading-relaxed">
          Kinika turns what you have told it about {activeBrand.name} into the next few targets and a checklist for each. Tasks an agent can do on its own are marked, so you can hand them off in one click. You edit everything.
        </p>
        <div className="mt-6">
          <p className="font-ui text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">Start from</p>
          <div className="flex items-center gap-2 flex-wrap">
            {([["auto", "Let Kinika decide"], ...Object.entries(PLAYBOOKS).map(([k, p]) => [k, p.label])] as [PlaybookChoice, string][]).map(([k, label]) => (
              <button key={k} onClick={() => setPlaybook(k)} className={cn("px-3 py-1.5 rounded-lg border font-ui text-[12px]", playbook === k ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:border-primary")}>{label}</button>
            ))}
          </div>
          {playbook !== "auto" && <p className="font-ui text-[11px] text-muted-foreground mt-2">{PLAYBOOKS[playbook].targets.join(" · ")}</p>}
        </div>
        <div className="mt-5 flex items-center gap-3 flex-wrap">
          <button disabled={!canEdit || busy === "build"} onClick={() => build(true)} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-ui text-[13px] font-medium disabled:opacity-50">
            {busy === "build" ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />} Write my plan
          </button>
          <button onClick={() => navigate("/mentor")} className="font-ui text-[13px] text-muted-foreground underline">Tell Kinika more first</button>
        </div>
        {!canEdit && <p className="font-ui text-[12px] text-muted-foreground mt-3">Only editors and the owner can build the plan.</p>}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-10 space-y-8">
      <header>
        <p className="font-ui text-[10px] uppercase tracking-[0.24em] text-muted-foreground mb-2">{activeBrand.name} · plan v{plan.version}</p>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="font-display text-3xl text-foreground">{plan.title}</h1>
            {plan.summary && <p className="font-ui text-[14px] text-muted-foreground mt-2 max-w-prose leading-relaxed">{plan.summary}</p>}
          </div>
          <div className="text-right shrink-0">
            <p className="font-display text-[32px] leading-none text-foreground">{progress.done}<span className="font-ui text-[13px] text-muted-foreground"> / {progress.total}</span></p>
            <p className="font-ui text-[11px] text-muted-foreground mt-1">tasks done</p>
          </div>
        </div>
        <div className="mt-3 h-1 rounded-full bg-muted/60 overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${progress.total ? Math.max(2, (progress.done / progress.total) * 100) : 2}%` }} /></div>
        <p className="font-ui text-[11px] text-muted-foreground mt-2">
          {plan.revise_pending
            ? "Something changed; Kinika is revising this plan in a few minutes."
            : plan.last_revision_reason ? `Revised after: ${plan.last_revision_reason}` : `Written ${new Date(plan.built_at).toLocaleDateString()}`}
          {plan.next_checkin_at && ` · Next check-in ${new Date(plan.next_checkin_at).toLocaleDateString()}`}
        </p>
        {canEdit && (
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <button onClick={() => setRevising((v) => !v)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-[12px] font-ui hover:border-primary"><RefreshCw size={12} /> Revise with Kinika</button>
            <button disabled={busy === "build"} onClick={() => setStartOverOpen(true)} className="font-ui text-[12px] text-muted-foreground underline disabled:opacity-50">Start over</button>
            <AlertDialog open={startOverOpen} onOpenChange={setStartOverOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-display">Start over from the beginning?</AlertDialogTitle>
                  <AlertDialogDescription className="font-ui">
                    Kinika takes you back to the start: you tell Kinika about the business again, check what Kinika understood, choose a goal, and Kinika writes a new plan. This plan, your edits and the ticked tasks are replaced. Kinika keeps what it learned about your business in memory.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="font-ui">Keep this plan</AlertDialogCancel>
                  <AlertDialogAction className="font-ui bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => navigate(`/start?review=1&brand=${plan.brand_id}`)}>Yes, start over</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <label className="ml-auto inline-flex items-center gap-2 font-ui text-[11px] text-muted-foreground cursor-pointer">
              <input type="checkbox" className="accent-primary" checked={plan.auto_revise} onChange={async (e) => { const on = e.target.checked; setPlan({ ...plan, auto_revise: on }); if (!(await setAutoRevise(plan.id, on))) { toast.error("Could not save"); reload(); } }} />
              Revise when I reach a milestone or change stage
            </label>
          </div>
        )}
        {revising && (
          <div className="mt-3 rounded-lg border border-border p-3">
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What changed, or what should the plan do differently? e.g. 'We launched last week; focus on the first 50 customers now.'" />
            <div className="mt-2 flex items-center gap-2">
              <button disabled={busy === "revise" || !note.trim()} onClick={() => build(false)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[12px] font-ui font-medium disabled:opacity-50">{busy === "revise" ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Revise</button>
              <button onClick={() => setRevising(false)} className="font-ui text-[12px] text-muted-foreground">Cancel</button>
              <span className="font-ui text-[11px] text-muted-foreground">Done tasks and your edits are kept.</span>
            </div>
          </div>
        )}
      </header>

      {user && <KinikaTeam plan={plan} agents={agents} hires={hires} ent={ent} userId={user.id} canEdit={canEdit} onChanged={reload} />}

      {plan.targets.map((t, i) => (
        <TargetCard key={t.id} index={i} target={t} plan={plan} canEdit={canEdit} agentBySlug={agentBySlug} hired={hired} seats={ent ? effectiveLimit(ent, "agents") : 0} seatsFree={ent ? (effectiveLimit(ent, "agents") < 0 ? Infinity : Math.max(0, effectiveLimit(ent, "agents") - hires.filter((x) => x.status === "active").length)) : 0} userId={user?.id ?? ""} busy={busy} setBusy={setBusy} onChanged={reload} />
      ))}
    </div>
  );
}

function TargetCard({ index, target, plan, canEdit, agentBySlug, hired, seats, seatsFree, userId, busy, setBusy, onChanged }: {
  index: number; target: PlanTarget; plan: FounderPlan; canEdit: boolean; agentBySlug: Map<string, Agent>; hired: Set<string>;
  seats: number; seatsFree: number; userId: string;
  busy: string | null; setBusy: (b: string | null) => void; onChanged: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const done = target.tasks.filter((k) => k.status === "done").length;
  const current = target.status === "current";

  const toggle = async (k: PlanTask) => {
    if (!canEdit) return;
    const next: TaskStatus = k.status === "done" ? "todo" : "done";
    setBusy(k.id);
    const ok = await setTaskStatus(k, next);
    setBusy(null);
    if (!ok) toast.error("Could not update the task");
    await onChanged();
  };

  return (
    <section className={cn("rounded-xl border p-5", current ? "border-primary/50 bg-primary/[0.03]" : target.status === "done" ? "border-border/60 opacity-70" : "border-border")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-ui text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Target {index + 1}{current ? " · now" : target.status === "done" ? " · done" : ""}</p>
          <h2 className="font-display text-xl text-foreground mt-1">{target.title}</h2>
          {target.why && <p className="font-ui text-[12px] text-muted-foreground mt-1">{target.why}</p>}
        </div>
        <p className="font-ui text-[12px] text-muted-foreground shrink-0">{done}/{target.tasks.length}</p>
      </div>

      <ul className="mt-4 space-y-2">
        {target.tasks.map((k) => {
          const agent = k.agent_slug ? agentBySlug.get(k.agent_slug) : null;
          const isDone = k.status === "done";
          return (
            <li key={k.id} className={cn("rounded-lg border border-border/60 bg-card/30 px-3 py-2.5 flex items-start gap-3", isDone && "opacity-60")}>
              <button disabled={!canEdit || busy === k.id} onClick={() => toggle(k)} className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary disabled:opacity-50" aria-label={isDone ? "Mark not done" : "Mark done"}>
                {busy === k.id ? <Loader2 size={16} className="animate-spin" /> : isDone ? <Check size={16} className="text-primary" /> : <Circle size={16} />}
              </button>
              <div className="min-w-0 flex-1">
                <p className={cn("font-ui text-[13px] text-foreground", isDone && "line-through")}>{k.title}</p>
                {k.detail && <p className="font-ui text-[12px] text-muted-foreground mt-0.5">{k.detail}</p>}
                <p className="font-ui text-[11px] text-muted-foreground mt-1 inline-flex items-center gap-1.5">
                  {k.owner === "agent" ? <Bot size={11} /> : <UserRound size={11} />}
                  {k.owner === "agent" ? (agent?.name ?? k.agent_slug) : "You"}
                  {k.status === "doing" && <span className="text-primary">· in progress</span>}
                  {k.status === "skipped" && <span>· skipped</span>}
                  {k.run_id && <button onClick={() => navigate(`/work/${k.id}`)} className="underline">open the work</button>}
                </p>
              </div>
              {canEdit && !isDone && (
                <div className="shrink-0 flex items-center gap-1">
                  {k.owner === "agent" && k.status !== "doing" && (
                    hired.has(k.agent_slug ?? "") ? (
                      <button onClick={() => navigate(delegateUrl(k))} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary text-primary-foreground text-[11px] font-ui font-medium">Hand to {agent?.name ?? "agent"} <ChevronRight size={11} /></button>
                    ) : seats === 0 ? (
                      <button onClick={() => navigate(`/mentor?task=${k.id}`)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border text-[11px] font-ui hover:border-primary" title="No agent seat yet">Do it with Kinika</button>
                    ) : seatsFree > 0 && agent ? (
                      <button disabled={busy === `hire-${k.id}`} onClick={async () => { setBusy(`hire-${k.id}`); const r = await hireAgent(plan.brand_id, userId, agent.id, "kinika"); setBusy(null); if (r.success) { toast(`Kinika hired ${agent.name}`); await onChanged(); navigate(delegateUrl(k)); } else toast.error(r.error ?? "Could not hire"); }} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border text-[11px] font-ui hover:border-primary disabled:opacity-50">Let Kinika hire {agent.name}</button>
                    ) : (
                      <button onClick={() => navigate("/billing")} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border text-[11px] font-ui hover:border-primary" title="All seats are taken">Needs a seat</button>
                    )
                  )}
                  {k.status !== "skipped" && <button onClick={async () => { setBusy(k.id); await setTaskStatus(k, "skipped"); setBusy(null); onChanged(); }} className="text-muted-foreground hover:text-foreground" title="Skip" aria-label="Skip task"><X size={13} /></button>}
                  <button onClick={async () => { if (await deleteTask(k.id)) onChanged(); }} className="text-muted-foreground hover:text-destructive" title="Remove" aria-label="Remove task"><Trash2 size={13} /></button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {canEdit && (
        adding ? (
          <form className="mt-2 flex items-center gap-2" onSubmit={async (e) => { e.preventDefault(); if (!newTitle.trim()) return; const t = await addTask(plan, target.id, newTitle, target.tasks.length); if (t) { setNewTitle(""); setAdding(false); onChanged(); } else toast.error("Could not add the task"); }}>
            <Input autoFocus value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="A task of your own" className="h-9" />
            <button type="submit" className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[12px] font-ui">Add</button>
            <button type="button" onClick={() => setAdding(false)} className="font-ui text-[12px] text-muted-foreground">Cancel</button>
          </form>
        ) : (
          <button onClick={() => setAdding(true)} className="mt-2 inline-flex items-center gap-1 font-ui text-[12px] text-muted-foreground hover:text-foreground"><Plus size={12} /> Add a task</button>
        )
      )}
    </section>
  );
}

/** The plan page's shape while it loads: header, progress, revise row, team card, two targets. */
function PlanSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-10 space-y-8" aria-busy="true" aria-label="Loading your plan">
      <header>
        <Skeleton className="h-3 w-40 mb-3" />
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-3">
            <Skeleton className="h-8 w-3/4 max-w-md" />
            <Skeleton className="h-4 w-full max-w-prose" />
            <Skeleton className="h-4 w-2/3 max-w-prose" />
          </div>
          <Skeleton className="h-9 w-16 shrink-0" />
        </div>
        <Skeleton className="mt-4 h-1 w-full rounded-full" />
        <Skeleton className="mt-3 h-3 w-56" />
        <div className="mt-4 flex items-center gap-2">
          <Skeleton className="h-8 w-36 rounded-lg" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="ml-auto h-4 w-64" />
        </div>
      </header>
      <Skeleton className="h-14 w-full rounded-xl" />
      {[0, 1].map((i) => (
        <section key={i} className="rounded-2xl border border-border bg-card p-5 md:p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-6 w-2/3" />
            </div>
            <Skeleton className="h-4 w-8" />
          </div>
          <div className="space-y-2.5">
            {[0, 1, 2].map((j) => (
              <div key={j} className="flex items-center gap-3">
                <Skeleton className="h-4 w-4 rounded-full shrink-0" />
                <Skeleton className={j === 1 ? "h-4 w-1/2" : "h-4 w-3/4"} />
                <Skeleton className="ml-auto h-5 w-20 rounded-full" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
