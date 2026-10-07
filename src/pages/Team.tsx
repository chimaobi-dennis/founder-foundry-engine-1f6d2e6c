import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Users, Plus, Pause, Play, Check, X, Loader2, ChevronDown, ChevronUp,
  Copy, ArrowUpRight, Coins, AlertTriangle, Clock, Sparkles, RefreshCw, Repeat, Archive, Webhook,
} from "lucide-react";
import { useBrand } from "@/hooks/use-brand";
import { useAuth } from "@/contexts/AuthContext";
import { useCreditBalance } from "@/hooks/use-credit-balance";
import { usePricingModal } from "@/contexts/PricingModalContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { QuoteChip } from "@/components/billing/QuoteChip";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  listAgents, listHires, hireAgent, setHireStatus, removeHire,
  quoteAgentTask, createRun, listRuns, getRun, resumeRun, cancelRun, kickRun,
  listPendingApprovals, decideApproval, outputItems, outputToText,
  listAutomations, createAutomation, setAutomationStatus, runAutomationNow, SCHEDULE_INTERVALS,
  type Agent, type AgentHire, type AutomationRun, type Approval, type RunStep, type Automation, type ScheduleInterval,
} from "@/services/agentService";
import type { Quote } from "@/services/pricingService";
import { ConnectionsSection, DiffTable, CodeReview } from "@/components/team/Connections";
import { DescribeIt } from "@/components/team/DescribeIt";
import { listConnections, type ToolConnection } from "@/services/connectionService";
import { SUPABASE_CONFIG } from "@/config/supabaseConfig";
import { getEntitlements, planAllows, planLimitMessage, effectiveLimit, type Entitlements } from "@/services/subscriptionService";
import { getMyRole, roleAtLeast, type BrandRole } from "@/services/teamMembersService";
import { PeopleSection } from "@/components/team/People";
import { useProfile } from "@/hooks/use-profile";

