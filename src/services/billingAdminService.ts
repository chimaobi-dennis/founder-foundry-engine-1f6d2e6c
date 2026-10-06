/**
 * billingAdminService.ts
 *
 * Admin APIs for billing management.
 * Runs with the normal client; admin writes are allowed by the
 * "Admins ..." RLS policies and the is_admin()-gated RPCs
 * (20260702000000_remove_frontend_service_role.sql).
 *
 * Provides:
 *   - Credit package CRUD
 *   - Generation pricing CRUD
 *   - Platform settings CRUD
 *   - Manual credit grants
 *   - Billing analytics
 */

import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;

// ═══════════════════════════════════════════════════════════════
// CREDIT PACKAGE CRUD
// ═══════════════════════════════════════════════════════════════

export interface CreditPackageRow {
  id: string;
  name: string;
  credits: number;
  price_usd: number;
  description: string | null;
  badge: string | null;
  stripe_price_id: string | null;
  active: boolean;
  sort_order: number;
  created_at: string | null;
  updated_at: string | null;
}

export async function listCreditPackages(): Promise<CreditPackageRow[]> {
  const { data, error } = await db
    .from('credit_packages')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[BillingAdmin] listCreditPackages error:', error.message);
    return [];
  }
  return data ?? [];
}

export async function createCreditPackage(pkg: {
  name: string;
  credits: number;
  price_usd: number;
  description?: string;
  badge?: string;
  stripe_price_id?: string;
  sort_order?: number;
  active?: boolean;
}): Promise<CreditPackageRow | null> {
  const { data, error } = await db
    .from('credit_packages')
    .insert({
      name: pkg.name,
      credits: pkg.credits,
      price_usd: pkg.price_usd,
      description: pkg.description ?? null,
      badge: pkg.badge ?? null,
      stripe_price_id: pkg.stripe_price_id ?? null,
      sort_order: pkg.sort_order ?? 0,
      active: pkg.active ?? true,
    })
    .select('*')
    .single();

  if (error) {
    console.error('[BillingAdmin] createCreditPackage error:', error.message);
    return null;
  }
  return data;
}

export async function updateCreditPackage(
  id: string,
  updates: Partial<Omit<CreditPackageRow, 'id' | 'created_at'>>
): Promise<CreditPackageRow | null> {
  const { data, error } = await db
    .from('credit_packages')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    console.error('[BillingAdmin] updateCreditPackage error:', error.message);
    return null;
  }
  return data;
}

export async function deleteCreditPackage(id: string): Promise<boolean> {
  const { error } = await db
    .from('credit_packages')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[BillingAdmin] deleteCreditPackage error:', error.message);
    return false;
  }
  return true;
}

// ═══════════════════════════════════════════════════════════════
// GENERATION PRICING CRUD
// ═══════════════════════════════════════════════════════════════

export interface GenerationPricingRow {
  id: string;
  pricing_key: string;
  display_name: string;
  base_cost: number;
  model_multipliers: Record<string, number>;
  feature_multipliers: Record<string, number>;
  per_platform_cost: number;
  complexity_multipliers: Record<string, number>;
  is_active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export async function listGenerationPricing(): Promise<GenerationPricingRow[]> {
  const { data, error } = await db
    .from('ai_generation_pricing')
    .select('*')
    .order('pricing_key');

  if (error) {
    console.error('[BillingAdmin] listGenerationPricing error:', error.message);
    return [];
  }
  return data ?? [];
}

export async function updateGenerationPricing(
  id: string,
  updates: Partial<Omit<GenerationPricingRow, 'id' | 'created_at'>>
): Promise<GenerationPricingRow | null> {
  const { data, error } = await db
    .from('ai_generation_pricing')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    console.error('[BillingAdmin] updateGenerationPricing error:', error.message);
    return null;
  }
  return data;
}

export async function createGenerationPricing(pricing: {
  pricing_key: string;
  display_name: string;
  base_cost: number;
  per_platform_cost?: number;
  model_multipliers?: Record<string, number>;
  feature_multipliers?: Record<string, number>;
  complexity_multipliers?: Record<string, number>;
  description?: string;
}): Promise<GenerationPricingRow | null> {
  const { data, error } = await db
    .from('ai_generation_pricing')
    .insert({
      pricing_key: pricing.pricing_key,
      display_name: pricing.display_name,
      base_cost: pricing.base_cost,
      per_platform_cost: pricing.per_platform_cost ?? 1,
      model_multipliers: pricing.model_multipliers ?? {},
      feature_multipliers: pricing.feature_multipliers ?? {},
      complexity_multipliers: pricing.complexity_multipliers ?? { simple: 0.75, balanced: 1, advanced: 1.5, experimental: 2 },
      description: pricing.description ?? null,
    })
    .select('*')
    .single();

  if (error) {
    console.error('[BillingAdmin] createGenerationPricing error:', error.message);
    return null;
  }
  return data;
}

