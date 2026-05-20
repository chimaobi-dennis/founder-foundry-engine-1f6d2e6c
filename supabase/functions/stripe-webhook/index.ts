import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Validate environment ──
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!stripeKey || !webhookSecret) {
      throw new Error("Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
    }

    // ── Verify Stripe signature (replay attack prevention) ──
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return new Response(
        JSON.stringify({ error: "Missing stripe-signature header" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.text();
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error("[stripe-webhook] Signature verification failed:", err.message);
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[stripe-webhook] Event received:", event.type, event.id);

    // ── Service client for DB mutations ──
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // ── Handle relevant events ──
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // Extract metadata set during checkout creation
        const purchaseId = session.metadata?.purchase_id;
        const userId = session.metadata?.user_id;
        const creditsAmount = parseFloat(session.metadata?.credits_amount || "0");

        if (!purchaseId || !userId || !creditsAmount) {
          console.error("[stripe-webhook] Missing metadata in checkout session:", {
            purchaseId,
            userId,
            creditsAmount,
          });
          // Acknowledge to Stripe to prevent retries for malformed events
          return new Response(JSON.stringify({ received: true, error: "Missing metadata" }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // ── Idempotency key: stripe event ID + purchase ID ──
        const fulfillmentKey = `stripe_${event.id}_${purchaseId}`;

        // ── Fulfill purchase (atomic, idempotent) ──
        const { data: result, error: fulfillError } = await supabaseAdmin.rpc(
          "fulfill_credit_purchase",
          {
            p_purchase_id: purchaseId,
            p_user_id: userId,
            p_credits_amount: creditsAmount,
            p_stripe_payment_intent_id: session.payment_intent as string,
          }
        );

        if (fulfillError) {
          console.error("[stripe-webhook] fulfill_credit_purchase error:", fulfillError.message);
          // Return 500 so Stripe retries
          return new Response(
            JSON.stringify({ error: "Fulfillment failed", detail: fulfillError.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const fulfillResult = result as Record<string, any>;
        console.log("[stripe-webhook] Purchase fulfilled:", {
          purchaseId,
          alreadyFulfilled: fulfillResult.already_fulfilled,
          creditsGranted: fulfillResult.credits_granted,
          balanceAfter: fulfillResult.balance_after,
        });

        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const purchaseId = session.metadata?.purchase_id;

        if (purchaseId) {
          await supabaseAdmin
            .from("credit_purchases")
            .update({
              status: "failed",
              metadata: { expired_event_id: event.id },
            })
            .eq("id", purchaseId)
            .eq("status", "pending"); // Only update if still pending

          console.log("[stripe-webhook] Purchase expired:", purchaseId);
        }
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = charge.payment_intent as string;

        if (paymentIntentId) {
          // Find the purchase by payment intent
          const { data: purchase } = await supabaseAdmin
            .from("credit_purchases")
            .select("id, user_id, credits")
            .eq("stripe_payment_intent_id", paymentIntentId)
            .eq("status", "completed")
            .maybeSingle();

          if (purchase) {
            // Mark purchase as refunded
            await supabaseAdmin
              .from("credit_purchases")
              .update({
                status: "refunded",
                metadata: { refunded_at: new Date().toISOString(), refund_event_id: event.id },
              })
              .eq("id", purchase.id);

            // Note: Credit deduction on refund is an admin decision.
            // We log the event but do NOT auto-deduct credits to avoid
            // negative balances if credits were already spent.
            console.log("[stripe-webhook] Charge refunded for purchase:", purchase.id);
          }
        }
        break;
      }

      default:
        console.log("[stripe-webhook] Unhandled event type:", event.type);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[stripe-webhook] Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
