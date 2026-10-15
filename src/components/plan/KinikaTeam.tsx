import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { rolesForPlan } from "@shared/plan";
import { effectiveLimit, type Entitlements } from "@/services/subscriptionService";
import { hireAgent, quoteAgentTask, removeHire, type Agent, type AgentHire } from "@/services/agentService";
import type { FounderPlan } from "@/services/planService";

/**
 * "Kinika's team for this plan": the roles the plan needs, the seats the
 * subscription has, and one confirmation that lets Kinika hire. On the
 * trial there are no seats; the card says so and offers the two doors.
 */
export function KinikaTeam({ plan, agents, hires, ent, userId, canEdit, onChanged }: {
  plan: FounderPlan; agents: Agent[]; hires: AgentHire[]; ent: Entitlements | null; userId: string; canEdit: boolean; onChanged: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [estimates, setEstimates] = useState<Record<string, number>>({});
  const collapseKey = `kinika.team.collapsed.${plan.id}`;
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem(collapseKey) === "1"; } catch { return false; } });

  const agentBySlug = useMemo(() => new Map(agents.map((a) => [a.slug, a])), [agents]);
  const roles = useMemo(() => rolesForPlan(plan.targets.flatMap((t) => t.tasks)).filter((r) => agentBySlug.has(r.slug)), [plan, agentBySlug]);
  const activeHires = hires.filter((h) => h.status === "active");
  const hiredSlugs = new Set(activeHires.map((h) => h.agent.slug));
  const seats = ent ? effectiveLimit(ent, "agents") : 0;
  const unlimited = seats < 0;
  const free = unlimited ? Infinity : Math.max(0, seats - activeHires.length);
  const missing = roles.filter((r) => !hiredSlugs.has(r.slug));

  // One quote per role for "about N credits": the agent's price for one task × its open tasks.
  useEffect(() => {
    let active = true;
    (async () => {
      const out: Record<string, number> = {};
      for (const r of roles) {
        const a = agentBySlug.get(r.slug);
        if (!a) continue;
        try { const q = await quoteAgentTask(a, { brief: r.titles[0] ?? "", units: 1 }); out[r.slug] = Math.round(q.estimate * r.open); } catch { /* no rate yet */ }
      }
      if (active) setEstimates(out);
    })();
    return () => { active = false; };
  }, [roles, agentBySlug]);

  if (!roles.length) return null;

  const setCollapsedPersist = (v: boolean) => { setCollapsed(v); try { localStorage.setItem(collapseKey, v ? "1" : "0"); } catch { /* storage unavailable */ } };

  const hire = async (slugs: string[]) => {
    setBusy("hire");
    let n = 0;
    for (const slug of slugs) {
      const a = agentBySlug.get(slug);
      if (!a) continue;
      const r = await hireAgent(plan.brand_id, userId, a.id, "kinika");
      if (r.success) n++; else { toast.error(r.error ?? `Could not hire ${a.name}`); break; }
    }
    setBusy(null);
    if (n) toast(`Kinika hired ${n === 1 ? agentBySlug.get(slugs[0])?.name : `${n} roles`} for this plan`);
    await onChanged();
  };

  /** Swap: a hired role with no open tasks makes room for the next one. */
  const swap = async (outHire: AgentHire, inSlug: string) => {
    setBusy("swap");
    if (await removeHire(outHire.id)) await hire([inSlug]); else { setBusy(null); toast.error("Could not free the seat"); }
  };

  const seatWord = (n: number) => `${n} seat${n === 1 ? "" : "s"}`;

  // ── Trial: no seats ──
  if (seats === 0) {
    if (collapsed) {
      return (
        <div className="rounded-xl border border-border bg-card px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="font-ui text-[13px] text-muted-foreground"><strong className="font-semibold text-foreground">Doing it yourself.</strong> Kinika plans and advises; you do the tasks. {roles.length} role{roles.length === 1 ? "" : "s"} would take the marked ones off your hands if you change your mind.</p>
          <div className="flex items-center gap-3 whitespace-nowrap">
            <button onClick={() => setCollapsedPersist(false)} className="font-ui text-[13px] text-foreground underline">See the roles</button>
            <button onClick={() => navigate("/billing")} className="font-ui text-[13px] text-accent-foreground underline">Add seats</button>
          </div>
        </div>
      );
    }
    return (
      <section aria-labelledby="kteam-h" className="rounded-2xl border-2 border-primary bg-card p-5 md:p-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="font-ui text-[11px] uppercase tracking-[0.18em] text-accent-foreground">Kinika's team for this plan</span>
          <h2 id="kteam-h" className="font-display text-[22px] leading-tight">This plan needs {roles.length} role{roles.length === 1 ? "" : "s"}. Your trial has no agent seats yet.</h2>
          <p className="font-ui text-[14px] leading-relaxed text-muted-foreground max-w-[64ch]">On the trial, Kinika plans with you and advises you; you do the tasks yourself. With seats, Kinika hires these roles and they do the tasks listed below, in your voice and from your brand record, and you approve each result before it goes anywhere. Seats are how many agents can be on the team; credits are how much work they do.</p>
        </div>
        <RoleGrid roles={roles} agentBySlug={agentBySlug} estimates={estimates} hiredSlugs={hiredSlugs} note="needs a seat" />
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => navigate("/billing")} className="inline-flex items-center h-11 px-5 rounded-lg bg-primary text-primary-foreground font-ui text-[14px] font-medium">Add seats · from $20/month</button>
          <button onClick={() => setCollapsedPersist(true)} className="h-11 px-4 rounded-lg border border-border bg-card font-ui text-[14px]">Do it myself for now</button>
          <span className="font-ui text-[12px] text-muted-foreground">Solo: 2 seats, Kinika swaps roles in turn. Startup: 5 seats.</span>
        </div>
      </section>
    );
  }

  // ── Paid: seats exist ──
  const canHireNow = missing.slice(0, Math.min(missing.length, free === Infinity ? missing.length : free));
  const waiting = missing.slice(canHireNow.length);
  const idle = activeHires.filter((h) => { const r = roles.find((x) => x.slug === h.agent.slug); return r ? r.open === 0 : true; });

  return (
    <section aria-labelledby="kteam-h" className="rounded-2xl border border-border bg-card p-5 md:p-6 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <span className="font-ui text-[11px] uppercase tracking-[0.18em] text-muted-foreground inline-flex items-center gap-1.5"><Users size={11} /> Kinika's team for this plan</span>
          <h2 id="kteam-h" className="font-display text-[20px] leading-tight">
            {missing.length === 0 ? (roles.length === 1 ? "The one role this plan needs is on the team." : `All ${roles.length} roles are on the team.`) : unlimited ? `${roles.length} roles; Kinika can hire them all.` : `${roles.length} role${roles.length === 1 ? "" : "s"} · ${seatWord(seats)} · ${activeHires.length} on the team`}
          </h2>
        </div>
        {canEdit && canHireNow.length > 0 && (
          <button disabled={!!busy} onClick={() => hire(canHireNow.map((r) => r.slug))} className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-primary-foreground font-ui text-[13px] font-medium disabled:opacity-60">
            {busy === "hire" ? <Loader2 size={14} className="animate-spin" /> : null}
            Let Kinika hire {canHireNow.length === 1 ? agentBySlug.get(canHireNow[0].slug)?.name : `${canHireNow.length} roles`}
          </button>
        )}
      </div>
      <RoleGrid roles={roles} agentBySlug={agentBySlug} estimates={estimates} hiredSlugs={hiredSlugs} note="waits for a seat" />
      {waiting.length > 0 && (
        <p className="font-ui text-[12px] text-muted-foreground">
          {seatWord(seats)} for {roles.length} roles: Kinika hires in plan order and swaps when a role's tasks are done.
          {idle.length > 0 && canEdit && (
            <> {idle.map((h) => (
              <button key={h.id} disabled={!!busy} onClick={() => swap(h, waiting[0].slug)} className="ml-2 underline text-accent-foreground">Swap {h.agent.name} for {agentBySlug.get(waiting[0].slug)?.name}</button>
            ))}</>
          )}
          {idle.length === 0 && " "}
          <button onClick={() => navigate("/billing")} className="ml-1 underline">Add a seat</button>
        </p>
      )}
    </section>
  );
}

