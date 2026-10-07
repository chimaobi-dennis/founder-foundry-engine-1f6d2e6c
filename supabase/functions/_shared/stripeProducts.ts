/**
 * One Stripe Product per package, created on first use and remembered on
 * credit_packages.stripe_product_id. Subscription item updates require a
 * product id (inline product_data is only accepted by Checkout), and having
 * a stable product also lets the webhook recognise plan and seat lines by
 * the product's metadata.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import type Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

export interface PackageRow {
  id: string;
  name: string;
  slug: string | null;
  description?: string | null;
  price_usd: number;
  addon_kind?: string | null;
  stripe_product_id?: string | null;
}

export async function ensureStripeProduct(stripe: Stripe, admin: SupabaseClient, pkg: PackageRow): Promise<string> {
  const metadata: Record<string, string> = { package_id: pkg.id, plan_slug: pkg.slug ?? "", addon_kind: pkg.addon_kind ?? "" };
  if (pkg.stripe_product_id) {
    try {
      const existing = await stripe.products.retrieve(pkg.stripe_product_id);
      if (existing && !existing.deleted) {
        // Keep metadata current; cheap and idempotent.
        if (existing.metadata?.package_id !== pkg.id || existing.metadata?.addon_kind !== metadata.addon_kind) {
          await stripe.products.update(pkg.stripe_product_id, { metadata });
        }
        return pkg.stripe_product_id;
      }
    } catch {
      // fall through and create a fresh one (e.g. test vs live mode mismatch)
    }
  }
  const created = await stripe.products.create({
    name: pkg.addon_kind ? pkg.name : `Kinika ${pkg.name}`,
    description: pkg.description || undefined,
    metadata,
  });
  await admin.from("credit_packages").update({ stripe_product_id: created.id }).eq("id", pkg.id);
  return created.id;
}

/** A recurring monthly price_data line for a package, by product id. */
export function monthlyPriceData(productId: string, priceUsd: number) {
  return { currency: "usd", product: productId, recurring: { interval: "month" as const }, unit_amount: Math.round(priceUsd * 100) };
}
