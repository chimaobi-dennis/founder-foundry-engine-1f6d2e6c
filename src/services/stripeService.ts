/**
 * stripeService.ts
 *
 * Frontend service for Stripe credit purchasing.
 * Handles: package listing, checkout session creation, purchase history.
 *
 * SECURITY: Credit amounts are NEVER sent from the frontend.
 * The edge function reads the package from the DB server-side.
 */

import { supabase } from '@/integrations/supabase/client';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  priceUsd: number;
  description: string | null;
  badge: string | null;
  active: boolean;
  sortOrder: number;
}

export interface CreditPurchase {
  id: string;
  packageId: string | null;
  creditsAmount: number;
  priceUsd: number;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  createdAt: string;
  metadata: Record<string, any> | null;
}

export interface CheckoutResult {
  sessionId: string;
  url: string;
  purchaseId: string;
}

// ═══════════════════════════════════════════════════════════════
// CREDIT PACKAGES
// ═══════════════════════════════════════════════════════════════

/**
 * Fetch all active credit packages, sorted by sort_order.
 */
export async function getCreditPackages(): Promise<CreditPackage[]> {
  const { data, error } = await (supabase as any)
    .from('credit_packages')
    .select('id, name, credits, price_usd, description, badge, active, sort_order')
    .eq('active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[StripeService] getCreditPackages error:', error.message);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    credits: Number(row.credits),
    priceUsd: Number(row.price_usd),
    description: row.description,
    badge: row.badge,
    active: row.active,
    sortOrder: row.sort_order,
  }));
}

// ═══════════════════════════════════════════════════════════════
// CHECKOUT SESSION
// ═══════════════════════════════════════════════════════════════

/**
 * Create a Stripe Checkout session for a credit package.
 * Redirects user to Stripe hosted checkout page.
 */
export async function createCheckoutSession(params: {
  packageId: string;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<CheckoutResult> {
  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    body: {
      packageId: params.packageId,
      successUrl: params.successUrl,
      cancelUrl: params.cancelUrl,
    },
  });

  if (error) {
    console.error('[StripeService] createCheckoutSession error:', error.message);
    throw new Error(error.message || 'Failed to create checkout session');
  }

  if (!data?.url) {
    throw new Error('No checkout URL returned');
  }

  return {
    sessionId: data.sessionId,
    url: data.url,
    purchaseId: data.purchaseId,
  };
}

/**
 * Create a checkout session and immediately redirect to Stripe.
 */
export async function redirectToCheckout(packageId: string): Promise<void> {
  const origin = window.location.origin;
  const result = await createCheckoutSession({
    packageId,
    successUrl: `${origin}/billing?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${origin}/billing?purchase=cancelled`,
  });

  window.location.href = result.url;
}

// ═══════════════════════════════════════════════════════════════
// PURCHASE HISTORY
// ═══════════════════════════════════════════════════════════════

/**
 * Get the current user's purchase history.
 */
export async function getPurchaseHistory(options?: {
  limit?: number;
  offset?: number;
}): Promise<CreditPurchase[]> {
  const limit = options?.limit ?? 20;
  const offset = options?.offset ?? 0;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await (supabase as any)
    .from('credit_purchases')
    .select('id, package_id, credits, amount_usd, status, metadata, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('[StripeService] getPurchaseHistory error:', error.message);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    packageId: row.package_id,
    creditsAmount: Number(row.credits),
    priceUsd: Number(row.amount_usd),
    status: row.status,
    createdAt: row.created_at,
    metadata: row.metadata,
  }));
}
