import { useEffect, useState } from 'react';
import { Crown, Loader2, Minus, Plus, ExternalLink, AlertTriangle, Check } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { getCreditPackages, type CreditPackage } from '@/services/stripeService';
import {
  getEntitlements, getSubscription, splitPackages, startPlanCheckout, openBillingPortal, setSeats, setCancelAtPeriodEnd, changePlan, isActiveStatus,
  type Entitlements, type Subscription,
} from '@/services/subscriptionService';

const money = (v: number) => `$${v % 1 === 0 ? v.toFixed(0) : v.toFixed(2)}`;
const limit = (n: number) => (n < 0 ? 'Unlimited' : String(n));

/**
 * "Your plan": what the founder is on, what it includes, seats they can add,
 * and the plans they can move to. Changes go through Stripe and come back via
 * the webhook; the panel refetches after each action.
 */
export function PlanPanel({ onChanged }: { onChanged?: () => void }) {
  const { user } = useAuth();
  const [ent, setEnt] = useState<Entitlements | null>(null);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    if (!user?.id) return;
    const [e, s, p] = await Promise.all([getEntitlements(user.id), getSubscription(user.id), getCreditPackages()]);
    setEnt(e);
    setSub(s);
    setPackages(p);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [user?.id]);

  if (!ent) return null;
  const { plans, seats } = splitPackages(packages);
  const agentSeat = seats.find((p) => p.addonKind === 'agent_seat');
  const memberSeat = seats.find((p) => p.addonKind === 'member_seat');
  const live = !!sub && isActiveStatus(sub.status);
  const current = plans.find((p) => p.slug === ent.plan_slug);

  const act = async (what: string, fn: () => Promise<{ success: boolean; error?: string }>) => {
    setBusy(what);
    const r = await fn();
    setBusy(null);
    if (!r.success) { toast({ title: r.error ?? 'Something went wrong', variant: 'destructive' }); return; }
    await load();
    onChanged?.();
  };

  const seatControl = (label: string, pkg: CreditPackage | undefined, value: number, key: 'agentSeats' | 'memberSeats') => {
    if (!pkg) return null;
    return (
      <div className="flex items-center justify-between gap-3 py-2 border-t border-border/60">
        <div>
          <p className="font-ui text-[13px] text-foreground">{label}</p>
          <p className="font-ui text-[11px] text-muted-foreground">{money(pkg.priceUsd)}/month each{pkg.monthlyCredits ? ` · +${pkg.monthlyCredits} credits/month` : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <button disabled={!!busy || value <= 0} onClick={() => act(key, () => setSeats({ [key]: value - 1 }))} className="w-7 h-7 rounded-md border border-border inline-flex items-center justify-center disabled:opacity-40" aria-label={`Remove ${label}`}><Minus size={12} /></button>
          <span className="font-ui text-[13px] tabular-nums w-5 text-center">{value}</span>
          <button disabled={!!busy || value >= 50} onClick={() => act(key, () => setSeats({ [key]: value + 1 }))} className="w-7 h-7 rounded-md border border-border inline-flex items-center justify-center disabled:opacity-40" aria-label={`Add ${label}`}><Plus size={12} /></button>
        </div>
      </div>
    );
  };

  return (
    <section className="rounded-xl border border-card-border bg-card/60 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Crown size={16} className="text-primary" />
            <h2 className="font-display text-xl text-foreground">{ent.plan_name}</h2>
            {sub?.status === 'past_due' && <span className="inline-flex items-center gap-1 text-[11px] font-ui text-destructive"><AlertTriangle size={11} /> payment failed</span>}
            {sub?.cancel_at_period_end && <span className="text-[11px] font-ui text-muted-foreground">ends {sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString() : 'at period end'}</span>}
          </div>
          <p className="font-ui text-[12px] text-muted-foreground mt-0.5">
            {live && current ? `${money(current.priceUsd)}/month · ${ent.monthly_credits.toLocaleString()} credits each month${ent.current_period_end ? ` · renews ${new Date(ent.current_period_end).toLocaleDateString()}` : ''}` : 'Free: one agent, one schedule, one tool. Pick a plan to grow the team.'}
          </p>
        </div>
        {live && (
          <div className="flex items-center gap-2">
            <button disabled={!!busy} onClick={() => act('portal', openBillingPortal)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-[12px] font-ui">
              {busy === 'portal' ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />} Invoices & payment
            </button>
            <button disabled={!!busy} onClick={() => act('cancel', () => setCancelAtPeriodEnd(!sub!.cancel_at_period_end))} className="text-[12px] font-ui text-muted-foreground hover:text-foreground">
              {sub!.cancel_at_period_end ? 'Keep my plan' : 'Cancel at period end'}
            </button>
          </div>
        )}
      </div>

      <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 font-ui text-[12px]">
        {([
          ['Agents', `${limit(ent.agents)}${ent.extra_agent_seats ? ` + ${ent.extra_agent_seats} seats` : ''}`],
          ['Schedules', limit(ent.automations)],
          ['Connected tools', limit(ent.connections)],
          ['Team members', `${limit(ent.members)}${ent.extra_member_seats ? ` + ${ent.extra_member_seats}` : ''}`],
          ['Code repositories', limit(ent.code_repos)],
          ['Autonomous publishing', ent.autonomous_publishing ? 'Yes' : 'Review first'],
          ['Enterprise unlocks', ent.enterprise ? 'Yes' : 'No'],
        ] as [string, string][]).map(([k, v]) => (
          <div key={k} className="rounded-lg bg-background/50 px-3 py-2"><dt className="text-muted-foreground">{k}</dt><dd className="text-foreground">{v}</dd></div>
        ))}
      </dl>

      {live && (
        <div>
          {seatControl('Extra agents', agentSeat, sub!.extra_agent_seats, 'agentSeats')}
          {seatControl('Extra team members', memberSeat, sub!.extra_member_seats, 'memberSeats')}
        </div>
      )}

      {plans.length > 0 && (
        <div>
          <p className="font-ui text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">{live ? 'Change plan' : 'Plans'}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {plans.map((p) => {
              const isCurrent = live && p.slug === ent.plan_slug;
              const lim = (p.limits ?? {}) as Record<string, number | boolean>;
              return (
                <div key={p.id} className={cn('rounded-lg border p-4 flex flex-col gap-2', isCurrent ? 'border-primary bg-primary/5' : 'border-border/70')}>
                  <div className="flex items-center justify-between">
                    <span className="font-display text-[16px] text-foreground">{p.name}</span>
                    {p.badge && <span className="font-ui text-[10px] uppercase tracking-wider text-primary">{p.badge}</span>}
                  </div>
                  <p className="font-ui text-[20px] text-foreground">{money(p.priceUsd)}<span className="text-[12px] text-muted-foreground">/mo</span></p>
                  <p className="font-ui text-[12px] text-muted-foreground">{p.monthlyCredits?.toLocaleString()} credits/month · {limit(Number(lim.agents ?? 0))} agents · {limit(Number(lim.automations ?? 0))} schedules</p>
                  {p.tagline && <p className="font-ui text-[12px] text-muted-foreground">{p.tagline}</p>}
                  <button
                    disabled={!!busy || isCurrent}
                    onClick={() => act(`plan-${p.id}`, async () => {
                      if (live) return changePlan(p.id);
                      await startPlanCheckout(p.id);
                      return { success: true };
                    })}
                    className={cn('mt-auto inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-ui font-medium disabled:opacity-60', isCurrent ? 'border border-primary text-primary' : 'bg-primary text-primary-foreground')}
                  >
                    {busy === `plan-${p.id}` ? <Loader2 size={12} className="animate-spin" /> : isCurrent ? <Check size={12} /> : null}
                    {isCurrent ? 'Current plan' : live ? 'Switch' : 'Choose'}
                  </button>
                </div>
              );
            })}
          </div>
          {live && <p className="font-ui text-[11px] text-muted-foreground mt-2">Switching is prorated by Stripe. New monthly credits start from your next renewal.</p>}
        </div>
      )}
    </section>
  );
}

export default PlanPanel;