function RoleGrid({ roles, agentBySlug, estimates, hiredSlugs, note }: {
  roles: ReturnType<typeof rolesForPlan>; agentBySlug: Map<string, Agent>; estimates: Record<string, number>; hiredSlugs: Set<string>; note: string;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
      {roles.map((r) => {
        const a = agentBySlug.get(r.slug);
        const hired = hiredSlugs.has(r.slug);
        return (
          <div key={r.slug} className={cn("flex flex-col gap-1 p-3.5 rounded-xl border", hired ? "border-[hsl(var(--brand-good))]/40 bg-[hsl(var(--brand-good-soft))]/40" : "border-border bg-muted/40")}>
            <span className="font-ui text-[14px] font-semibold">{a?.name ?? r.slug}</span>
            {a?.tagline && <span className="font-ui text-[12px] text-muted-foreground leading-relaxed">{a.tagline}</span>}
            <span className="font-ui text-[11px] uppercase tracking-[0.14em] text-muted-foreground mt-1.5">{hired ? "Doing for you" : "Would do for you"}</span>
            <ul className="flex flex-col gap-1">
              {r.titles.slice(0, 4).map((t) => (
                <li key={t} className="font-ui text-[13px] leading-snug text-foreground flex gap-2"><span aria-hidden className="text-muted-foreground">·</span><span>{t}</span></li>
              ))}
              {r.titles.length > 4 && <li className="font-ui text-[12px] text-muted-foreground">and {r.titles.length - 4} more</li>}
            </ul>
            <span className="font-ui text-[12px] text-muted-foreground mt-1">{r.count} task{r.count === 1 ? "" : "s"}{estimates[r.slug] ? ` · about ${estimates[r.slug]} credits` : ""}{hired ? "" : " · or you do these yourself"}</span>
            <span className={cn("font-ui text-[11px]", hired ? "text-[hsl(var(--brand-good))]" : "text-muted-foreground")}>{hired ? "on the team" : note}</span>
          </div>
        );
      })}
    </div>
  );
}

export default KinikaTeam;
