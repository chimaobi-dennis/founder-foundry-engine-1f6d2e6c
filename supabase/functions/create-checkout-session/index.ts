import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // ── CORS preflight ──
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Validate Stripe key ──
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // ── Authenticate user via JWT ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Parse request ──
    const { packageId, successUrl, cancelUrl, agentSeats = 0, memberSeats = 0 } = await req.json();

    if (!packageId) {
      return new Response(
        JSON.stringify({ error: "packageId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Service client for DB ops ──
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // ── Fetch credit package (server-side — NEVER trust frontend amounts) ──
    const { data: pkg, error: pkgError } = await supabaseAdmin
      .from("credit_packages")
      .select("*")
      .eq("id", packageId)
      .eq("active", true)
      .single();

    if (pkgError || !pkg) {
      return new Response(
        JSON.stringify({ error: "Credit package not found or inactive" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Initialize Stripe ──
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // ── Get or create Stripe customer ──
    let stripeCustomerId: string;

    const { data: existingCustomer } = await supabaseAdmin
      .from("stripe_customers")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingCustomer?.stripe_customer_id) {
      stripeCustomerId = existingCustomer.stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });
      stripeCustomerId = customer.id;

      await supabaseAdmin
        .from("stripe_customers")
        .upsert({
          user_id: user.id,
          stripe_customer_id: stripeCustomerId,
        }, { onConflict: "user_id" });
    }

    // ── Subscriptions: plans and seats bill monthly through Stripe ──
    if (pkg.billing_interval === "month" && pkg.price_usd > 0 && !pkg.addon_kind) {
      const origin = successUrl ? new URL(successUrl).origin : req.headers.get("origin") || "https://app.kinika.co";
      const { data: live } = await supabaseAdmin
        .from("subscriptions")
        .select("id, status, stripe_subscription_id")
        .eq("user_id", user.id)
        .in("status", ["trialing", "active", "past_due"])
        .maybeSingle();
      if (live?.stripe_subscription_id) {
        return new Response(
          JSON.stringify({ error: "You already have a plan. Change it from Billing → Manage plan." }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const { data: addons } = await supabaseAdmin.from("credit_packages").select("id, name, price_usd, addon_kind, monthly_credits").eq("active", true).not("addon_kind", "is", null);
      const seatLine = (kind: string, qty: number) => {
        const a = (addons ?? []).find((x: any) => x.addon_kind === kind);
        if (!a || qty <= 0) return null;
        return {
          price_data: { currency: "usd", recurring: { interval: "month" }, product_data: { name: a.name, metadata: { package_id: a.id, addon_kind: kind } }, unit_amount: Math.round(a.price_usd * 100) },
          quantity: Math.min(50, Math.floor(qty)),
        };
      };
      const lineItems = [
        { price_data: { currency: "usd", recurring: { interval: "month" }, product_data: { name: `Kinika ${pkg.name}`, description: pkg.description || undefined, metadata: { package_id: pkg.id, plan_slug: pkg.slug } }, unit_amount: Math.round(pkg.price_usd * 100) }, quantity: 1 },
        seatLine("agent_seat", Number(agentSeats)),
        seatLine("member_seat", Number(memberSeats)),
      ].filter(Boolean);

      const session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        mode: "subscription",
        line_items: lineItems as any,
        allow_promotion_codes: true,
        subscription_data: {
          metadata: { user_id: user.id, package_id: pkg.id, plan_slug: pkg.slug ?? "", agent_seats: String(agentSeats || 0), member_seats: String(memberSeats || 0) },
        },
        metadata: { kind: "subscription", user_id: user.id, package_id: pkg.id, plan_slug: pkg.slug ?? "" },
        success_url: successUrl || `${origin}/billing?subscription=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl || `${origin}/billing?subscription=cancelled`,
      });
      return new Response(
        JSON.stringify({ sessionId: session.id, url: session.url, kind: "subscription" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (pkg.addon_kind) {
      return new Response(
        JSON.stringify({ error: "Seats are added from Billing → Manage plan once you have a plan." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Create pending purchase record ──
    const { data: purchase, error: purchaseError } = await supabaseAdmin
      .from("credit_purchases")
      .insert({
        user_id: user.id,
        package_id: pkg.id,
        credits: pkg.credits,
        amount_usd: pkg.price_usd,
        status: "pending",
        metadata: { stripe_customer_id: stripeCustomerId, package_name: pkg.name },
      })
      .select("id")
      .single();

    if (purchaseError || !purchase) {
      throw new Error("Failed to create purchase record: " + purchaseError?.message);
    }

    // ── Build origin for redirect URLs ──
    const origin = successUrl
      ? new URL(successUrl).origin
      : req.headers.get("origin") || "https://app.kinika.co";

    // ── Create Stripe Checkout Session ──
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${pkg.name} — ${pkg.credits} Credits`,
              description: pkg.description || `${pkg.credits} AI generation credits`,
            },
            unit_amount: Math.round(pkg.price_usd * 100), // cents
          },
          quantity: 1,
        },
      ],
      metadata: {
        purchase_id: purchase.id,
        user_id: user.id,
        package_id: pkg.id,
        credits_amount: pkg.credits.toString(),  // used by webhook to fulfill
      },
      success_url: successUrl || `${origin}/billing?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${origin}/billing?purchase=cancelled`,
    });

    // ── Update purchase with session ID ──
    await supabaseAdmin
      .from("credit_purchases")
      .update({
        stripe_session_id: session.id,
      })
      .eq("id", purchase.id);

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        url: session.url,
        purchaseId: purchase.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[create-checkout-session] Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
