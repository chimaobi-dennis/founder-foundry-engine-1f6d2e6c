/**
 * Mirror a Stripe subscription into the subscriptions table and grant the
 * period's credits once. Used by the webhook (the normal path) and by
 * manage-subscription's sync_checkout (the success redirect), so a founder
 * who just paid sees their plan even if the webhook is delayed.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import type Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

export interface SyncedSubscription {
  id: string;
  current_period_start: string;
  status: string;
}

export async function syncSubscription(admin: SupabaseClient, sub: Stripe.Subscription, userIdHint?: string): Promise<SyncedSubscription | null> {
  const md = sub.metadata ?? {};
  const userId = md.user_id || userIdHint;
  if (!userId) {
    console.error("[stripeSync] subscription without user_id metadata:", sub.id);
    return null;
  }
  let agentSeats = 0;
  let memberSeats = 0;
  let planPackageId: string | null = md.package_id || null;
  let planSlug: string = md.plan_slug || "";
  for (const item of sub.items.data) {
    // product metadata is present when items.data.price.product was expanded
    const pm = ((item.price.product as any)?.metadata ?? {}) as Record<string, string>;
    const kind = pm.addon_kind;
    if (kind === "agent_seat") agentSeats += item.quantity ?? 0;
    else if (kind === "member_seat") memberSeats += item.quantity ?? 0;
    else if (pm.package_id) {
      planPackageId = pm.package_id;
      planSlug = pm.plan_slug || planSlug;
    }
  }
  if (!agentSeats && md.agent_seats) agentSeats = Number(md.agent_seats) || 0;
  if (!memberSeats && md.member_seats) memberSeats = Number(md.member_seats) || 0;

  const { data: pkg } = planPackageId
    ? await admin.from("credit_packages").select("id, slug, monthly_credits").eq("id", planPackageId).maybeSingle()
    : await admin.from("credit_packages").select("id, slug, monthly_credits").eq("slug", planSlug).maybeSingle();

  const status = ["trialing", "active", "past_due", "canceled", "incomplete", "unpaid"].includes(sub.status) ? sub.status : "incomplete";
  const row = {
    user_id: userId,
    package_id: pkg?.id ?? null,
    plan_slug: pkg?.slug ?? planSlug ?? "unknown",
    stripe_subscription_id: sub.id,
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : (sub.customer as any)?.id ?? null,
    status,
    monthly_credits: pkg?.monthly_credits ?? 0,
    extra_agent_seats: agentSeats,
    extra_member_seats: memberSeats,
    current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
    current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
    cancel_at_period_end: !!sub.cancel_at_period_end,
  };

  // The partial unique index allows one live subscription per founder; an
  // older one still marked live must step aside for the new one.
  if (["trialing", "active", "past_due", "incomplete"].includes(status)) {
    await admin
      .from("subscriptions")
      .update({ status: "canceled" })
      .eq("user_id", userId)
      .neq("stripe_subscription_id", sub.id)
      .in("status", ["trialing", "active", "past_due", "incomplete"]);
  }

  const { data: saved, error } = await admin
    .from("subscriptions")
    .upsert(row, { onConflict: "stripe_subscription_id" })
    .select("id, current_period_start, status")
    .single();
  if (error) {
    console.error("[stripeSync] subscription upsert failed:", error.message);
    return null;
  }
  return saved as SyncedSubscription;
}

export async function grantForPeriod(admin: SupabaseClient, subscriptionRowId: string, periodStart: string): Promise<unknown> {
  const { data, error } = await admin.rpc("grant_subscription_credits", { p_subscription_id: subscriptionRowId, p_period_start: periodStart });
  if (error) {
    console.error("[stripeSync] grant_subscription_credits failed:", error.message);
    return null;
  }
  return data;
}
