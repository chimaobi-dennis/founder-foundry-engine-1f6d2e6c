/**
 * Subscription Service — the founder's plan, seats and entitlements.
 *
 * Entitlements come from the get_entitlements() RPC (the same function the
 * database triggers use), so the UI and the enforcement never disagree.
 */

import { supabase } from '@/integrations/supabase/client';
import { planAllows, effectiveLimit, isActiveStatus, FREE_LIMITS, type Entitlements, type LimitKind } from '@shared/plans';
import { createCheckoutSession, type CreditPackage } from './stripeService';

export { planAllows, effectiveLimit, isActiveStatus };
export type { Entitlements, LimitKind };

const db = supabase as any;

export interface Subscription {
  id: string;
  plan_slug: string;
  package_id: string | null;
  status: Entitlements['status'];
  monthly_credits: number;
  extra_agent_seats: number;
  extra_member_seats: number;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_subscription_id: string | null;
}

export const FREE_ENTITLEMENTS: Entitlements = {
  ...FREE_LIMITS,
  plan_slug: 'free',
  plan_name: 'Free',
  status: 'free',
  monthly_credits: 0,
  extra_agent_seats: 0,
  extra_member_seats: 0,
  current_period_end: null,
  cancel_at_period_end: false,
};

export async function getEntitlements(userId: string): Promise<Entitlements> {
  const { data, error } = await db.rpc('get_entitlements', { p_user_id: userId });
  if (error || !data) {
    if (error) console.error('[Subscription] get_entitlements error:', error.message);
    return FREE_ENTITLEMENTS;
  }
  return { ...FREE_ENTITLEMENTS, ...data } as Entitlements;
}

export async function getSubscription(userId: string): Promise<Subscription | null> {
  const { data } = await db
    .from('subscriptions')
    .select('id, plan_slug, package_id, status, monthly_credits, extra_agent_seats, extra_member_seats, current_period_start, current_period_end, cancel_at_period_end, stripe_subscription_id')
    .eq('user_id', userId)
    .in('status', ['trialing', 'active', 'past_due', 'incomplete'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

/** Plans and seats, from the same packages table the pricing modal reads. */
export function splitPackages(packages: CreditPackage[]): { plans: CreditPackage[]; seats: CreditPackage[]; topups: CreditPackage[] } {
  const plans = packages.filter((p) => p.isSubscription && p.priceUsd > 0 && !p.addonKind && p.billingInterval === 'month').sort((a, b) => a.priceUsd - b.priceUsd);
  const seats = packages.filter((p) => !!p.addonKind);
  const topups = packages.filter((p) => p.billingInterval === 'one_time' && p.priceUsd > 0).sort((a, b) => a.priceUsd - b.priceUsd);
  return { plans, seats, topups };
}

/** Start a Stripe Checkout for a plan (optionally with seats) and redirect. */
export async function startPlanCheckout(packageId: string, seats: { agentSeats?: number; memberSeats?: number } = {}): Promise<void> {
  const origin = window.location.origin;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in first');
  const res = await supabase.functions.invoke('create-checkout-session', {
    body: {
      packageId,
      agentSeats: seats.agentSeats ?? 0,
      memberSeats: seats.memberSeats ?? 0,
      successUrl: `${origin}/billing?subscription=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/billing?subscription=cancelled`,
    },
  });
  if (res.error) throw new Error(res.error.message || 'Could not start checkout');
  if (!res.data?.url) throw new Error(res.data?.error ?? 'No checkout URL returned');
  window.location.href = res.data.url;
}

async function manage(body: Record<string, unknown>): Promise<any> {
  const res = await supabase.functions.invoke('manage-subscription', { body: { ...body, returnUrl: `${window.location.origin}/billing` } });
  if (res.error) {
    // The function returns JSON on errors; surface it.
    let msg = res.error.message;
    try {
      const ctx = (res.error as any).context;
      if (ctx && typeof ctx.json === 'function') msg = (await ctx.json())?.error ?? msg;
    } catch { /* keep message */ }
    return { success: false, error: msg };
  }
  return res.data ?? { success: false, error: 'No response' };
}

export async function openBillingPortal(): Promise<{ success: boolean; error?: string }> {
  const r = await manage({ action: 'portal' });
  if (r.success && r.url) {
    window.location.href = r.url;
    return { success: true };
  }
  return { success: false, error: r.error ?? 'Could not open the billing portal' };
}

export async function setSeats(seats: { agentSeats?: number; memberSeats?: number }): Promise<{ success: boolean; error?: string }> {
  return manage({ action: 'set_seats', ...seats });
}

export async function setCancelAtPeriodEnd(cancel: boolean): Promise<{ success: boolean; error?: string; current_period_end?: string }> {
  return manage({ action: cancel ? 'cancel' : 'resume' });
}

export async function changePlan(packageId: string): Promise<{ success: boolean; error?: string }> {
  return manage({ action: 'change_plan', packageId });
}

/** After the Stripe success redirect: mirror the subscription now rather than waiting for the webhook. */
export async function syncCheckoutSession(sessionId: string): Promise<{ success: boolean; error?: string; status?: string; plan?: string | null }> {
  return manage({ action: 'sync_checkout', sessionId });
}

/** Friendly reading of a PLAN_LIMIT database error. */
export function planLimitMessage(err: unknown): string | null {
  const msg = typeof err === 'string' ? err : (err as any)?.message ?? '';
  const m = msg.match(/PLAN_LIMIT:\s*(.+?)(?:\n|$)/);
  return m ? `${m[1].trim()}.` : null;
}

// Legacy top-up path still goes through the one-time checkout.
export { createCheckoutSession };