// ═══════════════════════════════════════════════════════════════
// PLATFORM SETTINGS CRUD (billing-specific)
// ═══════════════════════════════════════════════════════════════

export interface BillingSettings {
  stripe_live_mode: boolean;
  free_trial_credits: number;
  max_retry_count: number;
  default_generation_cost: number;
}

const BILLING_SETTINGS_KEY = 'billing';

const DEFAULT_BILLING_SETTINGS: BillingSettings = {
  stripe_live_mode: false,
  free_trial_credits: 10,
  max_retry_count: 3,
  default_generation_cost: 1,
};

export async function getBillingSettings(): Promise<BillingSettings> {
  const { data, error } = await db
    .from('platform_settings')
    .select('setting_value')
    .eq('setting_key', BILLING_SETTINGS_KEY)
    .maybeSingle();

  if (error || !data) {
    return { ...DEFAULT_BILLING_SETTINGS };
  }

  // Parse JSON string from setting_value
  let value: Partial<BillingSettings> = {};
  try {
    if (typeof data.setting_value === 'string') {
      value = JSON.parse(data.setting_value) as Partial<BillingSettings>;
    } else if (data.setting_value && typeof data.setting_value === 'object') {
      value = data.setting_value as Partial<BillingSettings>;
    }
  } catch (parseError) {
    console.error('[BillingAdmin] Failed to parse billing settings JSON:', parseError);
    return { ...DEFAULT_BILLING_SETTINGS };
  }

  return {
    stripe_live_mode: value.stripe_live_mode ?? DEFAULT_BILLING_SETTINGS.stripe_live_mode,
    free_trial_credits: value.free_trial_credits ?? DEFAULT_BILLING_SETTINGS.free_trial_credits,
    max_retry_count: value.max_retry_count ?? DEFAULT_BILLING_SETTINGS.max_retry_count,
    default_generation_cost: value.default_generation_cost ?? DEFAULT_BILLING_SETTINGS.default_generation_cost,
  };
}

export async function updateBillingSettings(
  updates: Partial<BillingSettings>
): Promise<BillingSettings | null> {
  const current = await getBillingSettings();
  const merged = { ...current, ...updates };

  const { data, error } = await db
    .from('platform_settings')
    .upsert(
      {
        setting_key: BILLING_SETTINGS_KEY,
        setting_value: merged,
        description: 'Billing and Stripe configuration',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'setting_key' }
    )
    .select('setting_value')
    .single();

  if (error) {
    console.error('[BillingAdmin] updateBillingSettings error:', error.message);
    return null;
  }
  return data?.setting_value as BillingSettings;
}

// ═══════════════════════════════════════════════════════════════
// MANUAL CREDIT GRANTS
// ═══════════════════════════════════════════════════════════════

/**
 * Grant free trial credits to the signed-in user after onboarding completion.
 *
 * Runs the `claim_free_trial_credits` RPC (SECURITY DEFINER): it reads
 * free_trial_credits from billing settings, grants them once as a topup, and
 * is idempotent per user. The amount and duplicate check live server-side, so
 * no privileged client is needed. `userId` must be the current user; the RPC
 * always grants to auth.uid().
 */
export async function grantFreeTrialCredits(userId: string): Promise<{ success: boolean; error?: string; amount?: number; transactionId?: string; balanceAfter?: number; alreadyGranted?: boolean }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }
    if (user.id !== userId) {
      return { success: false, error: 'Free trial credits can only be claimed by the signed-in user' };
    }

    const { data, error } = await db.rpc('claim_free_trial_credits');

    if (error) {
      console.error('[BillingAdmin] grantFreeTrialCredits error:', error.message);
      return { success: false, error: error.message };
    }

    const result = (data ?? {}) as Record<string, any>;
    if (!result.success) {
      return { success: false, error: result.error ?? 'Unknown error' };
    }

    if (result.already_granted) {
      console.log('[BillingAdmin] Free trial credits already granted to user:', userId);
      return { success: true, amount: 0, alreadyGranted: true };
    }

    const amount = result.credits_granted != null ? Number(result.credits_granted) : 0;
    if (amount > 0) {
      console.log('[BillingAdmin] Free trial credits granted:', { userId, amount, transactionId: result.transaction_id });
    }
    return {
      success: true,
      amount,
      transactionId: result.transaction_id,
      balanceAfter: result.balance_after != null ? Number(result.balance_after) : undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[BillingAdmin] grantFreeTrialCredits error:', message);
    return { success: false, error: message };
  }
}

