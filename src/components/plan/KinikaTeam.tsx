import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { rolesForPlan } from "@shared/plan";
import { effectiveLimit, type Entitlements } from "@/services/subscriptionService";
import { quoteAgentTask, type Agent, type AgentHire } from "@/services/agentService";
import type { FounderPlan } from "@/services/planService";

/**
 * "Kinika's team for this plan": the roles the plan calls for and who is on
 * the team because of it. Staffing is Kinika's: a role joins the team when
 * its first task is set up, if a seat is free. The founder sees seats only
 * when they bind. On the trial there are no seats; the card says so once.
 */
export function KinikaTeam({ plan, agents, hires, ent }: {
  plan: FounderPlan; agents: Agent[]; hires: AgentHire[]; ent: Entitlements | null; userId: string; canEdit: boolean; onChanged: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const [estimates, setEstimates] = useState<Record<string, number>>({});
  const collapseKey = `kinika.team.collapsed.${plan.id}`;
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem(collapseKey) === "1"; } catch { return false; } });

  const agentBySlug = useMemo(() => new Map(agents.map((a) => [a.slug, a])), [agents]);
  const roles = useMemo(() => rolesForPlan(plan.targets.flatMap((t) => t.tasks)).filter((r) => agentBySlug.has(r.slug)), [plan, agentBySlug]);
  const activeHires = hires.filter((h) => h.status === "active");
  const onTeam = new Set(activeHires.map((h) => h.agent.slug));
  const seats = ent ? effectiveLimit(ent, "agents") : 0;
  const unlimited = seats < 0;
  const agentTasks = roles.reduce((n, r) => n + r.count, 0);

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

  // ── Trial: no seats ──
  if (seats === 0) {
    if (collapsed) {
      return (
        <div className="rounded-xl border border-border bg-card px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="font-ui text-[13px] text-muted-foreground"><strong className="font-semibold text-foreground">Doing it with Kinika.</strong> {agentTasks} task{agentTasks === 1 ? "" : "s"} on this plan would run with agents once you have seats.</p>
          <div className="flex items-center gap-3 whitespace-nowrap">
            <button onClick={() => setCollapsedPersist(false)} className="font-ui text-[13px] text-foreground underline">See which</button>
            <button onClick={() => navigate("/billing")} className="font-ui text-[13px] text-accent-foreground underline">Add seats</button>
          </div>
        </div>
      );
    }
    return (
      <section aria-labelledby="kteam-h" className="rounded-2xl border-2 border-primary bg-card p-5 md:p-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="font-ui text-[11px] uppercase tracking-[0.18em] text-accent-foreground">Kinika's team for this plan</span>
          <h2 id="kteam-h" className="font-display text-[22px] leading-tight">Kinika would run {agentTasks} of these tasks with agents. Your trial has no seats yet.</h2>
          <p className="font-ui text-[14px] leading-relaxed text-muted-foreground max-w-[64ch]">On the trial you do every task with Kinika. With seats, you press Set up on a task and Kinika staffs it: the right agent joins the team, works from your brand record in your voice, and you approve each result before it goes anywhere. Seats are how many agents can be on the team at once; credits are how much work they do.</p>
        </div>
        <RoleGrid roles={roles} agentBySlug={agentBySlug} estimates={estimates} onTeam={onTeam} />
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => navigate("/billing")} className="inline-flex items-center h-11 px-5 rounded-lg bg-primary text-primary-foreground font-ui text-[14px] font-medium">Add seats · from $20/month</button>
          <button onClick={() => setCollapsedPersist(true)} className="h-11 px-4 rounded-lg border border-border bg-card font-ui text-[14px]">I'll do them with Kinika for now</button>
          <span className="font-ui text-[12px] text-muted-foreground">Solo: 2 seats, Kinika staffs one role at a time. Startup: 5 seats.</span>
        </div>
      </section>
    );
  }

  // ── Paid: the roster, as a consequence of the plan ──
  const notYet = roles.filter((r) => !onTeam.has(r.slug));
  const short = !unlimited && roles.length > seats;
  return (
    <section aria-labelledby="kteam-h" className="rounded-2xl border border-border bg-card p-5 md:p-6 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <span className="font-ui text-[11px] uppercase tracking-[0.18em] text-muted-foreground inline-flex items-center gap-1.5"><Users size={11} /> Kinika's team for this plan</span>
          <h2 id="kteam-h" className="font-display text-[20px] leading-tight">
            {unlimited ? `${roles.length} role${roles.length === 1 ? "" : "s"} on this plan · ${activeHires.length} on the team` : `${activeHires.length} of ${seats} seat${seats === 1 ? "" : "s"} in use · ${roles.length} role${roles.length === 1 ? "" : "s"} on this plan`}
          </h2>
          <p className="font-ui text-[13px] text-muted-foreground max-w-[64ch]">{notYet.length === 0 ? "Everyone this plan needs is on the team. Press Set up on a task and Kinika runs it." : "Press Set up on a task and Kinika staffs it. A role joins the team the first time one of its tasks is set up."}</p>
        </div>
        <button onClick={() => navigate("/team")} className="font-ui text-[12px] underline text-muted-foreground">Kinika's team</button>
      </div>
      <RoleGrid roles={roles} agentBySlug={agentBySlug} estimates={estimates} onTeam={onTeam} />
      {short && (
        <p className="font-ui text-[12px] text-muted-foreground">
          {roles.length} roles for {seats} seat{seats === 1 ? "" : "s"}: Kinika staffs in plan order and tells you the moment a seat is needed. <button onClick={() => navigate("/billing")} className="underline">Add a seat</button>
        </p>
      )}
    </section>
  );
}

function RoleGrid({ roles, agentBySlug, estimates, onTeam }: {
  roles: ReturnType<typeof rolesForPlan>; agentBySlug: Map<string, Agent>; estimates: Record<string, number>; onTeam: Set<string>;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
      {roles.map((r) => {
        const a = agentBySlug.get(r.slug);
        const here = onTeam.has(r.slug);
        return (
          <div key={r.slug} className={cn("flex flex-col gap-1 p-3.5 rounded-xl border", here ? "border-[hsl(var(--brand-good))]/40 bg-[hsl(var(--brand-good-soft))]/40" : "border-border bg-muted/40")}>
            <span className="font-ui text-[14px] font-semibold">{a?.name ?? r.slug}</span>
            {a?.tagline && <span className="font-ui text-[12px] text-muted-foreground leading-relaxed">{a.tagline}</span>}
            <span className="font-ui text-[11px] uppercase tracking-[0.14em] text-muted-foreground mt-1.5">{here ? "Doing for you" : "Would do for you"}</span>
            <ul className="flex flex-col gap-1">
              {r.titles.slice(0, 4).map((t) => (
                <li key={t} className="font-ui text-[13px] leading-snug text-foreground flex gap-2"><span aria-hidden className="text-muted-foreground">·</span><span>{t}</span></li>
              ))}
              {r.titles.length > 4 && <li className="font-ui text-[12px] text-muted-foreground">and {r.titles.length - 4} more</li>}
            </ul>
            <span className="font-ui text-[12px] text-muted-foreground mt-1">{r.count} task{r.count === 1 ? "" : "s"}{estimates[r.slug] ? ` · about ${estimates[r.slug]} credits` : ""}</span>
            <span className={cn("font-ui text-[11px]", here ? "text-[hsl(var(--brand-good))]" : "text-muted-foreground")}>{here ? "on the team" : "joins when its first task is set up"}</span>
          </div>
        );
      })}
    </div>
  );
}

export default KinikaTeam;
