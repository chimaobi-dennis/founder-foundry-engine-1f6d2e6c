/**
 * manage-subscription — changes to a live plan, by the owner.
 *
 *   { action: "portal" }                             → Stripe billing portal URL (payment method, invoices, cancel)
 *   { action: "set_seats", agentSeats?, memberSeats? } → change seat quantities with proration
 *   { action: "cancel" } / { action: "resume" }      → cancel at period end / undo
 *   { action: "change_plan", packageId }             → switch plan item, prorated
 *
 * The subscriptions table is updated by the webhook after Stripe confirms.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { corsHeaders, json } from "../_shared/cors.ts";
import { syncSubscription, grantForPeriod } from "../_shared/stripeSync.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "POST only" }, 405);

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) return json({ success: false, error: "STRIPE_SECRET_KEY is not configured" }, 500);
  const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const user = (await userClient.auth.getUser()).data.user;
  if (!user) return json({ success: false, error: "Unauthorized" }, 401);
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  let body: { action?: string; agentSeats?: number; memberSeats?: number; packageId?: string; returnUrl?: string; sessionId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "Invalid JSON body" }, 400);
  }

  const { data: sub } = await admin
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .in("status", ["trialing", "active", "past_due", "incomplete"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const origin = body.returnUrl ? new URL(body.returnUrl).origin : req.headers.get("origin") || "https://app.kinika.co";

  try {
    if (body.action === "sync_checkout") {
      // The success redirect: confirm the session belongs to this user, then
      // mirror the subscription and grant credits (idempotent) without
      // waiting for the webhook.
      if (!body.sessionId) return json({ success: false, error: "sessionId is required" }, 400);
      const session = await stripe.checkout.sessions.retrieve(body.sessionId);
      if (session.metadata?.user_id !== user.id) return json({ success: false, error: "Not your checkout session" }, 403);
      if (session.mode !== "subscription" || !session.subscription) return json({ success: true, kind: session.mode });
      const stripeSubFull = await stripe.subscriptions.retrieve(session.subscription as string, { expand: ["items.data.price.product"] });
      const saved = await syncSubscription(admin, stripeSubFull, user.id);
      let grant: unknown = null;
      if (saved && ["active", "trialing"].includes(stripeSubFull.status)) grant = await grantForPeriod(admin, saved.id, saved.current_period_start);
      return json({ success: true, status: stripeSubFull.status, plan: stripeSubFull.metadata?.plan_slug ?? null, grant });
    }

    if (body.action === "portal") {
      const customerId = sub?.stripe_customer_id ?? (await admin.from("stripe_customers").select("stripe_customer_id").eq("user_id", user.id).maybeSingle()).data?.stripe_customer_id;
      if (!customerId) return json({ success: false, error: "No billing account yet. Pick a plan first." }, 404);
      const portal = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: body.returnUrl || `${origin}/billing` });
      return json({ success: true, url: portal.url });
    }

    if (!sub?.stripe_subscription_id) return json({ success: false, error: "No active plan." }, 404);
    const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id, { expand: ["items.data.price.product"] });
    const itemOf = (kind: "agent_seat" | "member_seat" | "plan") =>
      stripeSub.items.data.find((it: Stripe.SubscriptionItem) => {
        const md = ((it.price.product as any)?.metadata ?? {}) as Record<string, string>;
        return kind === "plan" ? !md.addon_kind : md.addon_kind === kind;
      });

    if (body.action === "set_seats") {
      const { data: addons } = await admin.from("credit_packages").select("id, name, price_usd, addon_kind").eq("active", true).not("addon_kind", "is", null);
      const items: Stripe.SubscriptionUpdateParams.Item[] = [];
      const want: Array<["agent_seat" | "member_seat", number | undefined]> = [["agent_seat", body.agentSeats], ["member_seat", body.memberSeats]];
      for (const [kind, qtyRaw] of want) {
        if (qtyRaw == null) continue;
        const qty = Math.max(0, Math.min(50, Math.floor(Number(qtyRaw))));
        const existing = itemOf(kind);
        if (existing) {
          items.push(qty === 0 ? { id: existing.id, deleted: true } : { id: existing.id, quantity: qty });
        } else if (qty > 0) {
          const a = (addons ?? []).find((x: any) => x.addon_kind === kind);
          if (!a) return json({ success: false, error: `No ${kind} package configured.` }, 500);
          items.push({
            price_data: { currency: "usd", recurring: { interval: "month" }, product: undefined as any, product_data: { name: a.name, metadata: { package_id: a.id, addon_kind: kind } }, unit_amount: Math.round(a.price_usd * 100) } as any,
            quantity: qty,
          });
        }
      }
      if (!items.length) return json({ success: true, unchanged: true });
      const updated = await stripe.subscriptions.update(sub.stripe_subscription_id, {
        items,
        proration_behavior: "create_prorations",
        metadata: { ...stripeSub.metadata, agent_seats: String(body.agentSeats ?? stripeSub.metadata?.agent_seats ?? 0), member_seats: String(body.memberSeats ?? stripeSub.metadata?.member_seats ?? 0) },
      });
      // Reflect immediately; the webhook confirms shortly after.
      await admin.from("subscriptions").update({ extra_agent_seats: body.agentSeats ?? sub.extra_agent_seats, extra_member_seats: body.memberSeats ?? sub.extra_member_seats }).eq("id", sub.id);
      return json({ success: true, status: updated.status });
    }

    if (body.action === "cancel" || body.action === "resume") {
      const updated = await stripe.subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: body.action === "cancel" });
      await admin.from("subscriptions").update({ cancel_at_period_end: updated.cancel_at_period_end }).eq("id", sub.id);
      return json({ success: true, cancel_at_period_end: updated.cancel_at_period_end, current_period_end: new Date(updated.current_period_end * 1000).toISOString() });
    }

    if (body.action === "change_plan") {
      if (!body.packageId) return json({ success: false, error: "packageId is required" }, 400);
      const { data: pkg } = await admin.from("credit_packages").select("*").eq("id", body.packageId).eq("active", true).eq("billing_interval", "month").is("addon_kind", null).maybeSingle();
      if (!pkg) return json({ success: false, error: "Plan not found" }, 404);
      const planItem = itemOf("plan");
      if (!planItem) return json({ success: false, error: "Could not find the plan line on the subscription" }, 500);
      const updated = await stripe.subscriptions.update(sub.stripe_subscription_id, {
        items: [{
          id: planItem.id,
          price_data: { currency: "usd", recurring: { interval: "month" }, product_data: { name: `Kinika ${pkg.name}`, metadata: { package_id: pkg.id, plan_slug: pkg.slug } }, unit_amount: Math.round(pkg.price_usd * 100) } as any,
        }],
        proration_behavior: "create_prorations",
        metadata: { ...stripeSub.metadata, package_id: pkg.id, plan_slug: pkg.slug ?? "" },
      });
      await admin.from("subscriptions").update({ package_id: pkg.id, plan_slug: pkg.slug, monthly_credits: pkg.monthly_credits ?? 0 }).eq("id", sub.id);
      return json({ success: true, status: updated.status, plan: pkg.slug });
    }

    return json({ success: false, error: `Unknown action ${body.action}` }, 400);
  } catch (e) {
    const msg = (e as any)?.message ?? String(e);
    console.error("[manage-subscription]", msg);
    return json({ success: false, error: msg }, 502);
  }
});