export async function grantCreditsToUser(params: {
  userId: string;
  amount: number;
  type?: 'topup' | 'adjustment' | 'refund';
  description?: string;
  adminUserId?: string;
}): Promise<{ success: boolean; error?: string; transactionId?: string; balanceAfter?: number }> {

  const idempotencyKey = `admin_grant_${params.userId}_${Date.now()}`;

  const { data, error } = await db.rpc('grant_credits_admin', {
    p_user_id: params.userId,
    p_amount: params.amount,
    p_type: params.type || 'topup',
    p_description: params.description || 'Admin credit grant',
    p_admin_user_id: params.adminUserId || null,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    console.error('[BillingAdmin] grantCreditsToUser error:', error.message);
    return { success: false, error: error.message };
  }

  const result = data as Record<string, any>;
  return {
    success: result.success,
    error: result.error,
    transactionId: result.transaction_id,
    balanceAfter: result.balance_after != null ? Number(result.balance_after) : undefined,
  };
}

// ═══════════════════════════════════════════════════════════════
// BILLING ANALYTICS
// ═══════════════════════════════════════════════════════════════

export interface BillingAnalytics {
  totalRevenue: number;
  totalPurchases: number;
  completedPurchases: number;
  totalCreditsGranted: number;
  totalCreditsSpent: number;
  activeWallets: number;
  averageBalance: number;
}

export async function getBillingAnalytics(): Promise<BillingAnalytics> {

  const [purchaseStats, walletStats] = await Promise.all([
    // Purchase stats
    db
      .from('credit_purchases')
      .select('status, amount_usd, credits')
      .then(({ data }: any) => {
        const purchases = data || [];
        const completed = purchases.filter((p: any) => p.status === 'completed');
        return {
          totalPurchases: purchases.length,
          completedPurchases: completed.length,
          totalRevenue: completed.reduce((sum: number, p: any) => sum + Number(p.amount_usd || 0), 0),
          totalCreditsGranted: completed.reduce((sum: number, p: any) => sum + Number(p.credits || 0), 0),
        };
      }),

    // Wallet stats
    db
      .from('wallets')
      .select('balance, lifetime_spent')
      .then(({ data }: any) => {
        const wallets = data || [];
        const totalBalance = wallets.reduce((sum: number, w: any) => sum + Number(w.balance || 0), 0);
        const totalSpent = wallets.reduce((sum: number, w: any) => sum + Number(w.lifetime_spent || 0), 0);
        return {
          activeWallets: wallets.length,
          averageBalance: wallets.length > 0 ? Math.round((totalBalance / wallets.length) * 100) / 100 : 0,
          totalCreditsSpent: totalSpent,
        };
      }),
  ]);

  return {
    totalRevenue: purchaseStats.totalRevenue,
    totalPurchases: purchaseStats.totalPurchases,
    completedPurchases: purchaseStats.completedPurchases,
    totalCreditsGranted: purchaseStats.totalCreditsGranted,
    totalCreditsSpent: walletStats.totalCreditsSpent,
    activeWallets: walletStats.activeWallets,
    averageBalance: walletStats.averageBalance,
  };
}

/**
 * Get all purchases across all users (admin view).
 */
export async function getAllPurchases(options?: {
  limit?: number;
  offset?: number;
  status?: string;
}): Promise<any[]> {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  let query = db
    .from('credit_purchases')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (options?.status) {
    query = query.eq('status', options.status);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[BillingAdmin] getAllPurchases error:', error.message);
    return [];
  }
  return data ?? [];
}

/**
 * Get all wallets with user info (admin view).
 */
export async function getAllWallets(options?: {
  limit?: number;
  offset?: number;
}): Promise<any[]> {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const { data, error } = await db
    .from('wallets')
    .select('*')
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('[BillingAdmin] getAllWallets error:', error.message);
    return [];
  }
  return data ?? [];
}