const PLATFORMS = ["instagram", "linkedin", "x", "facebook", "tiktok", "email"];

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  queued: { label: "Queued", cls: "bg-muted text-muted-foreground" },
  running: { label: "Working", cls: "bg-primary/10 text-primary" },
  waiting_approval: { label: "Needs you", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  paused: { label: "Paused", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  completed: { label: "Done", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  failed: { label: "Stopped", cls: "bg-destructive/10 text-destructive" },
  cancelled: { label: "Cancelled", cls: "bg-muted text-muted-foreground" },
};

function CostDots({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`cost level ${n} of 3`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={cn("w-1.5 h-1.5 rounded-full", i <= n ? "bg-primary" : "bg-border")} />
      ))}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const s = STATUS_LABEL[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-ui font-medium", s.cls)}>{s.label}</span>;
}

export default function Team() {
  const { activeBrand } = useBrand();
  const { user } = useAuth();
  const { balance, loading: balanceLoading, refresh: refetchBalance } = useCreditBalance();
  const { openPricingModal } = usePricingModal();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  const [agents, setAgents] = useState<Agent[]>([]);
  const [hires, setHires] = useState<AgentHire[]>([]);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [connections, setConnections] = useState<ToolConnection[]>([]);
  const [ent, setEnt] = useState<Entitlements | null>(null);
  const [myRole, setMyRole] = useState<BrandRole | null>(null);
  const { profile } = useProfile();
  const [loading, setLoading] = useState(true);
  const [taskAgent, setTaskAgent] = useState<Agent | null>(null);
  const [openRunId, setOpenRunId] = useState<string | null>(params.get("run"));

  const brandId = activeBrand?.id;

  const reload = useCallback(async () => {
    if (!brandId) return;
    const [a, h, r, ap, au, co, en, role] = await Promise.all([listAgents(), listHires(brandId), listRuns(brandId), listPendingApprovals(brandId), listAutomations(brandId), listConnections(brandId), activeBrand?.user_id ? getEntitlements(activeBrand.user_id) : Promise.resolve(null), getMyRole(brandId, true)]);
    setEnt(en);
    setMyRole(role);
    setAgents(a);
    setHires(h);
    setRuns(r);
    setApprovals(ap);
    setAutomations(au);
    setConnections(co);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId, activeBrand?.user_id]);

  useEffect(() => {
    setLoading(true);
    reload().finally(() => setLoading(false));
  }, [reload]);

  // Runs in flight: poll gently so the founder sees steps complete.
  const inFlight = runs.some((r) => r.status === "queued" || r.status === "running");
  useEffect(() => {
    if (!inFlight) return;
    const t = setInterval(() => { reload(); refetchBalance(); }, 4000);
    return () => clearInterval(t);
  }, [inFlight, reload, refetchBalance]);

  // Until the membership migration is applied the role RPC is absent; the
  // brand's owner must still be treated as the owner.
  const effectiveRole: BrandRole | null = myRole ?? (activeBrand && user?.id && activeBrand.user_id === user.id ? "owner" : null);
  const canEdit = roleAtLeast(effectiveRole, "editor");
  const isOwner = effectiveRole === "owner";
  const hiredIds = useMemo(() => new Set(hires.map((h) => h.agent_id)), [hires]);
  const available = agents.filter((a) => !hiredIds.has(a.id));

  if (!activeBrand) {
    return (
      <div className="px-4 md:px-8 py-12 max-w-[1180px] mx-auto">
        <h1 className="font-display text-3xl text-foreground">Your team</h1>
        <p className="font-ui text-[13px] text-muted-foreground mt-2">Pick or create a brand first. Agents work from your Brand DNA.</p>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-8 py-8 max-w-[1180px] mx-auto space-y-10">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{activeBrand.name}</span>
          <h1 className="font-display text-3xl text-foreground mt-1">Your team</h1>
          <p className="font-ui text-[13px] text-muted-foreground mt-1 max-w-xl">
            {effectiveRole === "viewer" ? "You can see everything here. Ask the owner for the editor role to give tasks or approve work." : "Hire an agent, give it a task, review the result. Every task shows its cost before it runs."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {ent && (
            <button onClick={() => navigate("/billing")} className="font-ui text-[11px] text-muted-foreground hover:text-foreground" title="Your plan">
              {ent.plan_name} · {hires.filter((h) => h.status === "active").length}/{ent.agents < 0 ? "∞" : ent.agents + ent.extra_agent_seats} agents
            </button>
          )}
          <button onClick={() => { reload(); refetchBalance(); }} className="inline-flex items-center gap-1.5 text-[12px] font-ui text-muted-foreground hover:text-foreground">
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-muted-foreground" size={20} /></div>
      ) : (
        <>
          {/* ── Describe it ── */}
          {canEdit && <DescribeIt
            brandId={brandId!}
            userId={user!.id}
            agents={hires.filter((h) => h.status === "active").map((h) => h.agent)}
            connections={connections}
            stage={activeBrand.journey_stage}
            balance={balance}
            balanceLoading={balanceLoading}
            onTopUp={() => openPricingModal({ currentBalance: balance })}
            onCreated={(id) => { if (id) setOpenRunId(id); reload(); refetchBalance(); }}
          />}

          {/* ── People ── */}
          <PeopleSection
            brandId={brandId!}
            userId={user!.id}
            myRole={effectiveRole}
            ownerName={isOwner ? (profile?.full_name || "You") : "Workspace owner"}
            memberLimit={ent ? effectiveLimit(ent, "members") : 1}
            onChanged={() => reload()}
          />

          {/* ── Needs you ── */}
          {approvals.length > 0 && (
            <section>
              <SectionTitle icon={<AlertTriangle size={14} className="text-amber-500" />} title="Needs you" count={approvals.length} />
              <div className="grid gap-3">
                {approvals.map((ap) => (
                  <ApprovalCard
                    key={ap.id}
                    approval={ap}
                    userId={user!.id}
                    canDecide={canEdit}
                    onDecided={() => { reload(); refetchBalance(); }}
                    onOpenRun={() => setOpenRunId(ap.run_id)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── Hired agents ── */}
          <section>
            <SectionTitle icon={<Users size={14} className="text-primary" />} title="On your team" count={hires.length} />
            {hires.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 p-6">
                <p className="font-display text-[15px] text-foreground">No one hired yet.</p>
                <p className="font-ui text-[13px] text-muted-foreground mt-1">Start with the Copywriter: captions in your voice, reviewed before anything goes out.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {hires.map((h) => (
                  <div key={h.id} className="rounded-xl border border-card-border bg-card/60 p-5 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-display text-lg text-foreground">{h.agent.name}</h3>
                          <CostDots n={h.agent.cost_indicator} />
                          {h.status === "paused" && <StatusPill status="paused" />}
                        </div>
                        <p className="font-ui text-[12px] text-muted-foreground mt-0.5">{h.agent.tagline}</p>
                      </div>
                      <button
                        onClick={async () => { await setHireStatus(h.id, h.status === "active" ? "paused" : "active"); reload(); }}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={h.status === "active" ? "Pause agent" : "Resume agent"}
                        title={h.status === "active" ? "Pause" : "Resume"}
                      >
                        {h.status === "active" ? <Pause size={14} /> : <Play size={14} />}
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-auto">
                      <button
                        onClick={() => setTaskAgent(h.agent)}
                        disabled={h.status !== "active" || !canEdit}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[12px] font-ui font-medium disabled:opacity-50"
                      >
                        <Sparkles size={12} /> Give a task
                      </button>
                      <button
                        onClick={async () => { if (await removeHire(h.id)) { toast(`${h.agent.name} removed from your team`); reload(); } }}
                        className="text-[12px] font-ui text-muted-foreground hover:text-destructive ml-auto"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Hire ── */}
          {canEdit && available.length > 0 && (
            <section>
              <SectionTitle icon={<Plus size={14} className="text-muted-foreground" />} title="Hire" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {available.map((a) => (
                  <div key={a.id} className="rounded-xl border border-card-border bg-card/30 p-5 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-lg text-foreground">{a.name}</h3>
                      <CostDots n={a.cost_indicator} />
                    </div>
                    <p className="font-ui text-[12px] text-muted-foreground leading-relaxed">{a.description}</p>
                    <p className="font-ui text-[11px] text-muted-foreground/80">
                      {a.cost_indicator === 3 ? "Uses more credits: reads and checks more before answering." : a.cost_indicator === 2 ? "Standard credit use." : "Light on credits."}
                    </p>
                    <button
                      onClick={async () => {
                        if (ent) {
                          const v = planAllows(ent, "agents", hires.filter((h) => h.status === "active").length);
                          if (v.ok === false) { toast.error(v.reason, { action: { label: "Plans", onClick: () => navigate("/billing") } }); return; }
                        }
                        const r = await hireAgent(brandId!, user!.id, a.id);
                        if (r.success) { toast(`${a.name} joined your team`); reload(); }
                        else toast.error(planLimitMessage(r.error) ?? r.error ?? "Could not hire", planLimitMessage(r.error) ? { action: { label: "Plans", onClick: () => navigate("/billing") } } : undefined);
                      }}
                      className="mt-auto inline-flex items-center gap-1.5 self-start px-3 py-1.5 rounded-lg border border-border text-[12px] font-ui hover:border-primary"
                    >
                      <Plus size={12} /> Hire {a.name}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Connected tools + changes ── */}
          <ConnectionsSection
            brandId={brandId!}
            userId={user!.id}
            autonomousAllowed={!!ent?.autonomous_publishing}
            canConnect={isOwner}
            canRun={canEdit}
            agents={agents}
            balance={balance}
            balanceLoading={balanceLoading}
            onTopUp={() => openPricingModal({ currentBalance: balance })}
            onRunStarted={(id) => { setOpenRunId(id); reload(); }}
          />

          {/* ── Automations ── */}
          {automations.length > 0 && (
            <section>
              <SectionTitle icon={<Repeat size={14} className="text-muted-foreground" />} title="On a schedule" count={automations.length} />
              <div className="grid gap-2">
                {automations.map((au) => (
                  <AutomationRow key={au.id} automation={au} userId={user!.id} onChanged={() => { reload(); refetchBalance(); }} onOpenRun={(id) => setOpenRunId(id)} />
                ))}
              </div>
              <p className="font-ui text-[11px] text-muted-foreground mt-2">
                Scheduled runs start on their own once the runner tick is set up (supabase/sql/phase1_cron.sql). "Run now" always works.
              </p>
            </section>
          )}

          {/* ── Runs ── */}
          <section>
            <SectionTitle icon={<Clock size={14} className="text-muted-foreground" />} title="Recent work" count={runs.length} />
            {runs.length === 0 ? (
              <p className="font-ui text-[13px] text-muted-foreground">Nothing yet. Give an agent a task and it shows up here with its cost.</p>
            ) : (
              <div className="grid gap-2">
                {runs.map((r) => (
                  <RunRow
                    key={r.id}
                    run={r}
                    open={openRunId === r.id}
                    onToggle={() => { const next = openRunId === r.id ? null : r.id; setOpenRunId(next); if (next) params.set("run", next); else params.delete("run"); setParams(params, { replace: true }); }}
                    onChanged={() => { reload(); refetchBalance(); }}
                    onTopUp={() => openPricingModal({ currentBalance: balance })}
                    onOpenInStudio={(run) => navigate(`/content-studio/new?fromRun=${run.id}`)}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {taskAgent && (
        <TaskDialog
          agent={taskAgent}
          balance={balance}
          balanceLoading={balanceLoading}
          onClose={() => setTaskAgent(null)}
          onTopUp={() => openPricingModal({ currentBalance: balance })}
          onCreate={async (name, input, autonomous, repeat) => {
            const policy = { approval: autonomous ? "autonomous" : "review_first" } as const;
            if (repeat !== "once") {
              const r = await createAutomation({ brandId: brandId!, userId: user!.id, agent: taskAgent, name, input, interval: repeat === "webhook" ? "weekly" : repeat, trigger: repeat === "webhook" ? "webhook" : "schedule", policy });
              if (!r.success) { toast.error(planLimitMessage(r.error) ?? r.error ?? "Could not set up the schedule"); return false; }
              toast(repeat === "webhook" ? "Webhook ready; copy its URL from the schedule list" : `${taskAgent.name} will do this ${SCHEDULE_INTERVALS.find((i) => i.value === repeat)?.label.toLowerCase() ?? repeat}`);
              setTaskAgent(null);
              if (r.run) setOpenRunId(r.run.id);
              reload();
              return true;
            }
            const r = await createRun({ brandId: brandId!, userId: user!.id, agent: taskAgent, name, input, policy });
            if (!r.success) { toast.error(r.error ?? "Could not start the task"); return false; }
            toast(`${taskAgent.name} is on it`);
            setTaskAgent(null);
            setOpenRunId(r.run!.id);
            reload();
            return true;
          }}
        />
      )}
    </div>
  );
}

function SectionTitle({ icon, title, count }: { icon: React.ReactNode; title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {icon}
      <h2 className="font-ui text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{title}</h2>
      {count != null && count > 0 && <span className="font-ui text-[11px] text-muted-foreground">· {count}</span>}
    </div>
  );
}

// ─── Task dialog ────────────────────────────────────────────

function TaskDialog({ agent, balance, balanceLoading, onClose, onTopUp, onCreate }: {
  agent: Agent;
  balance: number;
  balanceLoading: boolean;
  onClose: () => void;
  onTopUp: () => void;
  onCreate: (name: string, input: { brief: string; units: number; platforms: string[] }, autonomous: boolean, repeat: ScheduleInterval | "once" | "webhook") => Promise<boolean>;
}) {
  const [brief, setBrief] = useState("");
  const [repeat, setRepeat] = useState<ScheduleInterval | "once" | "webhook">("once");
  const [name, setName] = useState("");
  const [units, setUnits] = useState(agent.slug === "copywriter" ? 3 : 1);
  const [platforms, setPlatforms] = useState<string[]>(agent.slug === "researcher" ? [] : ["instagram"]);
  const [autonomous, setAutonomous] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const effectiveUnits = agent.slug === "designer" ? Math.max(1, platforms.length) : units;

  useEffect(() => {
    let active = true;
    quoteAgentTask(agent, { brief, units: effectiveUnits }).then((q) => { if (active) setQuote(q); });
    return () => { active = false; };
  }, [agent, effectiveUnits, brief]);

  const insufficient = !balanceLoading && !!quote && quote.max > balance;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Task for your {agent.name}</DialogTitle>
          <DialogDescription className="font-ui text-[12px]">
            {agent.tagline} Reviewed by you before anything leaves Kinika unless you say otherwise.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="task-brief" className="text-[12px]">What do you need?</Label>
            <Textarea
              id="task-brief"
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={4}
              placeholder={agent.slug === "researcher" ? "e.g. Who are our three closest competitors and where do we differ?" : agent.slug === "designer" ? "e.g. A launch-week campaign for our new membership tier" : "e.g. Three captions announcing Saturday's cultural night"}
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="task-name" className="text-[12px]">Name (optional)</Label>
              <Input id="task-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={`${agent.name} task`} className="mt-1" />
            </div>
            {agent.slug !== "designer" && (
              <div>
                <Label htmlFor="task-units" className="text-[12px]">How many {agent.unit_label}s</Label>
                <Input id="task-units" type="number" min={1} max={20} value={units} onChange={(e) => setUnits(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} className="mt-1" />
              </div>
            )}
          </div>
          {agent.slug !== "researcher" && (
            <div>
              <Label className="text-[12px]">Platforms</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {PLATFORMS.map((p) => {
                  const on = platforms.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPlatforms(on ? platforms.filter((x) => x !== p) : [...platforms, p])}
                      className={cn("px-2.5 py-1 rounded-full text-[11px] font-ui border capitalize", on ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground")}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div>
            <Label htmlFor="task-repeat" className="text-[12px]">Repeat</Label>
            <select
              id="task-repeat"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value as ScheduleInterval | "once" | "webhook")}
              className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-[13px] font-ui"
            >
              <option value="once">Just once</option>
              {SCHEDULE_INTERVALS.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
              <option value="webhook">When a webhook fires</option>
            </select>
            {repeat === "webhook" ? (
              <p className="font-ui text-[11px] text-muted-foreground mt-1">Creates a webhook URL you can call from another system (Zapier, a form, your app). Each call starts one run with the call's data attached.</p>
            ) : repeat !== "once" && (
              <p className="font-ui text-[11px] text-muted-foreground mt-1">Runs now, then {SCHEDULE_INTERVALS.find((i) => i.value === repeat)?.label.toLowerCase()}. Each run is quoted and reviewed the same way; pause it any time.</p>
            )}
          </div>
          <label className="flex items-start gap-2 text-[12px] font-ui text-muted-foreground">
            <input type="checkbox" checked={autonomous} onChange={(e) => setAutonomous(e.target.checked)} className="mt-0.5" />
            <span>Skip my review. The result lands in Recent work without waiting for me. Anything that publishes or changes a connected tool is still held for approval unless your plan includes autonomous changes.</span>
          </label>
          {quote && (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <QuoteChip
                estimate={quote.estimate}
                max={quote.max}
                mode={quote.mode}
                balance={balance}
                balanceLoading={balanceLoading}
                retailUsd={quote.retailUsd}
                breakdown={quote.breakdown}
                onTopUp={onTopUp}
              />
              <span className="text-[11px] font-ui text-muted-foreground inline-flex items-center gap-1"><Coins size={11} /> {balance} available</span>
            </div>
          )}
        </div>
        <DialogFooter>
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-[12px] font-ui text-muted-foreground">Cancel</button>
          <button
            disabled={submitting || !brief.trim() || !quote || insufficient}
            onClick={async () => {
              setSubmitting(true);
              const ok = await onCreate(name, { brief: brief.trim(), units: effectiveUnits, platforms }, autonomous, repeat);
              setSubmitting(false);
              if (!ok) return;
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-[12px] font-ui font-medium disabled:opacity-50"
          >
            {submitting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {insufficient ? "Top up to run" : repeat === "once" ? "Run" : repeat === "webhook" ? "Create webhook" : "Run and schedule"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Approval card ──────────────────────────────────────────

function ApprovalCard({ approval, userId, canDecide = true, onDecided, onOpenRun }: { approval: Approval; userId: string; canDecide?: boolean; onDecided: () => void; onOpenRun: () => void }) {
  const [busy, setBusy] = useState<"approved" | "rejected" | null>(null);
  const [note, setNote] = useState("");
  const items = outputItems(approval.payload?.output);
  const agentName = approval.run?.agent?.name ?? "Agent";

  const decide = async (d: "approved" | "rejected") => {
    setBusy(d);
    const r = await decideApproval(approval.id, d, userId, note.trim() || undefined);
    setBusy(null);
    if (!r.success) { toast.error(r.error ?? "Could not record your decision"); return; }
    toast(d === "approved" ? "Approved" : "Sent back");
    onDecided();
  };

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="font-display text-[15px] text-foreground">{approval.title}</p>
          <p className="font-ui text-[12px] text-muted-foreground mt-0.5">
            {(approval.payload as any)?.code ? `${(approval.payload as any).code.files?.length ?? 0} file${((approval.payload as any).code.files?.length ?? 0) === 1 ? "" : "s"} to review` : (approval.payload as any)?.diff ? `${(approval.payload as any).diff.lines?.length ?? 0} field change${((approval.payload as any).diff.lines?.length ?? 0) === 1 ? "" : "s"} to review` : items.length ? `${items.length} item${items.length === 1 ? "" : "s"} ready` : "Result ready"} · {Number(approval.run?.credits_captured ?? 0)} credits used
          </p>
        </div>
        <button onClick={onOpenRun} className="text-[12px] font-ui text-muted-foreground hover:text-foreground inline-flex items-center gap-1">Open run <ArrowUpRight size={12} /></button>
      </div>
      {(approval.payload as any)?.code ? <CodeReview code={(approval.payload as any).code} /> : (approval.payload as any)?.diff ? <DiffTable diff={(approval.payload as any).diff} /> : <OutputView output={approval.payload?.output ?? null} compact />}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note for the log" className="max-w-xs h-8 text-[12px]" />
        <button onClick={() => decide("approved")} disabled={!!busy || !canDecide} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[12px] font-ui font-medium disabled:opacity-50">
          {busy === "approved" ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Approve
        </button>
        <button onClick={() => decide("rejected")} disabled={!!busy || !canDecide} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-[12px] font-ui disabled:opacity-50">
          {busy === "rejected" ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />} Send back
        </button>
        <span className="text-[11px] font-ui text-muted-foreground">{approval.kind === "review_publish" ? "Approving publishes these posts to your linked accounts. Deleting them afterwards works only where the network allows it." : approval.kind === "review_code" ? "Approving opens the pull request; closing it later reverts everything." : (approval.payload as any)?.diff ? "Approving applies these changes; each one can be reverted afterwards." : "Approving keeps the result; sending back cancels the run."} Credits already used stay used.</span>
      </div>
    </div>
  );
}

// ─── Automation row ─────────────────────────────────────────

function AutomationRow({ automation, userId, onChanged, onOpenRun }: { automation: Automation; userId: string; onChanged: () => void; onOpenRun: (runId: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const isWebhook = automation.trigger_type === "webhook";
  const label = isWebhook ? "Webhook" : SCHEDULE_INTERVALS.find((i) => i.value === automation.schedule_interval)?.label ?? automation.schedule_interval ?? "";
  const next = automation.next_run_at ? new Date(automation.next_run_at) : null;
  const paused = automation.status === "paused";
  const webhookUrl = isWebhook && automation.webhook_secret ? `${SUPABASE_CONFIG.url}/functions/v1/webhook-trigger?automation=${automation.id}&key=${automation.webhook_secret}` : null;

  const act = async (what: string, fn: () => Promise<unknown>) => {
    setBusy(what);
    await fn();
    setBusy(null);
    onChanged();
  };

  return (
    <div className="rounded-xl border border-card-border bg-card/40 px-5 py-3.5 flex items-center gap-3 flex-wrap">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-display text-[15px] text-foreground truncate">{automation.name}</span>
          {paused ? <StatusPill status="paused" /> : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-ui font-medium bg-primary/10 text-primary">{isWebhook && <Webhook size={10} />}{label}</span>}
        </div>
        {webhookUrl && (
          <p className="font-ui text-[11px] text-muted-foreground mt-1 flex items-center gap-2 min-w-0">
            <code className="truncate bg-muted/60 rounded px-1.5 py-0.5 text-[10px]">POST {webhookUrl}</code>
            <button onClick={() => navigator.clipboard?.writeText(webhookUrl).then(() => toast("Webhook URL copied")).catch(() => toast.error("Copy failed"))} className="inline-flex items-center gap-1 shrink-0 hover:text-foreground"><Copy size={11} /> copy</button>
          </p>
        )}
        <p className="font-ui text-[12px] text-muted-foreground mt-0.5 truncate">
          {automation.agent?.name ?? "Agent"} · {automation.task_input.units ?? 1} {automation.agent?.unit_label ?? "item"}{(automation.task_input.units ?? 1) === 1 ? "" : "s"}
          {next && !paused && !isWebhook ? ` · next ${next.toLocaleString()}` : ""}
          {automation.last_run_at ? ` · last ${new Date(automation.last_run_at).toLocaleDateString()}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          disabled={!!busy || paused}
          onClick={() => act("run", async () => { const r = await runAutomationNow(automation, userId); if (!r.success) toast.error(r.error ?? "Could not start"); else if (r.run) onOpenRun(r.run.id); })}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-[12px] font-ui hover:border-primary disabled:opacity-50"
        >
          {busy === "run" ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Run now
        </button>
        <button
          disabled={!!busy}
          onClick={() => act("toggle", () => setAutomationStatus(automation.id, paused ? "active" : "paused"))}
          className="text-muted-foreground hover:text-foreground"
          aria-label={paused ? "Resume schedule" : "Pause schedule"}
          title={paused ? "Resume" : "Pause"}
        >
          {paused ? <Play size={14} /> : <Pause size={14} />}
        </button>
        <button
          disabled={!!busy}
          onClick={() => act("archive", () => setAutomationStatus(automation.id, "archived"))}
          className="text-muted-foreground hover:text-destructive"
          aria-label="Remove schedule"
          title="Remove"
        >
          <Archive size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Run row + step log ─────────────────────────────────────

function RunRow({ run, open, onToggle, onChanged, onTopUp, onOpenInStudio }: {
  run: AutomationRun;
  open: boolean;
  onToggle: () => void;
  onChanged: () => void;
  onTopUp: () => void;
  onOpenInStudio: (run: AutomationRun) => void;
}) {
  const [detail, setDetail] = useState<AutomationRun | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    getRun(run.id).then((d) => { if (active) setDetail(d); });
    return () => { active = false; };
  }, [open, run.id, run.status, run.credits_captured]);

  const agentName = run.agent?.name ?? "Agent";
  const summary = typeof run.output?.summary === "string" ? run.output.summary : null;
  const insufficient = run.status === "paused" && /Not enough credits/i.test(run.paused_reason ?? "");

  return (
    <div className="rounded-xl border border-card-border bg-card/40">
      <button onClick={onToggle} className="w-full text-left px-5 py-3.5 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display text-[15px] text-foreground truncate">{run.name}</span>
            <StatusPill status={run.status} />
          </div>
          <p className="font-ui text-[12px] text-muted-foreground mt-0.5 truncate">
            {agentName} · {new Date(run.created_at).toLocaleString()} · {Number(run.credits_captured)} of up to {run.credits_reserved} credits
            {summary ? ` · ${summary}` : ""}
          </p>
        </div>
        {open ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-border/60 space-y-4">
          {run.status === "paused" && (
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex items-center gap-3 flex-wrap">
              <AlertTriangle size={14} className="text-amber-500" />
              <span className="font-ui text-[12px] text-foreground flex-1">{run.paused_reason}</span>
              {insufficient ? (
                <button onClick={onTopUp} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[12px] font-ui">Top up</button>
              ) : null}
              <button
                disabled={busy}
                onClick={async () => { setBusy(true); const r = await resumeRun(run.id, insufficient ? undefined : { credits_per_run: run.budget.credits_per_run + 100 }); setBusy(false); if (!r.success) toast.error(r.error ?? "Could not resume"); onChanged(); }}
                className="px-3 py-1.5 rounded-lg border border-border text-[12px] font-ui"
              >
                {insufficient ? "Try again" : "Raise cap by 100 and continue"}
              </button>
              <button disabled={busy} onClick={async () => { setBusy(true); await cancelRun(run.id); setBusy(false); onChanged(); }} className="text-[12px] font-ui text-muted-foreground">Cancel run</button>
            </div>
          )}
          {run.status === "failed" && run.error && (
            <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 font-ui text-[12px] text-foreground">{run.error}</div>
          )}
          {(run.status === "queued" || run.status === "running") && (
            <div className="mt-4 flex items-center gap-2 font-ui text-[12px] text-muted-foreground">
              <Loader2 size={12} className="animate-spin" /> {agentName} is working. This updates on its own.
              <button onClick={() => kickRun(run.id).then(onChanged)} className="underline">Nudge</button>
            </div>
          )}

          {detail?.steps && detail.steps.length > 0 && (
            <div className="mt-4">
              <p className="font-ui text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">Steps</p>
              <ol className="space-y-1.5">
                {detail.steps.map((s) => <StepLine key={s.id} step={s} />)}
              </ol>
            </div>
          )}

          {run.status === "completed" && (run.output as any)?.connector?.summary && (
            <p className="font-ui text-[12px] text-foreground mt-3 inline-flex items-center gap-1.5"><Check size={12} className="text-emerald-500" /> {(run.output as any).connector.summary}</p>
          )}
          {run.output && (run.status === "completed" || run.status === "waiting_approval") && (
            <div>
              <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                <p className="font-ui text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Result</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigator.clipboard?.writeText(outputToText(run.output)).then(() => toast("Copied")).catch(() => toast.error("Copy failed"))}
                    className="inline-flex items-center gap-1 text-[12px] font-ui text-muted-foreground hover:text-foreground"
                  >
                    <Copy size={12} /> Copy all
                  </button>
                  {run.agent?.slug === "designer" && run.status === "completed" && (
                    <button onClick={() => onOpenInStudio(run)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[12px] font-ui">
                      Create campaign from this <ArrowUpRight size={12} />
                    </button>
                  )}
                </div>
              </div>
              <OutputView output={run.output} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StepLine({ step }: { step: RunStep }) {
  const icon = step.status === "done" ? <Check size={12} className="text-emerald-500" />
    : step.status === "running" ? <Loader2 size={12} className="animate-spin text-primary" />
    : step.status === "waiting" ? <Clock size={12} className="text-amber-500" />
    : step.status === "failed" ? <X size={12} className="text-destructive" />
    : <span className="w-3 h-3 rounded-full border border-border inline-block" />;
  return (
    <li className="flex items-center gap-2 font-ui text-[12px]">
      {icon}
      <span className="text-foreground">{step.name}</span>
      {step.credits_captured > 0 && <span className="text-muted-foreground">· {Number(step.credits_captured)} credits</span>}
      {step.cost_usd > 0 && <span className="text-muted-foreground/70">· ${Number(step.cost_usd).toFixed(4)}</span>}
      {step.error && <span className="text-destructive truncate">· {step.error}</span>}
    </li>
  );
}

// ─── Output renderer ────────────────────────────────────────

function OutputView({ output, compact = false }: { output: Record<string, unknown> | null; compact?: boolean }) {
  if (!output) return null;
  const o = output as any;
  const items = outputItems(output);
  const shown = compact ? items.slice(0, 2) : items;

  return (
    <div className={cn("space-y-3", compact && "mt-3")}>
      {typeof o.brief === "string" && <p className="font-ui text-[13px] text-foreground leading-relaxed">{o.brief}</p>}
      {o.visual_direction && typeof o.visual_direction === "object" && !compact && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 font-ui text-[12px]">
          {Object.entries(o.visual_direction).map(([k, v]) => (
            <div key={k}><dt className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</dt><dd className="text-foreground">{String(v)}</dd></div>
          ))}
        </dl>
      )}
      {Array.isArray(o.headlines) && (
        <ul className="font-ui text-[13px] text-foreground list-disc pl-5 space-y-0.5">
          {o.headlines.slice(0, compact ? 3 : 10).map((h: string, i: number) => <li key={i}>{h}</li>)}
        </ul>
      )}
      {shown.map((it, i) => (
        <div key={i} className="rounded-lg border border-border/60 bg-background/40 p-3">
          <div className="flex items-center gap-2 mb-1">
            {it.platform && <span className="font-ui text-[10px] uppercase tracking-wider text-muted-foreground">{it.platform}</span>}
            {it.title && <span className="font-ui text-[12px] text-foreground">{it.title}</span>}
          </div>
          <p className="font-ui text-[13px] text-foreground whitespace-pre-wrap">{it.body}</p>
          {it.hashtags?.length ? <p className="font-ui text-[11px] text-muted-foreground mt-1">{it.hashtags.map((h) => (h.startsWith("#") ? h : "#" + h)).join(" ")}</p> : null}
          {it.cta && <p className="font-ui text-[12px] text-primary mt-1">{it.cta}</p>}
        </div>
      ))}
      {compact && items.length > shown.length && <p className="font-ui text-[11px] text-muted-foreground">+ {items.length - shown.length} more</p>}
      {Array.isArray(o.findings) && !compact && (
        <div className="space-y-2">
          {o.findings.map((f: any, i: number) => (
            <div key={i} className="rounded-lg border border-border/60 bg-background/40 p-3">
              <p className="font-ui text-[13px] text-foreground font-medium">{f.heading} <span className="text-[10px] uppercase text-muted-foreground ml-1">{f.confidence} · {String(f.source ?? "").replace(/_/g, " ")}</span></p>
              <p className="font-ui text-[13px] text-foreground mt-1 whitespace-pre-wrap">{f.body}</p>
            </div>
          ))}
        </div>
      )}
      {Array.isArray(o.recommendations) && !compact && (
        <div><p className="font-ui text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1">Recommendations</p>
          <ul className="font-ui text-[13px] text-foreground list-disc pl-5 space-y-0.5">{o.recommendations.map((r: string, i: number) => <li key={i}>{r}</li>)}</ul></div>
      )}
      {Array.isArray(o.open_questions) && !compact && (
        <div><p className="font-ui text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1">To validate</p>
          <ul className="font-ui text-[13px] text-foreground list-disc pl-5 space-y-0.5">{o.open_questions.map((r: string, i: number) => <li key={i}>{r}</li>)}</ul></div>
      )}
      {typeof o.notes === "string" && o.notes && !compact && <p className="font-ui text-[12px] text-muted-foreground italic">{o.notes}</p>}
    </div>
  );
}
